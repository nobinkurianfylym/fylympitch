// ============================================================
// FYLYMPITCH Matching Engine v2.0
// Weighted project-to-opportunity scoring.
// Pure function — no I/O, fully unit-testable.
//
// v2 changes what a missing criterion means.
//
// v1 treated "this fund published no genre restriction" and "this fund
// published a genre restriction and you match it" as the same thing: full
// marks. Four absences was 70 points, so a record with no metadata at all
// scored 93 and reported HIGH confidence. Since most of the catalogue has
// empty formats/stages/genres, that ranked the least-documented funds
// highest and told the filmmaker it was certain about them.
//
// Now each component reports whether the fund actually DECLARED the
// criterion. A declared match earns full marks and appears under "Why it
// fits". An unstated criterion earns partial credit and is reported
// separately as something the fund has not said. Confidence counts declared
// criteria, so it finally measures what it claims to.
//
// Weights (each column totals 100):
//              genre stage country budget format funding language historical
//   fund          20    20      15     15     10      10        5          5
//   partner       24    20      18     15     13       0        5          5
//
// A production partner is judged on creative fit, not on award size, so the
// funding weight is redistributed across genre, territory and format. In v1
// that redistribution silently did nothing: the score summed points computed
// against the BASE weight while the adjusted weight was used only to decide
// what counted as a strength. The effect was that an identical creative fit
// scored 88 as a producer versus 98 as a grant, and lost the three bullets
// the redistribution was meant to emphasise. Components now return a
// fraction and the assembly applies the weight, so the weights are the only
// place scoring policy lives.
// ============================================================

import type { MatchResult, Project, Opportunity } from "@/types";

/**
 * Credit awarded for a criterion the fund never published.
 *
 * Not zero: most funds that publish no format restriction really do accept
 * any format, so treating silence as exclusion would bury legitimate
 * opportunities. Not full either: we have not verified it, and saying so is
 * the whole point. A fund that declares nothing lands at the bottom of
 * "possible" with low confidence, rather than at the top of "excellent".
 */
const UNSTATED_CREDIT = 0.6;

const WEIGHTS_FUND = {
  genre: 20, stage: 20, country: 15, budget: 15,
  format: 10, funding: 10, language: 5, historical: 5,
} as const;

const WEIGHTS_PARTNER = {
  genre: 24, stage: 20, country: 18, budget: 15,
  format: 13, funding: 0, language: 5, historical: 5,
} as const;

type Component = keyof typeof WEIGHTS_FUND;

/** Opportunity types judged on creative fit rather than money. */
const PARTNER_TYPES = new Set([
  "producer", "co_producer", "production_company", "studio",
]);

type Part = {
  /** 0..1 of this component's weight. */
  frac: number;
  /** Did the opportunity actually publish this criterion? */
  declared: boolean;
  /** A verified fact about the fit. Only these become strengths. */
  reason: string | null;
  /** What this fund has not told us. */
  unstated: string | null;
  warning: string | null;
};

function part(p: Partial<Part> & { frac: number; declared: boolean }): Part {
  return { reason: null, unstated: null, warning: null, ...p };
}

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

function has(list: unknown): boolean {
  return Array.isArray(list) && list.length > 0;
}

// ── Components ───────────────────────────────────────────────────────────────

function genreScore(project: Project, opp: Opportunity): Part {
  if (!has(opp.genres)) {
    return part({ frac: UNSTATED_CREDIT, declared: false,
      unstated: "Eligible genres not stated by this fund" });
  }
  const pg = norm(project.genre);
  if (opp.genres.some((g) => norm(g) === pg)) {
    return part({ frac: 1, declared: true, reason: `Genre match: ${project.genre}` });
  }
  if (opp.genres.some((g) => norm(g).includes(pg) || (pg && pg.includes(norm(g))))) {
    return part({ frac: 0.5, declared: true, reason: `Related genre: ${project.genre}` });
  }
  return part({ frac: 0, declared: true });
}

function stageScore(project: Project, opp: Opportunity): Part {
  if (!has(opp.stages)) {
    return part({ frac: UNSTATED_CREDIT, declared: false,
      unstated: "Eligible production stages not stated by this fund" });
  }
  if (opp.stages.includes(project.stage)) {
    return part({ frac: 1, declared: true,
      reason: `Stage fit: ${project.stage.replace(/_/g, "-")}` });
  }
  const order = ["development", "pre_production", "production", "post_production", "completed"];
  const pi = order.indexOf(project.stage);
  if (opp.stages.some((s) => Math.abs(order.indexOf(s) - pi) === 1)) {
    return part({ frac: 0.5, declared: true,
      reason: "Adjacent stage, worth applying when you advance" });
  }
  return part({ frac: 0, declared: true });
}

function countryScore(project: Project, opp: Opportunity): Part {
  // "Global" is a positive statement of eligibility, not an absence.
  if (opp.region === "Global") {
    return part({ frac: 1, declared: true, reason: "Open worldwide" });
  }
  if (!opp.country && !opp.region) {
    return part({ frac: UNSTATED_CREDIT, declared: false,
      unstated: "Eligible territories not stated by this fund" });
  }
  if (opp.country && norm(opp.country) === norm(project.country)) {
    return part({ frac: 1, declared: true, reason: `Eligible country: ${project.country}` });
  }
  if (opp.region) {
    const countries = REGION_MAP[opp.region] ?? [];
    if (countries.some((c) => norm(c) === norm(project.country))) {
      return part({ frac: 1, declared: true, reason: `Eligible region: ${opp.region}` });
    }
    if (opp.region === "Global South" && GLOBAL_SOUTH.has(project.country)) {
      return part({ frac: 1, declared: true, reason: "Eligible as a Global South project" });
    }
    // A region with no explicit country restriction: many such funds accept
    // work from outside the region, so this is a weak maybe, not a match.
    if (!opp.country) {
      return part({ frac: 0.4, declared: true });
    }
  }
  return part({ frac: 0, declared: true });
}

function budgetScore(project: Project, opp: Opportunity): Part {
  const declared = opp.min_budget_usd != null || opp.max_budget_usd != null;
  const b = project.budget_usd;

  // Our gap, not the fund's: say so on the project rather than the fund.
  if (b == null) {
    return part({ frac: 0.5, declared,
      warning: "Add a budget to your project to sharpen this match" });
  }
  if (!declared) {
    return part({ frac: UNSTATED_CREDIT, declared: false,
      unstated: "Budget range not stated by this fund" });
  }

  const min = opp.min_budget_usd ?? 0;
  const max = opp.max_budget_usd ?? Number.POSITIVE_INFINITY;
  if (b >= min && b <= max) {
    return part({ frac: 1, declared: true, reason: "Budget within the eligible range" });
  }
  if (b < min && b >= min * 0.75) {
    return part({ frac: 0.5, declared: true,
      warning: "Budget slightly below the fund's minimum" });
  }
  if (max !== Number.POSITIVE_INFINITY && b > max && b <= max * 1.25) {
    return part({ frac: 0.5, declared: true,
      warning: "Budget slightly above the fund's maximum" });
  }
  return part({ frac: 0, declared: true,
    warning: "Budget outside this opportunity's range" });
}

function formatScore(project: Project, opp: Opportunity): Part {
  if (!has(opp.formats)) {
    return part({ frac: UNSTATED_CREDIT, declared: false,
      unstated: "Eligible formats not stated by this fund" });
  }
  if (opp.formats.includes(project.format)) {
    return part({ frac: 1, declared: true, reason: `Accepts ${project.format} films` });
  }
  return part({ frac: 0, declared: true });
}

function fundingScore(project: Project, opp: Opportunity): Part {
  const need = project.funding_needed_usd;
  const award = opp.max_award_usd;

  if (award == null) {
    return part({ frac: UNSTATED_CREDIT, declared: false,
      unstated: "Award size not published by this fund" });
  }
  if (need == null) {
    return part({ frac: 0.5, declared: true,
      warning: "Add your funding need to see how far this award goes" });
  }
  if (award >= need) {
    return part({ frac: 1, declared: true, reason: "Award can cover your full funding gap" });
  }
  const coverage = award / need;
  if (coverage >= 0.25) {
    return part({ frac: coverage, declared: true,
      reason: `Covers about ${Math.round(coverage * 100)}% of your funding gap` });
  }
  return part({ frac: 0, declared: true,
    warning: "Award is small next to your funding need, so plan to stack funds" });
}

function languageScore(project: Project, opp: Opportunity): Part {
  if (!has(opp.languages)) {
    return part({ frac: UNSTATED_CREDIT, declared: false,
      unstated: "Eligible languages not stated by this fund" });
  }
  if (opp.languages.some((l) => norm(l) === norm(project.language))) {
    return part({ frac: 1, declared: true, reason: `Language fit: ${project.language}` });
  }
  return part({ frac: 0, declared: true });
}

function historicalScore(rate?: number): Part {
  // Hook for the learning loop: platform-wide acceptance rate for this
  // opportunity with similar projects (0-1). Not surfaced as an unknown,
  // because it is our own missing signal rather than anything the fund owes.
  if (rate == null) return part({ frac: 0.5, declared: false });
  const clamped = Math.min(Math.max(rate, 0), 1);
  return part({
    frac: clamped, declared: true,
    reason: clamped >= 0.5 ? "Similar projects have succeeded here" : null,
  });
}

// ── Assembly ─────────────────────────────────────────────────────────────────

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
  const unstated: string[] = [];
  const warnings: string[] = [];

  const parts: Record<Component, Part> = {
    genre:      genreScore(project, opportunity),
    stage:      stageScore(project, opportunity),
    country:    countryScore(project, opportunity),
    budget:     budgetScore(project, opportunity),
    format:     formatScore(project, opportunity),
    funding:    fundingScore(project, opportunity),
    language:   languageScore(project, opportunity),
    historical: historicalScore(historicalSuccessRate),
  };

  const weights = PARTNER_TYPES.has(opportunity.opp_type)
    ? WEIGHTS_PARTNER
    : WEIGHTS_FUND;

  let score = 0;
  let declaredCount = 0;

  for (const key of Object.keys(parts) as Component[]) {
    const weight = weights[key];
    if (weight === 0) continue; // e.g. funding carries no weight for a partner

    const p = parts[key];
    score += p.frac * weight;
    if (p.declared) declaredCount++;

    if (p.reason) {
      reasons.push(p.reason);
      // A strength is a verified full match. An unstated criterion has no
      // reason string, so it can never reach this list.
      if (p.declared && p.frac === 1) strengths.push(p.reason);
    }
    if (p.unstated) unstated.push(p.unstated);
    if (p.warning) warnings.push(p.warning);
  }

  // Hard eligibility gate: wrong stage AND wrong territory, both declared.
  if (parts.stage.frac === 0 && parts.country.frac === 0) {
    warnings.push("Likely ineligible: stage and territory both fall outside this opportunity's criteria");
    score = Math.min(score, 45);
  }

  if (opportunity.deadline) {
    const days = Math.ceil((new Date(opportunity.deadline).getTime() - Date.now()) / 86400000);
    if (days < 0) {
      warnings.push("Deadline has passed, so watch for the next cycle");
      score = Math.min(score, 55);
    } else if (days <= 14) {
      warnings.push(`Deadline in ${days} day${days === 1 ? "" : "s"}, act now`);
    }
  }

  if (opportunity.copro_required) {
    if ((project as any).has_coproducer) {
      score += 8;
      reasons.push("Co-producer attached, meeting the fund's requirement");
    } else {
      warnings.push("This fund requires a confirmed co-producer");
    }
  }

  score = Math.max(0, Math.min(99, Math.round(score)));

  // Confidence now counts criteria the FUND declared, not components that
  // happened to score. In v1 an empty record scored on everything and was
  // therefore reported as high confidence.
  const confidence: MatchResult["confidence"] =
    declaredCount >= 6 ? "high" : declaredCount >= 3 ? "medium" : "low";

  return { score, tier: tierOf(score), confidence, reasons, strengths, unstated, warnings, declaredCount };
}

/** Rank a project against many opportunities; hidden tier filtered out. */
export function rankOpportunities(project: Project, opportunities: Opportunity[]) {
  return opportunities
    .map((o) => ({ opportunity: o, match: calculateMatchScore(project, o) }))
    .filter((r) => r.match.tier !== "hidden")
    .sort((a, b) => b.match.score - a.match.score);
}
