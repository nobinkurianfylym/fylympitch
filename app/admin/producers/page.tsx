import { createClient } from "@/lib/supabase/server";
import { adminSetApproval } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminProducersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, role, approval_status, company, country, bio, imdb_url, created_at")
    .eq("role", "producer")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "pending") query = query.eq("approval_status", "pending");
  if (filter === "approved") query = query.eq("approval_status", "approved");

  const { data: producers } = await query;

  // Pending count for badge
  const { count: pendingCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "producer")
    .eq("approval_status", "pending");

  const statusStyle: Record<string, string> = {
    pending:  "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    rejected: "bg-red-50 text-red-700 border border-red-200",
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Producer management</p>
          <h1 className="font-display text-3xl font-light mt-1">
            Producers
            {(pendingCount ?? 0) > 0 && (
              <span className="ml-3 text-[14px] font-normal bg-amber-100 text-amber-800 px-3 py-1 rounded-full align-middle">
                {pendingCount} pending
              </span>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <a href="/admin/producers" className={`btn-ghost ${!filter ? "border-gold text-ink" : ""}`}>All</a>
          <a href="/admin/producers?filter=pending" className={`btn-ghost ${filter === "pending" ? "border-gold text-ink" : ""}`}>
            Pending {(pendingCount ?? 0) > 0 && `(${pendingCount})`}
          </a>
          <a href="/admin/producers?filter=approved" className={`btn-ghost ${filter === "approved" ? "border-gold text-ink" : ""}`}>Approved</a>
        </div>
      </div>

      <div className="card mt-8 divide-y divide-line">
        {(producers ?? []).map((p) => (
          <div key={p.id} className="px-5 py-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-normal text-ink">{p.full_name ?? "Unnamed"}</p>
                <span className={`text-[10px] tracking-[0.14em] uppercase px-2.5 py-0.5 rounded-full ${statusStyle[p.approval_status] ?? ""}`}>
                  {p.approval_status}
                </span>
              </div>
              <p className="text-[13px] text-ash mt-1">
                {[p.company, p.country].filter(Boolean).join(" · ") || "No company details"}
              </p>
              {p.bio && (
                <p className="text-[13px] text-ash mt-1 line-clamp-2">{p.bio}</p>
              )}
              {p.imdb_url && (
                <a className="text-[12px] underline hover:text-gold mt-1 inline-block" href={p.imdb_url} target="_blank" rel="noreferrer">
                  IMDb profile ↗
                </a>
              )}
              <p className="text-[11px] text-ash/60 mt-1">
                Joined {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {p.approval_status !== "approved" && (
                <form action={adminSetApproval}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="btn-gold !py-2 !px-5 text-[13px]">Approve</button>
                </form>
              )}
              {p.approval_status !== "rejected" && (
                <form action={adminSetApproval}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="btn-ghost !py-2 !px-5 text-[13px]">Reject</button>
                </form>
              )}
              {p.approval_status === "approved" && (
                <span className="text-[12px] text-ash">Access granted</span>
              )}
            </div>
          </div>
        ))}
        {(!producers || producers.length === 0) && (
          <p className="px-5 py-8 text-[14px] text-ash">No producers found.</p>
        )}
      </div>
    </div>
  );
}
