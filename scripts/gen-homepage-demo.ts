// ============================================================
// scripts/gen-homepage-demo.ts
// Regenerates components/homepage-demo-data.ts — the honest, real
// FYLYMPITCH ENGINE output shown in the homepage "See the engine in
// action" section.
//
// It parses the live MASTER_DATA opportunity catalog straight from
// supabase/migrations/005_master_data_seed.sql, runs the ACTUAL engine
// (services/fylympitchEngine.ts) against three representative sample
// projects, and writes the genuine results out as a typed data module.
//
// No fabricated, mock, or hand-tuned numbers: every score, readiness
// value, match count and award is real engine output. Only the sample
// project INPUTS are authored here (a demo needs a sample project);
// the OUTPUTS are whatever the engine produces.
//
// Run:  npx tsx scripts/gen-homepage-demo.ts
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runFylympitchEngine, rankHybridMatches } from "../services/fylympitchEngine.ts";
import { usd, TYPE_LABEL } from "../lib/format.ts";
import type { Opportunity, Project } from "../types/index.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED = path.join(ROOT, "supabase/migrations/005_master_data_seed.sql");

// ---- Parse the MASTER_DATA seed INSERT into Opportunity rows ----
const COLS = ["title","opp_type","description","country","region","genres","formats","stages","languages","min_budget_usd","max_budget_usd","max_award_usd","deadline","url","is_active","career_stages","match_weight","gender_focus","copro_required","festival_affiliated","ott_affiliated","contact_email","contact_phone","key_person","app_link","deadline_note"];

function parseSeed(sql: string): Opportunity[] {
  const start = sql.toLowerCase().indexOf(") values") + ") values".length;
  const end = sql.toLowerCase().lastIndexOf("on conflict");
  const body = sql.slice(start, end).trim().replace(/;\s*$/, "").trim();

  // Split into top-level ( ... ) rows, respecting '' escapes
  const rows: string[] = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === "(") {
      let depth = 0, inStr = false, buf = "";
      let j = i;
      while (j < body.length) {
        const c = body[j];
        if (inStr) {
          if (c === "'") { if (body[j+1] === "'") { buf += "''"; j += 2; continue; } inStr = false; buf += c; j++; continue; }
          buf += c; j++; continue;
        }
        if (c === "'") { inStr = true; buf += c; j++; continue; }
        if (c === "(") { depth++; if (depth === 1) { j++; continue; } buf += c; j++; continue; }
        if (c === ")") { depth--; if (depth === 0) { j++; break; } buf += c; j++; continue; }
        buf += c; j++;
      }
      rows.push(buf); i = j;
    } else i++;
  }

  const splitFields = (row: string): string[] => {
    const out: string[] = []; let buf = ""; let inStr = false; let k = 0;
    while (k < row.length) {
      const c = row[k];
      if (inStr) {
        if (c === "'") { if (row[k+1] === "'") { buf += "'"; k += 2; continue; } inStr = false; k++; continue; }
        buf += c; k++; continue;
      }
      if (c === "'") { inStr = true; k++; continue; }
      if (c === ",") { out.push(buf.trim()); buf = ""; k++; continue; }
      buf += c; k++;
    }
    out.push(buf.trim());
    return out;
  };

  const parseArr = (s: string): string[] => {
    const t = s.trim();
    if (t === "{}" || t === "") return [];
    const inner = t.startsWith("{") ? t.slice(1, -1) : t;
    if (!inner) return [];
    const out: string[] = []; let cur = ""; let inq = false;
    for (const ch of inner) {
      if (ch === '"') { inq = !inq; continue; }
      if (ch === "," && !inq) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(Boolean);
  };

  const opps: Opportunity[] = [];
  rows.forEach((row, idx) => {
    const f = splitFields(row);
    if (f.length !== COLS.length) return;
    const o: any = { id: `seed-${idx}` };
    COLS.forEach((col, ci) => {
      const raw = f[ci]; const v = raw.trim();
      if (v === "null") { o[col] = null; return; }
      if (v === "true") { o[col] = true; return; }
      if (v === "false") { o[col] = false; return; }
      if (["genres","formats","stages","languages","career_stages"].includes(col)) { o[col] = parseArr(raw); return; }
      if (["min_budget_usd","max_budget_usd","max_award_usd"].includes(col)) { const n = parseInt(v, 10); o[col] = Number.isFinite(n) ? n : null; return; }
      o[col] = raw;
    });
    opps.push(o as Opportunity);
  });
  return opps;
}

const active = parseSeed(fs.readFileSync(SEED, "utf8")).filter(o => o.is_active);
const extras: Record<string, any> = {};
for (const o of active) extras[o.id] = { career_stages: o.career_stages ?? [], match_weight: o.match_weight ?? undefined, festival_affiliated: o.festival_affiliated, ott_affiliated: o.ott_affiliated };

// ---- Representative sample projects (INPUTS only; realistically incomplete) ----
function mk(over: any): Project & { career_stage?: string } {
  return {
    id: over.id, owner_id: "sample", title: over.title, slug: "sample",
    genre: over.genre, format: over.format, language: over.language, country: over.country,
    budget_currency: "USD", budget_usd: over.budget_usd, budget_amount: over.budget_usd,
    finance_secured_usd: 0, finance_secured_amount: 0,
    funding_needed_usd: over.funding_needed_usd, funding_needed_amount: over.funding_needed_usd,
    stage: over.stage ?? "development", logline: "Representative sample logline.",
    synopsis: "Representative sample synopsis.",
    director_statement: "director_statement" in over ? over.director_statement : "Sample statement.",
    producer_info: "producer_info" in over ? over.producer_info : "Attached producer.",
    director_name: "Sample Director", writer_name: "Sample Writer",
    pitch_deck_path: "pitch_deck_path" in over ? over.pitch_deck_path : "sample.pdf",
    script_path: "script_path" in over ? over.script_path : "sample.pdf",
    poster_path: null, has_script_doc: true, has_budget_doc: true, has_lookbook: true,
    has_coproducer: over.has_coproducer ?? true, is_public: true, created_at: new Date().toISOString(),
    career_stage: over.career_stage,
  } as any;
}

// Three profiles at DIFFERENT production stages — this also demonstrates the
// engine's stage-aware gating (a development project surfaces dev funds/labs;
// a pre-production project surfaces co-production markets). Funding needs are
// set to realistic mid-budget levels so fundingScore differentiates funds by
// how much of the gap they actually cover — the scores below are whatever the
// engine returns for these inputs, never hand-picked.
const samples = [
  mk({ id: "s-comedy", title: "SAMPLE FEATURE — COMEDY", genre: "Comedy", format: "feature", country: "India", language: "Hindi", budget_usd: 2500000, funding_needed_usd: 1800000, stage: "development", career_stage: "Emerging", script_path: null }),
  mk({ id: "s-drama", title: "SAMPLE FEATURE — DRAMA", genre: "Drama", format: "feature", country: "India", language: "Malayalam", budget_usd: 1500000, funding_needed_usd: 1100000, stage: "pre_production", career_stage: "First-time", has_coproducer: false, producer_info: null }),
  mk({ id: "s-doc", title: "SAMPLE FEATURE — DOCUMENTARY", genre: "Documentary", format: "documentary", country: "India", language: "English", budget_usd: 200000, funding_needed_usd: 150000, stage: "development", career_stage: "Emerging", has_coproducer: false, pitch_deck_path: null, producer_info: null }),
];

const CAT = (t: string) =>
  ["fund","grant"].includes(t) ? "grants" :
  ["lab","residency","mentorship","writing_fellowship","script_lab"].includes(t) ? "labs" :
  ["market","co_production","pitch_forum"].includes(t) ? "markets" :
  ["broadcaster","streamer","sales_agent","world_sales"].includes(t) ? "buyers" : "other";

const AWARD = (o: Opportunity) =>
  o.max_award_usd ? `Up to ${usd(o.max_award_usd)}` :
  o.max_budget_usd ? `Up to ${usd(o.max_budget_usd)}` : "Amount varies";

async function main() {
  const out: any[] = [];
  for (const p of samples) {
    const r = await runFylympitchEngine({ project: p, opportunities: active, opportunityExtras: extras });
    const full = rankHybridMatches(p as any, active, extras);
    const counts: Record<string, number> = { grants: 0, labs: 0, markets: 0, buyers: 0, other: 0 };
    for (const m of full) counts[CAT(m.opportunity.opp_type)]++;
    out.push({
      title: p.title, genre: p.genre, format: p.format, country: p.country, language: p.language,
      budgetLabel: usd(p.budget_usd), seekingLabel: usd(p.funding_needed_usd),
      readiness: r.funding_readiness.score, matchedSources: full.length,
      categories: [
        { label: "Grants & funds", count: counts.grants },
        { label: "Labs & residencies", count: counts.labs },
        { label: "Markets & co-pro", count: counts.markets },
        { label: "Buyers & platforms", count: counts.buyers },
      ].filter(c => c.count > 0),
      topMatches: full.slice(0, 4).map(m => ({
        name: m.opportunity.title, typeLabel: TYPE_LABEL[m.opportunity.opp_type] ?? m.opportunity.opp_type,
        country: m.opportunity.country ?? m.opportunity.region ?? "Various",
        award: AWARD(m.opportunity), deadline: m.opportunity.deadline_note ?? "See site",
        score: m.match.score, tier: m.match.tier,
      })),
      roadmap: r.roadmap.stages.map(s => ({ label: s.label, status: s.status, live: s.live_count ?? 0 })),
      ep: r.executive_producer.summary,
    });
  }

  const header = `// AUTO-GENERATED by scripts/gen-homepage-demo.ts — do not hand-edit.
// Real FYLYMPITCH ENGINE output for representative sample projects, computed
// offline against the live MASTER_DATA opportunity catalog (migration 005).
// Every score, count, readiness value and award below is genuine engine output
// from services/fylympitchEngine.ts — no fabricated or hand-tuned numbers.
//
// Regenerate after the catalog or engine changes:
//   npx tsx scripts/gen-homepage-demo.ts
//
export type DemoTier = "excellent" | "strong" | "possible";
export interface DemoMatch { name: string; typeLabel: string; country: string; award: string; deadline: string; score: number; tier: DemoTier; }
export interface DemoStage { label: string; status: "done" | "current" | "upcoming"; live: number; }
export interface DemoCategory { label: string; count: number; }
export interface DemoProject {
  title: string; genre: string; format: string; country: string; language: string;
  budgetLabel: string; seekingLabel: string; readiness: number; matchedSources: number;
  categories: DemoCategory[]; topMatches: DemoMatch[]; roadmap: DemoStage[]; ep: string;
}
export const DEMO_PROJECTS: DemoProject[] = `;
  fs.writeFileSync(path.join(ROOT, "components/homepage-demo-data.ts"), header + JSON.stringify(out, null, 2) + ";\n");
  console.log("Wrote components/homepage-demo-data.ts —", out.length, "sample projects");
}
main();
