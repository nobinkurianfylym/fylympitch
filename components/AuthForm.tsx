"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sanitise the ?next= param — must be a relative path, and must not loop back to auth pages.
  const rawNext = params.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("/login") &&
    !rawNext.startsWith("/signup") &&
    !rawNext.startsWith("/auth")
      ? rawNext
      : "/dashboard";

  const authError = params.get("error");

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: mode === "signup" ? { prompt: "select_account" } : {},
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-7">
        <Wordmark />
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-[32px]">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-3 text-[21px] leading-[1.7] text-ash">
            {mode === "signup"
              ? "Filmmaker accounts get instant access. Producer, investor and organisation accounts are verified within 48 hours."
              : "Sign in with Google to see your matches, applications and offers."}
          </p>

          {/* Auth error from callback */}
          {authError && (
            <p className="mt-6 text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3 text-left">
              {authError === "cancelled"
                ? "Sign-in was cancelled. Try again when you're ready."
                : "Something went wrong with sign-in. Please try again."}
            </p>
          )}

          {error && (
            <p className="mt-6 text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3 text-left">
              {error}
            </p>
          )}

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="btn-gold w-full mt-10 gap-3 disabled:opacity-50"
          >
            <GoogleIcon />
            {busy ? "One moment…" : "Continue with Google"}
          </button>

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
