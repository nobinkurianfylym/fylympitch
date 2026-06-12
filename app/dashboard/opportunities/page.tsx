import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, TYPE_LABEL } from "@/lib/format";
import { toggleSaved } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPES = ["grant","fund","lab","co_production","market","distribution","investor","broadcaster","streamer","sales_agent"];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const { type, q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("opportunities").select("*").eq("is_active", true).order("deadline", { ascending: true, nullsFirst: false });
  if (type && TYPES.includes(type)) query = query.eq("opp_type", type);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: opps } = await query;

  const { data: saved } = await supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", user!.id);
  const savedSet = new Set((saved ?? []).map((s) => s.opportunity_id));

  return (
    <div>
      <p className="eyebrow mb-3">Database</p>
      <h1 className="font-display text-[34px]">Opportunities</h1>

      <form className="mt-8 flex flex-wrap gap-3" action="/dashboard/opportunities" method="get">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by name…" className="field !w-64" />
        <select name="type" defaultValue={type ?? ""} className="field !w-52">
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <button className="btn-ghost !px-5 !py-2.5">Filter</button>
      </form>

      <div className="mt-8">
        {(opps ?? []).map((o) => (
          <div key={o.id} className="hairline py-5 flex items-center justify-between gap-6">
            <Link href={`/dashboard/opportunities/${o.id}`} className="min-w-0 group">
              <div className="font-normal text-[15px] group-hover:text-gold transition-colors">{o.title}</div>
              <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                {TYPE_LABEL[o.opp_type]}
                {o.region ? ` · ${o.region}` : o.country ? ` · ${o.country}` : " · Worldwide"}
                {o.max_award_usd ? ` · up to ${usd(o.max_award_usd)}` : ""}
                {o.deadline ? ` · deadline ${o.deadline}` : ""}
              </div>
            </Link>
            <form action={toggleSaved}>
              <input type="hidden" name="opportunity_id" value={o.id} />
              <button className={`text-[12px] tracking-[0.16em] uppercase ${savedSet.has(o.id) ? "text-gold" : "text-ash hover:text-ink"}`}>
                {savedSet.has(o.id) ? "Saved ★" : "Save"}
              </button>
            </form>
          </div>
        ))}
        {(!opps || opps.length === 0) && <p className="hairline py-10 text-[14px] text-ash">No opportunities match that filter.</p>}
      </div>
    </div>
  );
}
