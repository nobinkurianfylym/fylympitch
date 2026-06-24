import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { SubmitOpportunityForm } from "./SubmitOpportunityForm";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit an Opportunity — PITCH.FYLYM",
  description: "Know a film grant, fund, or opportunity that filmmakers should know about? Submit it for review.",
};

export default async function SubmitOpportunityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dashboardHref = "/dashboard";
  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if ((me as any)?.role === "producer") dashboardHref = "/producerstudio";
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features"  className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/filmprojects"   className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/opportunities"      className="hover:text-ink transition-colors">Opportunities</Link>
          </nav>
          {user
            ? <Link href={dashboardHref} className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">Dashboard</Link>
            : <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
          }
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 pb-24">
        <Link href="/opportunities" className="text-[11px] tracking-[0.16em] uppercase text-ash hover:text-ink transition-colors">
          ← Opportunities
        </Link>

        <div className="mt-8 mb-2">
          <p className="eyebrow mb-3">Community</p>
          <h1 className="font-display text-[34px] font-[400]">Submit an opportunity</h1>
          <p className="mt-3 text-[15px] text-ash max-w-lg">
            Know a film grant, fund, lab, or co-production opportunity that filmmakers should know about?
            Submit it here — our team will verify and add it to the database.
          </p>
        </div>

        <SubmitOpportunityForm />
      </main>
    </div>
  );
}
