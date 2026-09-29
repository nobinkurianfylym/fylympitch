// lib/pitch-order.ts
//
// Admin-pinned pitches come first wherever pitches are listed, in the order
// set on /admin/projects/order. Everything else follows, newest first.
//
// projects.admin_rank (migration 100): null = not pinned, lower = higher up.
//
// withPitchOrder runs a listing with that ordering. If the column is not there
// yet — the code deployed before migration 100 was run — it runs the listing
// again with the old newest-first order. PostgREST fails the WHOLE query on an
// unknown column, and a showcase that silently empties is the failure this
// avoids.

type Listing<T> = { data: T[] | null; error: { message: string } | null };
type Orderer = (query: any) => any;

const pinnedFirst: Orderer = (q) =>
  q.order("admin_rank", { ascending: true, nullsFirst: false })
   .order("created_at", { ascending: false });

const newestFirst: Orderer = (q) => q.order("created_at", { ascending: false });

export async function withPitchOrder<T = any>(
  build: (order: Orderer) => PromiseLike<Listing<T>>,
): Promise<Listing<T>> {
  const res = await build(pinnedFirst);
  if (!res.error || !/admin_rank/i.test(res.error.message)) return res;
  console.error("[pitch-order] admin_rank unavailable, listing newest first:", res.error.message);
  return build(newestFirst);
}
