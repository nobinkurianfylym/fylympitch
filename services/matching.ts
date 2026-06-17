// ============================================================
// FYLYMPITCH Matching Engine v1.0
// Weighted project-to-opportunity scoring.
// Pure function — no I/O, fully unit-testable.
//
// Weights (total 100):
//   Genre 20 · Stage 20 · Country 15 · Budget 15
//   Format 10 · Funding 10 · Language 5 · Historical 5
// ============================================================

import type { MatchResult, Project, Opportunity } from "@/types";

const WEIGHTS = {
  genre: 20,
  stage: 20,
  country: 15,
  budget: 15,
  format: 10,
  funding: 10,
  language: 5,
  historical: 5,
} as const;

const GLOBAL_SOUTH = new Set([
  "India", "Indonesia", "Philippines", "Vietnam", "Thailand", "Bangladesh",
  "Sri Lanka", "Nepal", "Pakistan", "Nigeria", "Kenya", "South Africa",
  "Egypt", "Morocco", "Brazil", "Argentina", "Mexico", "Colombia", "Peru",
  "Chile", "Iran", "Lebanon", "Jordan", "Georgia", "Armenia",
]);

const REGION_MAP: Record<string, string[]> = {
  "Asia-Pacific": ["India", "China", "Japan", "South Korea", "Indonesia", "Philippines", "Thailand", "Vietnam", "Australia", "New Zealand", "Sri Lanka", "Nepal", "Bangladesh", "Malaysia", "Singapore", "Taiwan"],
  Europe: ["France", "Germany", "United Kingdom", "Italy", "Spain", "Netherlands", "Belgium", "Switzerland", "Austria", "Poland", "Denmark", "Sweden", "Norway", "Finland", "Portugal", "Greece", "Ireland"],
  Americas: ["United States", "Canada", "Mexico", "Brazil", "Argentina", "Colombia", "Chile", "Peru"],
  "Middle East": ["UAE", "Qatar", "Saudi Arabia", "Jordan", "Lebanon", "Israel", "Iran", "Egypt"],
  Africa: ["Nigeria", "Kenya", "South Africa", "Egypt", "Morocco", "Ghana", "Senegal", "Tunisia"],
  "India/South Asia": ["India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "Bhutan", "Maldives", "Afghanistan"],
  "Global South": Array.from(GLOBAL_SOUTH),
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function genreScore(project: Project, opp: Opportunity): { pts: number; reason: string | null } {
  if (!opp.genres || opp.genres.length === 0) {
    return { pts: WEIGHTS.genre, reason: "Open to all genres" };
  }
  const pg = norm(project.genre);
  const exact = opp.genres.some((g) => norm(g) === pg);
  if (exact) return { pts: WEIGHTS.genre, reason: `Genre match: ${project.genre}` };
  const partial = opp.genres.some((g) => norm(g).includes(pg) || pg.includes(norm(g)));
  if (partial) return { pts: Math.round(WEIGHTS.genre * 0.5), reason: `Related genre (${project.genre})` };
  return { pts: 0, reason: null };
}

function stageScore(project: Project, opp: Opportunity): { pts: number; reason: string | null } {
  if (!opp.stages || opp.stages.length === 0) {
    return { pts: WEIGHTS.stage, reason: "Accepts projects at any stage" };
  }
  if (opp.stages.includes(project.stage)) {
    return { pts: WEIGHTS.stage, reason: `Stage fit: ${project.stage.replace("_", "-")}` };
  }
  // Adjacent stage = half credit (e.g. development project vs pre-production fund)
  const order = ["development", "pre_production", "production", "post_production", "completed"];
  const pi = order.indexOf(project.stage);
  const adjacent = opp.stages.some((s) => Math.abs(order.indexOf(s) - pi) === 1);
  if (adjacent) return { pts: Math.round(WEIGHTS.stage * 0.5), reason: "Adjacent stage — apply when you advance" };
  return { pts: 0, reason: null };
}

function countryScore(project: Project, opp: Opportunity): { pts: number; reason: string | null } {
  if (opp.region === "Global") {
    return { pts: WEIGHTS.country, reason: "Open worldwide" };
  }
  if (!opp.country && !opp.region) {
    return { pts: WEIGHTS.country, reason: "Open worldwide" };
  }
  if (opp.country && norm(opp.country) === norm(project.country)) {
    return { pts: WEIGHTS.country, reason: `Eligible country: ${project.country}` };
  }
  if (opp.region) {
    const countries = REGION_MAP[opp.region] ?? [];
    if (countries.some((c) => norm(c) === norm(project.country))) {
      return { pts: WEIGHTS.country, reason: `Eligible region: ${opp.region}` };
    }
    if (opp.region === "Global South" && GLOBAL_SOUTH.has(project.country)) {
      return { pts: WEIGHTS.country, reason: "Global South eligible" };
    }
    // Region exists but country not in it — funder still hosts/operates there;
    // many European funds accept worldwide projects, give partial credit only
    // when the opportunity has no explicit country restriction.
    if (!opp.country) {
      return { pts: Math.round(WEIGHTS.country * 0.4), reason: null };
    }
  }
  return { pts: 0, reason: null };
}

function budgetScore(project: Project, opp: Opportunity): { pts: number; reason: string | null; warning: string | null } {
  const b = project.budget_usd;
  if (b == null) return { pts: Math.round(WEIGHTS.budget * 0.5), reason: null, warning: "Add a budget to improve match accuracy" };
  if (opp.min_budget_usd == null && opp.max_budget_usd == null) {
    return { pts: WEIGHTS.budget, reason: "No budget restrictions", warning: null };
  }
  const min = opp.min_budget_usd ?? 0;
  const max = opp.max_budget_usd ?? Number.POSITIVE_INFINITY;
  if (b >= min && b <= max) return { pts: WEIGHTS.budget, reason: "Budget within eligible range", warning: null };
  // within 25% of the boundary = partial
  if (b < min && b >= min * 0.75) return { pts: Math.round(WEIGHTS.budget * 0.5), reason: null, warning: "Budget slightly below the fund's minimum" };
  if (max !== Number.POSITIVE_INFINITY && b > max && b <= max * 1.25) return { pts: Math.round(WEIGHTS.budget * 0.5), reason: null, warning: "Budget slightly above the fund's maximum" };
  return { pts: 0, reason: null, warning: "Budget outside this opportunity's range" };
}

function formatScore(project: Project, opp: Opportunity): { pts: number; reason: string | null } {
  if (!opp.formats || opp.formats.length === 0) return { pts: WEIGHTS.format, reason: null };
  if (opp.formats.includes(project.format)) return { pts: WEIGHTS.format, reason: `Accepts ${project.format} films` };
  return { pts: 0, reason: null };
}

function fundingScore(project: Project, opp: Opportunity): { pts: number; reason: string | null; warning: string | null } {
  const need = project.funding_needed_usd;
  const award = opp.max_award_usd;
  if (need == null || award == null) return { pts: Math.round(WEIGHTS.funding * 0.5), reason: null, warning: null };
  if (award >= need) return { pts: WEIGHTS.funding, reason: "Award can cover your full funding gap", warning: null };
  const coverage = award / need;
  if (coverage >= 0.25) {
    return { pts: Math.round(WEIGHTS.funding * coverage), reason: `Covers ~${Math.round(coverage * 100)}% of your funding gap`, warning: null };
  }
  return { pts: 0, reason: null, warning: "Award is small relative to your funding need — consider stacking funds" };
}

function languageScore(project: Project, opp: Opportunity): { pts: number; reason: string | null } {
  if (!opp.languages || opp.languages.length === 0) return { pts: WEIGHTS.language, reason: null };
  if (opp.languages.some((l) => norm(l) === norm(project.language))) {
    return { pts: WEIGHTS.language, reason: `Language fit: ${project.language}` };
  }
  return { pts: 0, reason: null };
}

function historicalScore(historicalSuccessRate?: number): { pts: number; reason: string | null } {
  // Hook for learning loop: pass the platform-wide acceptance rate for this
  // opportunity with similar projects (0–1). Defaults to neutral half credit.
  if (historicalSuccessRate == null) return { pts: Math.round(WEIGHTS.historical * 0.5), reason: null };
  const pts = Math.round(WEIGHTS.historical * Math.min(Math.max(historicalSuccessRate, 0), 1));
  return { pts, reason: historicalSuccessRate >= 0.5 ? "Similar projects have succeeded here" : null };
}

export function tierOf(score: number): MatchResult["tier"] {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 60) return "possible";
  return "hidden";
}

export function calculateMatchScore(
  project: Project,
  opportunity: Opportunity,
  historicalSuccessRate?: number
): MatchResult {
  const reasons: string[] = [];
  const strengths: string[] = [];
  const warnings: string[] = [];

  const g = genreScore(project, opportunity);
  const st = stageScore(project, opportunity);
  const c = countryScore(project, opportunity);
  const b = budgetScore(project, opportunity);
  const f = formatScore(project, opportunity);
  const fu = fundingScore(project, opportunity);
  const l = languageScore(project, opportunity);
  const h = historicalScore(historicalSuccessRate);

  // Production partners: score on creative fit (genre, territory, format, budget range).
  // Funding coverage is irrelevant — they are co-production partners, not funders.
  // Redistribute the funding weight across genre + country + format.
  const isProducer = opportunity.opp_type === "producer";
  const parts = isProducer
    ? [
        { ...g,  w: WEIGHTS.genre + 4 },
        { ...st, w: WEIGHTS.stage },
        { ...c,  w: WEIGHTS.country + 3 },
        { ...b,  w: WEIGHTS.budget },
        { ...f,  w: WEIGHTS.format + 3 },
        { pts: 0, reason: null as string | null, warning: null as string | null, w: 0 },
        { ...l,  w: WEIGHTS.language },
        { ...h,  w: WEIGHTS.historical },
      ]
    : [
        { ...g, w: WEIGHTS.genre }, { ...st, w: WEIGHTS.stage }, { ...c, w: WEIGHTS.country },
        { ...b, w: WEIGHTS.budget }, { ...f, w: WEIGHTS.format }, { ...fu, w: WEIGHTS.funding },
        { ...l, w: WEIGHTS.language }, { ...h, w: WEIGHTS.historical },
      ];

  let score = 0;
  let dataPoints = 0;
  for (const p of parts) {
    score += p.pts;
    if (p.reason) {
      reasons.push(p.reason);
      if (p.pts === p.w) strengths.push(p.reason);
    }
    if ("warning" in p && p.warning) warnings.push(p.warning as string);
    if (p.pts > 0) dataPoints++;
  }

  // Hard eligibility gates: wrong stage AND wrong country = not eligible
  if (st.pts === 0 && c.pts === 0) {
    warnings.push("Likely ineligible — stage and territory both fall outside this opportunity's criteria");
    score = Math.min(score, 45);
  }

  // Deadline awareness
  if (opportunity.deadline) {
    const days = Math.ceil((new Date(opportunity.deadline).getTime() - Date.now()) / 86400000);
    if (days < 0) {
      warnings.push("Deadline has passed — watch for the next cycle");
      score = Math.min(score, 55);
    } else if (days <= 14) {
      warnings.push(`Deadline in ${days} day${days === 1 ? "" : "s"} — act now`);
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const confidence: MatchResult["confidence"] =
    dataPoints >= 6 ? "high" : dataPoints >= 4 ? "medium" : "low";

  return { score, tier: tierOf(score), confidence, reasons, strengths, warnings };
}

/** Rank a project against many opportunities; hidden tier filtered out. */
export function rankOpportunities(project: Project, opportunities: Opportunity[]) {
  return opportunities
    .map((o) => ({ opportunity: o, match: calculateMatchScore(project, o) }))
    .filter((r) => r.match.tier !== "hidden")
    .sort((a, b) => b.match.score - a.match.score);
}
