import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PendingClient from "./PendingClient";

export const dynamic = "force-dynamic";

export default async function ProducerPendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company, approval_status")
    .eq("id", user.id)
    .single();

  // Already approved — go straight to studio (handles manual refresh + re-login)
  if (profile?.approval_status === "approved") redirect("/producer");

  return (
    <PendingClient
      userId={user.id}
      fullName={profile?.full_name ?? null}
      company={profile?.company ?? null}
    />
  );
}
