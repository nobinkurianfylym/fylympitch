// ─────────────────────────────────────────────────────────────────────────────
// Facet hubs: /opportunities/for/<facet>
//
// The third way into the catalogue. /opportunities/type groups by what the
// money IS, /opportunities/country by where it is, and this by WHO or WHAT it
// is for — which is how a filmmaker actually searches. Nobody types "grants
// and funds taxonomy". They type "grants for first-time filmmakers" and
// "funding for short documentaries".
//
// Three columns carry this, all text[] on `opportunities`:
//   career_stages  debut | second_film | established | veteran
//   formats        feature | documentary | short | series | animation
//   stages         development | pre_production | production | post_production
//                  | completed
//
// A facet matches when the row's array contains ANY of the facet's values, or
// — deliberately — when the row's array is EMPTY. An empty array on this data
// means "not restricted", not "restricted to nothing": a fund that never
// published a format restriction is open to documentaries, and hiding it from
// the documentary page would make the page wrong. See `facetMatches`.
// ─────────────────────────────────────────────────────────────────────────────

import type { HubRow } from "@/lib/hubs";
import { HUB_MIN_RECORDS } from "@/lib/hubs";

export type FacetGroup = "audience" | "format" | "stage";

export type Facet = {
  slug: string;
  /** Title Case, for headings and nav chips. */
  label: string;
  /** The <h1>. Reads as the phrase a person would search for. */
  heading: string;
  /** Lower-case plural for the generated intro sentence. */
  noun: string;
  /** One sentence of standing context, true regardless of the live numbers. */
  blurb: string;
  /**
   * The meta description, with `%n` standing in for the live count.
   *
   * Written per facet rather than assembled from `noun` + `blurb`: that
   * concatenation ran to 260 characters and arrived at the search result
   * clamped mid-sentence, spending the whole description on a generic
   * stats clause and amputating the part that says what the page is.
   * Each of these is measured to fit at any catalogue size.
   */
  meta: string;
  group: FacetGroup;
  column: "career_stages" | "formats" | "stages";
  /** Values in that column that belong to this facet. */
  values: string[];
};

export const FACET_GROUPS: { key: FacetGroup; label: string }[] = [
  { key: "audience", label: "By who you are" },
  { key: "format", label: "By what you are making" },
  { key: "stage", label: "By where the project is" },
];

export const FACETS: Facet[] = [
  // ── Who you are ────────────────────────────────────────────────────────────
  {
    slug: "first-time-filmmakers",
    label: "First-Time Filmmakers",
    heading: "Film Funding for First-Time Filmmakers",
    noun: "funds and programmes open to first features",
    blurb:
      "Funds, labs and grants that accept a director with no feature credit. Some are reserved for debuts outright; the rest simply place no restriction on experience.",
    meta:
      "Funds, labs and grants that accept a director with no feature credit. %n verified programmes, with deadlines and award sizes.",
    group: "audience",
    column: "career_stages",
    values: ["debut"],
  },
  {
    slug: "second-films",
    label: "Second Films",
    heading: "Funding for a Second Feature",
    noun: "funds and programmes open to a second feature",
    blurb:
      "The hardest film to finance is the second one: too experienced for the debut schemes, not established enough for the rest. These programmes accept it.",
    meta:
      "The second feature is the hardest to finance. %n verified funds and labs that accept one, with deadlines and award sizes.",
    group: "audience",
    column: "career_stages",
    values: ["second_film"],
  },
  {
    slug: "established-filmmakers",
    label: "Established Filmmakers",
    heading: "Film Funding for Established Directors",
    noun: "funds and programmes open to established directors",
    blurb:
      "Programmes with no debut restriction, including those that ask for a track record of previous features in competition or distribution.",
    meta:
      "Programmes with no debut restriction, including those asking for a track record. %n verified, with deadlines and award sizes.",
    group: "audience",
    column: "career_stages",
    values: ["established", "veteran"],
  },

  // ── What you are making ────────────────────────────────────────────────────
  {
    slug: "documentary",
    label: "Documentary",
    heading: "Documentary Film Funding",
    noun: "documentary funds, grants and labs",
    blurb:
      "Grants, funds and labs that finance non-fiction, from single-issue shorts to feature documentaries with theatrical ambition.",
    meta:
      "Grants, funds and labs that finance non-fiction, from single-issue shorts to feature docs. %n verified, with deadlines.",
    group: "format",
    column: "formats",
    values: ["documentary"],
  },
  {
    slug: "short-films",
    label: "Short Films",
    heading: "Short Film Funding and Grants",
    noun: "funds and grants for short films",
    blurb:
      "Money for work under forty minutes: production grants, festival-affiliated schemes and the short strands inside larger funds.",
    meta:
      "Money for work under forty minutes: production grants, festival schemes and short strands. %n verified, with deadlines.",
    group: "format",
    column: "formats",
    values: ["short"],
  },
  {
    slug: "feature-films",
    label: "Feature Films",
    heading: "Feature Film Funding",
    noun: "funds and programmes for feature films",
    blurb:
      "Development and production finance for narrative features, including co-production funds and territory-specific production support.",
    meta:
      "Development and production finance for narrative features, including co-production funds. %n verified, with deadlines.",
    group: "format",
    column: "formats",
    values: ["feature"],
  },
  {
    slug: "series",
    label: "Series",
    heading: "Funding for Series and Episodic Work",
    noun: "funds and programmes for series",
    blurb:
      "Development money, writers' rooms and co-production support for episodic work, scripted and documentary alike.",
    meta:
      "Development money, writers rooms and co-production support for episodic work. %n verified, with deadlines and awards.",
    group: "format",
    column: "formats",
    values: ["series"],
  },
  {
    slug: "animation",
    label: "Animation",
    heading: "Animation Funding and Grants",
    noun: "animation funds, grants and labs",
    blurb:
      "Programmes that finance animated work, where development runs long and the budget is committed earlier than in live action.",
    meta:
      "Programmes that finance animated work, where development runs long and budgets commit early. %n verified, with deadlines.",
    group: "format",
    column: "formats",
    values: ["animation"],
  },

  // ── Where the project is ───────────────────────────────────────────────────
  {
    slug: "development",
    label: "Development",
    heading: "Development Funding for Films",
    noun: "development funds, labs and grants",
    blurb:
      "Money for the stage before anything is shot: script development, research, treatment, and the labs that get a project to a financeable draft.",
    meta:
      "Money for the stage before anything is shot: script, research, treatment and labs. %n verified, with deadlines.",
    group: "stage",
    column: "stages",
    values: ["development"],
  },
  {
    slug: "production",
    label: "Production",
    heading: "Production Funding for Films",
    noun: "production funds and grants",
    blurb:
      "Finance for the shoot itself, including pre-production support, production grants and the rebates that lower what the shoot costs.",
    meta:
      "Finance for the shoot itself: production grants, pre-production support and rebates. %n verified, with deadlines.",
    group: "stage",
    column: "stages",
    values: ["pre_production", "production"],
  },
  {
    slug: "post-production",
    label: "Post-Production",
    heading: "Post-Production Funding and Finishing Funds",
    noun: "post-production and finishing funds",
    blurb:
      "Finishing funds and post support for a film that is shot but not done: edit, sound, grade, and the residencies built around a rough cut.",
    meta:
      "Finishing funds and post support for a film that is shot but not done. %n verified, with deadlines and award sizes.",
    group: "stage",
    column: "stages",
    values: ["post_production", "completed"],
  },
];

const BY_SLUG = new Map(FACETS.map(f => [f.slug, f]));

export function facetBySlug(slug: string): Facet | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Does this row belong on this facet's page?
 *
 * An empty or absent array counts as a match. On this catalogue an empty
 * `formats` means the programme published no format restriction, not that it
 * funds no formats — most national production funds are exactly that. Reading
 * it as "matches nothing" would empty the format pages of the largest funds
 * on the site, which is both wrong and the opposite of useful.
 */
export function facetMatches(facet: Facet, row: HubRow): boolean {
  const raw = (row as unknown as Record<string, unknown>)[facet.column];
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  if (list.length === 0) return true;
  return list.some(v => facet.values.includes(String(v).toLowerCase().trim()));
}

export function rowsForFacet(facet: Facet, rows: HubRow[]): HubRow[] {
  return rows.filter(r => facetMatches(facet, r));
}

/**
 * The share of the whole catalogue above which a facet stops being a facet.
 *
 * Because an unrestricted row matches every facet in its group, a facet whose
 * column is mostly empty ends up listing almost the entire catalogue — at
 * which point the page is a near-duplicate of /opportunities and asking Google
 * to index it is asking for a scaled-content penalty. The page still renders,
 * still lists, still links: it simply does not compete in the index.
 *
 * This is a self-correcting rule rather than a judgement about today's data.
 * As the crawler fills in `formats` and `stages`, facets cross the line into
 * indexability on their own.
 */
export const FACET_MAX_SHARE = 0.8;

export function facetIndexability(
  matched: number,
  total: number,
): { index: boolean; reason: string } {
  if (matched < HUB_MIN_RECORDS) return { index: false, reason: "too_few_records" };
  if (total > 0 && matched / total > FACET_MAX_SHARE)
    return { index: false, reason: "not_distinct_from_catalogue" };
  return { index: true, reason: "ok" };
}
