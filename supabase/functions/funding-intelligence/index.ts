// supabase/functions/funding-intelligence/index.ts
// ============================================================
// FYLYMPITCH — Funding Intelligence Engine
// Supabase Edge Function — triggered by pg_cron daily at 02:00 UTC
//
// Flow per invocation:
//   1. Create a new funding_crawl_run record
//   2. Load all active funding_sources
//   3. Crawl each source via Firecrawl (parallel, batches of 8)
//   4. Extract structured data via Claude Haiku
//   5. Normalize against taxonomy
//   6. Duplicate detection (by source_url + title similarity)
//   7. Upsert: INSERT new / UPDATE changed / skip identical
//   8. confidence ≥ 90 → auto-publish; < 90 → admin_review_queue
//   9. Notify filmmakers for new inserts via auto_broadcast_new_fund
//  10. Sync submission statuses (closing_soon / closed)
//  11. Finalize crawl run with summary stats
//
// Environment variables required (set in Supabase dashboard):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   FIRECRAWL_API_KEY
//   ANTHROPIC_API_KEY
//
// Manual trigger:
//   curl -X POST https://<project>.supabase.co/functions/v1/funding-intelligence \
//     -H "Authorization: Bearer <service_role_key>"
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Env ──────────────────────────────────────────────────────
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_KEY     = Deno.env.get("FIRECRAWL_API_KEY")!;
const ANTHROPIC_KEY     = Deno.env.get("ANTHROPIC_API_KEY")!;
const CONFIDENCE_GATE   = 90;   // below this → admin review
const CRAWL_CONCURRENCY = 8;    // parallel Firecrawl requests

// ─── Taxonomy (must match DB enums) ───────────────────────────
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

// ─── Supabase client (service role — bypasses RLS) ────────────
function getSupabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
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
      console.error(`Firecrawl ${res.status} for ${url}`);
      return null;
    }

    const data = await res.json();
    return data?.data?.markdown ?? null;
  } catch (err) {
    console.error(`Firecrawl error for ${url}:`, err);
    return null;
  }
}

// ─── Claude Haiku extraction ───────────────────────────────────
const EXTRACTION_SYSTEM = `You are a film funding data extraction specialist for PITCH.FYLYM.

Extract structured funding opportunity data from the provided webpage content.
Respond ONLY with a single valid JSON object — no markdown, no preamble, no explanation.

TAXONOMY (use ONLY these exact values):

opp_type: grant | fund | lab | co_production | market | distribution | investor |
           broadcaster | streamer | sales_agent | producer | brand_integration |
           crowdfunding | production_company | studio | sponsor | pre_sale | tax_incentive

formats: feature | short | documentary | series | animation

stages: development | pre_production | production | post_production | completed

career_stages: debut | second_film | established | veteran

match_weight: high | medium | low

submission_status: open | closing_soon | closed | archived | cancelled

gender_focus: women | non_binary | women_and_non_binary | null

RULES:
- genres: use standard film genres exactly (Drama, Documentary, Comedy, Thriller, Horror, Animation, etc.)
- languages: use ISO language names (English, French, Arabic, etc.)
- country: use full country name or null for worldwide/international
- deadline: ISO date YYYY-MM-DD or null if rolling/ongoing
- max_award_usd: numeric USD amount or null
- confidence: 0-100 integer. Score LOWER if: page is generic, deadline not found, award amount missing
- confidence_notes: brief reason for score
- If multiple programs exist on one page, extract only the PRIMARY / most prominent one

JSON schema:
{
  "title": string,
  "organization_name": string,
  "opp_type": string,
  "description": string (2-4 sentences, factual),
  "country": string | null,
  "region": string | null,
  "genres": string[],
  "formats": string[],
  "stages": string[],
  "languages": string[],
  "career_stages": string[],
  "max_award_usd": number | null,
  "min_budget_usd": number | null,
  "max_budget_usd": number | null,
  "deadline": string | null,
  "deadline_note": string | null,
  "app_link": string | null,
  "url": string,
  "gender_focus": string | null,
  "copro_required": boolean,
  "festival_affiliated": boolean,
  "match_weight": string,
  "is_active": boolean,
  "submission_status": string,
  "confidence": number,
  "confidence_notes": string
}`;

async function extractWithHaiku(
  content: string,
  source: FundingSource,
): Promise<ExtractedOpportunity | null> {
  const userPrompt = `Organization: ${source.organization_name}
Program: ${source.program_name}
Official URL: ${source.url}
Expected type: ${source.expected_opp_type ?? "unknown"}
${source.notes ? `Notes: ${source.notes}` : ""}
Country hint: ${source.country ?? "international"}
Region hint: ${source.region ?? "global"}

--- WEBPAGE CONTENT ---
${content.slice(0, 12000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        system: EXTRACTION_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error(`Anthropic ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as ExtractedOpportunity;

    // Enforce source URL
    parsed.url = parsed.url || source.url;
    return parsed;
  } catch (err) {
    console.error(`Haiku extraction error for ${source.url}:`, err);
    return null;
  }
}

// ─── Normalize extracted data against taxonomy ─────────────────
function normalize(raw: ExtractedOpportunity): ExtractedOpportunity {
  // opp_type
  if (!OPP_TYPES.includes(raw.opp_type as typeof OPP_TYPES[number])) {
    raw.opp_type = "grant";
  }

  // formats
  raw.formats = (raw.formats ?? []).filter(f =>
    FORMATS.includes(f as typeof FORMATS[number])
  );

  // stages
  raw.stages = (raw.stages ?? []).filter(s =>
    STAGES.includes(s as typeof STAGES[number])
  );

  // career_stages
  raw.career_stages = (raw.career_stages ?? []).filter(c =>
    CAREER.includes(c as typeof CAREER[number])
  );

  // match_weight
  if (!["high","medium","low"].includes(raw.match_weight)) {
    raw.match_weight = "medium";
  }

  // submission_status
  if (!["open","closing_soon","closed","archived","cancelled"].includes(raw.submission_status)) {
    raw.submission_status = "open";
  }

  // gender_focus
  const validGender = ["women","non_binary","women_and_non_binary"];
  if (raw.gender_focus && !validGender.includes(raw.gender_focus)) {
    raw.gender_focus = null;
  }

  // deadline validation
  if (raw.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(raw.deadline)) {
    raw.deadline = null;
  }

  // arrays cleanup
  raw.genres    = (raw.genres ?? []).filter(Boolean);
  raw.languages = (raw.languages ?? []).filter(Boolean);

  // clamp confidence
  raw.confidence = Math.max(0, Math.min(100, raw.confidence ?? 0));

  return raw;
}

// ─── Duplicate detection ───────────────────────────────────────
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
    .limit(1)
    .single();

  if (byUrl) return byUrl;

  // 2. Match by title + organization_name (fuzzy — exact for now)
  const { data: byTitle } = await supabase
    .from("opportunities")
    .select("id, version_number")
    .ilike("title", extracted.title)
    .ilike("organization_name", extracted.organization_name)
    .limit(1)
    .single();

  return byTitle ?? null;
}

// ─── Detect which fields changed ──────────────────────────────
function detectChanges(
  existing: Record<string, unknown>,
  incoming: ExtractedOpportunity,
): { fields: string[]; prev: Record<string, unknown>; next: Record<string, unknown> } {
  const watchFields: Array<keyof ExtractedOpportunity> = [
    "title","description","deadline","max_award_usd","submission_status",
    "app_link","url","country","genres","formats","stages",
    "is_active","deadline_note",
  ];

  const fields: string[] = [];
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};

  for (const field of watchFields) {
    const existVal = existing[field];
    const newVal   = incoming[field as keyof ExtractedOpportunity];

    const existStr = JSON.stringify(existVal ?? null);
    const newStr   = JSON.stringify(newVal ?? null);

    if (existStr !== newStr) {
      fields.push(field);
      prev[field] = existVal;
      next[field] = newVal;
    }
  }

  return { fields, prev, next };
}

// ─── Upsert one opportunity ────────────────────────────────────
async function upsertOpportunity(
  supabase: ReturnType<typeof getSupabase>,
  extracted: ExtractedOpportunity,
  source: FundingSource,
  runId: string,
): Promise<{ action: "inserted" | "updated" | "skipped"; opportunityId: string | null }> {
  const existing = await findExisting(supabase, extracted, source.url);

  if (existing) {
    // Fetch current record for change detection
    const { data: current } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", existing.id)
      .single();

    if (!current) return { action: "skipped", opportunityId: existing.id };

    const { fields, prev, next } = detectChanges(current, extracted);

    if (fields.length === 0) {
      // Nothing changed — just update last_verified_at
      await supabase
        .from("opportunities")
        .update({ last_verified_at: new Date().toISOString() })
        .eq("id", existing.id);

      return { action: "skipped", opportunityId: existing.id };
    }

    const newVersion = (existing.version_number ?? 1) + 1;

    // Update opportunity
    await supabase.from("opportunities").update({
      title:              extracted.title,
      description:        extracted.description,
      deadline:           extracted.deadline,
      deadline_note:      extracted.deadline_note,
      max_award_usd:      extracted.max_award_usd,
      min_budget_usd:     extracted.min_budget_usd,
      max_budget_usd:     extracted.max_budget_usd,
      app_link:           extracted.app_link,
      url:                extracted.url,
      is_active:          extracted.is_active,
      submission_status:  extracted.submission_status,
      genres:             extracted.genres,
      formats:            extracted.formats,
      stages:             extracted.stages,
      languages:          extracted.languages,
      career_stages:      extracted.career_stages,
      gender_focus:       extracted.gender_focus,
      copro_required:     extracted.copro_required,
      festival_affiliated: extracted.festival_affiliated,
      match_weight:       extracted.match_weight,
      last_verified_at:   new Date().toISOString(),
      version_number:     newVersion,
      crawl_confidence:   extracted.confidence,
      auto_crawled:       true,
    }).eq("id", existing.id);

    // Write version record
    await supabase.from("opportunity_versions").insert({
      opportunity_id:  existing.id,
      version_number:  newVersion,
      changed_fields:  fields,
      previous_values: prev,
      new_values:      next,
      change_source:   "auto_crawl",
    });

    return { action: "updated", opportunityId: existing.id };
  }

  // ── INSERT new opportunity ──
  const { data: inserted, error } = await supabase
    .from("opportunities")
    .insert({
      title:               extracted.title,
      opp_type:            extracted.opp_type,
      description:         extracted.description,
      country:             extracted.country,
      region:              extracted.region,
      genres:              extracted.genres,
      formats:             extracted.formats,
      stages:              extracted.stages,
      languages:           extracted.languages,
      career_stages:       extracted.career_stages,
      max_award_usd:       extracted.max_award_usd,
      min_budget_usd:      extracted.min_budget_usd,
      max_budget_usd:      extracted.max_budget_usd,
      deadline:            extracted.deadline,
      deadline_note:       extracted.deadline_note,
      app_link:            extracted.app_link,
      url:                 extracted.url,
      is_active:           extracted.is_active,
      submission_status:   extracted.submission_status,
      gender_focus:        extracted.gender_focus,
      copro_required:      extracted.copro_required,
      festival_affiliated: extracted.festival_affiliated,
      match_weight:        extracted.match_weight,
      organization_name:   extracted.organization_name,
      source_url:          source.url,
      last_verified_at:    new Date().toISOString(),
      version_number:      1,
      auto_crawled:        true,
      crawl_confidence:    extracted.confidence,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("Insert error:", error);
    return { action: "skipped", opportunityId: null };
  }

  // Write version 1
  await supabase.from("opportunity_versions").insert({
    opportunity_id:  inserted.id,
    version_number:  1,
    changed_fields:  ["*"],
    previous_values: {},
    new_values:      extracted as unknown as Record<string, unknown>,
    change_source:   "auto_crawl",
  });

  // Notify filmmakers
  await supabase.rpc("auto_broadcast_new_fund", {
    p_opp_id:   inserted.id,
    p_title:    extracted.title,
    p_opp_type: extracted.opp_type,
  });

  return { action: "inserted", opportunityId: inserted.id };
}

// ─── Process one source (crawl → extract → upsert) ───────────
async function processSource(
  supabase: ReturnType<typeof getSupabase>,
  source: FundingSource,
  runId: string,
  stats: CrawlStats,
): Promise<void> {
  stats.pages_visited++;

  // 1. Crawl
  const markdown = await scrapeUrl(source.url);
  if (!markdown) {
    stats.failed_crawls++;
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id,
      action: "failed", error_message: "Firecrawl returned no content",
    });
    await supabase.from("funding_sources")
      .update({ fail_count: supabase.raw ? undefined : 0 })
      .eq("id", source.id);
    return;
  }

  // 2. Extract
  const raw = await extractWithHaiku(markdown, source);
  if (!raw) {
    stats.failed_crawls++;
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id,
      action: "failed", error_message: "AI extraction returned null",
    });
    return;
  }

  // 3. Normalize
  const extracted = normalize(raw);
  stats.confidences.push(extracted.confidence);

  // 4. Low confidence → admin review queue
  if (extracted.confidence < CONFIDENCE_GATE) {
    stats.pending_review++;
    await supabase.from("admin_review_queue").insert({
      run_id:         runId,
      source_id:      source.id,
      source_url:     source.url,
      extracted_data: extracted as unknown as Record<string, unknown>,
      confidence:     extracted.confidence,
    });
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id,
      action: "queued_review", confidence: extracted.confidence,
      raw_extraction: extracted as unknown as Record<string, unknown>,
    });
    return;
  }

  // 5. Upsert
  const { action, opportunityId } = await upsertOpportunity(
    supabase, extracted, source, runId,
  );

  // Track stats
  if (action === "inserted") {
    stats.new_opportunities++;
  } else if (action === "updated") {
    stats.updated_opportunities++;
  } else {
    stats.duplicates_prevented++;
  }

  // 6. Log crawl item
  await supabase.from("funding_crawl_items").insert({
    run_id:         runId,
    source_id:      source.id,
    opportunity_id: opportunityId,
    action,
    confidence:     extracted.confidence,
    raw_extraction: extracted as unknown as Record<string, unknown>,
  });

  // 7. Update source timestamp
  await supabase.from("funding_sources").update({
    last_crawled_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    fail_count: 0,
  }).eq("id", source.id);
}

// ─── Batch runner (concurrency limiter) ───────────────────────
async function runInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(fn));
  }
}

// ─── Main handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Allow POST or GET (for cron)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = getSupabase();

  // 1. Create crawl run
  const { data: run, error: runErr } = await supabase
    .from("funding_crawl_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runErr || !run) {
    return new Response(JSON.stringify({ error: "Could not create crawl run" }), {
      status: 500,
    });
  }

  const runId = run.id;
  const stats: CrawlStats = {
    sources_crawled: 0,
    pages_visited: 0,
    new_opportunities: 0,
    updated_opportunities: 0,
    expired_opportunities: 0,
    failed_crawls: 0,
    pending_review: 0,
    duplicates_prevented: 0,
    confidences: [],
  };

  try {
    // 2. Load active sources
    const { data: sources } = await supabase
      .from("funding_sources")
      .select("*")
      .eq("crawl_active", true)
      .order("last_crawled_at", { ascending: true, nullsFirst: true });

    if (!sources || sources.length === 0) {
      await supabase.from("funding_crawl_runs").update({
        status: "complete",
        finished_at: new Date().toISOString(),
        error_summary: "No active sources found",
      }).eq("id", runId);

      return new Response(JSON.stringify({ message: "No active sources" }), { status: 200 });
    }

    stats.sources_crawled = sources.length;

    // 3. Process all sources in parallel batches
    await runInBatches(
      sources as FundingSource[],
      CRAWL_CONCURRENCY,
      (source) => processSource(supabase, source, runId, stats),
    );

    // 4. Sync submission statuses
    const { data: synced } = await supabase.rpc("sync_opportunity_statuses");
    stats.expired_opportunities = synced ?? 0;

    // 5. Finalize run
    const avgConf = stats.confidences.length > 0
      ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length
      : null;

    await supabase.from("funding_crawl_runs").update({
      status:                 "complete",
      finished_at:            new Date().toISOString(),
      sources_crawled:        stats.sources_crawled,
      pages_visited:          stats.pages_visited,
      new_opportunities:      stats.new_opportunities,
      updated_opportunities:  stats.updated_opportunities,
      expired_opportunities:  stats.expired_opportunities,
      failed_crawls:          stats.failed_crawls,
      pending_review:         stats.pending_review,
      duplicates_prevented:   stats.duplicates_prevented,
      avg_confidence:         avgConf,
    }).eq("id", runId);

    const summary = {
      run_id:               runId,
      sources_crawled:      stats.sources_crawled,
      new_opportunities:    stats.new_opportunities,
      updated:              stats.updated_opportunities,
      expired:              stats.expired_opportunities,
      pending_review:       stats.pending_review,
      failed:               stats.failed_crawls,
      duplicates_prevented: stats.duplicates_prevented,
      avg_confidence:       avgConf?.toFixed(1),
    };

    console.log("FUNDING INTELLIGENCE RUN COMPLETE:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Funding Intelligence fatal error:", err);
    await supabase.from("funding_crawl_runs").update({
      status:        "failed",
      finished_at:   new Date().toISOString(),
      error_summary: String(err),
    }).eq("id", runId);

    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
