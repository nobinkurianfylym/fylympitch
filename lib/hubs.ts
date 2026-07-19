// ─────────────────────────────────────────────────────────────────────────────
// Hub data layer. One cached read of the indexable opportunity set, then all
// grouping/stats happen in-process. Every hub's intro copy is derived from live
// numbers (count, award range, next deadline) so each page is genuinely unique —
// the technique that keeps programmatic hubs on the right side of scaled-content.
// ─────────────────────────────────────────────────────────────────────────────

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { opportunityIndexability } from "@/lib/seo";
import { usd } from "@/lib/format";
import { countrySlug } from "@/lib/opportunity-taxonomy";

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
  min_award_usd: number | null;
  max_award_usd: number | null;
  description: string | null;
  career_stages: string[] | null;
  eligible_countries: string[] | null;
  is_active: boolean | null;
  is_producer_post: boolean | null;
  posted_by_producer_id: string | null;
};

const HUB_SELECT =
  "id, slug, title, opp_type, country, region, deadline, deadline_note, min_award_usd, max_award_usd, description, career_stages, eligible_countries, is_active, is_producer_post, posted_by_producer_id";

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
  return rows.filter((r) => opportunityIndexability(r).index);
}

/**
 * Request-scoped cached loader — dedupes the single big read across
 * generateMetadata() and the page body within one request.
 */
export const loadIndexableOpportunities = cache(async (): Promise<HubRow[]> => {
  const supabase = await createClient();
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
    const lo = r.min_award_usd ?? r.max_award_usd;
    const hi = r.max_award_usd ?? r.min_award_usd;
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
