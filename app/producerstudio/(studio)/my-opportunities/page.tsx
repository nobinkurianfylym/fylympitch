import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TYPE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MyOpportunitiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .single();

  if (!profile || !["producer", "admin"].includes((profile as any).role)) {
    redirect("/producerstudio");
  }

  // Fetch this producer's posted opportunities + application counts
  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, title, slug, opp_type, description, deadline, is_active, poster_url, created_at, max_award_usd")
    .eq("posted_by_producer_id", user.id)
    .eq("is_producer_post", true)
    .order("created_at", { ascending: false });

  // Get application counts per opportunity
  const oppIds = (opps ?? []).map((o: any) => o.id);
  const { data: appCounts } = oppIds.length > 0
    ? await supabase
        .from("applications")
        .select("opportunity_id")
        .in("opportunity_id", oppIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  (appCounts ?? []).forEach((a: any) => {
    countMap[a.opportunity_id] = (countMap[a.opportunity_id] ?? 0) + 1;
  });

  return (
    <div className="px-8 py-10 max-w-[900px]">

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-10 pb-8 border-b border-line">
        <div>
          <p className="text-[10px] tracking-[0.22em] uppercase text-ash mb-2">Producer Studio</p>
          <h1 className="font-display text-[32px] font-[400] text-ink">My Opportunities</h1>
          <p className="mt-2 text-[14px] text-ash">Opportunities you've published to filmmakers.</p>
        </div>
        <Link href="/producerstudio/create-opportunity" className="btn-gold shrink-0">
          + New Opportunity
        </Link>
      </div>

      {/* Empty state */}
      {(!opps || opps.length === 0) && (
        <div className="card p-12 text-center">
          <p className="font-display text-[22px] font-[400] text-ink mb-3">No opportunities posted yet</p>
          <p className="text-[14px] text-ash mb-8 max-w-md mx-auto">
            Post a brief and filmmakers worldwide will see it on the public Opportunities page.
            Submissions come directly to your pipeline.
          </p>
          <Link href="/producerstudio/create-opportunity" className="btn-gold">
            Create your first opportunity →
          </Link>
        </div>
      )}

      {/* Opportunities list */}
      {opps && opps.length > 0 && (
        <div className="space-y-4">
          {(opps as any[]).map((opp) => {
            const typeLabel   = TYPE_LABEL[opp.opp_type as string] ?? opp.opp_type;
            const submissions = countMap[opp.id] ?? 0;
            const deadline    = opp.deadline
              ? new Date(opp.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : null;

            return (
              <div key={opp.id} className="card p-6 flex gap-5 items-start">
                {/* Poster thumb */}
                {opp.poster_url && (
                  <div className="shrink-0 w-[52px] h-[72px] rounded-sm overflow-hidden border border-line">
                    <img src={opp.poster_url} alt={opp.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-[10px] tracking-[0.16em] uppercase text-ash mb-1">{typeLabel}</p>
                      <h2 className="font-display text-[18px] font-[400] text-ink leading-snug">{opp.title}</h2>
                    </div>
                    {/* Status badge */}
                    <span className={`text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-sm ${
                      opp.is_active ? "bg-emerald-50 text-emerald-700" : "bg-parchment text-ash"
                    }`}>
                      {opp.is_active ? "Live" : "Inactive"}
                    </span>
                  </div>

                  {opp.description && (
                    <p className="mt-2 text-[13px] text-ash leading-relaxed line-clamp-2">
                      {opp.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-ash">
                    {deadline && <span>Deadline — <span className="text-ink">{deadline}</span></span>}
                    <span>
                      <span className="text-gold font-medium">{submissions}</span>{" "}
                      submission{submissions !== 1 ? "s" : ""}
                    </span>
                    <span>
                      Posted {new Date(opp.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Link
                      href={`/opportunities/${opp.slug}`}
                      target="_blank"
                      className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors"
                    >
                      View public page ↗
                    </Link>
                    {submissions > 0 && (
                      <Link
                        href="/producerstudio"
                        className="text-[11px] tracking-[0.14em] uppercase text-gold hover:text-gold/80 transition-colors"
                      >
                        See submissions →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
