import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

// ─────────────────────────────────────────────────────────────────────────────
// Shared, NON user-specific queries, cached in R2.
//
// Measured on the live site: rendering a page costs ~35ms (a route with no
// database work answers in 80ms against a 44ms network floor), while the data
// pages sit at 460-550ms. Effectively all of that gap is one conversation with
// Supabase, which is in a different region to both the Worker and the user.
// Parallelising the queries took the number of round trips down to the
// minimum; it could not make the remaining ones cheap.
//
// So: cache the DATA, not the PAGE. Everything in this file is identical for
// every visitor — public projects, public opportunities, a count. None of it
// depends on who is asking, so it can be shared safely, and the pages stay
// dynamic. That matters: the homepage renders the signed-in user's name and
// avatar, /filmprojects renders each viewer's own likes, and /opportunities
// changes its row limit by auth. Caching those PAGES would serve one person's
// header to everybody. Caching these queries cannot.
//
// A Supabase client cannot be passed in — unstable_cache serialises its
// arguments — so each function makes its own, using the COOKIE-FREE client.
// lib/supabase/server.ts reads cookies(), and unstable_cache forbids
// request-scoped data: calling it here throws, the catch below swallowed it,
// and every listing rendered its empty fallback. The pages had not got faster,
// they had stopped returning rows. Hence createAnonClient, and hence every
// catch now logging rather than failing silently.
// ─────────────────────────────────────────────────────────────────────────────

/** Five minutes. Long enough to absorb traffic, short enough that a new fund or project shows up quickly. */
const TTL = 300;

export type TrendingProject = {
  id: string; slug: string | null; title: string; genre: string; format: string;
  stage: string; country: string; budget: string; seeking: string;
  posterPath: string | null; deckCoverPath: string | null;
};

function formatBudget(usd: number | null): string {
  if (!usd) return "TBC";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (usd >= 1_000)     return `$${Math.round(usd / 1_000)}K`;
  return `$${Math.round(usd)}`;
}

const SEEKING: Record<string, string> = {
  development: "Co-Producer", pre_production: "Producer",
  production: "Line Producer", post_production: "Sales Agent", completed: "Distribution",
};

/** Public projects for the homepage ticker. */
export const getTrendingProjects = unstable_cache(
  async (): Promise<TrendingProject[]> => {
    try {
      const supabase = createAnonClient();
      const { data } = await supabase
        .from("projects")
        .select("id, slug, title, genre, format, stage, country, budget_usd, poster_path, deck_cover_path")
        .eq("is_public", true)
        .eq("admin_hidden", false)
        // Exclusivity is not privacy (085). is_public above already decides who
        // may see this; a pitch addressed to a producer and marked Public belongs
        // on the showcase the filmmaker was promised.
        // Posters only. Without one, ProjectThumbnail draws a generated pastel
        // title card in one of eight colours -- next to real 2:3 artwork those
        // read as placeholders, and the ticker looked like a half-finished
        // grid rather than a showcase.
        //
        // Deliberately not "poster OR deck cover": a deck cover is a landscape
        // slide cropped to 2:3, which is the same unevenness by another route.
        //
        // Filtered in SQL, before the limit, so this searches every public
        // project for a poster rather than only the 40 newest.
        .not("poster_path", "is", null)
        .neq("poster_path", "")
        .order("created_at", { ascending: false })
        .limit(40);

      return (data ?? []).map((p: any) => ({
        id: p.id, slug: p.slug ?? null, title: p.title, genre: p.genre, format: p.format,
        stage: p.stage, country: p.country ?? "International",
        budget: formatBudget(p.budget_usd),
        seeking: SEEKING[p.stage] ?? "Producer",
        posterPath: p.poster_path ?? null,
        deckCoverPath: p.deck_cover_path ?? null,
      }));
    } catch (err) {
      console.error("[cached-queries] getTrendingProjects failed:", err);
      return []; // the ticker has an empty state
    }
  },
  ["trending-projects"],
  { revalidate: TTL, tags: ["projects"] },
);

/** Active opportunity count, for on-page copy and the meta description. */
export const getOpportunityCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const supabase = createAnonClient();
      const { data: snap } = await supabase
        .from("platform_metrics")
        .select("active_opportunities")
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const cached = (snap as any)?.active_opportunities ?? 0;
      if (cached) return cached;

      const { count } = await supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      return count ?? 0;
    } catch (err) {
      console.error("[cached-queries] getOpportunityCount failed:", err);
      return 0;
    }
  },
  ["opportunity-count"],
  { revalidate: TTL, tags: ["opportunities"] },
);

/**
 * The public project listing.
 *
 * Keyed on the filters, so /filmprojects?format=documentary caches separately
 * from the unfiltered listing. Search terms are NOT cached — they are
 * effectively unbounded, and caching them would fill R2 with entries nobody
 * asks for twice.
 */
export const PUBLIC_PAGE_SIZE = 60;

export const getPublicProjects = unstable_cache(
  async (format?: string, page = 0): Promise<any[]> => {
    try {
      const supabase = createAnonClient();
      let query = supabase
        .from("projects")
        .select("id, slug, title, genre, format, stage, language, country, director_name, logline, budget_usd, budget_currency, finance_secured_usd, funding_needed_usd, poster_path, deck_cover_path, pitch_deck_path, love_count, owner_id, filmmaker:profiles!projects_owner_id_fkey(full_name, career_stage)")
        .eq("is_public", true)
        // admin_hidden belongs in the query as well as in RLS. Relying on a
        // policy alone means one permissive policy added later silently
        // unhides everything — which is exactly what projects_select was
        // doing before migration 081.
        .eq("admin_hidden", false)
        // Exclusivity is not privacy (085). is_public above already decides who
        // may see this; a pitch addressed to a producer and marked Public belongs
        // on the showcase the filmmaker was promised.
        .order("created_at", { ascending: false })
        // One extra row, never rendered: its presence is how the page knows a
        // next page exists without a second count(*) query on every request.
        .range(page * PUBLIC_PAGE_SIZE, page * PUBLIC_PAGE_SIZE + PUBLIC_PAGE_SIZE);

      if (format) query = query.eq("format", format.toLowerCase());

      const { data } = await query;
      return data ?? [];
    } catch (err) {
      console.error("[cached-queries] getPublicProjects failed:", err);
      return [];
    }
  },
  ["public-projects"],
  { revalidate: TTL, tags: ["projects"] },
);

/**
 * The public opportunity listing.
 *
 * `limit` is part of the cache key because the page asks for more rows when
 * somebody is signed in — two different lists, two different entries, and
 * neither contains anything about the person who triggered it.
 */
export const getOpportunities = unstable_cache(
  async (oppTypes: string[] | null, limit: number): Promise<any[]> => {
    try {
      const supabase = createAnonClient();
      let query = supabase
        .from("opportunities")
        .select("id, slug, title, opp_type, description, country, region, deadline, deadline_note, languages, url, app_link, is_producer_post, poster_url, key_person")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (oppTypes?.length) query = query.in("opp_type", oppTypes);

      const { data } = await query;
      return data ?? [];
    } catch (err) {
      console.error("[cached-queries] getOpportunities failed:", err);
      return [];
    }
  },
  ["public-opportunities"],
  { revalidate: TTL, tags: ["opportunities"] },
);
