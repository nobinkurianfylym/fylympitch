import Link from "next/link";
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
    { label: "Registered users",      value: users,                   href: "/admin/users" },
    { label: "Pending verifications", value: pending, accent: pending > 0, href: "/admin/producers" },
    { label: "Projects submitted",    value: projects,                href: "/admin/projects" },
    { label: "Active opportunities",  value: opps,                    href: "/admin/opportunities" },
    { label: "Applications sent",     value: applications,            href: "/admin/audit" },
    { label: "Opportunity views",     value: views,                   href: "/admin/audit" },
    { label: "Match success rate",    value: `${matchSuccess}%` },
    { label: "Offer acceptance rate", value: `${offerSuccess}%` },
  ];

  const { data: recent } = await supabase
    .from("activity_logs")
    .select("action, entity, created_at, user_id, profiles!activity_logs_user_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <div>
      <p className="eyebrow">Platform health</p>
      <h1 className="font-display text-[30px] font-normal mt-1">Analytics</h1>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => {
          const inner = (
            <>
              <p className={`text-[30px] font-normal ${s.accent ? "text-gold" : "text-ink"}`}>{s.value}</p>
              <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-ash font-normal group-hover:text-gold transition-colors">{s.label}</p>
            </>
          );
          return (s as any).href ? (
            <Link key={s.label} href={(s as any).href}
              className="card p-5 hover:border-gold hover:shadow-sm transition-all group block">
              {inner}
            </Link>
          ) : (
            <div key={s.label} className="card p-5">
              <p className={`text-[30px] font-normal ${s.accent ? "text-gold" : "text-ink"}`}>{s.value}</p>
              <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-ash font-normal">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <p className="eyebrow">Recent activity</p>
        <div className="card mt-3 divide-y divide-line">
          {(recent ?? []).map((r, i) => {
            const who = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return (
              <Link key={i} href={`/admin/users`}
                className="px-5 py-3 flex items-center justify-between text-[14px] font-normal hover:bg-parchment transition-colors">
                <span className="text-ink">
                  {who?.full_name ?? "Someone"} · {r.action.replaceAll("_", " ")} {r.entity}
                </span>
                <span className="text-ash text-[12px]">{new Date(r.created_at).toLocaleString()}</span>
              </Link>
            );
          })}
          {(!recent || recent.length === 0) && (
            <p className="px-5 py-6 text-[14px] text-ash font-normal">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
