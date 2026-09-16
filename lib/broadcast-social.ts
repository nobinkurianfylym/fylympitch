import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Like counts for a set of announcements.
 *
 * An admin broadcast fans out into one notification row per recipient, so the
 * count cannot come from the notifications table — every row there belongs to
 * exactly one person. It lives on admin_broadcasts, which recipients cannot
 * read directly (migration 063 makes that table admin-only), so this goes
 * through the broadcast_social RPC: SECURITY DEFINER, returns only the social
 * columns, and only for announcements the caller actually received.
 */
export interface BroadcastSocial {
  broadcast_id: string;
  like_count: number;
  liked_by_me: boolean;
  public_slug: string | null;
  is_public: boolean;
}

export async function fetchBroadcastSocial(
  supabase: SupabaseClient,
  broadcastIds: (string | null | undefined)[]
): Promise<Map<string, BroadcastSocial>> {
  const ids = [...new Set(broadcastIds.filter(Boolean) as string[])];
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase.rpc("broadcast_social", {
    p_broadcast_ids: ids,
  });

  // Migration 077 may not have been run yet. A missing function must not take
  // the whole inbox down with it — the page simply renders without reactions.
  if (error || !data) return new Map();

  return new Map(
    (data as BroadcastSocial[]).map((r) => [r.broadcast_id, r])
  );
}
