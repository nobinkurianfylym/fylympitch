import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { preferThumb } from "@/lib/poster-url";
import PitchOrderList, { type OrderPitch } from "./PitchOrderList";
import type { PitchOrderMode } from "@/lib/pitch-order";

export const dynamic = "force-dynamic";

const SELECT =
  "id, slug, title, format, country, poster_path, is_public, admin_hidden, target_producer_id, created_at, admin_rank, love_count, filmmaker:profiles!projects_owner_id_fkey(full_name)";

function toPitch(p: any): OrderPitch {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const fm = Array.isArray(p.filmmaker) ? p.filmmaker[0] : p.filmmaker;
  return {
    id: p.id,
    href: `/filmprojects/${p.slug || p.id}`,
    title: p.title ?? "Untitled",
    meta: [fm?.full_name, p.format, p.country?.trim()].filter(Boolean).join(" · "),
    imageUrl: p.poster_path ? `${base}/storage/v1/object/public/thumbnails/${preferThumb(p.poster_path)}` : null,
    isPublic: !!p.is_public,
    adminHidden: !!p.admin_hidden,
    exclusive: !!p.target_producer_id,
    createdAt: p.created_at,
    loveCount: Number(p.love_count ?? 0),
  };
}

export default async function PitchOrderPage() {
  const supabase = await createClient();

  // Read directly, not through the cached getter: this page must show the
  // setting as it is right now.
  const { data: config } = await supabase.from("pitch_order_config").select("mode").maybeSingle();
  const mode: PitchOrderMode = config?.mode === "likes" ? "likes" : "newest";

  let restQuery = supabase.from("projects").select(SELECT)
    .is("admin_rank", null)
    .eq("is_public", true)
    .eq("admin_hidden", false);
  if (mode === "likes") restQuery = restQuery.order("love_count", { ascending: false });
  restQuery = restQuery.order("created_at", { ascending: false }).limit(300);

  const [pinnedRes, restRes] = await Promise.all([
    supabase.from("projects").select(SELECT)
      .not("admin_rank", "is", null)
      .order("admin_rank", { ascending: true }),
    restQuery,
  ]);

  const missingColumn = [pinnedRes.error, restRes.error].some((e) => e && /admin_rank/i.test(e.message));
  const otherError = [pinnedRes.error, restRes.error].find((e) => e && !/admin_rank/i.test(e.message));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Project management</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Pitch order</h1>
          <p className="text-[13px] leading-[1.7] text-ash mt-3 max-w-2xl">
            Pinned pitches are listed first, in the order below, on the Film Projects showcase,
            Producer Studio → All Projects, and Discover for approved industry accounts. Every other
            pitch follows, newest first or most liked first, as set below. Producer Studio&rsquo;s
            personal top matches stay ranked by match.
          </p>
        </div>
        <Link href="/admin/projects" className="btn-ghost">Back to projects</Link>
      </div>

      {missingColumn ? (
        <p className="text-[14px] text-amber-800 bg-amber-50 border border-amber-200 rounded-card px-5 py-4 max-w-2xl">
          Pitch ordering needs migration <code>100_pitch_order.sql</code>. Run it in the Supabase SQL
          Editor, then reload this page. Until then every listing stays newest first.
        </p>
      ) : otherError ? (
        <p className="text-[14px] text-red-700 bg-red-50 border border-red-200 rounded-card px-5 py-4 max-w-2xl">
          Could not load pitches: {otherError.message}
        </p>
      ) : (
        <PitchOrderList
          pinned={(pinnedRes.data ?? []).map(toPitch)}
          rest={(restRes.data ?? []).map(toPitch)}
          mode={mode}
        />
      )}
    </div>
  );
}
