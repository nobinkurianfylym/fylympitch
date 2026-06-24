import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_completed, role, approval_status")
    .eq("id", user.id)
    .single();

  // Already completed onboarding
  if (profile?.profile_completed) {
    if (profile.role === "producer") {
      if (profile.approval_status === "approved") redirect("/producerstudio");
      redirect("/producerstudio/pending");
    }
    redirect("/dashboard");
  }

  return <>{children}</>;
}
