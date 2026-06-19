// ============================================================
// ⚠️  DEVELOPMENT ONLY — REMOVE THIS PAGE BEFORE GO-LIVE
//     Delete the entire /app/dev-login/ folder when done.
// ============================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

const TEST_ACCOUNTS = [
  {
    label: "Admin",
    email: "admin@gmail.com",
    description: "Full platform access. Manage producers, projects, opportunities.",
    redirect: "/admin",
    badge: "Admin",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
  },
  {
    label: "Filmmaker",
    email: "filmmaker@gmail.com",
    description: "Submit projects, run the engine, browse opportunities.",
    redirect: "/dashboard",
    badge: "Filmmaker",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    label: "Producer",
    email: "producer@gmail.com",
    description: "Browse projects, manage pipeline, send meeting requests.",
    redirect: "/producer",
    badge: "Producer",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
];

const DEV_PASSWORD = "Fylympitch@dev1";

export default function DevLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(email: string, redirect: string) {
    setError(null);
    setLoading(email);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: DEV_PASSWORD,
    });
    if (error) {
      setError(`${email}: ${error.message}`);
      setLoading(null);
    } else {
      router.push(redirect);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#F5F5F0]">
      <header className="max-w-6xl w-full mx-auto px-6 py-7">
        <Wordmark />
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-lg">

          {/* Warning banner */}
          <div className="mb-8 px-4 py-3 rounded-card bg-amber-50 border-2 border-amber-400">
            <p className="text-[13px] text-amber-800 font-normal leading-relaxed">
              <strong>⚠️ DEVELOPER LOGIN — TEMPORARY.</strong>{" "}
              This page bypasses normal authentication for testing.
              Remove <code className="bg-amber-100 px-1 rounded">/app/dev-login/</code> before going live.
            </p>
          </div>

          <p className="eyebrow mb-2">Test accounts</p>
          <h1 className="font-display text-[28px] font-normal mb-6">Sign in as</h1>

          <div className="space-y-3">
            {TEST_ACCOUNTS.map((account) => (
              <div key={account.email} className="card px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-normal text-ink">{account.label}</p>
                    <span className={`text-[10px] tracking-[0.14em] uppercase px-2 py-0.5 rounded-full border ${account.badgeColor}`}>
                      {account.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-ash">{account.email}</p>
                  <p className="text-[12px] text-ash mt-0.5">{account.description}</p>
                </div>
                <button
                  onClick={() => loginAs(account.email, account.redirect)}
                  disabled={!!loading}
                  className="btn-gold !py-1.5 !px-4 text-[13px] shrink-0 disabled:opacity-50"
                >
                  {loading === account.email ? "Signing in…" : "Sign in"}
                </button>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-4 text-[13px] text-red-600 border border-red-200 bg-red-50 rounded-card px-4 py-3">
              {error}
            </p>
          )}

          <div className="mt-8 px-4 py-3 rounded-card border border-line bg-white">
            <p className="text-[12px] text-ash font-normal">
              <strong className="text-ink">Password for all accounts:</strong>{" "}
              <code className="bg-parchment px-2 py-0.5 rounded text-ink">{DEV_PASSWORD}</code>
            </p>
            <p className="text-[11px] text-ash mt-2">
              Create these accounts in Supabase → Authentication → Users,
              then run the SQL below to assign roles correctly.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
