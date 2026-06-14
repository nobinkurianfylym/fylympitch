import { createClient } from "@/lib/supabase/server";
import { adminSetCertificateStatus } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  incorporation: "Incorporation certificate",
  accreditation: "Accreditation / membership",
  id_proof: "ID proof",
  tax: "Tax registration",
  other: "Other document",
};

export default async function AdminCertificates({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("certificates")
    .select("id, user_id, cert_type, label, file_path, status, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!filter || filter === "pending") query = query.eq("status", "pending");

  const { data: certs, error } = await query;

  const userIds = [...new Set((certs ?? []).map((c) => c.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, company, role").in("id", userIds)
    : { data: [] };
  const ownerById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Certificate management</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Certificates</h1>
        </div>
        <div className="flex gap-2">
          <a href="/admin/certificates" className={`btn-ghost ${!filter || filter === "pending" ? "border-gold text-ink" : ""}`}>
            Pending review
          </a>
          <a href="/admin/certificates?filter=all" className={`btn-ghost ${filter === "all" ? "border-gold text-ink" : ""}`}>
            All
          </a>
        </div>
      </div>

      {error && (
        <div className="mt-8 card border-gold/50 bg-gold/5 px-5 py-4 text-[14px]">
          <span className="font-normal">Certificates table not found.</span>{" "}
          <span className="text-ash">
            Run <code>supabase/migrations/002_certificates_and_reports.sql</code> in the Supabase SQL editor to enable this module.
          </span>
        </div>
      )}

      {!error && (
        <div className="card mt-8 divide-y divide-line">
          {(certs ?? []).map((c) => {
            const owner = ownerById.get(c.user_id);
            return (
              <div key={c.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-normal text-ink">
                    {c.label} <span className="text-[12px] text-ash">· {TYPE_LABEL[c.cert_type] ?? c.cert_type}</span>
                  </p>
                  <p className="text-[12px] text-ash font-normal mt-0.5">
                    {[owner?.full_name ?? "Unknown", owner?.company, owner?.role].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[12px] uppercase tracking-[0.14em] font-normal ${
                      c.status === "approved" ? "text-emerald-700" : c.status === "rejected" ? "text-red-700" : "text-gold"
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.status !== "approved" && (
                    <form action={adminSetCertificateStatus}>
                      <input type="hidden" name="certificate_id" value={c.id} />
                      <input type="hidden" name="status" value="approved" />
                      <button className="btn-gold !py-1.5 !px-4 text-[14px]">Approve</button>
                    </form>
                  )}
                  {c.status !== "rejected" && (
                    <form action={adminSetCertificateStatus}>
                      <input type="hidden" name="certificate_id" value={c.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button className="btn-ghost !py-1.5 !px-4 text-[14px]">Reject</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
          {(!certs || certs.length === 0) && (
            <p className="px-5 py-6 text-[14px] text-ash font-normal">
              {!filter || filter === "pending" ? "Nothing pending review." : "No certificates submitted yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
