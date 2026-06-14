import { createClient } from "@/lib/supabase/server";
import { adminSetApproval } from "@/lib/actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  filmmaker: "Filmmaker",
  producer: "Producer",
  investor: "Investor",
  organization: "Organization",
  admin: "Admin",
};

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, role, approval_status, company, country, imdb_url, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "pending") {
    query = query.eq("approval_status", "pending").neq("role", "filmmaker");
  }

  const { data: users } = await query;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">User management</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Users</h1>
        </div>
        <div className="flex gap-2">
          <a href="/admin/users" className={`btn-ghost ${!filter ? "border-gold text-ink" : ""}`}>All</a>
          <a href="/admin/users?filter=pending" className={`btn-ghost ${filter === "pending" ? "border-gold text-ink" : ""}`}>
            Pending verification
          </a>
        </div>
      </div>

      <div className="card mt-8 divide-y divide-line">
        {(users ?? []).map((u) => (
          <div key={u.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-normal text-ink">
                {u.full_name ?? "Unnamed"}{" "}
                <span className="text-[12px] text-ash">· {ROLE_LABEL[u.role] ?? u.role}</span>
              </p>
              <p className="text-[12px] text-ash font-normal mt-0.5">
                {[u.company, u.country].filter(Boolean).join(" · ") || "No company details"}
                {u.imdb_url && (
                  <> · <a className="underline hover:text-gold" href={u.imdb_url} target="_blank" rel="noreferrer">IMDb</a></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-[12px] uppercase tracking-[0.14em] font-normal ${
                  u.approval_status === "approved"
                    ? "text-emerald-700"
                    : u.approval_status === "rejected"
                    ? "text-red-700"
                    : "text-gold"
                }`}
              >
                {u.approval_status}
              </span>
              {u.role !== "filmmaker" && u.role !== "admin" && u.approval_status !== "approved" && (
                <form action={adminSetApproval}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="btn-gold !py-1.5 !px-4 text-[14px]">Approve</button>
                </form>
              )}
              {u.role !== "filmmaker" && u.role !== "admin" && u.approval_status !== "rejected" && (
                <form action={adminSetApproval}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="btn-ghost !py-1.5 !px-4 text-[14px]">Reject</button>
                </form>
              )}
            </div>
          </div>
        ))}
        {(!users || users.length === 0) && (
          <p className="px-5 py-6 text-[14px] text-ash font-normal">No users found.</p>
        )}
      </div>
    </div>
  );
}
