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
//   FIRECRAWL_API_KEY          <set as a Supabase secret>
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
const FIRECRAWL_KEY   = Deno.env.get("FIRECRAWL_API_KEY");
// The original name is misspelled and was set on Cloudflare, not Supabase —
// so on this runtime it resolved to undefined and every extraction silently
// fell through to the 8B fallback model. Accept all spellings.
const CEREBRAS_KEY    = Deno.env.get("CEREBERAS_API")
                     ?? Deno.env.get("CEREBRAS_API")
                     ?? Deno.env.get("CEREBRAS_API_KEY");
const GROQ_KEY        = Deno.env.get("GROQ_API_KEY");
const OPENAI_KEY      = Deno.env.get("OPENAI_API_KEY");

const CONFIDENCE_GATE   = 70;

// Firecrawl rate limiting. Concurrency was 6 with no retry, which tripped the
// API rate limit after ~10 sources and failed the remaining ~39 every run.
// Firecrawl reports the ceiling in its 429 body: ~17 req/min on this plan.
// Serial requests with a 3.5s gap keep us near 12/min including scrape time.
const CRAWL_CONCURRENCY    = 1;
const SCRAPE_RETRIES       = 3;
const SCRAPE_BASE_DELAY_MS = 2000;
const SCRAPE_MAX_WAIT_MS   = 8000;
const INTER_BATCH_DELAY_MS = 3500;
const SCRAPE_TIMEOUT_MS    = 45000;

// Bound each run so it cannot exceed the Edge Function wall clock. Sources
// rotate because last_crawled_at is recorded on every path, success or not,
// so a small batch per run still covers every source within a day.
// Array extraction makes each source slower (bigger prompt, bigger response),
// so fewer sources per run. Sources rotate via last_crawled_at, and the cron
// runs hourly, so all 49 are still covered well within a day.
const MAX_SOURCES_PER_RUN  = 8;

// One page can list many programmes. These bound the blast radius.
const CONTENT_CHAR_LIMIT   = 30000;   // was 12000 — truncated long index pages
const EXTRACT_MAX_TOKENS   = 4000;    // was 1200 — could not hold >2 objects
const MAX_OPPS_PER_PAGE    = 20;

// auto_broadcast_new_fund notifies every filmmaker on each insert. Array
// extraction can produce dozens of inserts in one run, so cap the notifications
// or the first good crawl spams the entire user base.
const MAX_NEW_BROADCASTS_PER_RUN = 5;
let   broadcastsThisRun    = 0;

// Hard stop for starting NEW work. The platform kills the function at its own
// wall clock, and a killed function never reaches the catch block — which is
// why runs were left stuck at status 'running' forever. We stop early and
// finalise the row ourselves instead.
const RUN_DEADLINE_MS      = 100_000;
let   runDeadline          = Number.MAX_SAFE_INTEGER;

// ─── AI provider config (mirrors aiEngine.ts) ─────────────────
const CEREBRAS_URL   = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "gpt-oss-120b";

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const OPENAI_URL   = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

// ─── Taxonomy ─────────────────────────────────────────────────
const OPP_TYPES = [
  // Development
  "lab","residency","mentorship","grant","fund","writing_fellowship",
  // Packaging & Markets
  "pitch_forum","co_production","market",
  // Early Financing
  "crowdfunding","donation","fiscal_sponsorship","seed_funding","community_funding",
  // Tax Incentives
  "tax_incentive","cash_rebate","production_rebate","regional_incentive","location_incentive",
  // Private Financing
  "investor","angel_investor","venture_capital","gap_financing",
  "brand_integration","product_placement","sponsor","private_fund",
  // Production
  "producer","co_producer","production_company","studio",
  // Post Production
  "post_production_grant","post_production_fund","finishing_fund",
  // Buyers & Sales
  "sales_agent","world_sales","broadcaster","streamer","pre_sale","content_buyer","music_rights",
  // Release & Distribution
  "film_festival","distribution","theatrical_distribution","ott_distribution",
  "tv_distribution","digital_aggregator","educational_distribution","airline_distribution",
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
  crawl_frequency: "daily" | "weekly" | "monthly";
  last_crawled_at: string | null;
  last_success_at: string | null;
  fail_count: number | null;
}

// Hours threshold per frequency before re-crawling
const FREQUENCY_HOURS: Record<string, number> = {
  daily:   20,        // 20h  — fires every daily cron
  weekly:  6 * 24,   // 6d   — fires once a week
  monthly: 28 * 24,  // 28d  — fires once a month
};

function isDue(source: FundingSource): boolean {
  if (!source.last_crawled_at) return true; // never crawled yet
  const hoursSince =
    (Date.now() - new Date(source.last_crawled_at).getTime()) / 36e5;
  const threshold = FREQUENCY_HOURS[source.crawl_frequency] ?? 20;
  return hoursSince >= threshold;
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

// ─── Error logger ─────────────────────────────────────────────
async function logError(
  supabase: ReturnType<typeof createClient>,
  message: string,
  context?: Record<string, unknown>,
  severity: "warn" | "error" | "critical" = "error"
) {
  try {
    await supabase.from("platform_errors").insert({
      source: "funding-intelligence",
      severity,
      message,
      context: context ?? null,
    });
  } catch (_) {
    // never let logging break the main flow
  }
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
      console.warn("[intelligence] Cerebras failed, trying OpenAI:", (e as Error).message);
    }
  }

  // 2. OpenAI — second by capability. This sits ahead of Groq deliberately:
  //    extraction quality drives the confidence score, and everything below
  //    the gate of 70 is discarded, so a weaker model here costs real data.
  //    response_format forces valid JSON and removes a class of parse failures.
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
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      if (text) return { text, provider: "openai" };
      throw new Error("Empty OpenAI response");
    } catch (e) {
      console.warn("[intelligence] OpenAI failed, trying Groq:", (e as Error).message);
    }
  }

  // 3. Groq — last resort. llama-3.1-8b is fast and cheap but the weakest of
  //    the three at structured extraction from dense multilingual pages.
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
      console.error("[intelligence] Groq failed:", (e as Error).message);
    }
  }

  return { text: "", provider: "none" };
}

// ─── Firecrawl scrape ─────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Scrape one URL via Firecrawl.
 * Retries on 429 / 5xx with exponential backoff, honouring Retry-After.
 * Returns the real failure reason so it can be stored on funding_crawl_items
 * instead of the useless generic "Firecrawl returned no content".
 */
async function scrapeUrl(
  url: string,
): Promise<{ markdown: string | null; error: string | null }> {
  if (!FIRECRAWL_KEY) {
    return { markdown: null, error: "FIRECRAWL_API_KEY is not set" };
  }

  let lastError = "unknown";

  for (let attempt = 0; attempt <= SCRAPE_RETRIES; attempt++) {
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
          timeout: SCRAPE_TIMEOUT_MS,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const markdown: string | null = data?.data?.markdown ?? null;

        // Firecrawl reports the ORIGIN's status in metadata. A site that serves
        // a styled 404 with HTTP 200 still shows up here. Ignoring this is why
        // dead sources looked like successful crawls for months.
        const originStatus = Number(data?.data?.metadata?.statusCode ?? 200);
        if (originStatus >= 400) {
          return { markdown: null, error: `Origin returned HTTP ${originStatus} (dead or moved URL)` };
        }

        if (!markdown) {
          lastError = "Firecrawl 200 but empty markdown";
          break;
        }

        // Soft 404: the page resolves but carries no programme content. The
        // extractor would otherwise invent a record from the prompt hints.
        const probe = markdown.slice(0, 1200).toLowerCase();
        const deadPhrases = [
          "page not found", "404 not found", "page cannot be found",
          "page doesn't exist", "page does not exist", "no longer available",
          "seite nicht gefunden", "page introuvable", "pagina non trovata",
        ];
        if (deadPhrases.some((phrase) => probe.includes(phrase))) {
          return { markdown: null, error: "Soft 404 — page content says not found" };
        }
        if (markdown.trim().length < 400) {
          return { markdown: null, error: `Content too thin (${markdown.trim().length} chars) — likely a shell or consent wall` };
        }

        return { markdown, error: null };
      }

      const body = (await res.text()).slice(0, 180).replace(/\s+/g, " ");
      lastError = `Firecrawl HTTP ${res.status}: ${body}`;

      // Rate limited or upstream error — back off and retry.
      if (res.status === 429 || res.status >= 500) {
        if (attempt === SCRAPE_RETRIES) break;
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, SCRAPE_MAX_WAIT_MS)
          : SCRAPE_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[firecrawl] ${res.status} ${url} — retry ${attempt + 1}/${SCRAPE_RETRIES} in ${wait}ms`);
        await sleep(wait);
        continue;
      }

      // 4xx other than 429 (bad URL, 402 out of credits) — retrying won't help.
      break;
    } catch (err) {
      lastError = `Firecrawl exception: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt === SCRAPE_RETRIES) break;
      await sleep(SCRAPE_BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  console.error(`[firecrawl] FAILED ${url} — ${lastError}`);
  return { markdown: null, error: lastError };
}

/** Record a crawl attempt on the source, whatever the outcome. */
async function recordAttempt(
  supabase: ReturnType<typeof getSupabase>,
  sourceId: string,
  ok: boolean,
  currentFailCount: number,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("funding_sources").update(
    ok
      ? { last_crawled_at: now, last_success_at: now, fail_count: 0 }
      : { last_crawled_at: now, fail_count: currentFailCount + 1 },
  ).eq("id", sourceId);
}

// ─── Extraction system prompt ──────────────────────────────────
const EXTRACTION_SYSTEM = `You are a film funding data extraction specialist for PITCH.FYLYM.

Extract structured funding opportunity data from the provided webpage content.
Respond ONLY with a single valid JSON object — no markdown fences, no preamble, no explanation.

CRITICAL — DO NOT INVENT:
The Organization / Program / URL lines below the content are routing hints, NOT
source data. If the WEBPAGE CONTENT is an error page, a "page not found" page, a
cookie or consent wall, a login wall, or otherwise does not actually describe
this funding programme, you MUST return confidence 0 and set confidence_notes to
"page unavailable". Never reconstruct a record from the hints alone, and never
carry a deadline, award amount or eligibility rule that does not literally
appear in the webpage content. A missing field must be null, never a guess.

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

gender_focus: women | non_binary | women_and_non_binary   (or null)

RULES:
- genres: standard film genres (Drama, Documentary, Comedy, Thriller, Horror, Animation, etc.)
- languages: ISO language names (English, French, Arabic, etc.)
- country: full country name, or null for worldwide
- deadline: ISO date YYYY-MM-DD, or null if rolling/no fixed date
- max_award_usd: numeric USD amount, or null
- confidence: 0-100. Score LOWER if page is generic, deadline missing, or award amount absent
MULTIPLE PROGRAMMES — IMPORTANT:
A single page often lists several distinct funding programmes: an index of
schemes, a "programmes" or "funds" page, or a table of deadlines. Extract EVERY
distinct programme as its own object, each with its own title, deadline and
award amount. Do not merge them, and do not pick only the most prominent one.
If the page genuinely describes one programme, return exactly one object.
Return at most 20 objects, most important first.

Each programme gets its own confidence score. Score a programme LOWER if its
deadline or award amount is missing from the page.

Respond with this exact wrapper:
{ "opportunities": [ <programme object>, ... ] }

Each programme object:
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
): Promise<ExtractedOpportunity[]> {
  const userPrompt = `Organization: ${source.organization_name}
Program: ${source.program_name}
Official URL: ${source.url}
Expected type: ${source.expected_opp_type ?? "unknown"}${source.notes ? `\nNotes: ${source.notes}` : ""}
Country hint: ${source.country ?? "international"}
Region hint: ${source.region ?? "global"}

--- WEBPAGE CONTENT ---
${content.slice(0, CONTENT_CHAR_LIMIT)}`;

  const { text, provider } = await callLLM(
    [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user",   content: userPrompt },
    ],
    EXTRACT_MAX_TOKENS,
  );

  if (!text) return [];

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as unknown;

    // Accept the wrapper, a bare array, or a single object, so a model that
    // ignores the wrapper instruction still yields usable data.
    let list: ExtractedOpportunity[];
    if (Array.isArray(parsed)) {
      list = parsed as ExtractedOpportunity[];
    } else if (parsed && Array.isArray((parsed as Record<string, unknown>).opportunities)) {
      list = (parsed as { opportunities: ExtractedOpportunity[] }).opportunities;
    } else if (parsed && typeof parsed === "object" && (parsed as ExtractedOpportunity).title) {
      list = [parsed as ExtractedOpportunity];
    } else {
      console.warn(`[${provider}] Unrecognised extraction shape`);
      return [];
    }

    list = list.filter((o) => o && typeof o.title === "string" && o.title.trim().length > 0)
               .slice(0, MAX_OPPS_PER_PAGE);

    for (const item of list) {
      item.url = item.url || source.url;
      (item as unknown as Record<string, unknown>)._provider = provider;
    }

    console.log(`[${provider}] Extracted ${list.length} programme(s) from ${source.url}`);
    return list;
  } catch (err) {
    console.error(`[intelligence] JSON parse error (${provider}):`, err, "\nRaw:", text.slice(0, 200));
    return [];
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
  // Previously any non-ISO string was silently discarded, throwing away real
  // dates the model had found ("15 March 2026"). Now: keep ISO, try to parse
  // unambiguous written dates, and preserve anything else as a note rather
  // than losing it. Numeric slash formats are NOT parsed — 03/04/2026 is
  // ambiguous between locales and a wrong deadline is worse than none.
  if (raw.deadline) {
    const d = raw.deadline.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      // already ISO — leave it
    } else if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(d) || /^[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4}$/.test(d)) {
      const parsed = new Date(`${d} UTC`);
      if (!isNaN(parsed.getTime())) {
        raw.deadline = parsed.toISOString().slice(0, 10);
      } else {
        raw.deadline_note = raw.deadline_note || d;
        raw.deadline = null;
      }
    } else {
      // Partial or descriptive ("March 2026", "Annual") — not a usable date,
      // but still information. Keep it where it can be read.
      raw.deadline_note = raw.deadline_note || d;
      raw.deadline = null;
    }
  }
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
  // A source page can now yield many opportunities, so source_url alone is no
  // longer a unique key — maybeSingle() on it would throw the moment a second
  // opportunity was extracted from the same page. Identity is page + title.
  const { data: byUrlTitle } = await supabase
    .from("opportunities")
    .select("id, version_number")
    .eq("source_url", sourceUrl)
    .ilike("title", extracted.title)
    .limit(1);
  if (byUrlTitle && byUrlTitle.length > 0) return byUrlTitle[0];

  // Fall back to organisation + title, so a programme that moved to a new page
  // is updated rather than duplicated.
  const { data: byTitle } = await supabase
    .from("opportunities")
    .select("id, version_number")
    .ilike("title", extracted.title)
    .ilike("organization_name", extracted.organization_name)
    .limit(1);
  if (byTitle && byTitle.length > 0) return byTitle[0];

  return null;
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

  // Notify filmmakers — but never more than a handful per run. Array
  // extraction can insert dozens at once; without this cap the first healthy
  // crawl would notify every user dozens of times.
  if (broadcastsThisRun < MAX_NEW_BROADCASTS_PER_RUN) {
    broadcastsThisRun++;
    await supabase.rpc("auto_broadcast_new_fund", {
      p_opp_id:   inserted.id,
      p_title:    extracted.title,
      p_opp_type: extracted.opp_type,
    });
  } else {
    console.log(`[intelligence] broadcast cap reached — skipping notify for "${extracted.title}"`);
  }

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

  const { markdown, error: scrapeError } = await scrapeUrl(source.url);
  if (!markdown) {
    stats.failed_crawls++;
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id,
      action: "failed", error_message: scrapeError ?? "Firecrawl returned no content",
    });
    await recordAttempt(supabase, source.id, false, source.fail_count ?? 0);
    return;
  }

  const rawList = await extractWithAI(markdown, source);
  if (rawList.length === 0) {
    stats.failed_crawls++;
    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id,
      action: "failed", error_message: "AI extraction returned no programmes",
    });
    await recordAttempt(supabase, source.id, false, source.fail_count ?? 0);
    return;
  }

  // One page can describe several programmes. Each is judged, deduped and
  // written on its own — a weak entry no longer discards the whole page.
  let anyAccepted = false;

  for (const raw of rawList) {
    const extracted = normalize(raw);
    stats.confidences.push(extracted.confidence);

    if (extracted.confidence < CONFIDENCE_GATE) {
      const existing = await findExisting(supabase, extracted, source.url);

      if (existing) {
        // Known programme, weak read — touch the verification stamp only.
        // Never overwrite good stored values with a low-confidence guess.
        await supabase.from("opportunities")
          .update({ last_verified_at: new Date().toISOString() })
          .eq("id", existing.id);
        stats.duplicates_prevented++;
        await supabase.from("funding_crawl_items").insert({
          run_id: runId, source_id: source.id, opportunity_id: existing.id,
          action: "skipped", confidence: extracted.confidence,
          raw_extraction: extracted as unknown as Record<string, unknown>,
        });
        continue;
      }

      // Unknown programme, weak read — queue for a human, once per title.
      const { data: alreadyQueued } = await supabase
        .from("admin_review_queue")
        .select("id")
        .eq("source_url", source.url)
        .eq("status", "pending")
        .ilike("extracted_data->>title", extracted.title)
        .limit(1);

      if (!alreadyQueued || alreadyQueued.length === 0) {
        stats.pending_review++;
        await supabase.from("admin_review_queue").insert({
          run_id: runId, source_id: source.id,
          source_url: source.url,
          extracted_data: extracted as unknown as Record<string, unknown>,
          confidence: extracted.confidence,
        });
      }
      await supabase.from("funding_crawl_items").insert({
        run_id: runId, source_id: source.id, action: "queued_review",
        confidence: extracted.confidence,
        raw_extraction: extracted as unknown as Record<string, unknown>,
      });
      continue;
    }

    // Cleared the gate — write it.
    const { action, opportunityId } = await upsertOpportunity(supabase, extracted, source);

    if (action === "inserted")     stats.new_opportunities++;
    else if (action === "updated") stats.updated_opportunities++;
    else                           stats.duplicates_prevented++;

    anyAccepted = true;

    await supabase.from("funding_crawl_items").insert({
      run_id: runId, source_id: source.id, opportunity_id: opportunityId,
      action, confidence: extracted.confidence,
      raw_extraction: extracted as unknown as Record<string, unknown>,
    });
  }

  // The source counts as a success only if at least one programme was good
  // enough to store, so fail_count keeps surfacing sources that read poorly.
  await recordAttempt(supabase, source.id, anyAccepted, source.fail_count ?? 0);
}

// ─── Concurrency limiter ──────────────────────────────────────
async function runInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    if (Date.now() > runDeadline) {
      console.warn(`[intelligence] deadline reached — stopping after ${i}/${items.length} sources`);
      break;
    }
    await Promise.all(items.slice(i, i + concurrency).map(fn));
    if (i + concurrency < items.length) await sleep(INTER_BATCH_DELAY_MS);
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
  runDeadline = Date.now() + RUN_DEADLINE_MS;
  broadcastsThisRun = 0;
  const stats: CrawlStats = {
    sources_crawled: 0, pages_visited: 0, new_opportunities: 0,
    updated_opportunities: 0, expired_opportunities: 0,
    failed_crawls: 0, pending_review: 0, duplicates_prevented: 0,
    confidences: [],
  };

  try {
    const { data: allSources } = await supabase
      .from("funding_sources")
      .select("*")
      .eq("crawl_active", true)
      .order("last_crawled_at", { ascending: true, nullsFirst: true });

    if (!allSources || allSources.length === 0) {
      await supabase.from("funding_crawl_runs").update({
        status: "complete", finished_at: new Date().toISOString(),
        error_summary: "No active sources found",
      }).eq("id", runId);
      return new Response(JSON.stringify({ message: "No active sources" }), { status: 200 });
    }

    // Filter to only sources due for a crawl based on their frequency
    const due     = (allSources as FundingSource[]).filter(isDue);
    const sources = due.slice(0, MAX_SOURCES_PER_RUN);
    const skipped = allSources.length - sources.length;

    console.log(`[intelligence] ${sources.length} due / ${allSources.length} total / ${skipped} skipped (not due)`);

    if (sources.length === 0) {
      await supabase.from("funding_crawl_runs").update({
        status: "complete", finished_at: new Date().toISOString(),
        sources_crawled: 0,
        error_summary: `All ${allSources.length} sources up to date — nothing due`,
      }).eq("id", runId);
      return new Response(JSON.stringify({ message: "All sources up to date", skipped }), { status: 200 });
    }

    stats.sources_crawled = sources.length;

    await runInBatches(
      sources,
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

    // ── Log high failure rate ───────────────────────────────────
    if (stats.failed_crawls > 0 && stats.sources_crawled > 0) {
      const failRate = stats.failed_crawls / stats.sources_crawled;
      if (failRate >= 0.5) {
        await logError(supabase, `High crawl failure rate: ${stats.failed_crawls}/${stats.sources_crawled} sources failed`, { run_id: runId, ...summary }, "warn");
      }
    }

    // ── Refresh platform metrics snapshot ──────────────────────
    try {
      await supabase.rpc("refresh_platform_metrics");
      console.log("[intelligence] platform_metrics refreshed");
    } catch (metricsErr) {
      // Non-fatal — log and continue
      console.warn("[intelligence] platform_metrics refresh failed:", metricsErr);
    }

    return new Response(JSON.stringify(summary), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[intelligence] Fatal:", err);
    await logError(supabase, `Fatal crawl error: ${String(err)}`, { run_id: runId }, "critical");
    await supabase.from("funding_crawl_runs").update({
      status: "failed", finished_at: new Date().toISOString(),
      error_summary: String(err),
    }).eq("id", runId);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
