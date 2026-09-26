// Standalone test for the matching engine (no framework needed).
// Run: npm run test:matching
//
// v2 note: three assertions in v1 asserted that an opportunity with EMPTY
// metadata scores 90+ with high confidence. That was the bug, written down as
// a requirement. They are now inverted: an undeclared criterion must score
// lower than a declared match and must never appear as a reason the project
// fits.
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

// Declares nothing at all. The whole point of v2.
const openOpp: any = {
  ...perfectOpp, id: "o3", title: "Undocumented Fund",
  country: null, region: null, genres: [], formats: [], stages: [],
  languages: [], min_budget_usd: null, max_budget_usd: null, max_award_usd: null,
};

console.log("\n— Matching engine tests —");

const r1 = calculateMatchScore(project, perfectOpp);
expect("perfect match scores 90+ (excellent)", r1.score >= 90 && r1.tier === "excellent", r1);
expect("perfect match has strengths", r1.strengths.length >= 5, r1.strengths);
expect("perfect match no warnings", r1.warnings.length === 0, r1.warnings);
expect("perfect match states nothing as unknown", r1.unstated.length === 0, r1.unstated);
expect("perfect match reports high confidence", r1.confidence === "high", r1.confidence);

const r2 = calculateMatchScore(project, wrongOpp);
expect("total mismatch is hidden tier", r2.tier === "hidden", r2);
expect("mismatch carries eligibility warning", r2.warnings.length > 0, r2.warnings);
expect("a DECLARED mismatch is still high confidence", r2.confidence === "high", r2);

// ── The v2 contract: absence is not evidence ────────────────────────────────
const r3 = calculateMatchScore(project, openOpp);
expect("undocumented fund is NOT excellent", r3.tier !== "excellent", r3);
expect("undocumented fund scores below a declared match", r3.score < r1.score, { r3: r3.score, r1: r1.score });
expect("undocumented fund has NO strengths", r3.strengths.length === 0, r3.strengths);
expect("undocumented fund reports low confidence", r3.confidence === "low", r3.confidence);
expect("undocumented fund declared nothing", r3.declaredCount === 0, r3.declaredCount);
expect("undocumented fund lists what it never stated", r3.unstated.length >= 5, r3.unstated);
expect("undocumented fund is still visible, not hidden", r3.tier !== "hidden", r3.tier);

// An absence must never be phrased as a reason the project fits.
const ABSENCE_WORDS = ["not stated", "not published", "open to all", "any stage", "no budget restrictions"];
const allStrengths = [r1, r2, r3].flatMap(r => r.strengths).map(s => s.toLowerCase());
expect("no strength is phrased as an absence",
  !allStrengths.some(s => ABSENCE_WORDS.some(w => s.includes(w))), allStrengths);

// ── Production partners are scored on creative fit, at full weight ──────────
// v1 summed points against the BASE weight while comparing them to the
// REDISTRIBUTED weight, so an identical fit scored 10 lower as a producer and
// lost its genre, territory and format bullets.
const asPartner = calculateMatchScore(project, { ...perfectOpp, opp_type: "production_company" });
expect("partner scores the same as a fund on identical creative fit",
  Math.abs(asPartner.score - r1.score) <= 2, { partner: asPartner.score, fund: r1.score });
expect("partner keeps its genre / territory / format strengths",
  ["Genre match", "Eligible", "Accepts"].every(k => asPartner.strengths.some(s => s.includes(k))),
  asPartner.strengths);

const pastDeadline: any = { ...perfectOpp, id: "o4", deadline: "2024-01-01" };
const r4 = calculateMatchScore(project, pastDeadline);
expect("past deadline caps score at 55", r4.score <= 55, r4);
expect("past deadline warns", r4.warnings.some(w => w.includes("Deadline has passed")), r4.warnings);

const adjacent: any = { ...perfectOpp, id: "o5", stages: ["pre_production"] };
const r5 = calculateMatchScore(project, adjacent);
expect("adjacent stage gets partial credit", r5.score > 70 && r5.score < r1.score, r5);
expect("adjacent stage is not a strength", !r5.strengths.some(s => s.startsWith("Stage fit")), r5.strengths);

const noBudget = { ...project, budget_usd: null };
const r6 = calculateMatchScore(noBudget, perfectOpp);
expect("missing project budget warns", r6.warnings.some(w => w.toLowerCase().includes("budget")), r6);

const ranked = rankOpportunities(project, [wrongOpp, perfectOpp, openOpp, pastDeadline]);
expect("ranking hides 'hidden' tier", ranked.every(r => r.match.tier !== "hidden"), ranked.map(r => r.match.tier));
expect("ranking sorted descending", ranked[0].match.score >= ranked[ranked.length - 1].match.score);
expect("score never exceeds 100", ranked.every(r => r.match.score <= 100));
expect("a documented match outranks an undocumented one",
  ranked[0].opportunity.id === "o1", ranked.map(r => [r.opportunity.id, r.match.score]));

expect("tier boundaries", tierOf(90) === "excellent" && tierOf(89) === "strong" && tierOf(75) === "strong" && tierOf(74) === "possible" && tierOf(60) === "possible" && tierOf(59) === "hidden");

// ── Region handling (MASTER_DATA import) ───────────────────────────────────
// "Global" is a positive statement of eligibility, so it IS a declared match
// even though the other columns are empty. The score therefore sits below a
// fully documented fund but above an undocumented one.
const globalOpp: any = { ...perfectOpp, id: "o6", country: "United States", region: "Global", genres: [], formats: [], stages: [], languages: [] };
const r7 = calculateMatchScore(project, globalOpp);
expect("'Global' region counts as declared worldwide eligibility",
  r7.strengths.includes("Open worldwide"), r7.strengths);
expect("'Global' region scores between undocumented and fully documented",
  r7.score > r3.score && r7.score < r1.score, { r3: r3.score, r7: r7.score, r1: r1.score });

const southAsiaOpp: any = { ...perfectOpp, id: "o7", country: null, region: "India/South Asia", genres: [], formats: [], stages: [], languages: [] };
const r8 = calculateMatchScore(project, southAsiaOpp);
expect("'India/South Asia' region credits an Indian project's country",
  r8.strengths.some(s => s.includes("Eligible region")), r8.strengths);

const nonSouthAsiaProject: any = { ...project, country: "France" };
const r9 = calculateMatchScore(nonSouthAsiaProject, southAsiaOpp);
expect("'India/South Asia' region does not credit a French project's country", r9.score < r8.score, { r8: r8.score, r9: r9.score });

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
