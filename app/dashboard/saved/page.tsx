import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, TYPE_LABEL } from "@/lib/format";
import { toggleSaved } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: rows } = await supabase
    .from("saved_opportunities")
    .select("opportunity_id, opportunities(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <p className="eyebrow mb-3">Shortlist</p>
      <h1 className="font-display text-[34px]">Saved opportunities</h1>
      <div className="mt-10">
        {(rows ?? []).map((r: any) => (
          <div key={r.opportunity_id} className="hairline py-5 flex items-center justify-between gap-6">
            <Link href={`/dashboard/opportunities/${r.opportunity_id}`} className="min-w-0 group">
              <div className="font-normal text-[15px] group-hover:text-gold transition-colors">{r.opportunities?.title}</div>
              <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                {TYPE_LABEL[r.opportunities?.opp_type]}
                {r.opportunities?.max_award_usd ? ` · up to ${usd(r.opportunities.max_award_usd)}` : ""}
                {r.opportunities?.deadline ? ` · ${r.opportunities.deadline}` : ""}
              </div>
            </Link>
            <form action={toggleSaved}>
              <input type="hidden" name="opportunity_id" value={r.opportunity_id} />
              <button className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-red-700">Remove</button>
            </form>
          </div>
        ))}
        {(!rows || rows.length === 0) && (
          <p className="hairline py-10 text-[14px] text-ash">Nothing saved yet. Star opportunities to build your application shortlist.</p>
        )}
      </div>
    </div>
  );
}
