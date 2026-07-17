import { createClient } from "@/lib/supabase/server";
import { adminSetApproval, adminVerifyProducer } from "@/lib/actions";
import Link from "next/link";

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
    .select("id, full_name, role, approval_status, is_producer_verified, company, country, bio, imdb_url, created_at")
    .eq("role", "producer")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "pending")  query = query.eq("approval_status", "pending");
  if (filter === "approved") query = query.eq("approval_status", "approved");
  if (filter === "verified") query = query.eq("is_producer_verified", true);

  const { data: producers } = await query;

  const { count: pendingCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "producer")
    .eq("approval_status", "pending");

  const { count: verifiedCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "producer")
    .eq("is_producer_verified", true);

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
          <h1 className="font-display text-[30px] font-normal mt-1">
            Producers
            {(pendingCount ?? 0) > 0 && (
              <span className="ml-3 text-[14px] font-normal bg-amber-100 text-amber-800 px-3 py-1 rounded-full align-middle">
                {pendingCount} pending
              </span>
            )}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/admin/producers" className={`btn-ghost ${!filter ? "border-gold text-ink" : ""}`}>All</a>
          <a href="/admin/producers?filter=pending" className={`btn-ghost ${filter === "pending" ? "border-gold text-ink" : ""}`}>
            Pending {(pendingCount ?? 0) > 0 && `(${pendingCount})`}
          </a>
          <a href="/admin/producers?filter=approved" className={`btn-ghost ${filter === "approved" ? "border-gold text-ink" : ""}`}>Approved</a>
          <a href="/admin/producers?filter=verified" className={`btn-ghost ${filter === "verified" ? "border-gold text-ink" : ""}`}>
            ✓ Verified {(verifiedCount ?? 0) > 0 && `(${verifiedCount})`}
          </a>
        </div>
      </div>

      <div className="card mt-8 divide-y divide-line">
        {(producers ?? []).map((p) => (
          <div key={p.id} className="px-5 py-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/admin/users/${p.id}`} className="font-normal text-ink hover:text-gold transition-colors">
                  {p.full_name ?? "Unnamed"}
                </Link>
                {p.is_producer_verified && (
                  <span
                    title="Verified producer"
                    className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold leading-none"
                  >
                    ✓
                  </span>
                )}
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
              <div className="flex items-center gap-3 mt-1">
                <Link href={`/admin/users/${p.id}`} className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-gold">
                  View full profile →
                </Link>
                {p.imdb_url && (
                  <a className="text-[12px] underline hover:text-gold" href={p.imdb_url} target="_blank" rel="noreferrer">
                    IMDb ↗
                  </a>
                )}
              </div>
              <p className="text-[11px] text-ash mt-1">
                Joined {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Approve / Reject */}
              {p.approval_status !== "approved" && (
                <form action={adminSetApproval}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="btn-gold !py-2 !px-4 text-[13px]">Approve</button>
                </form>
              )}
              {p.approval_status !== "rejected" && (
                <form action={adminSetApproval}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="btn-ghost !py-2 !px-4 text-[13px]">Reject</button>
                </form>
              )}

              {/* Verify / Unverify — only available on approved producers */}
              {p.approval_status === "approved" && (
                <form action={adminVerifyProducer}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <input type="hidden" name="verify" value={p.is_producer_verified ? "false" : "true"} />
                  <button
                    className={p.is_producer_verified
                      ? "btn-ghost !py-2 !px-4 text-[13px] border-blue-200 text-blue-600"
                      : "btn-ghost !py-2 !px-4 text-[13px]"}
                  >
                    {p.is_producer_verified ? "✓ Unverify" : "Verify"}
                  </button>
                </form>
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
