import { createClient } from "@/lib/supabase/server";
import { adminCreateOpportunity } from "@/lib/actions";
import { CATEGORY_CONFIG, OPP_CATEGORY_MAP } from "@/lib/format";
import { OpportunityEditForm } from "./OpportunityEditForm";

export const dynamic = "force-dynamic";

const OPP_TYPE_OPTIONS = [
  { value: "grant",              label: "Grant" },
  { value: "fund",               label: "Fund" },
  { value: "lab",                label: "Lab" },
  { value: "co_production",      label: "Co-production" },
  { value: "market",             label: "Market" },
  { value: "distribution",       label: "Distribution" },
  { value: "investor",           label: "Investor" },
  { value: "broadcaster",        label: "Broadcaster" },
  { value: "streamer",           label: "Streamer" },
  { value: "sales_agent",        label: "Sales Agent" },
  { value: "brand_integration",  label: "Brand Integration" },
  { value: "crowdfunding",       label: "Crowdfunding" },
  { value: "producer",           label: "Producer" },
  { value: "production_company", label: "Production Company" },
  { value: "studio",             label: "Studio" },
  { value: "sponsor",            label: "Sponsor" },
  { value: "pre_sale",           label: "Pre-Sale" },
  { value: "tax_incentive",      label: "Tax Incentive" },
];

export default async function AdminOpportunities() {
  const supabase = await createClient();
  const { data: opps } = await supabase
    .from("opportunities")
    .select(`
      id, title, opp_type, country, region,
      genres, formats, stages, languages,
      min_budget_usd, max_budget_usd, max_award_usd,
      deadline, url, description, is_active
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const allOpps = opps ?? [];

  // Group by category; only show categories that have at least one entry
  const grouped = CATEGORY_CONFIG
    .map(cat => ({
      ...cat,
      items: allOpps.filter(o => OPP_CATEGORY_MAP[o.opp_type] === cat.key),
    }))
    .filter(g => g.items.length > 0);

  // Any opp_type not in the map falls into an "Other" bucket
  const uncategorised = allOpps.filter(o => !OPP_CATEGORY_MAP[o.opp_type]);

  return (
    <div>
      <p className="eyebrow">Fund management</p>
      <h1 className="font-display text-[30px] font-normal mt-1">Grants, funds &amp; opportunities</h1>
      <p className="text-[13px] text-ash font-normal mt-1">{allOpps.length} total · {allOpps.filter(o => o.is_active).length} active</p>

      {/* Categorised sections */}
      <div className="mt-8 space-y-10">
        {grouped.map(cat => (
          <div key={cat.key}>
            <div className="mb-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-[22px] font-normal">{cat.label}</h2>
                <span className="text-[12px] text-ash font-normal tracking-[0.1em]">{cat.items.length}</span>
              </div>
              <p className="text-[12px] text-ash/70 font-normal mt-0.5">{cat.sub}</p>
            </div>
            <div className="card divide-y divide-line">
              {cat.items.map(o => (
                <OpportunityEditForm key={o.id} opp={o} />
              ))}
            </div>
          </div>
        ))}

        {uncategorised.length > 0 && (
          <div>
            <div className="mb-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-[22px] font-normal">Other</h2>
                <span className="text-[12px] text-ash font-normal tracking-[0.1em]">{uncategorised.length}</span>
              </div>
            </div>
            <div className="card divide-y divide-line">
              {uncategorised.map(o => (
                <OpportunityEditForm key={o.id} opp={o} />
              ))}
            </div>
          </div>
        )}

        {allOpps.length === 0 && (
          <p className="text-[14px] text-ash font-normal">No opportunities yet.</p>
        )}
      </div>

      {/* Add new opportunity */}
      <div className="card mt-14 p-6 sm:p-8">
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
              {OPP_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Country</span>
            <input name="country" placeholder="e.g. Netherlands, Global" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Region</span>
            <input name="region" placeholder="e.g. Europe, Asia-Pacific" className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="eyebrow">Genres (comma-separated)</span>
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
