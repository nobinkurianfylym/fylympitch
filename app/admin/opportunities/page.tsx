import { createClient } from "@/lib/supabase/server";
import { CATEGORY_CONFIG, OPP_CATEGORY_MAP } from "@/lib/format";
import { OpportunityEditForm } from "./OpportunityEditForm";
import { AdminCreateOpportunityForm } from "./AdminCreateOpportunityForm";

export const dynamic = "force-dynamic";

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
      <AdminCreateOpportunityForm />
    </div>
  );
}
