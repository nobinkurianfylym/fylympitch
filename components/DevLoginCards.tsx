"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

const DEV_PASSWORD = "Fylympitch@dev1";

const ACCOUNTS = [
  {
    role:        "Admin",
    email:       "admin@gmail.com",
    redirect:    "/admin",
    description: "Full platform access. Manage producers, projects, and opportunities.",
    capabilities: ["Approve producers", "Edit opportunities", "View all projects", "Audit logs"],
    accent:      "#BF9953",
    accentBg:    "rgba(191,153,83,0.08)",
    accentBorder:"rgba(191,153,83,0.28)",
    badgeClass:  "bg-amber-50 text-amber-800 border-amber-200",
    icon:        "◈",
  },
  {
    role:        "Filmmaker",
    email:       "filmmaker@gmail.com",
    redirect:    "/dashboard",
    description: "Submit projects, run the matching engine, browse funding opportunities.",
    capabilities: ["Submit projects", "Run FRS engine", "Browse opportunities", "Filmmaker profile"],
    accent:      "#2E6B4E",
    accentBg:    "rgba(46,107,78,0.07)",
    accentBorder:"rgba(46,107,78,0.22)",
    badgeClass:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon:        "◉",
  },
  {
    role:        "Producer",
    email:       "producer@gmail.com",
    redirect:    "/producerstudio",
    description: "Discover projects, manage pipeline, message filmmakers.",
    capabilities: ["Discover projects", "Pipeline management", "Message filmmakers", "Producer Studio"],
    accent:      "#3B6CB7",
    accentBg:    "rgba(59,108,183,0.07)",
    accentBorder:"rgba(59,108,183,0.22)",
    badgeClass:  "bg-blue-50 text-blue-700 border-blue-200",
    icon:        "◎",
  },
] as const;

export default function DevLoginCards() {
  const router  = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function loginAs(email: string, redirect: string) {
    setError(null);
    setLoading(email);
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password: DEV_PASSWORD,
    });
    if (authErr) {
      setError(`${email}: ${authErr.message}`);
      setLoading(null);
    } else {
      router.push(redirect);
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line">
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <span className="text-[10px] tracking-[0.22em] uppercase text-amber-600 border border-amber-300 bg-amber-50 px-3 py-1 rounded-full">
            Dev Mode
          </span>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 pt-12 pb-24">

        <div className="mb-10 px-5 py-4 rounded-card border-2 border-amber-400 bg-amber-50/80 flex items-start gap-3">
          <span className="text-amber-500 text-[18px] mt-0.5 shrink-0">⚠</span>
          <div>
            <p className="text-[13px] text-amber-900 font-[500] leading-snug">
              Development login — bypasses normal authentication.
            </p>
            <p className="text-[12px] text-amber-700 mt-1 leading-relaxed">
              Gated behind a passcode, but this only ever belongs on a private/staging
              environment long-term. Delete <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">/app/dev-login/</code> once QA no longer needs it.
            </p>
          </div>
        </div>

        <p className="eyebrow mb-3">Test accounts</p>
        <h1 className="font-display text-[40px] font-[400] leading-tight mb-2">
          Sign in as
        </h1>
        <p className="text-[14px] text-ash mb-10">
          Three roles, one password.{" "}
          <code className="bg-parchment border border-line px-2 py-0.5 rounded text-[13px] text-ink font-mono">
            {DEV_PASSWORD}
          </code>
        </p>

        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          {ACCOUNTS.map((account) => (
            <div
              key={account.email}
              className="flex flex-col rounded-card overflow-hidden border transition-all"
              style={{ borderColor: account.accentBorder, background: account.accentBg }}
            >
              <div className="px-6 pt-6 pb-5 border-b" style={{ borderColor: account.accentBorder }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[26px] leading-none" style={{ color: account.accent }} aria-hidden>
                    {account.icon}
                  </span>
                  <span className={`text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full border ${account.badgeClass}`}>
                    {account.role}
                  </span>
                </div>
                <h2 className="font-display text-[24px] font-[400] leading-tight mb-1">{account.role}</h2>
                <p className="text-[12px] text-ash leading-relaxed">{account.description}</p>
              </div>

              <div className="px-6 py-4 flex-1">
                <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-3">Access</p>
                <ul className="space-y-1.5">
                  {account.capabilities.map((cap) => (
                    <li key={cap} className="flex items-center gap-2 text-[12px] text-ink">
                      <span className="text-[10px] shrink-0" style={{ color: account.accent }}>✓</span>
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6 pt-4 border-t" style={{ borderColor: account.accentBorder }}>
                <p className="text-[11px] text-ash mb-3 font-mono truncate">{account.email}</p>
                <button
                  onClick={() => loginAs(account.email, account.redirect)}
                  disabled={!!loading}
                  className="w-full py-3 rounded-card text-[12px] tracking-[0.12em] uppercase font-[500] transition-colors disabled:opacity-40"
                  style={{
                    background: loading === account.email ? account.accent : account.accentBg,
                    color:      loading === account.email ? "#F5F5F0" : account.accent,
                    border:     `1px solid ${account.accentBorder}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.background = account.accent;
                      (e.currentTarget as HTMLButtonElement).style.color = "#F5F5F0";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (loading !== account.email) {
                      (e.currentTarget as HTMLButtonElement).style.background = account.accentBg;
                      (e.currentTarget as HTMLButtonElement).style.color = account.accent;
                    }
                  }}
                >
                  {loading === account.email ? "Signing in…" : `Sign in as ${account.role}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="px-5 py-4 rounded-card border border-red-200 bg-red-50">
            <p className="text-[13px] text-red-700">
              <strong>Auth error</strong> — {error}
            </p>
            <p className="text-[12px] text-red-500 mt-1">
              Make sure the account exists in Supabase → Authentication → Users with the password above.
            </p>
          </div>
        )}

        <div className="mt-8 px-5 py-4 rounded-card border border-line bg-white/60">
          <p className="text-[11px] tracking-[0.16em] uppercase text-ash mb-3">First-time setup</p>
          <p className="text-[13px] text-ink mb-2">
            Create these accounts in Supabase → Authentication → Users, then run:
          </p>
          <pre className="text-[11px] font-mono bg-parchment border border-line rounded-card px-4 py-3 overflow-x-auto text-ash leading-relaxed">{`-- Assign roles after creating auth users
UPDATE public.profiles
  SET role = 'admin'
  WHERE email = 'admin@gmail.com';

UPDATE public.profiles
  SET role = 'filmmaker',
      career_stage = 'established',
      full_name = 'Dev Filmmaker'
  WHERE email = 'filmmaker@gmail.com';

UPDATE public.profiles
  SET role = 'producer',
      full_name = 'Dev Producer',
      approval_status = 'approved'
  WHERE email = 'producer@gmail.com';`}</pre>
        </div>

      </main>
    </div>
  );
}
