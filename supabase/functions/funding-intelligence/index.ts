// supabase/functions/funding-intelligence/index.ts
// ============================================================
// FYLYMPITCH — Funding Intelligence Engine
// Supabase Edge Function — triggered by pg_cron daily at 02:00 UTC
//
// AI Waterfall (mirrors aiEngine.ts):
//   1. Cerebras  gpt-oss-120b          — primary, ultra-fast
//   2. Groq      llama-3.1-8b-instant  — secondary, high rate limit
//   3. OpenAI    gpt-4o-mini           — last resort
//
// Env vars required (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   FIRECRAWL_API_KEY          fc-ed8b65a125ac4ccab6b3d9ad65b750bb
//   CEREBERAS_API              (existing — same key as CF Workers)
//   GROQ_API_KEY               (existing)
//   OPENAI_API_KEY             (existing)
//
// Manual trigger:
//   curl -X POST https://<ref>.supabase.co/functions/v1/funding-intelligence \
//     -H "Authorization: Bearer <service_role_key>"
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Env ──────────────────────────────────────────────────────
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_KEY   = Deno.env.get("FIRECRAWL_API_KEY") ?? "fc-ed8b65a125ac4ccab6b3d9ad65b750bb";
const CEREBRAS_KEY    = Deno.env.get("CEREBERAS_API");   // note: typo preserved to match CF dashboard
const GROQ_KEY        = Deno.env.get("GROQ_API_KEY");
const OPENAI_KEY      = Deno.env.get("OPENAI_API_KEY");

const CONFIDENCE_GATE   = 90;
const CRAWL_CONCURRENCY = 6;

// ─── AI provider config (mirrors aiEngine.ts) ─────────────────
const CEREBRAS_URL   = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "gpt-oss-120b";

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const OPENAI_URL   = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

// ─── Taxonomy ─────────────────────────────────────────────────
const OPP_TYPES = [
  "grant","fund","lab","co_production","market","distribution",
  "investor","broadcaster","streamer","sales_agent","producer",
  "brand_integration","crowdfunding","production_company","studio",
  "sponsor","pre_sale","tax_incentive",
] as const;
const FORMATS  = ["feature","short","documentary","series","animation"] as const;
const STAGES   = ["development","pre_production","production","post_production","completed"] as const;
const CAREER   = ["debut","second_film","established","veteran"] as const;

// ─── Types ────────────────────────────────────────────────────
interface Message { role: "system" | "user" | "assistant"; content: string; }

interface FundingSource {
  id: string;
  organization_name: string;
  program_name: string;
  url: string;
  country: string | null;
  region: string | null;
  expected_opp_type: string | null;
  notes: string | null;
}

interface ExtractedOpportunity {
  title: string;
  organization_name: string;
  opp_type: string;
  description: string;
  country: string | null;
  region: string | null;
  genres: string[];
  formats: string[];
  stages: string[];
  languages: string[];
  career_stages: string[];
  max_award_usd: number | null;
  min_budget_usd: number | null;
  max_budget_usd: number | null;
  deadline: string | null;
  deadline_note: string | null;
  app_link: string | null;
  url: string;
  gender_focus: string | null;
  copro_required: boolean;
  festival_affiliated: boolean;
  match_weight: string;
  is_active: boolean;
  submission_status: string;
  confidence: number;
  confidence_notes: string;
}

interface CrawlStats {
  sources_crawled: number;
  pages_visited: number;
  new_opportunities: number;
  updated_opportunities: number;
  expired_opportunities: number;
  failed_crawls: number;
  pending_review: number;
  duplicates_prevented: number;
  confidences: number[];
}

// ─── Supabase client ──────────────────────────────────────────
function getSupabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ─── AI Waterfall: Cerebras → Groq → OpenAI ───────────────────
// Mirrors the callLLM() function in services/aiEngine.ts
async function callLLM(
  messages: Message[],
  maxTokens = 1200,
): Promise<{ text: string; provider: string }> {

  // 1. Cerebras — primary, ultra-fast
  if (CEREBRAS_KEY) {
    try {
      const res = await fetch(CEREBRAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CEREBRAS_KEY}`,
        },
        body: JSON.stringify({
          model: CEREBRAS_MODEL,
          max_tokens: maxTokens,
          messages,
        }),
      });
      if (!res.ok) throw new Error(`Cerebras HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      if (text) return { text, provider: "cerebras" };
      throw new Error("Empty Cerebras response");
    } catch (e) {
      console.warn("[intelligence] Cerebras failed, trying Groq:", (e as Error).message);
    }
  }

  // 2. Groq — secondary, high rate limit
  if (GROQ_KEY) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: maxTokens,
          messages,
        }),
      });
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      if (text) return { text, provider: "groq" };
      throw new Error("Empty Groq response");
    } catch (e) {
      console.warn("[intelligence] Groq failed, trying OpenAI:", (e as Error).message);
    }
  }

  // 3. OpenAI — last resort
  if (OPENAI_KEY) {
    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: maxTokens,
          messages,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      return { text, provider: "openai" };
    } catch (e) {
      console.error("[intelligence] OpenAI failed:", (e as Error).message);
    }
  }

  return { text: "", provider: "none" };
}

// ─── Firecrawl scrape ─────────────────────────────────────────
async function scrapeUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 30000,
      }),
    });
    if (!res.ok) {
      console.error(`[firecrawl] ${res.status} for ${url}`);
      return null;
    }
    const data = await res.json();
    return data?.data?.markdown ?? null;
  } catch (err) {
    console.error(`[firecrawl] Error for ${url}:`, err);
    return null;
  }
}

// ─── Extraction system prompt ──────────────────────────────────
const EXTRACTION_SYSTEM = `You are a film funding data extraction specialist for PITCH.FYLYM.

Extract structured funding opportunity data from the provided webpage content.
Respond ONLY with a single valid JSON object — no markdown fences, no preamble, no explanation.

TAXONOMY — use ONLY these exact values:

opp_type: grant | fund | lab | co_production | market | distribution | investor |
          broadcaster | streamer | sales_agent | producer | brand_integration |
          crowdfunding | production_company | studio | sponsor | pre_sale | tax_incentive

formats: feature | short | documentary | series | animation

stages: development | pre_production | production | post_production | completed

career_stages: debut | second_film | established | veteran

match_weight: high | medium | low

submission_status: open | closing_soon | closed | archived | cancelled

gender_focus: women | non_binary | women_and_non_binary   (or null)

RULES:
- genres: standard film genres (Drama, Documentary, Comedy, Thriller, Horror, Animation, etc.)
- languages: ISO language names (English, French, Arabic, etc.)
- country: full country name, or null for worldwide
- deadline: ISO date YYYY-MM-DD, or null if rolling/no fixed date
- max_award_usd: numeric USD amount, or null
- confidence: 0-100. Score LOWER if page is generic, deadline missing, or award amount absent
- Extract only the PRIMARY / most prominent program if multiple exist on one page

JSON schema (respond with this object only):
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

// ─── Extract via AI waterfall ──────────────────────────────────
async function extractWithAI(
  content: string,
  source: FundingSource,
): Promise<ExtractedOpportunity | null> {
  const userPrompt = `Organization: ${source.organization_name}
Program: ${source.program_name}
Official URL: ${source.url}
Expected type: ${source.expected_opp_type ?? "unknown"}${source.notes ? `\nNotes: ${source.notes}` : ""}
Country hint: ${source.country ?? "international"}
Region hint: ${source.region ?? "global"}

--- WEBPAGE CONTENT ---
${content.slice(0, 12000)}`;

  const { text, provider } = await callLLM(
    [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user",   content: userPrompt },
    ],
    1200,
  );

  if (!text) return null;

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as ExtractedOpportunity;
    parsed.url = parsed.url || source.url;
    console.log(`[${provider}] Extracted "${parsed.title}" conf=${parsed.confidence}`);
    return parsed;
  } catch (err) {
    console.error(`[intelligence] JSON parse error (${provider}):`, err, "\nRaw:", text.slice(0, 200));
    return null;
  }
}

// ─── Taxonomy normalizer ──────────────────────────────────────
function normalize(raw: ExtractedOpportunity): ExtractedOpportunity {
  if (!OPP_TYPES.includes(raw.opp_type as typeof OPP_TYPES[number])) raw.opp_type = "grant";
  raw.formats       = (raw.formats ?? []).filter(f => FORMATS.includes(f as typeof FORMATS[number]));
  raw.stages        = (raw.stages ?? []).filter(s => STAGES.includes(s as typeof STAGES[number]));
  raw.career_stages = (raw.career_stages ?? []).filter(c => CAREER.includes(c as typeof CAREER[number]));
  if (!["high","medium","low"].includes(raw.match_weight)) raw.match_weight = "medium";
  if (!["open","closing_soon","closed","archived","cancelled"].includes(raw.submission_status)) {
    raw.submission_status = "open";
  }
  const validGender = ["women","non_binary","women_and_non_binary"];
  if (raw.gender_focus && !validGender.includes(raw.gender_focus)) raw.gender_focus = null;
  if (raw.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(raw.deadline)) raw.deadline = null;
  raw.genres    = (raw.genres ?? []).filter(Boolean);
  raw.languages = (raw.languages ?? []).filter(Boolean);
  raw.confidence = Math.max(0, Math.min(100, raw.confidence ?? 0));
  return raw;
}

// ─── Duplicate detection ──────────────────────────────────────
async function findExisting(
  supabase: ReturnType<typeof getSupabase>,
  extracted: ExtractedOpportunity,
  sourceUrl: string,
): Promise<{ id: string; version_number: number } | null> {
  // 1. Match by source_url
  const { data: byUrl } = await supabase
    .from("opportunities")
    .select("id, version_number")
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (byUrl) return byUrl;

  // 2. Match by title + organization_name
  const { data: byTitle } = await supabase
    .from("opportunities")
    .select("id, version_number")
    .ilike("title", extracted.title)
    .ilike("organization_name", extracted.organization_name)
    .maybeSingle();
  return byTitle ?? null;
}

// ─── Change detection ─────────────────────────────────────────
function detectChanges(
  existing: Record<string, unknown>,
  incoming: ExtractedOpportunity,
): { fields: string[]; prev: Record<string, unknown>; next: Record<string, unknown> } {
  const watchFields = [
    "title","description","deadline","max_award_usd","submission_status",
    "app_link","url","country","genres","formats","stages","is_active","deadline_note",
  ] as const;

  const fields: string[] = [];
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};

  for (const field of watchFields) {
    const existStr = JSON.stringify(existing[field] ?? null);
    const newStr   = JSON.stringify(incoming[field as keyof ExtractedOpportunity] ?? null);
    if (existStr !== newStr) {
      fields.push(field);
      prev[field] = existing[field];
      next[field] = incoming[field as keyof ExtractedOpportunity];
    }
  }
  return { fields, prev, next };
}

// ─── Upsert one opportunity ───────────────────────────────────
async function upsertOpportunity(
  supabase: ReturnType<typeof getSupabase>,
  extracted: ExtractedOpportunity,
  source: FundingSource,
): Promise<{ action: "inserted" | "updated" | "skipped"; opportunityId: string | null }> {

  const existing = await findExisting(supabase, extracted, source.url);

  if (existing) {
    const { data: current } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", existing.id)
      .single();

    if (!current) return { action: "skipped", opportunityId: existing.id };

    const { fields, prev, next } = detectChanges(
      current as Record<string, unknown>,
      extracted,
    );

    // Nothing changed — touch last_verified_at only
    if (fields.length === 0) {
      await supabase
        .from("opportunities")
        .update({ last_verified_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { action: "skipped", opportunityId: existing.id };
    }

    const newVersion = (existing.version_number ?? 1) + 1;
    await supabase.from("opportunities").update({
      title: extracted.title, description: extracted.description,
      deadline: extracted.deadline, deadline_note: extracted.deadline_note,
      max_award_usd: extracted.max_award_usd, min_budget_usd: extracted.min_budget_usd,
      max_budget_usd: extracted.max_budget_usd, app_link: extracted.app_link,
      url: extracted.url, is_active: extracted.is_active,
      submission_status: extracted.submission_status, genres: extracted.genres,
      formats: extracted.formats, stages: extracted.stages, languages: extracted.languages,
      career_stages: extracted.career_stages, gender_focus: extracted.gender_focus,
      copro_required: extracted.copro_required, festival_affiliated: extracted.festival_affiliated,
      match_weight: extracted.match_weight, last_verified_at: new Date().toISOString(),
      version_number: newVersion, crawl_confidence: extracted.confidence, auto_crawled: true,
    }).eq("id", existing.id);

    await supabase.from("opportunity_versions").insert({
      opportunity_id: existing.id, version_number: newVersion,
      changed_fields: fields, previous_values: prev, new_values: next,
      change_source: "auto_crawl",
    });

    return { action: "updated", opportunityId: existing.id };
  }

  // ── New insert ────────────────────────────────────────────────
  const { data: inserted, error } = await supabase
    .from("opportunities")
    .insert({
      title: extracted.title, opp_type: extracted.opp_type,
      description: extracted.description, country: extracted.country,
      region: extracted.region, genres: extracted.genres,
      formats: extracted.formats, stages: extracted.stages,
      languages: extracted.languages, career_stages: extracted.career_stages,
      max_award_usd: extracted.max_award_usd, min_budget_usd: extracted.min_budget_usd,
      max_budget_usd: extracted.max_budget_usd, deadline: extracted.deadline,
      deadline_note: extracted.deadline_note, app_link: extracted.app_link,
      url: extracted.url, is_active: extracted.is_active,
      submission_status: extracted.submission_status, gender_focus: extracted.gender_focus,
      copro_required: extracted.copro_required, festival_affiliated: extracted.festival_affiliated,
      match_weight: extracted.match_weight, organization_name: extracted.organization_name,
      source_url: source.url, last_verified_at: new Date().toISOString(),
      version_number: 1, auto_crawled: true, crawl_confidence: extracted.confidence,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[intelligence] Insert error:", error?.message);
    return { action: "skipped", opportunityId: null };
  }

  await supabase.from("opportunity_versions").insert({
    opportunity_id: inserted.id, version_number: 1,
    changed_fields: ["*"], previous_values: {},
    new_values: extracted as unknown as Record<string, unknown>,
    change_source: "auto_crawl",
  });

  // Notify filmmakers
  await supabase.rpc("auto_broadcast_new_fund", {
    p_opp_id:   inserted.id,
    p_title:    extracted.title,
    p_opp_type: extracted.opp_type,
  });

  return { action: "inserted", opportunityId: inserted.id };
}

// ─── Process one source ───────────────────────────────────────
async function processSource(
  supabase: ReturnType<typeof getSupabase>,
  source: FundingSource,
  runId: string,
  stats: CrawlStats,
): Promise<void> {
  stats.pages_visited++;

  const markdown = await scrapeUrl(source.url);
  if (!markdown) {
    stats.failed_crawls++;
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id,
      action: "failed", error_message: "Firecrawl returned no content",
    });
    return;
  }

  const raw = await extractWithAI(markdown, source);
  if (!raw) {
    stats.failed_crawls++;
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id,
      action: "failed", error_message: "AI extraction returned null",
    });
    return;
  }

  const extracted = normalize(raw);
  stats.confidences.push(extracted.confidence);

  // Smart confidence gate:
  // - EXISTING record + low confidence → touch last_verified_at only, skip review
  // - NEW record + low confidence → admin review queue
  if (extracted.confidence < CONFIDENCE_GATE) {
    const existing = await findExisting(supabase, extracted, source.url);
    if (existing) {
      await supabase.from("opportunities")
        .update({ last_verified_at: new Date().toISOString() })
        .eq("id", existing.id);
      stats.duplicates_prevented++;
      await supabase.from("funding_crawl_items").insert({
        run_id: runId, source_id: source.id, opportunity_id: existing.id,
        action: "skipped", confidence: extracted.confidence,
      });
      return;
    }
    // Genuinely new record — queue for admin review
    stats.pending_review++;
    await supabase.from("admin_review_queue").insert({
      run_id: runId, source_id: source.id,
      source_url: source.url,
      extracted_data: extracted as unknown as Record<string, unknown>,
      confidence: extracted.confidence,
    });
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id, action: "queued_review",
      confidence: extracted.confidence,
      raw_extraction: extracted as unknown as Record<string, unknown>,
    });
    return;
  }

  const { action, opportunityId } = await upsertOpportunity(supabase, extracted, source);

  if (action === "inserted")       stats.new_opportunities++;
  else if (action === "updated")   stats.updated_opportunities++;
  else                             stats.duplicates_prevented++;

  await supabase.from("funding_crawl_items").insert({
    run_id: runId, source_id: source.id, opportunity_id: opportunityId,
    action, confidence: extracted.confidence,
    raw_extraction: extracted as unknown as Record<string, unknown>,
  });

  await supabase.from("funding_sources").update({
    last_crawled_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    fail_count: 0,
  }).eq("id", source.id);
}

// ─── Concurrency limiter ──────────────────────────────────────
async function runInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = getSupabase();

  const { data: run, error: runErr } = await supabase
    .from("funding_crawl_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runErr || !run) {
    return new Response(JSON.stringify({ error: "Could not create crawl run" }), { status: 500 });
  }

  const runId = run.id;
  const stats: CrawlStats = {
    sources_crawled: 0, pages_visited: 0, new_opportunities: 0,
    updated_opportunities: 0, expired_opportunities: 0,
    failed_crawls: 0, pending_review: 0, duplicates_prevented: 0,
    confidences: [],
  };

  try {
    const { data: sources } = await supabase
      .from("funding_sources")
      .select("*")
      .eq("crawl_active", true)
      .order("last_crawled_at", { ascending: true, nullsFirst: true });

    if (!sources || sources.length === 0) {
      await supabase.from("funding_crawl_runs").update({
        status: "complete", finished_at: new Date().toISOString(),
        error_summary: "No active sources found",
      }).eq("id", runId);
      return new Response(JSON.stringify({ message: "No active sources" }), { status: 200 });
    }

    stats.sources_crawled = sources.length;

    await runInBatches(
      sources as FundingSource[],
      CRAWL_CONCURRENCY,
      (source) => processSource(supabase, source, runId, stats),
    );

    // Sync deadline statuses
    const { data: synced } = await supabase.rpc("sync_opportunity_statuses");
    stats.expired_opportunities = synced ?? 0;

    const avgConf = stats.confidences.length > 0
      ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length
      : null;

    await supabase.from("funding_crawl_runs").update({
      status: "complete", finished_at: new Date().toISOString(),
      sources_crawled: stats.sources_crawled, pages_visited: stats.pages_visited,
      new_opportunities: stats.new_opportunities, updated_opportunities: stats.updated_opportunities,
      expired_opportunities: stats.expired_opportunities, failed_crawls: stats.failed_crawls,
      pending_review: stats.pending_review, duplicates_prevented: stats.duplicates_prevented,
      avg_confidence: avgConf,
    }).eq("id", runId);

    const summary = {
      run_id: runId, sources_crawled: stats.sources_crawled,
      new_opportunities: stats.new_opportunities, updated: stats.updated_opportunities,
      expired: stats.expired_opportunities, pending_review: stats.pending_review,
      failed: stats.failed_crawls, duplicates_prevented: stats.duplicates_prevented,
      avg_confidence: avgConf?.toFixed(1),
    };

    console.log("FUNDING INTELLIGENCE COMPLETE:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[intelligence] Fatal:", err);
    await supabase.from("funding_crawl_runs").update({
      status: "failed", finished_at: new Date().toISOString(),
      error_summary: String(err),
    }).eq("id", runId);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
