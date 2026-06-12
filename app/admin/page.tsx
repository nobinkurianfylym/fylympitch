import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function count(supabase: Awaited<ReturnType<typeof createClient>>, table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

export default async function AdminHome() {
  const supabase = await createClient();

  const [users, pending, projects, applications, accepted, offers, offersAccepted, opps, views] =
    await Promise.all([
      count(supabase, "profiles"),
      count(supabase, "profiles", (q) => q.eq("approval_status", "pending").neq("role", "filmmaker")),
      count(supabase, "projects"),
      count(supabase, "applications"),
      count(supabase, "applications", (q) => q.eq("status", "accepted")),
      count(supabase, "offers"),
      count(supabase, "offers", (q) => q.eq("status", "accepted")),
      count(supabase, "opportunities", (q) => q.eq("is_active", true)),
      count(supabase, "activity_logs", (q) => q.eq("action", "opportunity_viewed")),
    ]);

  const matchSuccess =
    applications > 0 ? Math.round((accepted / applications) * 100) : 0;
  const offerSuccess = offers > 0 ? Math.round((offersAccepted / offers) * 100) : 0;

  const stats = [
    { label: "Registered users", value: users },
    { label: "Pending verifications", value: pending, accent: pending > 0 },
    { label: "Projects submitted", value: projects },
    { label: "Active opportunities", value: opps },
    { label: "Applications sent", value: applications },
    { label: "Opportunity views", value: views },
    { label: "Match success rate", value: `${matchSuccess}%` },
    { label: "Offer acceptance rate", value: `${offerSuccess}%` },
  ];

  const { data: recent } = await supabase
    .from("activity_logs")
    .select("action, entity, created_at, profiles!activity_logs_user_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <div>
      <p className="eyebrow">Platform health</p>
      <h1 className="font-display text-3xl font-light mt-1">Analytics</h1>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className={`text-3xl font-light ${s.accent ? "text-gold" : "text-ink"}`}>{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ash font-light">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <p className="eyebrow">Recent activity</p>
        <div className="card mt-3 divide-y divide-line">
          {(recent ?? []).map((r, i) => {
            const who = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return (
              <div key={i} className="px-5 py-3 flex items-center justify-between text-sm font-light">
                <span className="text-ink">
                  {who?.full_name ?? "Someone"} · {r.action.replaceAll("_", " ")} {r.entity}
                </span>
                <span className="text-ash text-xs">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            );
          })}
          {(!recent || recent.length === 0) && (
            <p className="px-5 py-6 text-sm text-ash font-light">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
