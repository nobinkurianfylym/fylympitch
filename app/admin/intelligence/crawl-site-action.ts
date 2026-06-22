"use server";
// app/admin/intelligence/crawl-site-action.ts
// Manual targeted crawl: Firecrawl → AI extraction → admin_review_queue
// Mirrors the edge function pipeline but runs inline for a single URL.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Keys ──────────────────────────────────────────────────────
const FIRECRAWL_KEY   = process.env.FIRECRAWL_API_KEY ?? "fc-ed8b65a125ac4ccab6b3d9ad65b750bb";
const CEREBRAS_KEY    = process.env.CEREBERAS_API;          // typo matches CF dashboard
const GROQ_KEY        = process.env.GROQ_API_KEY;
const OPENAI_KEY      = process.env.OPENAI_API_KEY;

const CEREBRAS_URL   = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "gpt-oss-120b";
const GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL     = "llama-3.1-8b-instant";
const OPENAI_URL     = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL   = "gpt-4o-mini";

// ── Types ─────────────────────────────────────────────────────
export type GatherResult =
  | {
      success: true;
      title:        string;
      organization: string;
      opp_type:     string;
      confidence:   number;
      status:       "queued" | "auto_approved";
      queueId?:     string;
    }
  | {
      success: false;
      error: string;
      stage: "auth" | "scrape" | "extract" | "save";
    };

// ── Admin guard ───────────────────────────────────────────────
async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase: null };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Not admin" as const, supabase: null };
  return { error: null, supabase };
}

// ── Firecrawl scrape ──────────────────────────────────────────
async function scrapeUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${FIRECRAWL_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats:         ["markdown"],
        onlyMainContent: true,
        timeout:         20000,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.markdown ?? null;
  } catch {
    return null;
  }
}

// ── AI waterfall ──────────────────────────────────────────────
async function callLLM(
  system: string,
  user: string,
  maxTokens = 1400,
): Promise<{ text: string; provider: string }> {

  if (CEREBRAS_KEY) {
    try {
      const res = await fetch(CEREBRAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CEREBRAS_KEY}` },
        body: JSON.stringify({
          model: CEREBRAS_MODEL, max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (res.ok) {
        const d = await res.json();
        const text = d.choices?.[0]?.message?.content ?? "";
        if (text) return { text, provider: "cerebras" };
      }
    } catch {}
  }

  if (GROQ_KEY) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: GROQ_MODEL, max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (res.ok) {
        const d = await res.json();
        const text = d.choices?.[0]?.message?.content ?? "";
        if (text) return { text, provider: "groq" };
      }
    } catch {}
  }

  if (OPENAI_KEY) {
    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: OPENAI_MODEL, max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (res.ok) {
        const d = await res.json();
        const text = d.choices?.[0]?.message?.content ?? "";
        if (text) return { text, provider: "openai" };
      }
    } catch {}
  }

  return { text: "", provider: "none" };
}

// ── Extraction system prompt (mirrors edge function) ──────────
const EXTRACTION_SYSTEM = `You are a film funding data extraction specialist for PITCH.FYLYM.

Extract structured funding opportunity data from the provided webpage content.
Respond ONLY with a single valid JSON object — no markdown fences, no preamble, no explanation.

TAXONOMY — use ONLY these exact values:

opp_type: lab | residency | mentorship | grant | fund | writing_fellowship |
          pitch_forum | co_production | market |
          crowdfunding | donation | fiscal_sponsorship | seed_funding | community_funding |
          tax_incentive | cash_rebate | production_rebate | regional_incentive | location_incentive |
          investor | angel_investor | venture_capital | gap_financing |
          brand_integration | product_placement | sponsor | private_fund |
          producer | co_producer | production_company | studio |
          post_production_grant | post_production_fund | finishing_fund |
          sales_agent | world_sales | broadcaster | streamer | pre_sale | content_buyer | music_rights |
          film_festival | distribution | theatrical_distribution | ott_distribution |
          tv_distribution | digital_aggregator | educational_distribution | airline_distribution

formats: feature | short | documentary | series | animation
stages: development | pre_production | production | post_production | completed
career_stages: debut | second_film | established | veteran
match_weight: high | medium | low
submission_status: open | closing_soon | closed | archived | cancelled
gender_focus: women | non_binary | women_and_non_binary  (or null)

RULES:
- genres: standard film genres (Drama, Documentary, Comedy, Thriller, Horror, Animation, etc.)
- languages: ISO language names (English, French, Arabic, etc.)
- country: full country name, or null for worldwide
- deadline: ISO date YYYY-MM-DD, or null if rolling/no fixed date
- max_award_usd: numeric USD amount, or null
- confidence: 0-100. Score LOWER if page is generic, deadline missing, or award absent.
  Score 0-40 if the page is NOT a film funding opportunity at all.
- Extract only the PRIMARY / most prominent program if multiple exist on one page

JSON schema (respond with ONLY this object):
{
  "title": string,
  "organization_name": string,
  "opp_type": string,
  "description": string,
  "country": string|null,
  "region": string|null,
  "genres": string[],
  "formats": string[],
  "stages": string[],
  "languages": string[],
  "career_stages": string[],
  "max_award_usd": number|null,
  "min_budget_usd": number|null,
  "max_budget_usd": number|null,
  "deadline": string|null,
  "deadline_note": string|null,
  "app_link": string|null,
  "url": string,
  "gender_focus": string|null,
  "copro_required": boolean,
  "festival_affiliated": boolean,
  "match_weight": string,
  "is_active": boolean,
  "submission_status": string,
  "confidence": number,
  "confidence_notes": string
}`;

// ── Main action ───────────────────────────────────────────────
export async function gatherIntelligenceFromUrl(
  url: string,
): Promise<GatherResult> {
  // 1. Auth
  const { error: authErr, supabase } = await assertAdmin();
  if (authErr || !supabase) return { success: false, error: authErr!, stage: "auth" };

  // 2. Scrape
  const markdown = await scrapeUrl(url);
  if (!markdown) {
    return {
      success: false,
      error: "Firecrawl could not retrieve the page. Check the URL is publicly accessible.",
      stage: "scrape",
    };
  }

  // 3. Extract
  const userPrompt = `URL: ${url}\n\n--- WEBPAGE CONTENT ---\n${markdown.slice(0, 14000)}`;
  const { text } = await callLLM(EXTRACTION_SYSTEM, userPrompt, 1400);

  if (!text) {
    return { success: false, error: "AI extraction failed — all providers returned empty.", stage: "extract" };
  }

  let extracted: Record<string, unknown>;
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    extracted = JSON.parse(clean);
  } catch {
    return { success: false, error: "AI returned malformed JSON — could not parse.", stage: "extract" };
  }

  const confidence = Math.max(0, Math.min(100, Number(extracted.confidence ?? 0)));

  if (confidence < 45) {
    return {
      success: false,
      error: `Low confidence (${confidence}%): "${String(extracted.confidence_notes ?? "Page does not appear to contain a film funding opportunity.")}". Try a more specific URL.`,
      stage: "extract",
    };
  }

  // 4. Save — queue for review (admin is right here to approve/reject)
  const { data: inserted, error: insertErr } = await supabase
    .from("admin_review_queue")
    .insert({
      source_url:     url,
      extracted_data: extracted,
      confidence:     confidence,
      status:         "pending",
      // run_id and source_id intentionally null for manual crawls
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return {
      success: false,
      error: `Could not save to review queue: ${insertErr?.message ?? "unknown"}`,
      stage: "save",
    };
  }

  revalidatePath("/admin/intelligence");

  return {
    success:      true,
    title:        String(extracted.title ?? "Untitled"),
    organization: String(extracted.organization_name ?? "—"),
    opp_type:     String(extracted.opp_type ?? "grant"),
    confidence,
    status:       "queued",
    queueId:      inserted.id,
  };
}
