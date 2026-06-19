"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

type Role = "filmmaker" | "producer";
type Step = "role" | "method" | "sent";

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

  const [step, setStep]   = useState<Step>(mode === "signup" ? "role" : "method");
  const [role, setRole]   = useState<Role>("filmmaker");
  const [email, setEmail] = useState("");
  const [busy, setBusy]   = useState(false);
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

  /* ── Google OAuth ───────────────────────────────────────────── */
  async function handleGoogle() {
    setError(null);
    setBusy(true);
    if (mode === "signup") {
      // Cookie picked up by /auth/callback to claim correct role
      document.cookie = `signup_role=${role}; path=/; max-age=300; SameSite=Lax`;
    }
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

  /* ── Magic link ─────────────────────────────────────────────── */
  async function handleMagicLink() {
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        ...(mode === "signup" ? { data: { role } } : {}),
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) { setError(error.message); setBusy(false); }
    else        { setStep("sent"); setBusy(false); }
  }

  /* ── Shared error banner ────────────────────────────────────── */
  function ErrorBanner({ msg }: { msg: string }) {
    return (
      <p className="mt-6 text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3 text-left">
        {msg}
      </p>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     STEP 1 — Role selection (signup only)
  ══════════════════════════════════════════════════════════════ */
  if (step === "role") {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="max-w-6xl w-full mx-auto px-6 py-7">
          <Wordmark />
        </header>
        <div className="flex-1 flex items-center justify-center px-6 pb-24">
          <div className="w-full max-w-lg">
            <p className="eyebrow text-center mb-3">Create account</p>
            <h1 className="font-display text-[32px] text-center">How will you use FYLYMPITCH?</h1>
            <p className="mt-3 text-[15px] leading-[1.7] text-ash text-center mb-10">
              Choose your role to get started. You can always add more later.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Filmmaker tile */}
              <button
                onClick={() => { setRole("filmmaker"); setStep("method"); }}
                className={`text-left p-6 rounded-card border-2 transition-all hover:border-gold focus:outline-none ${
                  role === "filmmaker" ? "border-gold bg-parchment" : "border-line bg-white"
                }`}
              >
                <p className="font-display text-[20px] font-normal mb-2">Filmmaker</p>
                <p className="text-[13px] text-ash leading-relaxed">
                  Submit projects, run funding intelligence, connect with producers and investors.
                </p>
                <p className="mt-4 text-[11px] tracking-[0.14em] uppercase text-emerald-700">
                  Instant access
                </p>
              </button>

              {/* Producer tile */}
              <button
                onClick={() => { setRole("producer"); setStep("method"); }}
                className={`text-left p-6 rounded-card border-2 transition-all hover:border-gold focus:outline-none ${
                  role === "producer" ? "border-gold bg-parchment" : "border-line bg-white"
                }`}
              >
                <p className="font-display text-[20px] font-normal mb-2">Producer</p>
                <p className="text-[13px] text-ash leading-relaxed">
                  Discover projects to finance or co-produce. Build your pipeline and connect with filmmakers.
                </p>
                <p className="mt-4 text-[11px] tracking-[0.14em] uppercase text-amber-700">
                  Reviewed within 48 hours
                </p>
              </button>
            </div>

            <p className="mt-8 text-[13px] text-ash text-center">
              Already a member?{" "}
              <Link href="/login" className="text-ink underline underline-offset-4 hover:text-gold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     STEP 3 — Magic link sent confirmation
  ══════════════════════════════════════════════════════════════ */
  if (step === "sent") {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="max-w-6xl w-full mx-auto px-6 py-7">
          <Wordmark />
        </header>
        <div className="flex-1 flex items-center justify-center px-6 pb-24">
          <div className="w-full max-w-md text-center">
            <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-gold text-[20px]">✉</span>
            </div>
            <h1 className="font-display text-[32px]">Check your inbox</h1>
            <p className="mt-3 text-[15px] leading-[1.7] text-ash">
              We sent a sign-in link to <strong className="text-ink font-normal">{email}</strong>.
              Click it to continue — the link expires in 1 hour.
            </p>
            <p className="mt-6 text-[13px] text-ash">
              Wrong address?{" "}
              <button
                onClick={() => { setStep(mode === "signup" ? "role" : "method"); setEmail(""); }}
                className="text-ink underline underline-offset-4 hover:text-gold"
              >
                Go back
              </button>
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     STEP 2 — Auth method (Google + Magic link)
  ══════════════════════════════════════════════════════════════ */
  const headingByRole: Record<string, string> = {
    filmmaker: "Join as Filmmaker",
    producer:  "Join as Producer",
  };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-7">
        <Wordmark />
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md">

          {/* Back arrow — signup only */}
          {mode === "signup" && (
            <button
              onClick={() => setStep("role")}
              className="flex items-center gap-2 text-[13px] text-ash hover:text-ink mb-8 transition-colors"
            >
              ← Back
            </button>
          )}

          <h1 className="font-display text-[32px]">
            {mode === "signup" ? headingByRole[role] : "Welcome back"}
          </h1>

          {mode === "signup" && role === "producer" && (
            <p className="mt-2 text-[13px] text-ash leading-relaxed">
              Producer accounts are reviewed within 48 hours. You'll receive an email once approved.
            </p>
          )}
          {mode === "login" && (
            <p className="mt-2 text-[13px] text-ash">
              Sign in to see your matches, applications and offers.
            </p>
          )}

          {/* Callback error */}
          {authError && (
            <ErrorBanner msg={
              authError === "cancelled"
                ? "Sign-in was cancelled. Try again when you're ready."
                : "Something went wrong with sign-in. Please try again."
            } />
          )}
          {error && <ErrorBanner msg={error} />}

          <div className="mt-8 space-y-3">
            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="btn-gold w-full gap-3 disabled:opacity-50"
            >
              <GoogleIcon />
              {busy ? "One moment…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-line" />
              <span className="text-[11px] tracking-[0.14em] uppercase text-ash">or</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            {/* Magic link email */}
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                placeholder="your@email.com"
                className="field flex-1"
                disabled={busy}
                autoComplete="email"
              />
              <button
                onClick={handleMagicLink}
                disabled={busy || !email.trim()}
                className="btn-ghost !px-4 disabled:opacity-40 shrink-0"
              >
                {busy ? "…" : "Send link"}
              </button>
            </div>
            <p className="text-[11px] text-ash pl-0.5">
              We'll email you a magic link — no password needed.
            </p>
          </div>

          {/* Switch mode */}
          <p className="mt-8 text-[13px] text-ash">
            {mode === "signup" ? (
              <>
                Already a member?{" "}
                <Link href="/login" className="text-ink underline underline-offset-4 hover:text-gold">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link href="/signup" className="text-ink underline underline-offset-4 hover:text-gold">
                  Create account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
