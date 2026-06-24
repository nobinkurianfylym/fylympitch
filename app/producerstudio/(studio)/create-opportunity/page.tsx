import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateOpportunityForm from "./CreateOpportunityForm";

export const dynamic = "force-dynamic";

export default async function CreateOpportunityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status, full_name, company")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role   = (profile as any).role;
  const status = (profile as any).approval_status;

  if (!["producer", "admin"].includes(role)) redirect("/producerstudio");

  return (
    <div className="px-8 py-10 max-w-[760px]">

      {/* Header */}
      <div className="mb-10 pb-8 border-b border-line">
        <p className="text-[10px] tracking-[0.22em] uppercase text-ash mb-2">Producer Studio</p>
        <h1 className="font-display text-[32px] font-[400] text-ink">Create an Opportunity</h1>
        <p className="mt-3 text-[14px] text-ash max-w-lg leading-relaxed">
          Post a brief to the public Opportunities page. Filmmakers who apply will
          send their project to you as an exclusive submission — identical to pitching
          via your producer profile.
        </p>
      </div>

      {/* Blocked state */}
      {status !== "approved" && (
        <div className="card p-8 border-gold/40">
          <p className="text-[11px] tracking-[0.18em] uppercase text-gold mb-2">Verification Required</p>
          <p className="text-[15px] text-ink">
            Your account is pending verification. Once approved by the FYLYM team,
            you'll be able to post opportunities to the public platform.
          </p>
        </div>
      )}

      {/* Form — only shown to approved producers/admins */}
      {status === "approved" && (
        <CreateOpportunityForm userId={user.id} />
      )}
    </div>
  );
}
