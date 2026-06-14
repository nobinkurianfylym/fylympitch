import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  // Already approved — go to studio
  if (profile?.approval_status === "approved") redirect("/producer");

  return (
    <div className="flex-1 flex items-center justify-center min-h-[80vh] px-6">
      <div className="max-w-lg text-center">
        <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-8">
          <i className="ti ti-clock" style={{ fontSize: 28, color: "#BF9953" }} aria-hidden="true" />
        </div>

        <h1 className="font-display text-[32px] mb-4">Application received</h1>
        <p className="text-[17px] text-ash leading-[1.7] mb-2">
          Thanks{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}. Your producer account for{" "}
          <span className="text-ink">{profile?.company ?? "your company"}</span> is under review.
        </p>
        <p className="text-[15px] text-ash leading-[1.7] mb-10">
          We verify every producer account to protect filmmakers. This usually takes less than 24 hours.
          You'll receive a notification once you're approved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/projects" className="btn-ghost">Browse public projects</Link>
          <Link href="/dashboard" className="btn-gold">Go to filmmaker dashboard</Link>
        </div>

        <p className="mt-10 text-[12px] text-ash">
          Questions?{" "}
          <a href="mailto:nobinkurian@yahoo.com" className="underline hover:text-gold">
            Contact the team
          </a>
        </p>
      </div>
    </div>
  );
}
