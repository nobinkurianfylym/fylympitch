"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

type Role = "filmmaker" | "producer";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.84.86-3.06.86-2.36 0-4.36-1.6-5.07-3.74H.9v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.93 10.68A5.4 5.4 0 0 1 3.65 9c0-.58.1-1.15.28-1.68V4.99H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.01l3.03-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.59 8.59 0 0 0 9 0 9 9 0 0 0 .9 4.99l3.03 2.33C4.64 5.18 6.64 3.58 9 3.58z" />
    </svg>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();

  const [role, setRole] = useState<Role>(() => {
    const r = params.get("role");
    return r === "producer" ? "producer" : "filmmaker";
  });
  const [email, setEmail] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [sent,  setSent]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawNext = params.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("/login") &&
    !rawNext.startsWith("/signup") &&
    !rawNext.startsWith("/auth")
      ? rawNext
      : "/dashboard";

  const authError = params.get("error");

  /* ── Google OAuth ─────────────────────────────── */
  async function handleGoogle() {
    setError(null);
    setBusy(true);
    document.cookie = `signup_role=${role}; path=/; max-age=300; SameSite=Lax`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: mode === "signup" ? { prompt: "select_account" } : {},
      },
    });
    if (error) { setError(error.message); setBusy(false); }
  }

  /* ── Magic link ───────────────────────────────── */
  async function handleMagicLink() {
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        data: { role },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) { setError(error.message); setBusy(false); }
    else        { setSent(true); setBusy(false); }
  }

  /* ── Sent confirmation ────────────────────────── */
  if (sent) {
    return (
      <main className="min-h-screen bg-ivory flex flex-col">
        <header className="px-8 py-7">
          <Wordmark />
        </header>
        <div className="flex-1 flex items-center justify-center px-6 pb-24">
          <div className="w-full max-w-[380px] text-center">
            <div className="w-10 h-10 rounded-full border border-gold/40 flex items-center justify-center mx-auto mb-6 text-gold text-[18px]">
              ✉
            </div>
            <h1 className="font-display text-[28px] mb-3">Check your inbox</h1>
            <p className="text-[13px] text-ash leading-relaxed">
              Link sent to <span className="text-ink">{email}</span>. Expires in 1 hour.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-6 text-[11px] tracking-[0.12em] uppercase text-ash hover:text-ink transition-colors"
            >
              ← Try another address
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── Main form ────────────────────────────────── */
  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="px-8 py-7">
        <Wordmark />
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[380px]">

          {/* Role toggle */}
          <div className="relative flex border border-ink rounded-full p-1 mb-5 select-none">
            <div
              className={`absolute top-1 left-1 h-[calc(100%-8px)] w-[calc(50%-4px)] bg-ink rounded-full transition-transform duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                role === "producer" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              onClick={() => setRole("filmmaker")}
              className={`relative z-10 flex-1 py-3 text-[10px] font-semibold tracking-[0.18em] transition-colors duration-[220ms] ${
                role === "filmmaker" ? "text-ivory" : "text-ash"
              }`}
            >
              FILMMAKER
            </button>
            <button
              type="button"
              onClick={() => setRole("producer")}
              className={`relative z-10 flex-1 py-3 text-[10px] font-semibold tracking-[0.18em] transition-colors duration-[220ms] ${
                role === "producer" ? "text-ivory" : "text-ash"
              }`}
            >
              PRODUCER
            </button>
          </div>

          {/* Error */}
          {(authError || error) && (
            <p className="mb-6 text-[12px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">
              {error ?? (authError === "cancelled"
                ? "Sign-in was cancelled."
                : "Something went wrong. Please try again.")}
            </p>
          )}

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="inline-flex items-center justify-center gap-3 w-full rounded-full border border-ink bg-white text-ink text-[10px] font-bold tracking-[0.14em] uppercase px-6 py-2.5 mb-5 transition-colors hover:bg-ivory disabled:opacity-50"
          >
            <GoogleIcon />
            CONTINUE WITH GOOGLE
          </button>

          {/* OR divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[9px] font-bold tracking-[0.18em] text-ash">OR</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Email + send link — same size as Google */}
          <div className="flex items-center gap-2 w-full rounded-full border border-line bg-white px-6 py-2.5">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleMagicLink()}
              placeholder="your@email.com"
              className="flex-1 bg-transparent text-[10px] font-semibold text-ink placeholder:text-ash/50 placeholder:font-semibold outline-none tracking-[0.06em]"
              disabled={busy}
              autoComplete="email"
            />
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={busy || !email.trim()}
              className="text-[10px] font-bold tracking-[0.18em] uppercase text-ink hover:text-gold transition-colors disabled:opacity-30 shrink-0"
            >
              {busy ? "…" : "SEND LINK"}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
