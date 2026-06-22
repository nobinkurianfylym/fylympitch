"use server";
// app/admin/intelligence/crawl-site-action.ts
// Manual targeted crawl: Firecrawl → AI extraction → admin_review_queue
// All constants are defined INSIDE the action to avoid Worker startup CPU cost.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types (these are erased at runtime — zero startup cost) ───
export type GatherResult =
  | {
      success:      true;
      title:        string;
      organization: string;
      opp_type:     string;
      confidence:   number;
      status:       "queued";
      queueId:      string;
    }
  | {
      success: false;
      error:   string;
      stage:   "auth" | "scrape" | "extract" | "save";
    };

// ── Main action ───────────────────────────────────────────────
export async function gatherIntelligenceFromUrl(
  url: string,
): Promise<GatherResult> {

  // All keys + constants defined here — never at module level.
  const FIRECRAWL_KEY  = process.env.FIRECRAWL_API_KEY ?? "fc-ed8b65a125ac4ccab6b3d9ad65b750bb";
  const CEREBRAS_KEY   = process.env.CEREBERAS_API;
  const GROQ_KEY       = process.env.GROQ_API_KEY;
  const OPENAI_KEY     = process.env.OPENAI_API_KEY;

  // ── 1. Auth ─────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated", stage: "auth" };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { success: false, error: "Not admin", stage: "auth" };

  // ── 2. Scrape ────────────────────────────────────────────────
  let markdown: string | null = null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method:  "POST",
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
    if (res.ok) {
      const d = await res.json();
      markdown = d?.data?.markdown ?? null;
    }
  } catch {}

  if (!markdown) {
    return {
      success: false,
      error:   "Firecrawl could not retrieve the page. Check the URL is publicly accessible.",
      stage:   "scrape",
    };
  }

  // ── 3. Extract ───────────────────────────────────────────────
  const systemPrompt =
    "You are a film funding data extraction specialist for PITCH.FYLYM.\n" +
    "Extract structured funding opportunity data from the provided webpage content.\n" +
    "Respond ONLY with a single valid JSON object — no markdown fences, no preamble.\n\n" +
    "opp_type: lab|residency|mentorship|grant|fund|writing_fellowship|pitch_forum|" +
    "co_production|market|crowdfunding|donation|fiscal_sponsorship|seed_funding|" +
    "community_funding|tax_incentive|cash_rebate|production_rebate|regional_incentive|" +
    "location_incentive|investor|angel_investor|venture_capital|gap_financing|" +
    "brand_integration|product_placement|sponsor|private_fund|producer|co_producer|" +
    "production_company|studio|post_production_grant|post_production_fund|finishing_fund|" +
    "sales_agent|world_sales|broadcaster|streamer|pre_sale|content_buyer|music_rights|" +
    "film_festival|distribution|theatrical_distribution|ott_distribution|" +
    "tv_distribution|digital_aggregator|educational_distribution|airline_distribution\n\n" +
    "formats: feature|short|documentary|series|animation\n" +
    "stages: development|pre_production|production|post_production|completed\n" +
    "career_stages: debut|second_film|established|veteran\n" +
    "match_weight: high|medium|low\n" +
    "submission_status: open|closing_soon|closed|archived|cancelled\n\n" +
    "RULES: country=full name or null, deadline=YYYY-MM-DD or null, " +
    "confidence=0-100 (score 0-40 if NOT a film funding opportunity), " +
    "extract only the PRIMARY program if multiple exist.\n\n" +
    'JSON schema: {"title":string,"organization_name":string,"opp_type":string,' +
    '"description":string,"country":string|null,"region":string|null,' +
    '"genres":string[],"formats":string[],"stages":string[],"languages":string[],' +
    '"career_stages":string[],"max_award_usd":number|null,"min_budget_usd":number|null,' +
    '"max_budget_usd":number|null,"deadline":string|null,"deadline_note":string|null,' +
    '"app_link":string|null,"url":string,"gender_focus":string|null,' +
    '"copro_required":boolean,"festival_affiliated":boolean,"match_weight":string,' +
    '"is_active":boolean,"submission_status":string,"confidence":number,"confidence_notes":string}';

  const userPrompt = `URL: ${url}\n\n--- WEBPAGE CONTENT ---\n${markdown.slice(0, 14000)}`;

  // Cerebras → Groq → OpenAI waterfall
  let aiText = "";
  let provider = "none";

  if (CEREBRAS_KEY && !aiText) {
    try {
      const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CEREBRAS_KEY}` },
        body:    JSON.stringify({ model: "gpt-oss-120b", max_tokens: 1400,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      });
      if (r.ok) { const d = await r.json(); aiText = d.choices?.[0]?.message?.content ?? ""; provider = "cerebras"; }
    } catch {}
  }

  if (GROQ_KEY && !aiText) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body:    JSON.stringify({ model: "llama-3.1-8b-instant", max_tokens: 1400,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      });
      if (r.ok) { const d = await r.json(); aiText = d.choices?.[0]?.message?.content ?? ""; provider = "groq"; }
    } catch {}
  }

  if (OPENAI_KEY && !aiText) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
        body:    JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1400,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      });
      if (r.ok) { const d = await r.json(); aiText = d.choices?.[0]?.message?.content ?? ""; provider = "openai"; }
    } catch {}
  }

  void provider; // suppress unused warning

  if (!aiText) {
    return { success: false, error: "AI extraction failed — all providers returned empty.", stage: "extract" };
  }

  let extracted: Record<string, unknown>;
  try {
    const clean = aiText.replace(/```json|```/g, "").trim();
    extracted = JSON.parse(clean);
  } catch {
    return { success: false, error: "AI returned malformed JSON.", stage: "extract" };
  }

  const confidence = Math.max(0, Math.min(100, Number(extracted.confidence ?? 0)));

  if (confidence < 45) {
    const reason = String(extracted.confidence_notes ?? "Page does not appear to contain a film funding opportunity.");
    return {
      success: false,
      error:   `Low confidence (${confidence}%): ${reason} Try a more specific URL.`,
      stage:   "extract",
    };
  }

  // ── 4. Save to review queue ──────────────────────────────────
  const { data: inserted, error: insertErr } = await supabase
    .from("admin_review_queue")
    .insert({
      source_url:     url,
      extracted_data: extracted,
      confidence,
      status:         "pending",
      // run_id + source_id intentionally null for manual crawls (both columns nullable)
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return {
      success: false,
      error:   `Could not save to review queue: ${insertErr?.message ?? "unknown"}`,
      stage:   "save",
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
    queueId:      inserted.id as string,
  };
}
