import { createClient } from "@/lib/supabase/server";
import { AdminCreateOpportunityForm } from "./AdminCreateOpportunityForm";
import { OpportunitiesAdminClient } from "./OpportunitiesAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminOpportunities() {
  const supabase = await createClient();
  const { data: opps } = await supabase
    .from("opportunities")
    .select(`
      id, title, opp_type, country, region,
      genres, formats, stages, languages,
      min_budget_usd, max_budget_usd, max_award_usd,
      deadline, deadline_note, url, app_link, description, is_active,
      key_person, contact_email, gender_focus, eligible_countries,
      copro_required, festival_affiliated, ott_affiliated
    `)
    .order("is_active", { ascending: false })
    .order("title", { ascending: true });

  const allOpps = (opps ?? []) as any[];

  return (
    <div>
      <p className="eyebrow">Opportunity management</p>
      <h1 className="font-display text-[30px] font-normal mt-1">Opportunities</h1>

      <OpportunitiesAdminClient opps={allOpps} />

      <div className="mt-16 pt-10 border-t border-line">
        <AdminCreateOpportunityForm />
      </div>
    </div>
  );
}
