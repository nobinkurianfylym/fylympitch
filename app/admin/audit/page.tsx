import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminAudit() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, target_table, target_id, detail, created_at, profiles!audit_logs_admin_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <p className="eyebrow">Accountability</p>
      <h1 className="font-display text-3xl font-light mt-1">Audit log</h1>
      <p className="mt-2 text-sm text-ash font-light">
        Every administrative action is recorded here and cannot be edited.
      </p>

      <div className="card mt-8 divide-y divide-line">
        {(logs ?? []).map((l) => {
          const admin = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
          return (
            <div key={l.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-light text-ink">
                  <span className="text-gold">{admin?.full_name ?? "Admin"}</span>{" "}
                  · {l.action.replaceAll("_", " ")} · {l.target_table}
                </p>
                <p className="text-xs text-ash font-light">{new Date(l.created_at).toLocaleString()}</p>
              </div>
              {l.detail && (
                <p className="mt-1 text-xs text-ash font-light break-all">
                  {typeof l.detail === "string" ? l.detail : JSON.stringify(l.detail)}
                </p>
              )}
            </div>
          );
        })}
        {(!logs || logs.length === 0) && (
          <p className="px-5 py-6 text-sm text-ash font-light">No audit entries yet.</p>
        )}
      </div>
    </div>
  );
}
