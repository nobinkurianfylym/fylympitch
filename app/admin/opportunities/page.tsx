import { createClient } from "@/lib/supabase/server";
import { OpportunitiesAdminTabs } from "./OpportunitiesAdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminOpportunities() {
  const supabase = await createClient();
  const [{ data: opps }, { data: pending }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(`
        id, title, opp_type, country, region,
        genres, formats, stages, languages,
        min_budget_usd, max_budget_usd, max_award_usd,
        deadline, deadline_note, url, app_link, description, is_active,
        key_person, contact_email, gender_focus, eligible_countries,
        copro_required, festival_affiliated, ott_affiliated
      `)
      .eq("opp_approval_status", "approved")
      .order("is_active", { ascending: false })
      .order("title", { ascending: true }),
    supabase
      .from("opportunities")
      .select("id, title, opp_type, country, region, description, url, app_link, max_award_usd, deadline, submitted_by_name, submitted_by_email, genres, formats, stages, eligible_countries, created_at")
      .eq("opp_approval_status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div>
      <p className="eyebrow">Opportunity management</p>
      <h1 className="font-display text-[30px] font-normal mt-1">Opportunities</h1>
      <OpportunitiesAdminTabs
        opps={opps ?? []}
        pendingOpps={pending ?? []}
      />
    </div>
  );
}
