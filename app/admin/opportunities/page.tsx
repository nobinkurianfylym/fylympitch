import { createClient } from "@/lib/supabase/server";
import { adminToggleOpportunity, adminCreateOpportunity } from "@/lib/actions";
import { usd, TYPE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOpportunities() {
  const supabase = await createClient();
  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, title, opp_type, country, region, max_award_usd, deadline, is_active")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <p className="eyebrow">Fund management</p>
      <h1 className="font-display text-[30px] font-normal mt-1">Grants, funds &amp; opportunities</h1>

      <div className="card mt-8 divide-y divide-line">
        {(opps ?? []).map((o) => (
          <div key={o.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-normal text-ink">{o.title}</p>
              <p className="text-[12px] text-ash font-normal mt-0.5">
                {[TYPE_LABEL[o.opp_type] ?? o.opp_type, o.country || o.region || "Worldwide"].filter(Boolean).join(" · ")}
                {o.max_award_usd ? ` · up to ${usd(o.max_award_usd)}` : ""}
                {o.deadline ? ` · deadline ${new Date(o.deadline).toLocaleDateString()}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[12px] uppercase tracking-[0.14em] font-normal ${o.is_active ? "text-emerald-700" : "text-ash"}`}>
                {o.is_active ? "Active" : "Inactive"}
              </span>
              <form action={adminToggleOpportunity}>
                <input type="hidden" name="opportunity_id" value={o.id} />
                <input type="hidden" name="active" value={o.is_active ? "false" : "true"} />
                <button className={o.is_active ? "btn-ghost !py-1.5 !px-4 text-[14px]" : "btn-gold !py-1.5 !px-4 text-[14px]"}>
                  {o.is_active ? "Deactivate" : "Activate"}
                </button>
              </form>
            </div>
          </div>
        ))}
        {(!opps || opps.length === 0) && (
          <p className="px-5 py-6 text-[14px] text-ash font-normal">No opportunities yet.</p>
        )}
      </div>

      <div className="card mt-10 p-6 sm:p-8">
        <p className="eyebrow">Add opportunity</p>
        <h2 className="font-display text-[24px] font-normal mt-1">New opportunity</h2>
        <form action={async (fd: FormData) => { "use server"; await adminCreateOpportunity(fd); }} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="eyebrow">Title *</span>
            <input name="title" required className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Type *</span>
            <select name="opp_type" required className="field mt-1.5" defaultValue="grant">
              <option value="grant">Grant</option>
              <option value="fund">Fund</option>
              <option value="lab">Lab</option>
              <option value="co_production">Co-production</option>
              <option value="market">Market</option>
              <option value="distribution">Distribution</option>
              <option value="investor">Investor</option>
              <option value="broadcaster">Broadcaster</option>
              <option value="streamer">Streamer</option>
              <option value="sales_agent">Sales agent</option>
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Country / region</span>
            <input name="country" placeholder="e.g. Netherlands, Global" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Region</span>
            <input name="region" placeholder="e.g. Europe, Asia-Pacific" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Genres (comma-separated, empty = all)</span>
            <input name="genres" placeholder="Drama, Documentary" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Formats (comma-separated)</span>
            <input name="formats" placeholder="feature, documentary" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Stages (comma-separated)</span>
            <input name="stages" placeholder="development, production" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Languages (comma-separated)</span>
            <input name="languages" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Min budget USD</span>
            <input name="min_budget_usd" type="number" min={0} className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Max budget USD</span>
            <input name="max_budget_usd" type="number" min={0} className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Max award USD</span>
            <input name="max_award_usd" type="number" min={0} className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Deadline</span>
            <input name="deadline" type="date" className="field mt-1.5" />
          </label>
          <label className="block sm:col-span-2">
            <span className="eyebrow">URL</span>
            <input name="url" type="url" placeholder="https://" className="field mt-1.5" />
          </label>
          <label className="block sm:col-span-2">
            <span className="eyebrow">Description</span>
            <textarea name="description" rows={3} className="field mt-1.5" />
          </label>
          <div className="sm:col-span-2">
            <button className="btn-gold">Create opportunity</button>
          </div>
        </form>
      </div>
    </div>
  );
}
