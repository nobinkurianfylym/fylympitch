"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function PendingClient({
  userId,
  fullName,
  company,
}: {
  userId: string;
  fullName: string | null;
  company: string | null;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [justApproved, setJustApproved] = useState(false);

  // ── Supabase Realtime: watch own profile row ──────────────────
  // When the admin approves, approval_status changes to "approved".
  // The UPDATE event fires here and we redirect automatically.
  useEffect(() => {
    const channel = supabase
      .channel(`profile-approval-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.new?.approval_status === "approved") {
            setJustApproved(true);
            // Small delay so the producer sees the success state before redirect
            setTimeout(() => router.push("/producerstudio"), 1500);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, router]);

  // ── Manual check (also works if realtime isn't available) ─────
  async function handleCheck() {
    setChecking(true);
    const { data } = await supabase
      .from("profiles")
      .select("approval_status")
      .eq("id", userId)
      .single();
    if (data?.approval_status === "approved") {
      router.push("/producerstudio");
    } else {
      setChecking(false);
    }
  }

  if (justApproved) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[80vh] px-6">
        <div className="max-w-lg text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-8">
            <i className="ti ti-check" style={{ fontSize: 28, color: "#BF9953" }} aria-hidden="true" />
          </div>
          <h1 className="font-display text-[32px] mb-4">You're approved</h1>
          <p className="text-[17px] text-ash leading-[1.7]">
            Entering the Producer Studio…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-[80vh] px-6">
      <div className="max-w-lg text-center">
        <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-8">
          <i className="ti ti-clock" style={{ fontSize: 28, color: "#BF9953" }} aria-hidden="true" />
        </div>

        <h1 className="font-display text-[32px] mb-4">Application received</h1>
        <p className="text-[17px] text-ash leading-[1.7] mb-2">
          Thanks{fullName ? `, ${fullName.split(" ")[0]}` : ""}. Your producer account for{" "}
          <span className="text-ink">{company ?? "your company"}</span> is under review.
        </p>
        <p className="text-[15px] text-ash leading-[1.7] mb-10">
          We verify every producer account to protect filmmakers. This usually takes less than
          24 hours. This page will update automatically once you're approved — no need to
          refresh or log out.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link href="/filmprojects" className="btn-ghost">Browse public projects</Link>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="btn-gold disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check my status"}
          </button>
        </div>

        <p className="text-[12px] text-ash">
          Questions?{" "}
          <a href="mailto:nobinkurian@yahoo.com" className="underline hover:text-gold">
            Contact the team
          </a>
        </p>
      </div>
    </div>
  );
}
