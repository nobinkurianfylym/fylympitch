import { createClient } from "@/lib/supabase/server";
import { adminResolveReport } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TARGET_LABEL: Record<string, string> = {
  profile: "User profile",
  project: "Project",
  offer: "Offer",
  opportunity: "Opportunity",
};

export default async function AdminModeration({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!filter || filter === "open") query = query.eq("status", "open");

  const { data: reports, error } = await query;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Moderation</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Reports</h1>
        </div>
        <div className="flex gap-2">
          <a href="/admin/moderation" className={`btn-ghost ${!filter || filter === "open" ? "border-gold text-ink" : ""}`}>
            Open
          </a>
          <a href="/admin/moderation?filter=all" className={`btn-ghost ${filter === "all" ? "border-gold text-ink" : ""}`}>
            All
          </a>
        </div>
      </div>

      {error && (
        <div className="mt-8 card border-gold/50 bg-gold/5 px-5 py-4 text-[14px]">
          <span className="font-normal">Reports table not found.</span>{" "}
          <span className="text-ash">
            Run <code>supabase/migrations/002_certificates_and_reports.sql</code> in the Supabase SQL editor to enable this module.
          </span>
        </div>
      )}

      {!error && (
        <div className="card mt-8 divide-y divide-line">
          {(reports ?? []).map((r) => (
            <div key={r.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-normal text-ink">
                  {TARGET_LABEL[r.target_type] ?? r.target_type}{" "}
                  <span className="text-[12px] text-ash">· {r.target_id}</span>
                </p>
                <p className="text-[12px] text-ash font-normal mt-0.5">{r.reason}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[12px] uppercase tracking-[0.14em] font-normal ${
                    r.status === "resolved" ? "text-emerald-700" : r.status === "dismissed" ? "text-ash" : "text-gold"
                  }`}
                >
                  {r.status}
                </span>
                {r.status === "open" && (
                  <>
                    <form action={adminResolveReport}>
                      <input type="hidden" name="report_id" value={r.id} />
                      <input type="hidden" name="status" value="resolved" />
                      <button className="btn-gold !py-1.5 !px-4 text-[14px]">Resolve</button>
                    </form>
                    <form action={adminResolveReport}>
                      <input type="hidden" name="report_id" value={r.id} />
                      <input type="hidden" name="status" value="dismissed" />
                      <button className="btn-ghost !py-1.5 !px-4 text-[14px]">Dismiss</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))}
          {(!reports || reports.length === 0) && (
            <p className="px-5 py-6 text-[14px] text-ash font-normal">
              {!filter || filter === "open" ? "Queue is clear — no open reports." : "No reports found."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
