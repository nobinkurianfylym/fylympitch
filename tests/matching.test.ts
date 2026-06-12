// Standalone test for the matching engine (no framework needed).
// Run: npm run test:matching
import { calculateMatchScore, rankOpportunities, tierOf } from "../services/matching.ts";

let pass = 0, fail = 0;
function expect(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.error(`  FAIL  ${name}`, detail ?? ""); }
}

const project: any = {
  id: "p1", owner_id: "u1",
  title: "End of the Day", genre: "Drama", format: "feature",
  language: "Malayalam", country: "India",
  budget_usd: 400000, funding_needed_usd: 150000,
  stage: "development", logline: "x", synopsis: null,
  director_statement: null, producer_info: null,
  pitch_deck_path: null, script_path: null, is_public: true, created_at: "",
};

const perfectOpp: any = {
  id: "o1", title: "Perfect Fund", opp_type: "fund", description: null,
  country: "India", region: "Asia-Pacific",
  genres: ["Drama"], formats: ["feature"], stages: ["development"],
  languages: ["Malayalam"], min_budget_usd: 100000, max_budget_usd: 1000000,
  max_award_usd: 200000, deadline: null, url: null, is_active: true,
};

const wrongOpp: any = {
  ...perfectOpp, id: "o2", title: "Wrong Fund",
  country: "France", region: "Europe", genres: ["Horror"],
  formats: ["animation"], stages: ["completed"], languages: ["French"],
  min_budget_usd: 5000000, max_budget_usd: 50000000, max_award_usd: 1000,
};

const openOpp: any = {
  ...perfectOpp, id: "o3", title: "Open Worldwide Fund",
  country: null, region: null, genres: [], formats: [], stages: [],
  languages: [], min_budget_usd: null, max_budget_usd: null, max_award_usd: null,
};

console.log("\n— Matching engine tests —");

const r1 = calculateMatchScore(project, perfectOpp);
expect("perfect match scores 90+ (excellent)", r1.score >= 90 && r1.tier === "excellent", r1);
expect("perfect match has strengths", r1.strengths.length >= 5, r1.strengths);
expect("perfect match no warnings", r1.warnings.length === 0, r1.warnings);

const r2 = calculateMatchScore(project, wrongOpp);
expect("total mismatch is hidden tier", r2.tier === "hidden", r2);
expect("mismatch carries eligibility warning", r2.warnings.length > 0, r2.warnings);

const r3 = calculateMatchScore(project, openOpp);
expect("open opportunity scores 90+ with neutral history", r3.score >= 90, r3);
expect("confidence is high with many data points", r3.confidence === "high", r3);

const pastDeadline: any = { ...perfectOpp, id: "o4", deadline: "2024-01-01" };
const r4 = calculateMatchScore(project, pastDeadline);
expect("past deadline caps score at 55", r4.score <= 55, r4);
expect("past deadline warns", r4.warnings.some(w => w.includes("Deadline has passed")), r4.warnings);

const adjacent: any = { ...perfectOpp, id: "o5", stages: ["pre_production"] };
const r5 = calculateMatchScore(project, adjacent);
expect("adjacent stage gets partial credit", r5.score > 70 && r5.score < r1.score, r5);

const noBudget = { ...project, budget_usd: null };
const r6 = calculateMatchScore(noBudget, perfectOpp);
expect("missing budget warns and gives half credit", r6.warnings.some(w => w.includes("budget")) || r6.warnings.some(w => w.includes("Budget")), r6);

const ranked = rankOpportunities(project, [wrongOpp, perfectOpp, openOpp, pastDeadline]);
expect("ranking hides 'hidden' tier", ranked.every(r => r.match.tier !== "hidden"), ranked.map(r => r.match.tier));
expect("ranking sorted descending", ranked[0].match.score >= ranked[ranked.length - 1].match.score);
expect("score never exceeds 100", ranked.every(r => r.match.score <= 100));

expect("tier boundaries", tierOf(90) === "excellent" && tierOf(89) === "strong" && tierOf(75) === "strong" && tierOf(74) === "possible" && tierOf(60) === "possible" && tierOf(59) === "hidden");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
