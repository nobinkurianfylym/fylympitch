import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Belt-and-suspenders guard: middleware handles the unauthenticated case,
// but this layout also catches already-onboarded users who land on /onboarding
// directly (e.g. back-button after completing onboarding). Without this, they
// could re-submit the role form and silently overwrite their profile.
export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  // Unauthenticated — middleware should have caught this, but be explicit
  if (!user || error) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, role, approval_status")
    .eq("id", user.id)
    .single();

  // Already completed onboarding — route to the correct workspace
  if (profile?.onboarded_at) {
    if (profile.role === "producer") {
      if (profile.approval_status === "approved") redirect("/producer");
      redirect("/producer/pending");
    }
    redirect("/dashboard");
  }

  return <>{children}</>;
}
