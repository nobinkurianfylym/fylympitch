// ============================================================
// FYLYMPITCH ENGINE
// FYLYMPITCH's combined project intelligence engine.
//
// One entry point — runFylympitchEngine() — that takes a freshly
// submitted project plus the live opportunity/producer pool and
// returns EVERYTHING the project page needs:
//
//   1. Hybrid opportunity matching   (extends services/matching.ts)
//   2. Funding readiness score (FRS)
//   3. Funding discovery             ("your film can raise ₹X")
//   4. Funding obstacles             (what's blocking financing, w/ actions)
//   5. Financing roadmap             (where the project sits, what's next)
//   6. Producer / investor matches   (who to connect with, and why)
//   7. AI Executive Producer brief   (OpenAI "next best move", w/ fallback)
//   8. Dream scenario projection     (best-case timeline + ROI)
//
// Design notes:
//  - Everything except generateExecutiveProducerBrief() is a pure,
//    synchronous, fully unit-testable function — no I/O.
//  - generateExecutiveProducerBrief() is the ONLY part that touches
//    the network (OpenAI). If no OPENAI_API_KEY is supplied, or the
//    call fails for any reason, it degrades to a deterministic
//    heuristic brief — the page never breaks and never blocks on AI.
//  - Intended call site: createProject() in lib/actions.ts, ONCE at
//    submission time. The result is cached in `project_intelligence`
//    and the project page renders from that cache — no "Sharpen with
//    AI" button, no recompute on page load.
//  - opportunityExtras / producerProfiles are optional inputs sourced
//    from new columns/tables (career_stages, match_weight on
//    `opportunities`; a producer-matching view over `profiles`).
//    Everything works with empty/undefined inputs — new data only
//    sharpens the result, it's never required.
// ============================================================

import type { Project, Opportunity, OpportunityType, MatchResult } from "@/types";
import { calculateMatchScore, tierOf } from "./matching.ts";
import { usd } from "../lib/format.ts";

// ------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ============================================================
// 1. HYBRID OPPORTUNITY MATCHING
// ============================================================
// Extends the base 100-point matching.ts score with two new
// dimensions sourced from the FYLYMPITCH MASTER fund database:
//   - career-stage fit  (+6 bonus when the opportunity's stated
//     career stages include the project owner's career stage)
//   - match weight       (±8% multiplier — "high" weight funds from
//     the master database are nudged up, "low" weight nudged down)
// Re-clamped to 0–100 and re-tiered after adjustment.

export interface OpportunityIntelligenceExtras {
  /** e.g. ["First-time", "Emerging", "Established"] — from MASTER_DATA "CAREER STAGE" */
  career_stages?: string[];
  /** from MASTER_DATA "MATCH WEIGHT" */
  match_weight?: "high" | "medium" | "low";
  festival_affiliated?: boolean;
  ott_affiliated?: boolean;
}

const CAREER_STAGE_BONUS = 6;
const MATCH_WEIGHT_MULTIPLIER: Record<NonNullable<OpportunityIntelligenceExtras["match_weight"]>, number> = {
  high: 1.08,
  medium: 1.0,
  low: 0.92,
};

export function applyHybridAdjustments(
  base: MatchResult,
  project: Project & { career_stage?: string | null },
  extras?: OpportunityIntelligenceExtras
): MatchResult {
  if (!extras) return base;

  let score = base.score;
  const reasons = [...base.reasons];

  if (extras.career_stages?.length && project.career_stage) {
    const fits = extras.career_stages.some((cs) => norm(cs) === norm(project.career_stage));
    if (fits) {
      score = score + CAREER_STAGE_BONUS;
      reasons.push(`Career-stage fit: ${project.career_stage}`);
    }
  }

  if (extras.match_weight) {
    score = Math.round(score * MATCH_WEIGHT_MULTIPLIER[extras.match_weight]);
  }

  score = Math.max(0, Math.min(100, score));
  return { ...base, score, tier: tierOf(score), reasons };
}

/** Score every opportunity, apply hybrid adjustments, drop "hidden" tier, sort best-first. */
export function rankHybridMatches(
  project: Project & { career_stage?: string | null },
  opportunities: Opportunity[],
  opportunityExtras?: Record<string, OpportunityIntelligenceExtras>
): { opportunity: Opportunity; match: MatchResult }[] {
  return opportunities
    .map((opportunity) => {
      const base = calculateMatchScore(project, opportunity);
      const match = applyHybridAdjustments(base, project, opportunityExtras?.[opportunity.id]);
      return { opportunity, match };
    })
    .filter((m) => m.match.tier !== "hidden")
    .sort((a, b) => b.match.score - a.match.score);
}

// ============================================================
// 2. FUNDING READINESS SCORE (FRS)
// ============================================================
// Pure completeness score over 100 points. No AI — instant,
// free, and shown the moment the project is created.

const FRS_CHECKS: { ok: (p: Project) => boolean; weight: number; label: string }[] = [
  { ok: (p) => !!p.title, weight: 5, label: "Title" },
  { ok: (p) => !!p.logline, weight: 10, label: "Logline" },
  { ok: (p) => !!p.synopsis, weight: 15, label: "Synopsis" },
  { ok: (p) => !!p.director_statement, weight: 10, label: "Director's statement" },
  { ok: (p) => !!p.producer_info, weight: 10, label: "Producer information" },
  { ok: (p) => p.budget_usd != null, weight: 15, label: "Budget" },
  { ok: (p) => p.funding_needed_usd != null, weight: 10, label: "Funding need" },
  { ok: (p) => !!p.pitch_deck_path, weight: 15, label: "Pitch deck" },
  { ok: (p) => !!p.script_path, weight: 10, label: "Script" },
];
// weights sum to 100

export interface FundingReadiness {
  score: number;
  missing: string[];
  fund_requirements?: string[];  // specific requirements from top matched funds
}

export function computeFundingReadiness(
  project: Project,
  topMatches?: { opportunity: Opportunity; match: MatchResult }[]
): FundingReadiness {
  let score = 0;
  const missing: string[] = [];
  for (const c of FRS_CHECKS) {
    if (c.ok(project)) score += c.weight;
    else missing.push(c.label);
  }

  // Requirement-aware: check what the top 3 matched funds specifically need
  const fund_requirements: string[] = [];
  if (topMatches?.length) {
    const top3 = topMatches.slice(0, 3);
    for (const { opportunity: opp } of top3) {
      if (opp.copro_required && !project.producer_info?.toLowerCase().includes("co-produc")) {
        fund_requirements.push(`${opp.title} requires a confirmed co-producer`);
      }
      if (opp.gender_focus && !project.director_statement) {
        fund_requirements.push(`${opp.title} expects a director's statement addressing gender perspective`);
      }
      if (opp.career_stages?.includes("First-time") && !project.producer_info) {
        fund_requirements.push(`${opp.title} prioritises debut directors with an attached producer`);
      }
    }
  }

  return { score, missing, fund_requirements };
}

// ============================================================
// 3. FUNDING DISCOVERY
// ============================================================
// "Your film can raise ₹X Cr" — aggregates matched opportunities
// and producer/investor matches into a total + category breakdown
// + the source counts shown in the hero block.

const GRANT_TYPES: OpportunityType[] = ["grant", "fund"];
const EQUITY_TYPES: OpportunityType[] = ["co_production", "investor"];
const LAB_TYPES: OpportunityType[] = ["lab"];

export interface FundingDiscoveryItem {
  label: string;
  amount_usd: number;
  count: number;
}

export interface FundingSourceCounts {
  producers: number;
  investors: number;
  grants: number;
  co_producers: number;
}

export interface FundingSourceCounts {
  total: number;
  producers: number;
  investors: number;
  grants: number;
  co_producers: number;
}

export interface FundingDiscovery {
  total_usd: number;
  breakdown: FundingDiscoveryItem[];
  source_counts: FundingSourceCounts;
}

function sumByType(
  matches: { opportunity: Opportunity; match: MatchResult }[],
  types: OpportunityType[]
): { amount: number; count: number } {
  const rows = matches.filter((m) => types.includes(m.opportunity.opp_type));
  const amount = rows.reduce((sum, m) => sum + (m.opportunity.max_award_usd ?? m.opportunity.max_budget_usd ?? 0), 0);
  return { amount, count: rows.length };
}

export function computeFundingDiscovery(
  matches: { opportunity: Opportunity; match: MatchResult }[],
  producerMatches: ProducerMatch[]
): FundingDiscovery {
  const grants = sumByType(matches, GRANT_TYPES);
  const equity = sumByType(matches, EQUITY_TYPES);
  const labs = sumByType(matches, LAB_TYPES);

  const producers = producerMatches.filter((p) => p.profile.role === "producer");
  const investors = producerMatches.filter((p) => p.profile.role === "investor" || p.profile.role === "organization");

  const producerFunding = producers.reduce((s, p) => s + (p.profile.available_funding_usd ?? 0), 0);
  const investorFunding = investors.reduce((s, p) => s + (p.profile.available_funding_usd ?? 0), 0);

  const breakdown: FundingDiscoveryItem[] = [
    { label: "Grants", amount_usd: grants.amount, count: grants.count },
    { label: "Co-production equity", amount_usd: equity.amount + investorFunding, count: equity.count + investors.length },
    { label: "Lab awards", amount_usd: labs.amount, count: labs.count },
    { label: "Producer commitments", amount_usd: producerFunding, count: producers.length },
  ].filter((b) => b.amount_usd > 0 || b.count > 0);

  const total_usd = breakdown.reduce((s, b) => s + b.amount_usd, 0);

  return {
  total_usd,
  breakdown,
  source_counts: {
    total:
      producers.length +
      investors.length +
      grants.count +
      equity.count,
    producers: producers.length,
    investors: investors.length,
    grants: grants.count,
    co_producers: equity.count,
  },
};
}

// ============================================================
// 4. FUNDING OBSTACLES
// ============================================================
// Replaces generic "health score" bars with concrete, actionable
// blockers — each carries a [Solve] destination on the page.

export interface FundingObstacle {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  action_label: string;
  action_href: string;
}

const ACTOR_RE = /(actor|actress|cast|talent|starring)/i;
const COPRODUCER_RE = /(co-?producer|production company|associate producer|studio)/i;

export function computeFundingObstacles(
  project: Project,
  matches: { opportunity: Opportunity; match: MatchResult }[]
): FundingObstacle[] {
  const obstacles: FundingObstacle[] = [];
  const editHref = `/dashboard/projects/${project.id}/edit`;

  // Budget too high for current market: a third or more of matches
  // carry a budget warning from the base matcher.
  const budgetWarn = matches.filter((m) => m.match.warnings.some((w) => /budget/i.test(w)));
  if (matches.length > 0 && budgetWarn.length / matches.length >= 0.3) {
    obstacles.push({
      id: "budget_high",
      label: "Budget may be too high for currently matched sources",
      severity: "high",
      action_label: "Review budget",
      action_href: `${editHref}#budget_usd`,
    });
  }

  const text = `${project.producer_info ?? ""} ${project.synopsis ?? ""}`;

  if (!ACTOR_RE.test(text)) {
    obstacles.push({
      id: "no_actor",
      label: "No attached actor or cast noted",
      severity: "medium",
      action_label: "Add cast info",
      action_href: `${editHref}#producer_info`,
    });
  }

  if (!COPRODUCER_RE.test(text)) {
    obstacles.push({
      id: "no_coproducer",
      label: "Missing co-producer or production company",
      severity: "medium",
      action_label: "Add producers",
      action_href: `${editHref}#producer_info`,
    });
  }

  // Festival strategy: no market / distribution / sales-agent match
  // clearing "possible" (60+).
  const festivalReady = matches.some(
    (m) => ["market", "distribution", "sales_agent"].includes(m.opportunity.opp_type) && m.match.score >= 60
  );
  if (!festivalReady) {
    obstacles.push({
      id: "no_festival_strategy",
      label: "No festival or market strategy identified yet",
      severity: "low",
      action_label: "Explore festivals",
      action_href: `/dashboard/projects/${project.id}#festival-strategy`,
    });
  }

  return obstacles;
}

// ============================================================
// 5. FINANCING ROADMAP
// ============================================================
// Where the project sits today, and the recommended next step.
// Distinct from `project.stage` (development/production/etc.) —
// this is the financing journey: Script → Labs → Co-production
// → Grants → Investors → Production.

export type RoadmapStageKey = "script" | "labs" | "co_production" | "grants" | "investors" | "production";

export interface RoadmapStageInfo {
  key: RoadmapStageKey;
  label: string;
  status: "done" | "current" | "upcoming";
  live_count?: number;  // active matched opportunities in this stage
}

export interface Roadmap {
  stages: RoadmapStageInfo[];
  current: RoadmapStageKey;
  recommendation: string;
  success_probability: number;
}

const ROADMAP_ORDER: { key: RoadmapStageKey; label: string }[] = [
  { key: "script", label: "Script" },
  { key: "labs", label: "Labs" },
  { key: "co_production", label: "Co-production" },
  { key: "grants", label: "Grants" },
  { key: "investors", label: "Investors" },
  { key: "production", label: "Production" },
];

function currentRoadmapStage(project: Project): RoadmapStageKey {
  if (!project.synopsis && !project.pitch_deck_path) return "script";
  switch (project.stage) {
    case "development":
      return "labs";
    case "pre_production":
      return "co_production";
    case "production":
      return "investors";
    case "post_production":
    case "completed":
      return "production";
    default:
      return "labs";
  }
}

// Map roadmap stage keys to opportunity types for live counts
const ROADMAP_TYPE_MAP: Record<RoadmapStageKey, string[]> = {
  script:        ["development"],
  labs:          ["lab", "residency", "workshop"],
  co_production: ["co_production"],
  grants:        ["grant", "fund"],
  investors:     ["investor", "equity"],
  production:    ["distribution", "sales_agent", "market"],
};

export function computeRoadmap(
  project: Project,
  matches: { opportunity: Opportunity; match: MatchResult }[],
  frsScore: number
): Roadmap {
  const current = currentRoadmapStage(project);
  const currentIdx = ROADMAP_ORDER.findIndex((s) => s.key === current);

  // Count live matched opportunities per roadmap stage
  const countsByStage: Record<string, number> = {};
  for (const { key } of ROADMAP_ORDER) {
    const types = ROADMAP_TYPE_MAP[key];
    countsByStage[key] = matches.filter(
      (m) => types.some((t) => m.opportunity.opp_type?.includes(t)) && m.match.score >= 60
    ).length;
  }

  const stages: RoadmapStageInfo[] = ROADMAP_ORDER.map((s, i) => ({
    ...s,
    status: i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
    live_count: countsByStage[s.key] ?? 0,
  }));

  const top3 = matches.slice(0, 3);
  const top3Avg = top3.length ? top3.reduce((s, m) => s + m.match.score, 0) / top3.length : 0;
  const success_probability = Math.max(0, Math.min(100, Math.round(0.6 * top3Avg + 0.4 * frsScore)));

  const currentStageCount = countsByStage[current] ?? 0;
  let recommendation: string;
  if (current === "production") {
    recommendation = "Your project is in active production — focus on closing financing for post-production and delivery.";
  } else {
    const nextLabel = ROADMAP_ORDER[Math.min(currentIdx + 1, ROADMAP_ORDER.length - 1)].label;
    const bestMatch = matches[0];
    if (currentStageCount > 0) {
      recommendation = `${currentStageCount} live ${current} opportunit${currentStageCount === 1 ? "y" : "ies"} match your project right now. Start with "${bestMatch?.opportunity.title ?? "your top match"}".`;
    } else {
      recommendation = matches.length
        ? `Next step is moving toward ${nextLabel.toLowerCase()} — start with "${bestMatch.opportunity.title}".`
        : `Next step is moving toward ${nextLabel.toLowerCase()} — complete more project details to surface matches.`;
    }
  }

  return { stages, current, recommendation, success_probability };
}

// ============================================================
// 6. PRODUCER / INVESTOR MATCHES
// ============================================================
// New matching axis: project → industry profiles (producer,
// investor, organization). Requires a producer-matching view over
// `profiles` exposing the fields below — works with an empty list.

export interface ProducerMatchProfile {
  id: string;
  full_name: string;
  company: string | null;
  role: "producer" | "investor" | "organization";
  genres: string[];
  formats: string[];
  countries: string[];
  min_budget_usd: number | null;
  max_budget_usd: number | null;
  available_funding_usd: number | null;
  festival_track_record: boolean;
}

export interface ProducerMatch {
  profile: ProducerMatchProfile;
  score: number;
  tier: MatchResult["tier"];
  reasons: string[];
}

const PRODUCER_WEIGHTS = {
  genre: 30,
  budget: 25,
  format: 15,
  territory: 15,
  festival: 10,
  funding: 5,
} as const; // sums to 100

export function rankProducerMatches(project: Project, profiles: ProducerMatchProfile[]): ProducerMatch[] {
  return profiles
    .filter((profile) => {
      // A profile with zero matching signal (no genres/formats/countries/budget
      // range/funding/festival flag) would otherwise default to a misleadingly
      // high score on "open to everything" logic. Require at least one signal.
      return (
        profile.genres.length > 0 ||
        profile.formats.length > 0 ||
        profile.countries.length > 0 ||
        profile.min_budget_usd != null ||
        profile.max_budget_usd != null ||
        profile.festival_track_record ||
        (profile.available_funding_usd ?? 0) > 0
      );
    })
    .map((profile) => {
      const reasons: string[] = [];
      let score = 0;

      if (profile.genres.length === 0 || profile.genres.some((g) => norm(g) === norm(project.genre))) {
        score += PRODUCER_WEIGHTS.genre;
        reasons.push("Similar genre");
      }

      if (project.budget_usd != null) {
        const min = profile.min_budget_usd ?? 0;
        const max = profile.max_budget_usd ?? Number.POSITIVE_INFINITY;
        if (project.budget_usd >= min && project.budget_usd <= max) {
          score += PRODUCER_WEIGHTS.budget;
          reasons.push("Similar budget");
        }
      } else {
        score += Math.round(PRODUCER_WEIGHTS.budget * 0.5);
      }

      if (profile.formats.length === 0 || profile.formats.includes(project.format)) {
        score += PRODUCER_WEIGHTS.format;
        reasons.push("Format fit");
      }

      if (profile.countries.length === 0 || profile.countries.some((c) => norm(c) === norm(project.country))) {
        score += PRODUCER_WEIGHTS.territory;
        reasons.push("Territory fit");
      }

      if (profile.festival_track_record) {
        score += PRODUCER_WEIGHTS.festival;
        reasons.push("Festival experience");
      }

      if ((profile.available_funding_usd ?? 0) > 0) {
        score += PRODUCER_WEIGHTS.funding;
        reasons.push("Funding available");
      }

      score = Math.max(0, Math.min(100, score));
      return { profile, score, tier: tierOf(score), reasons };
    })
    .filter((m) => m.tier !== "hidden")
    .sort((a, b) => b.score - a.score);
}

// ============================================================
// 7. AI EXECUTIVE PRODUCER BRIEF
// ============================================================
// "Next best move" — the ONLY part of the engine that calls out
// to OpenAI. Falls back to a deterministic heuristic if no API
// key is configured, or if the call errors for any reason.

export interface ExecutiveProducerBrief {
  next_best_move: {
    title: string;
    opportunity_id: string | null;
    funding_range: string;
    deadline_days: number | null;
    success_chance: number;
    action_label: string;
  };
  summary: string;
  generated_by: "groq" | "openai" | "heuristic";
}

function fundingRangeLabel(opp: Opportunity): string {
  if (opp.max_award_usd) return `Up to ${usd(opp.max_award_usd)}`;
  if (opp.min_budget_usd || opp.max_budget_usd) {
    return `${usd(opp.min_budget_usd)} – ${usd(opp.max_budget_usd)}`;
  }
  return "Award amount varies";
}

function heuristicBrief(
  project: Project,
  matches: { opportunity: Opportunity; match: MatchResult }[],
  obstacles: FundingObstacle[]
): ExecutiveProducerBrief {
  const top = matches[0];

  const summary = top
    ? `"${project.title}" scores ${top.match.score}/100 against "${top.opportunity.title}", its strongest current match.` +
      (obstacles.length
        ? ` Addressing "${obstacles[0].label.toLowerCase()}" first would strengthen fit across similar opportunities.`
        : " The project profile is well-rounded for this category.")
    : `"${project.title}" doesn't yet clear the match threshold for any active opportunity. Completing the budget, ` +
      `funding need, and synopsis fields will sharpen matching significantly.`;

  return {
    next_best_move: {
      title: top ? `Apply to ${top.opportunity.title}` : "Complete your project profile",
      opportunity_id: top?.opportunity.id ?? null,
      funding_range: top ? fundingRangeLabel(top.opportunity) : "—",
      deadline_days: top?.opportunity.deadline ? daysUntil(top.opportunity.deadline) : null,
      success_chance: top?.match.score ?? 0,
      action_label: top ? "Apply" : "Edit project",
    },
    summary,
    generated_by: "heuristic",
  };
}

const EP_SYSTEM_PROMPT = `You are FYLYMPITCH's AI Executive Producer. Given a film project and its ranked funding \
matches, respond with STRICT JSON only, no prose, matching exactly this shape:
{
  "next_best_move": {
    "title": string,
    "opportunity_id": string | null,
    "funding_range": string,
    "deadline_days": number | null,
    "success_chance": number,
    "action_label": string
  },
  "summary": string
}
Keep "summary" to 2-3 direct, specific sentences. Pick "next_best_move" from the provided top_matches only \
(use its id as opportunity_id) unless none are suitable, in which case set opportunity_id to null and recommend \
a concrete profile improvement instead.`;

export async function generateExecutiveProducerBrief(
  project: Project,
  matches: { opportunity: Opportunity; match: MatchResult }[],
  obstacles: FundingObstacle[],
  openaiApiKey: string | undefined
): Promise<ExecutiveProducerBrief> {
  const fallback = heuristicBrief(project, matches, obstacles);
  if (!openaiApiKey) return fallback;

  const topMatches = matches.slice(0, 5).map((m) => ({
    id: m.opportunity.id,
    title: m.opportunity.title,
    type: m.opportunity.opp_type,
    score: m.match.score,
    tier: m.match.tier,
    max_award_usd: m.opportunity.max_award_usd,
    min_budget_usd: m.opportunity.min_budget_usd,
    max_budget_usd: m.opportunity.max_budget_usd,
    deadline: m.opportunity.deadline,
    reasons: m.match.reasons,
  }));

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.4,
        messages: [
          { role: "system", content: EP_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              project: {
                title: project.title,
                genre: project.genre,
                format: project.format,
                stage: project.stage,
                country: project.country,
                language: project.language,
                budget_usd: project.budget_usd,
                funding_needed_usd: project.funding_needed_usd,
                logline: project.logline,
              },
              top_matches: topMatches,
              obstacles: obstacles.map((o) => o.label),
            }),
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI responded ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return { ...fallback, ...parsed, generated_by: "openai" };
  } catch (err) {
    console.error("FYLYMPITCH ENGINE: OpenAI brief failed, using heuristic fallback.", err);
    return fallback;
  }
}

// ============================================================
// 8. DREAM SCENARIO
// ============================================================
// "If everything matches" — a best-case projection. Cheap and
// deterministic; meant to be aspirational, not a forecast.

export interface DreamScenario {
  funding_usd: number;
  production_start: string;
  festival_premiere: string;
  distribution_probability: number;
  projected_roi: number;
}

const MONTHS_TO_PRODUCTION: Record<RoadmapStageKey, number> = {
  script: 18,
  labs: 14,
  co_production: 10,
  grants: 8,
  investors: 6,
  production: 0,
};

const FESTIVAL_CYCLE: { name: string; month: number }[] = [
  { name: "Berlinale", month: 2 },
  { name: "Cannes", month: 5 },
  { name: "Venice", month: 9 },
  { name: "Busan", month: 10 },
];

export function computeDreamScenario(
  project: Project,
  funding: FundingDiscovery,
  roadmap: Roadmap,
  frsScore: number
): DreamScenario {
  const now = new Date();

  const productionStart = new Date(now);
  productionStart.setMonth(productionStart.getMonth() + MONTHS_TO_PRODUCTION[roadmap.current]);

  const premiere = new Date(productionStart);
  premiere.setMonth(premiere.getMonth() + 13);

  const premiereMonth = premiere.getMonth() + 1;
  const festival = FESTIVAL_CYCLE.reduce((best, f) =>
    Math.abs(f.month - premiereMonth) < Math.abs(best.month - premiereMonth) ? f : best
  );

  const distribution_probability = Math.round(Math.min(95, roadmap.success_probability * 0.95));

  let roi = 1.5;
  const budget = project.budget_usd ?? 0;
  if (budget > 0 && budget <= 500_000) roi += 0.6;
  if (frsScore >= 75) roi += 0.3;
  roi = Math.round(roi * 10) / 10;

  return {
    funding_usd: funding.total_usd,
    production_start: `${productionStart.toLocaleString("en-US", { month: "short" })} ${productionStart.getFullYear()}`,
    festival_premiere: `${festival.name} ${premiere.getFullYear()}`,
    distribution_probability,
    projected_roi: roi,
  };
}

// ============================================================
// ORCHESTRATOR
// ============================================================

export interface FylympitchEngineInput {
  project: Project & { career_stage?: string | null };
  opportunities: Opportunity[];
  /** keyed by opportunity.id — from MASTER_DATA import columns */
  opportunityExtras?: Record<string, OpportunityIntelligenceExtras>;
  producerProfiles?: ProducerMatchProfile[];
  /** read from process.env.OPENAI_API_KEY at the call site */
  openaiApiKey?: string;
}

export interface FylympitchEngineResult {
  project_id: string;
  generated_at: string;
  funding_readiness: FundingReadiness;
  matches: { opportunity: Opportunity; match: MatchResult }[];
  producer_matches: ProducerMatch[];
  funding_discovery: FundingDiscovery;
  obstacles: FundingObstacle[];
  roadmap: Roadmap;
  executive_producer: ExecutiveProducerBrief;
  dream_scenario: DreamScenario;
}

/**
 * Run the full FYLYMPITCH ENGINE for a project.
 * Intended to run ONCE, at submission time, with the result cached
 * in `project_intelligence`. The project page reads from that cache.
 */
export async function runFylympitchEngine(input: FylympitchEngineInput): Promise<FylympitchEngineResult> {
  const { project, opportunities, opportunityExtras, producerProfiles = [], openaiApiKey } = input;

  const matches = rankHybridMatches(project, opportunities, opportunityExtras);
  const producer_matches = rankProducerMatches(project, producerProfiles);
  const funding_readiness = computeFundingReadiness(project, matches.slice(0, 3));
  const funding_discovery = computeFundingDiscovery(matches, producer_matches);
  const obstacles = computeFundingObstacles(project, matches);
  const roadmap = computeRoadmap(project, matches, funding_readiness.score);
  const executive_producer = await generateExecutiveProducerBrief(project, matches, obstacles, openaiApiKey);
  const dream_scenario = computeDreamScenario(project, funding_discovery, roadmap, funding_readiness.score);

  return {
    project_id: project.id,
    generated_at: new Date().toISOString(),
    funding_readiness,
    matches: matches.slice(0, 10),
    producer_matches: producer_matches.slice(0, 10),
    funding_discovery,
    obstacles,
    roadmap,
    executive_producer,
    dream_scenario,
  };
}
