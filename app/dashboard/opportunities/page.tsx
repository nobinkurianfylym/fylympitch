import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, TYPE_LABEL } from "@/lib/format";
import { toggleSaved } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPES = ["grant","fund","lab","co_production","market","distribution","investor","broadcaster","streamer","sales_agent"];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; sort?: string }> }) {
  const { type, q, sort = "match" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("opportunities").select("*").eq("is_active", true);
  if (type && TYPES.includes(type)) query = query.eq("opp_type", type);
  if (q) query = query.ilike("title", `%${q}%`);
  if (sort !== "match") query = query.order("deadline", { ascending: true, nullsFirst: false });
  const { data: opps } = await query;

  const [
    { data: saved },
    { data: projects },
  ] = await Promise.all([
    supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", user!.id),
    supabase.from("projects").select("id").eq("owner_id", user!.id),
  ]);

  const savedSet   = new Set((saved ?? []).map((s) => s.opportunity_id));
  const projectIds = (projects ?? []).map((p: any) => p.id);

  // Fetch best match score per opportunity for this filmmaker
  const matchScoreByOpp: Record<string, number> = {};
  if (projectIds.length && sort === "match") {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("score, opportunity_id")
      .in("project_id", projectIds)
      .order("score", { ascending: false });

    for (const m of matchRows ?? []) {
      if (!matchScoreByOpp[m.opportunity_id] || m.score > matchScoreByOpp[m.opportunity_id]) {
        matchScoreByOpp[m.opportunity_id] = m.score;
      }
    }
  }

  // Sort by match score when requested
  const sorted = sort === "match"
    ? [...(opps ?? [])].sort((a, b) => (matchScoreByOpp[b.id] ?? 0) - (matchScoreByOpp[a.id] ?? 0))
    : (opps ?? []);

  const hasMatches = Object.keys(matchScoreByOpp).length > 0;

  function scorePill(score: number) {
    if (score >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-700";
    if (score >= 60) return "bg-gold/10 border-gold/30 text-gold";
    return "bg-parchment border-line text-ash";
  }

  return (
    <div>
      <p className="eyebrow mb-3">Database</p>
      <h1 className="font-display text-[34px]">Opportunities</h1>
      <p className="text-[14px] text-ash mt-2 mb-8">
        {hasMatches
          ? "Sorted by match score against your projects. Submit a project to personalise this list."
          : "397 active funding opportunities. Submit a project to see your match scores."}
      </p>

      {/* Filters + sort */}
      <form className="flex flex-wrap gap-3 mb-2" action="/dashboard/opportunities" method="get">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by name…" className="field !w-56" />
        <select name="type" defaultValue={type ?? ""} className="field !w-48">
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <select name="sort" defaultValue={sort} className="field !w-40">
          <option value="match">Match score</option>
          <option value="deadline">Deadline</option>
        </select>
        <button className="btn-ghost !px-5 !py-2.5">Filter</button>
        {(type || q) && <a href="/dashboard/opportunities" className="btn-ghost !px-5 !py-2.5 text-ash">Clear</a>}
      </form>

      <div className="mt-6">
        {sorted.map((o: any) => {
          const score = matchScoreByOpp[o.id];
          const days = o.deadline
            ? Math.ceil((new Date(o.deadline).getTime() - Date.now()) / 86_400_000)
            : null;

          return (
            <div key={o.id} className="hairline py-4 flex items-center justify-between gap-4">
              {/* Match score */}
              <div className="shrink-0 w-12 text-center hidden sm:block">
                {score != null ? (
                  <span className={`text-[11px] tracking-[0.08em] px-2 py-0.5 rounded-full border ${scorePill(score)}`}>
                    {score}
                  </span>
                ) : (
                  <span className="text-[11px] text-ash/30">—</span>
                )}
              </div>

              {/* Info */}
              <Link href={`/dashboard/opportunities/${o.id}`} className="flex-1 min-w-0 group">
                <div className="font-normal text-[15px] group-hover:text-gold transition-colors truncate">{o.title}</div>
                <div className="mt-0.5 text-[12px] tracking-[0.14em] uppercase text-ash flex flex-wrap gap-x-3">
                  <span>{TYPE_LABEL[o.opp_type]}</span>
                  {o.region ? <span>{o.region}</span> : o.country ? <span>{o.country}</span> : <span>Worldwide</span>}
                  {o.max_award_usd ? <span className="text-gold">up to {usd(o.max_award_usd)}</span> : null}
                </div>
              </Link>

              {/* Deadline */}
              {days != null && (
                <span className={`shrink-0 text-[11px] tracking-[0.08em] px-2 py-0.5 rounded-full border hidden md:inline-block ${
                  days <= 7
                    ? "bg-red-50 border-red-200 text-red-600"
                    : days <= 30
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-parchment border-line text-ash"
                }`}>
                  {days}d
                </span>
              )}

              {/* Save */}
              <form action={toggleSaved} className="shrink-0">
                <input type="hidden" name="opportunity_id" value={o.id} />
                <button className={`text-[12px] tracking-[0.16em] uppercase ${savedSet.has(o.id) ? "text-gold" : "text-ash hover:text-ink"}`}>
                  {savedSet.has(o.id) ? "★" : "Save"}
                </button>
              </form>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <p className="hairline py-10 text-[14px] text-ash">No opportunities match that filter.</p>
        )}
      </div>
    </div>
  );
}
