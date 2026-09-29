// lib/pitch-order.ts
//
// Admin-pinned pitches come first wherever pitches are listed, in the order
// set on /admin/projects/order. Everything else follows in the admin's chosen
// mode: newest first (default) or most liked first (then newest).
//
// projects.admin_rank (migration 100): null = not pinned, lower = higher up.
// pitch_order_config.mode (migration 100): 'newest' | 'likes'.
//
// withPitchOrder runs a listing with that ordering. If the column is not there
// yet — the code deployed before migration 100 was run — it runs the listing
// again with the old newest-first order. PostgREST fails the WHOLE query on an
// unknown column, and a showcase that silently empties is the failure this
// avoids.

import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

export type PitchOrderMode = "newest" | "likes";

/**
 * The admin's choice, cached under the "projects" tag so every listing reads
 * it without an extra round trip; changing it revalidates that tag.
 * Anything unexpected — no table yet, no row, an error — means newest first.
 */
export const getPitchOrderMode = unstable_cache(
  async (): Promise<PitchOrderMode> => {
    try {
      const { data, error } = await createAnonClient()
        .from("pitch_order_config")
        .select("mode")
        .maybeSingle();
      if (error) return "newest";
      return data?.mode === "likes" ? "likes" : "newest";
    } catch {
      return "newest";
    }
  },
  ["pitch-order-mode"],
  { revalidate: 300, tags: ["projects"] },
);

type Listing<T> = { data: T[] | null; error: { message: string } | null };
type Orderer = (query: any) => any;

function pinnedFirst(mode: PitchOrderMode): Orderer {
  return (q) => {
    let o = q.order("admin_rank", { ascending: true, nullsFirst: false });
    if (mode === "likes") o = o.order("love_count", { ascending: false, nullsFirst: false });
    return o.order("created_at", { ascending: false });
  };
}

const newestFirst: Orderer = (q) => q.order("created_at", { ascending: false });

export async function withPitchOrder<T = any>(
  build: (order: Orderer) => PromiseLike<Listing<T>>,
): Promise<Listing<T>> {
  const mode = await getPitchOrderMode();
  const res = await build(pinnedFirst(mode));
  if (!res.error || !/admin_rank/i.test(res.error.message)) return res;
  console.error("[pitch-order] admin_rank unavailable, listing newest first:", res.error.message);
  return build(newestFirst);
}
