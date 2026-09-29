// components/HomepageDemo.tsx
//
// "See the engine in action", the data half. Server component.
//
// Scores REAL public pitches against the REAL catalogue. The result is cached
// for five minutes (getEngineDemo); its inputs come from the caches in
// lib/cached-queries. It replaced three synthetic
// "Sample Feature" projects whose numbers were baked offline against the
// MASTER_DATA seed: that data went stale the moment the engine changed, and
// did exactly that after the v2 scoring work, leaving the section claiming
// "real engine results" while showing the previous engine's numbers.
//
// Only pitches a filmmaker has already published are eligible, read through
// the anonymous client so row-level security applies as it does to any
// logged-out visitor. If fewer than three qualify, the baked samples render
// instead — the section degrades to honest illustration rather than to an
// empty frame or a single lonely card.

import { unstable_cache } from "next/cache";
import { getShowcaseProjects, getActiveOpportunitiesForEngine, type ShowcaseProject } from "@/lib/cached-queries";
import { fundLogo, fundMonogram } from "@/lib/fund-logos";
import { DEMO_PROJECTS, type DemoProject } from "./homepage-demo-data";
import { familyForType } from "@/lib/opportunity-taxonomy";
import { usd, TYPE_LABEL } from "@/lib/format";
import { supabaseUrl } from "@/lib/supabase/env";
import HomepageDemoClient from "./HomepageDemoClient";

const WANTED = 3;

/** Same derivation ProjectThumbnail uses, so one poster renders identically everywhere. */
function posterUrl(path: string | null): string | null {
  if (!path) return null;
  try {
    return `${supabaseUrl()}/storage/v1/object/public/thumbnails/${path}`;
  } catch {
    return null; // env missing at build time; the card falls back to its plate
  }
}

function award(o: any): string {
  return o?.max_award_usd != null && o.max_award_usd > 0
    ? `Up to ${usd(o.max_award_usd)}`
    : "Amount varies";
}

/** Group counts, using the same families as the opportunity hubs. */
function categories(rows: { opportunity: any }[]): DemoProject["categories"] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = familyForType(r.opportunity?.opp_type)?.label ?? "Other";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }));
}

/** A showcase row in the shape the engine reads. */
function toEngineProject(c: ShowcaseProject): any {
  return {
    id: c.id, owner_id: "", slug: c.slug, title: c.title,
    genre: c.genre, format: c.format, stage: c.stage,
    country: c.country, language: c.language,
    budget_usd: c.budget_usd, funding_needed_usd: c.funding_needed_usd,
    logline: c.logline, is_public: true, created_at: "",
    // Funding readiness reads presence, not content. These stand in for
    // fields we deliberately did not fetch: without them every real pitch
    // would score 40/100 or less, and the homepage would be publishing a
    // false verdict on someone's film because of a missing SELECT.
    synopsis: c.has_synopsis ? "present" : null,
    director_statement: c.has_director_statement ? "present" : null,
    producer_info: c.has_producer_info ? "present" : null,
    pitch_deck_path: c.has_deck ? "present" : null,
    script_path: c.has_script ? "present" : null,
  };
}

/**
 * The demo's pick, computed once and cached.
 *
 * Exported so the homepage can ask which pitches the engine section is already
 * showing (the "For producers" section skips them) without running the engine
 * a second time. Caching it also means the ranking runs once per five minutes
 * rather than on every homepage request; its inputs were already cached.
 *
 * The engine is imported inside the function, not at the top of the module:
 * a static import of engine code in a high-traffic page is what drove the
 * Worker CPU overruns.
 */
export const getEngineDemo = unstable_cache(
  async (): Promise<{ projects: DemoProject[]; ids: string[]; live: boolean }> => {
    const { computeFundingReadiness, rankHybridMatches } = await import("@/services/fylympitchEngine");
    const [candidates, opportunities] = await Promise.all([
      getShowcaseProjects(),
      getActiveOpportunitiesForEngine(),
    ]);

    const built: DemoProject[] = [];
    const ids: string[] = [];

    if (opportunities.length > 0) {
      for (const c of candidates) {
        if (built.length >= WANTED) break;

        const project = toEngineProject(c);

        const ranked = rankHybridMatches(project, opportunities as any[]);
        // A pitch with almost nothing to show would undersell the engine and
        // expose the filmmaker to a thin public verdict. Skip it; there are
        // others.
        if (ranked.length < 5) continue;

        const readiness = computeFundingReadiness(project, ranked.slice(0, 3));

        built.push({
          title: c.title,
          genre: c.genre ?? "",
          format: c.format ?? "",
          country: c.country ?? "",
          language: c.language ?? "",
          logline: c.logline ?? "",
          budgetLabel: c.budget_usd != null ? usd(c.budget_usd) : "—",
          seekingLabel: c.funding_needed_usd != null ? usd(c.funding_needed_usd) : "—",
          readiness: readiness.score,
          matchedSources: ranked.length,
          categories: categories(ranked),
          topMatches: ranked.slice(0, 4).map((m) => ({
            name: m.opportunity.title,
            typeLabel: TYPE_LABEL[m.opportunity.opp_type as keyof typeof TYPE_LABEL] ?? m.opportunity.opp_type,
            country: m.opportunity.country ?? m.opportunity.region ?? "Various",
            award: award(m.opportunity),
            deadline: m.opportunity.deadline_note ?? "See site",
            score: m.match.score,
            tier: m.match.tier === "hidden" ? "possible" : m.match.tier,
          })),
          // The roadmap belongs to the full engine run, which is more work than
          // this section needs. The stepper reads the project's own stage.
          roadmap: roadmapFor(c.stage),
          ep: "",
          posterUrl: posterUrl(c.poster_path),
          href: c.slug ? `/filmprojects/${c.slug}` : `/filmprojects/${c.id}`,
        });
        ids.push(c.id);
      }
    }

    const live = built.length >= WANTED;
    return { projects: live ? built : DEMO_PROJECTS, ids: live ? ids : [], live };
  },
  ["homepage-engine-demo"],
  { revalidate: 300, tags: ["projects", "opportunities"] },
);

export type FilmmakerMatch = {
  name: string;
  typeLabel: string;
  deadline: string;
  score: number;
  logo: string | null;
  monogram: string;
};

export type FilmmakerMatches = {
  project: { title: string; href: string };
  total: number;
  matches: FilmmakerMatch[];
};

function deadlineText(o: any): string {
  if (o?.deadline_note?.trim()) return o.deadline_note.trim();
  if (o?.deadline) {
    const d = new Date(o.deadline);
    if (!Number.isNaN(d.getTime())) {
      return `Deadline ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
    }
  }
  return "Deadline varies";
}

/**
 * Real engine output for the homepage "For filmmakers" section.
 *
 * It replaced three hard-coded rows whose scores (85, 79, 78) nothing had
 * calculated. Now: one public pitch the engine section is NOT already showing,
 * scored against the live catalogue, and three of its matches. Funders whose
 * logo we hold are preferred among its top fifteen, so the rows are not
 * necessarily its top three; the section says "3 of its N matches" for that
 * reason. Every score shown is the engine's own.
 *
 * Cached with the engine demo, and for the same reasons.
 */
export const getFilmmakerSectionMatches = unstable_cache(
  async (): Promise<FilmmakerMatches | null> => {
    const { rankHybridMatches } = await import("@/services/fylympitchEngine");
    const [candidates, opportunities, demo] = await Promise.all([
      getShowcaseProjects(),
      getActiveOpportunitiesForEngine(),
      getEngineDemo(),
    ]);
    if (opportunities.length === 0) return null;

    const alreadyShown = new Set(demo.ids);
    for (const c of candidates) {
      if (alreadyShown.has(c.id)) continue;

      const ranked = rankHybridMatches(toEngineProject(c), opportunities as any[]);
      if (ranked.length < 5) continue;

      const pool = ranked.slice(0, 15);
      const picked = pool.filter((m) => fundLogo(m.opportunity.title)).slice(0, 3);
      for (const m of pool) {
        if (picked.length >= 3) break;
        if (!picked.includes(m)) picked.push(m);
      }
      picked.sort((a, b) => b.match.score - a.match.score);

      return {
        project: {
          title: c.title,
          href: c.slug ? `/filmprojects/${c.slug}` : `/filmprojects/${c.id}`,
        },
        total: ranked.length,
        matches: picked.map((m) => ({
          name: m.opportunity.title,
          typeLabel: TYPE_LABEL[m.opportunity.opp_type as keyof typeof TYPE_LABEL] ?? m.opportunity.opp_type,
          deadline: deadlineText(m.opportunity),
          score: m.match.score,
          logo: fundLogo(m.opportunity.title),
          monogram: fundMonogram(m.opportunity.title),
        })),
      };
    }
    return null;
  },
  ["homepage-filmmaker-matches"],
  { revalidate: 300, tags: ["projects", "opportunities"] },
);

export default async function HomepageDemo() {
  const { projects, live } = await getEngineDemo();
  return <HomepageDemoClient projects={projects} live={live} />;
}

/** Where the project sits on the funding path, from its own declared stage. */
function roadmapFor(stage: string | null): DemoProject["roadmap"] {
  const labels = ["Script", "Labs", "Co-production", "Grants", "Investors", "Production"];
  const at: Record<string, number> = {
    development: 1, pre_production: 2, production: 5, post_production: 5, completed: 5,
  };
  const current = at[stage ?? "development"] ?? 1;
  return labels.map((label, i) => ({
    label,
    status: i < current ? "done" : i === current ? "current" : "upcoming",
    live: 0,
  }));
}
