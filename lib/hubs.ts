// ─────────────────────────────────────────────────────────────────────────────
// Hub data layer. One cached read of the indexable opportunity set, then all
// grouping/stats happen in-process. Every hub's intro copy is derived from live
// numbers (count, award range, next deadline) so each page is genuinely unique —
// the technique that keeps programmatic hubs on the right side of scaled-content.
// ─────────────────────────────────────────────────────────────────────────────

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonClient } from "@/lib/supabase/anon";
import { opportunityIndexability } from "@/lib/seo";
import { usd } from "@/lib/format";
import { countrySlug, RESERVED_OPP_SEGMENTS } from "@/lib/opportunity-taxonomy";

export const HUB_MIN_RECORDS = 3; // a hub must list at least this many to be indexable

export type HubRow = {
  id: string;
  slug: string;
  title: string;
  opp_type: string | null;
  country: string | null;
  region: string | null;
  deadline: string | null;
  deadline_note: string | null;
  max_award_usd: number | null;
  description: string | null;
  career_stages: string[] | null;
  eligible_countries: string[] | null;
  // Facet columns. Read for /opportunities/for/<facet>; an empty array means
  // the programme published no restriction, not that it excludes everything.
  formats: string[] | null;
  stages: string[] | null;
  is_active: boolean | null;
  is_producer_post: boolean | null;
  posted_by_producer_id: string | null;
  // Added for the hub pages: cadence tells a reader a rolling fund is open
  // today rather than undated, and last_verified_at is the freshness signal
  // both search engines and answer engines weigh.
  deadline_type: string | null;
  typical_month: number | null;
  last_verified_at: string | null;
  app_link: string | null;
  organization_name: string | null;
};

const HUB_SELECT =
  "id, slug, title, opp_type, country, region, deadline, deadline_note, max_award_usd, description, career_stages, eligible_countries, formats, stages, is_active, is_producer_post, posted_by_producer_id, deadline_type, typical_month, last_verified_at, app_link, organization_name";

/** All opportunities that pass the indexation threshold, sorted by soonest deadline. */
export async function getIndexableOpportunities(
  supabase: SupabaseClient,
): Promise<HubRow[]> {
  const { data } = await supabase
    .from("opportunities")
    .select(HUB_SELECT)
    .eq("is_active", true)
    .not("slug", "is", null)
    .limit(5000);

  const rows = (data ?? []) as HubRow[];

  // A static segment beats a dynamic one in the App Router, so an opportunity
  // that ever slugged to "for", "type", "country" or "submit" would be
  // shadowed by the hub route of the same name: /opportunities/for renders the
  // facet directory, not that record. Listing it here would put a URL in the
  // hubs, the sitemap and the public API that resolves to a different page.
  const reachable = rows.filter((r) => !RESERVED_OPP_SEGMENTS.has(r.slug));

  const indexable = reachable.filter((r) => opportunityIndexability(r).index);

  // Soonest real deadline first, then rolling programmes (open today, so
  // still useful), then everything undated.
  const rank = (r: HubRow) =>
    r.deadline ? 0 : r.deadline_type === "rolling" ? 1 : 2;

  return indexable.sort((a, b) =>
    rank(a) - rank(b) ||
    (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
    a.title.localeCompare(b.title));
}

/**
 * Request-scoped cached loader — dedupes the single big read across
 * generateMetadata() and the page body within one request.
 */
// Read as an anonymous visitor, never with the caller's cookies.
//
// Two reasons. First, correctness: the indexable set is identical for every
// visitor, so carrying a session buys nothing. Second, and the reason this
// changed — generateStaticParams runs at BUILD time, where there is no HTTP
// request and therefore no cookie store. The cookie-reading server client
// throws there ("used cookies() inside generateStaticParams"), which fails
// the whole build. RLS still applies exactly as it does to a logged-out
// reader, which is the audience these pages are written for.
export const loadIndexableOpportunities = cache(async (): Promise<HubRow[]> => {
  const supabase = createAnonClient();
  return getIndexableOpportunities(supabase);
});

// ── Stats + intro ────────────────────────────────────────────────────────────

export type HubStats = {
  count: number;
  minAward: number | null;
  maxAward: number | null;
  nextDeadline: string | null;
};

export function hubStats(rows: HubRow[]): HubStats {
  let minAward: number | null = null;
  let maxAward: number | null = null;
  let nextDeadline: string | null = null;
  const now = Date.now();

  for (const r of rows) {
    const lo = r.max_award_usd;
    const hi = r.max_award_usd;
    if (lo != null) minAward = minAward == null ? lo : Math.min(minAward, lo);
    if (hi != null) maxAward = maxAward == null ? hi : Math.max(maxAward, hi);
    if (r.deadline) {
      const t = new Date(r.deadline).getTime();
      if (!Number.isNaN(t) && t >= now) {
        if (!nextDeadline || t < new Date(nextDeadline).getTime()) nextDeadline = r.deadline;
      }
    }
  }
  return { count: rows.length, minAward, maxAward, nextDeadline };
}

function awardClause(s: HubStats): string {
  if (s.minAward == null && s.maxAward == null) return "";
  if (s.minAward != null && s.maxAward != null && s.minAward !== s.maxAward)
    return `, awarding between ${usd(s.minAward)} and ${usd(s.maxAward)}`;
  const v = s.maxAward ?? s.minAward!;
  return `, awarding up to ${usd(v)}`;
}

function deadlineClause(s: HubStats): string {
  if (!s.nextDeadline) return "";
  const d = new Date(s.nextDeadline).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return ` The next deadline is ${d}.`;
}

/** Data-derived, unique-per-hub intro sentence. */
export function hubIntro(noun: string, scope: string | null, s: HubStats): string {
  const verb = s.count === 1 ? "is" : "are";
  const plural = s.count === 1 ? noun.replace(/s$/, "") : noun;
  const where = scope ? ` ${scope}` : "";
  return `There ${verb} ${s.count} verified ${plural}${where} on PITCH.FYLYM${awardClause(
    s,
  )}.${deadlineClause(s)}`.trim();
}

// ── Grouping for directory pages ─────────────────────────────────────────────

/**
 * Organisations (with ≥ HUB_MIN_RECORDS indexable records), sorted by count.
 *
 * Grouped case-insensitively on the trimmed name, with the most common
 * spelling used for display. That merges "BFI Film Fund" written two ways,
 * but NOT genuine aliases: "BFI" and "British Film Institute" are still two
 * entries, because deciding they are the same body is a judgement call and
 * merging blind would glue together organisations that only look alike.
 * A curated alias table is the proper fix and is deliberately not this.
 */
export function organisationsWithCounts(
  rows: HubRow[],
): { name: string; slug: string; count: number }[] {
  const groups = new Map<string, { names: Map<string, number>; count: number }>();

  for (const r of rows) {
    const raw = r.organization_name?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const g = groups.get(key) ?? { names: new Map(), count: 0 };
    g.count += 1;
    g.names.set(raw, (g.names.get(raw) ?? 0) + 1);
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter(g => g.count >= HUB_MIN_RECORDS)
    .map(g => {
      const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { name, slug: countrySlug(name), count: g.count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Every row belonging to one organisation slug. */
export function rowsForOrganisation(rows: HubRow[], slug: string): HubRow[] {
  return rows.filter(r => {
    const n = r.organization_name?.trim();
    return !!n && countrySlug(n) === slug;
  });
}

/** Countries (with ≥ HUB_MIN_RECORDS indexable records), sorted by count desc. */
export function countriesWithCounts(
  rows: HubRow[],
): { name: string; slug: string; count: number }[] {
  const byCountry = new Map<string, number>();
  for (const r of rows) {
    if (!r.country) continue;
    byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
  }
  return [...byCountry.entries()]
    .filter(([, c]) => c >= HUB_MIN_RECORDS)
    .map(([name, count]) => ({ name, slug: countrySlug(name), count }))
    .sort((a, b) => b.count - a.count);
}
