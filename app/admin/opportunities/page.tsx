import { createClient } from "@/lib/supabase/server";
import { adminToggleOpportunity, adminCreateOpportunity } from "@/lib/actions";
import { usd, TYPE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOpportunities() {
  const supabase = await createClient();
  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, name, organization_name, type, country, max_award_usd, deadline, is_active")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <p className="eyebrow">Opportunity management</p>
      <h1 className="font-display text-3xl font-light mt-1">Opportunities</h1>

      <div className="card mt-8 divide-y divide-line">
        {(opps ?? []).map((o) => (
          <div key={o.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-light text-ink">{o.name}</p>
              <p className="text-xs text-ash font-light mt-0.5">
                {[o.organization_name, TYPE_LABEL[o.type] ?? o.type, o.country].filter(Boolean).join(" · ")}
                {o.max_award_usd ? ` · up to ${usd(o.max_award_usd)}` : ""}
                {o.deadline ? ` · deadline ${new Date(o.deadline).toLocaleDateString()}` : ""}
              </p>
            </div>
            <form action={adminToggleOpportunity}>
              <input type="hidden" name="opportunity_id" value={o.id} />
              <input type="hidden" name="active" value={o.is_active ? "false" : "true"} />
              <button className={o.is_active ? "btn-ghost !py-1.5 !px-4 text-sm" : "btn-gold !py-1.5 !px-4 text-sm"}>
                {o.is_active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="card mt-10 p-6 sm:p-8">
        <p className="eyebrow">Add opportunity</p>
        <h2 className="font-display text-2xl font-light mt-1">New opportunity</h2>
        <form action={async (fd: FormData) => { "use server"; await adminCreateOpportunity(fd); }} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="eyebrow">Name *</span>
            <input name="name" required className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Organization</span>
            <input name="organization_name" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Type *</span>
            <select name="type" required className="field mt-1.5" defaultValue="grant">
              <option value="grant">Grant</option>
              <option value="fund">Fund</option>
              <option value="lab">Lab</option>
              <option value="co_production">Co-production</option>
              <option value="market">Market</option>
              <option value="distribution">Distribution</option>
              <option value="investor">Investor</option>
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Country / region</span>
            <input name="country" placeholder="e.g. Netherlands, Global" className="field mt-1.5" />
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
            <span className="eyebrow">Website</span>
            <input name="website" type="url" placeholder="https://" className="field mt-1.5" />
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
