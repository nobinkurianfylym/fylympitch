import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Minimal layout for /producerstudio/* — just enforces auth.
// The sidebar + producer_profiles gate live in (studio)/layout.tsx.
// /producerstudio/onboarding is NOT in (studio) so it renders without the gate.
export default async function ProducerRootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as any)?.role ?? "filmmaker";
  if (role !== "producer" && role !== "admin") redirect("/dashboard");

  return <>{children}</>;
}
