// Score distribution across the whole seed catalogue.
//
// Written to recalibrate the tier boundaries after the v2 scoring change.
// v1 compressed every score into roughly 93-99, because a criterion the fund
// never published scored full marks. v2 spreads the same catalogue across
// 40-98. The boundaries 90 / 75 / 60 were chosen for the compressed scale, so
// they need re-deriving rather than re-guessing.
//
// Run: npx tsx scripts/score-distribution.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateMatchScore } from "../services/matching.ts";
import { parseSeed } from "./gen-homepage-demo.ts";
import type { Opportunity, Project } from "../types/index.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const active: Opportunity[] = parseSeed(
  fs.readFileSync(path.join(ROOT, "supabase/migrations/005_master_data_seed.sql"), "utf8"),
).filter(o => o.is_active);

// A spread of realistic filmmaker profiles, not just the three demo samples,
// so the distribution is not an artefact of one project's attributes.
const mk = (o: any): Project => ({
  id: o.id, owner_id: "x", title: o.id, slug: "x",
  genre: o.genre, format: o.format, language: o.language, country: o.country,
  stage: o.stage, budget_usd: o.budget, funding_needed_usd: o.need,
  logline: "x", synopsis: "x", is_public: true, created_at: "",
} as any);

const PROFILES: Project[] = [
  mk({ id: "in-comedy-dev",  genre: "Comedy",      format: "feature",     language: "Hindi",      country: "India",         stage: "development",    budget: 2500000, need: 1800000 }),
  mk({ id: "in-drama-pre",   genre: "Drama",       format: "feature",     language: "Malayalam",  country: "India",         stage: "pre_production", budget: 1500000, need: 1100000 }),
  mk({ id: "in-doc-dev",     genre: "Documentary", format: "documentary", language: "English",    country: "India",         stage: "development",    budget:  200000, need:  150000 }),
  mk({ id: "fr-drama-prod",  genre: "Drama",       format: "feature",     language: "French",     country: "France",        stage: "production",     budget: 3000000, need: 1200000 }),
  mk({ id: "us-doc-post",    genre: "Documentary", format: "documentary", language: "English",    country: "United States", stage: "post_production",budget:  400000, need:  120000 }),
  mk({ id: "ng-drama-dev",   genre: "Drama",       format: "feature",     language: "English",    country: "Nigeria",       stage: "development",    budget:  600000, need:  500000 }),
  mk({ id: "br-short-dev",   genre: "Drama",       format: "short",       language: "Portuguese", country: "Brazil",        stage: "development",    budget:   60000, need:   50000 }),
  mk({ id: "de-anim-pre",    genre: "Animation",   format: "animation",   language: "German",     country: "Germany",       stage: "pre_production", budget: 4000000, need: 2500000 }),
];

const scores: number[] = [];
for (const p of PROFILES) for (const o of active) scores.push(calculateMatchScore(p, o).score);
scores.sort((a, b) => a - b);

const pct = (q: number) => scores[Math.min(scores.length - 1, Math.floor(q * scores.length))];
const countAtLeast = (n: number) => scores.filter(s => s >= n).length;
const share = (n: number) => (100 * countAtLeast(n) / scores.length);

console.log(`\n${PROFILES.length} profiles x ${active.length} opportunities = ${scores.length} scores\n`);
console.log("Percentiles:");
for (const q of [0.01, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99]) {
  console.log(`  p${String(Math.round(q * 100)).padStart(2)}  ${pct(q)}`);
}
console.log(`  min ${scores[0]}   max ${scores[scores.length - 1]}`);

console.log("\nHistogram (10-point buckets):");
for (let lo = 0; lo < 100; lo += 10) {
  const n = scores.filter(s => s >= lo && s < lo + 10).length;
  if (!n && lo < 30) continue;
  const pctOf = 100 * n / scores.length;
  console.log(`  ${String(lo).padStart(2)}-${String(lo + 9).padStart(2)}  ${String(n).padStart(5)}  ${"#".repeat(Math.round(pctOf / 2))} ${pctOf.toFixed(1)}%`);
}

console.log("\nShare of the catalogue at or above each candidate cutoff:");
for (const n of [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]) {
  console.log(`  >= ${String(n).padStart(2)}   ${share(n).toFixed(1).padStart(5)}%   (${countAtLeast(n)} of ${scores.length})`);
}
