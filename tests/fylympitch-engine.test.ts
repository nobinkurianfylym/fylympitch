// Standalone verification for FYLYMPITCH ENGINE (no framework needed).
// Run: npm run test:engine
//
// Exercises all 8 modules with a representative "Monsoon Diaries" project:
// hybrid matching, FRS, funding discovery, obstacles, roadmap, producer
// matches, AI Executive Producer (heuristic — no OPENAI_API_KEY in this
// run), and the dream scenario. Prints the full structured result so it
// can be eyeballed against the project-page mockup before wiring in.

import {
  runFylympitchEngine,
  type ProducerMatchProfile,
  type OpportunityIntelligenceExtras,
} from "../services/fylympitchEngine.ts";

let pass = 0, fail = 0;
function expect(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.error(`  FAIL  ${name}`, detail ?? ""); }
}

// ---------- Sample project: "Monsoon Diaries" ----------
const project: any = {
  id: "p1",
  owner_id: "u1",
  title: "Monsoon Diaries",
  genre: "Drama",
  format: "feature",
  language: "Malayalam",
  country: "India",
  budget_usd: 400000,
  funding_needed_usd: 150000,
  stage: "development",
  logline: "A fisherman's daughter unearths a decades-old shipwreck and the truth it was built to hide.",
  synopsis: "Asha mends nets in the harbor where her grandfather vanished thirty years ago. A storm drags an unmarked vessel ashore, and the logbook inside ties the village's most respected family to his disappearance.",
  director_statement: "I grew up on stories of the sea giving things back — debris, memories, debts.",
  producer_info: "Developed independently by the writer-director; seeking co-production and financing partners.",
  pitch_deck_path: "u1/monsoon-diaries-deck.pdf",
  script_path: "u1/monsoon-diaries-script.pdf",
  is_public: true,
  created_at: new Date().toISOString(),
  career_stage: "Emerging",
};

// ---------- Sample opportunities ----------
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

const opportunities: any[] = [
  {
    id: "o1", title: "Kerala State Co-Production Grant", opp_type: "grant",
    description: null, country: "India", region: "Asia-Pacific",
    genres: ["Drama"], formats: ["feature"], stages: ["development"], languages: ["Malayalam"],
    min_budget_usd: null, max_budget_usd: null, max_award_usd: 300000,
    deadline: null, url: null, is_active: true,
  },
  {
    id: "o2", title: "Torino FilmLab", opp_type: "lab",
    description: null, country: "Italy", region: "Europe",
    genres: [], formats: ["feature"], stages: ["development"], languages: [],
    min_budget_usd: null, max_budget_usd: null, max_award_usd: 200000,
    deadline: inDays(12), url: null, is_active: true,
  },
  {
    id: "o3", title: "South Asian Voices Fund", opp_type: "investor",
    description: null, country: null, region: "Global South",
    genres: ["Drama", "Thriller"], formats: ["feature"], stages: ["development", "pre_production"], languages: [],
    min_budget_usd: 100000, max_budget_usd: 600000, max_award_usd: 300000,
    deadline: null, url: null, is_active: true,
  },
  {
    id: "o4", title: "Sundance Institute Feature Film Program", opp_type: "lab",
    description: null, country: null, region: "Americas",
    genres: ["drama"], formats: ["feature"], stages: ["development"], languages: ["English"],
    min_budget_usd: null, max_budget_usd: null, max_award_usd: null,
    deadline: null, url: null, is_active: true,
  },
];

// Career-stage / match-weight extras, as imported from MASTER_DATA columns.
const opportunityExtras: Record<string, OpportunityIntelligenceExtras> = {
  o2: { career_stages: ["Emerging", "First-time"], match_weight: "high" },
};

// ---------- Sample producer / investor profiles ----------
const producerProfiles: ProducerMatchProfile[] = [
  {
    id: "pr1", full_name: "Lumen Pictures", company: "Lumen Pictures", role: "producer",
    genres: ["Drama"], formats: ["feature"], countries: [],
    min_budget_usd: 100000, max_budget_usd: 1000000, available_funding_usd: 300000,
    festival_track_record: true,
  },
  {
    id: "pr2", full_name: "South Indies Collective", company: "South Indies Collective", role: "producer",
    genres: ["Drama", "Thriller"], formats: ["feature", "documentary"], countries: ["India"],
    min_budget_usd: 50000, max_budget_usd: 500000, available_funding_usd: 120000,
    festival_track_record: false,
  },
  {
    id: "pr3", full_name: "Wild Bunch Intl.", company: "Wild Bunch Intl.", role: "investor",
    genres: [], formats: [], countries: [],
    min_budget_usd: 500000, max_budget_usd: 5000000, available_funding_usd: 1200000,
    festival_track_record: true,
  },
  {
    // No matching signal at all — should be excluded entirely, not default
    // to a high "open to everything" score.
    id: "pr4", full_name: "Empty Profile Productions", company: null, role: "producer",
    genres: [], formats: [], countries: [],
    min_budget_usd: null, max_budget_usd: null, available_funding_usd: null,
    festival_track_record: false,
  },
];

console.log("\n— FYLYMPITCH ENGINE verification —\n");

const result = await runFylympitchEngine({
  project,
  opportunities,
  opportunityExtras,
  producerProfiles,
  openaiApiKey: process.env.OPENAI_API_KEY, // undefined here -> heuristic EP brief
});

// ---------- 1. Hybrid matching ----------
console.log("1. Hybrid opportunity matches:");
for (const m of result.matches) {
  console.log(`   ${m.match.score.toString().padStart(3)}  ${m.match.tier.padEnd(9)} ${m.opportunity.title}`);
}
const torino = result.matches.find((m) => m.opportunity.id === "o2")!;
expect("Torino FilmLab gets a career-stage + weight bump", torino.match.score > 83, torino.match.score); // base ~83
expect("all returned matches clear the hidden tier", result.matches.every((m) => m.match.tier !== "hidden"));

// ---------- 2. Funding readiness ----------
console.log(`\n2. Funding readiness: ${result.funding_readiness.score}/100`);
if (result.funding_readiness.missing.length) {
  console.log(`   Missing: ${result.funding_readiness.missing.join(", ")}`);
}
expect("complete project scores 100 on FRS", result.funding_readiness.score === 100, result.funding_readiness);

// ---------- 3. Funding discovery ----------
console.log(`\n3. Funding discovery: $${result.funding_discovery.total_usd.toLocaleString()} total`);
for (const b of result.funding_discovery.breakdown) {
  console.log(`   ${b.label.padEnd(22)} $${b.amount_usd.toLocaleString().padStart(10)}  (${b.count})`);
}
console.log("   Source counts:", result.funding_discovery.source_counts);
expect("funding discovery total is positive", result.funding_discovery.total_usd > 0);
expect("source counts include 2 producers and 1 investor",
  result.funding_discovery.source_counts.producers === 2 && result.funding_discovery.source_counts.investors === 1,
  result.funding_discovery.source_counts);

// ---------- 4. Funding obstacles ----------
console.log(`\n4. Funding obstacles (${result.obstacles.length}):`);
for (const o of result.obstacles) {
  console.log(`   [${o.severity.toUpperCase()}] ${o.label}  →  ${o.action_label} (${o.action_href})`);
}
expect("flags missing cast/co-producer/festival strategy",
  result.obstacles.map((o) => o.id).join(",") === "no_actor,no_coproducer,no_festival_strategy",
  result.obstacles);
expect("does NOT flag budget — project budget is within matched ranges",
  !result.obstacles.some((o) => o.id === "budget_high"));

// ---------- 5. Financing roadmap ----------
console.log(`\n5. Roadmap — current stage: ${result.roadmap.current} (success probability ${result.roadmap.success_probability}%)`);
console.log(`   ${result.roadmap.stages.map((s) => `${s.label}${s.status === "current" ? "*" : ""}`).join(" → ")}`);
console.log(`   Recommendation: ${result.roadmap.recommendation}`);
expect("development-stage project with a deck lands on 'labs'", result.roadmap.current === "labs");
expect("success probability is within 0-100", result.roadmap.success_probability >= 0 && result.roadmap.success_probability <= 100);

// ---------- 6. Producer matches ----------
console.log(`\n6. Producer matches (${result.producer_matches.length}):`);
for (const p of result.producer_matches) {
  console.log(`   ${p.score.toString().padStart(3)}  ${p.tier.padEnd(9)} ${p.profile.full_name} — ${p.reasons.join(", ")}`);
}
expect("Lumen Pictures is the top producer match", result.producer_matches[0]?.profile.full_name === "Lumen Pictures", result.producer_matches);
expect("top match is 'excellent' tier", result.producer_matches[0]?.tier === "excellent");
expect("profile with no matching signal is excluded entirely",
  !result.producer_matches.some((p) => p.profile.full_name === "Empty Profile Productions"),
  result.producer_matches);

// ---------- 7. AI Executive Producer ----------
console.log(`\n7. AI Executive Producer (${result.executive_producer.generated_by}):`);
console.log(`   Next best move: ${result.executive_producer.next_best_move.title}`);
console.log(`   Funding range:  ${result.executive_producer.next_best_move.funding_range}`);
console.log(`   Deadline:       ${result.executive_producer.next_best_move.deadline_days ?? "—"} days`);
console.log(`   Success chance: ${result.executive_producer.next_best_move.success_chance}%`);
console.log(`   Summary: ${result.executive_producer.summary}`);
expect("falls back to heuristic without OPENAI_API_KEY", result.executive_producer.generated_by === "heuristic");
expect("next best move points at a real matched opportunity",
  result.matches.some((m) => m.opportunity.id === result.executive_producer.next_best_move.opportunity_id));

// ---------- 8. Dream scenario ----------
console.log(`\n8. Dream scenario:`);
console.log(`   Funding:                $${result.dream_scenario.funding_usd.toLocaleString()}`);
console.log(`   Production start:       ${result.dream_scenario.production_start}`);
console.log(`   Festival premiere:      ${result.dream_scenario.festival_premiere}`);
console.log(`   Distribution probability: ${result.dream_scenario.distribution_probability}%`);
console.log(`   Projected ROI:          ${result.dream_scenario.projected_roi}x`);
expect("dream scenario funding matches funding discovery total", result.dream_scenario.funding_usd === result.funding_discovery.total_usd);
expect("projected ROI reflects sub-$500K budget + high FRS bonus", result.dream_scenario.projected_roi === 2.4, result.dream_scenario);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
