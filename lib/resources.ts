import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishedResource = {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  category: string | null;
};

/** How many resources the dashboard sidebar lists before "See all". */
export const SIDEBAR_RESOURCE_LIMIT = 5;

/**
 * Published resources, in admin order.
 *
 * Shared by the dashboard layout (sidebar) and /dashboard/resources so the two
 * can never disagree about ordering or about what "published" means.
 *
 * Columns are named explicitly. PostgREST fails the entire query on an unknown
 * column -- in the select list and in ORDER BY alike -- and returns null with
 * no error, which is how a phantom column silently emptied the fund pages and
 * the sitemap before. Naming them keeps that failure visible here.
 *
 * Returns [] on any error rather than throwing: a resources list that cannot
 * load must not take the whole dashboard down with it.
 */
export async function getPublishedResources(
  supabase: SupabaseClient,
  limit?: number,
): Promise<PublishedResource[]> {
  let query = supabase
    .from("filmmaking_resources")
    .select("id, title, description, url, image_url, category")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    // Expected before migration 084 is run -- the table does not exist yet.
    // Logged rather than swallowed so a real failure is not mistaken for that.
    console.error("[resources] query failed:", error.message);
    return [];
  }

  return (data ?? []) as PublishedResource[];
}
