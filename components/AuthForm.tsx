"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(params.get("role") ?? "filmmaker");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get("next") ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setNotice("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: mode === "signup" ? { prompt: "select_account" } : {},
      },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-7">
        <Wordmark />
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md">
          <h1 className="font-display text-[32px]">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-3 text-[14px] text-ash">
            {mode === "signup"
              ? "Filmmakers get instant access. Producer and investor accounts are verified within 48 hours."
              : "Sign in to your matches, applications and offers."}
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            {mode === "signup" && (
              <>
                <div>
                  <label className="field-label" htmlFor="full_name">Full name</label>
                  <input id="full_name" className="field" value={fullName} required
                    onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </div>
                <div>
                  <label className="field-label" htmlFor="role">I am a</label>
                  <select id="role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="filmmaker">Filmmaker</option>
                    <option value="producer">Producer</option>
                    <option value="investor">Investor</option>
                    <option value="organization">Organization (fund / festival / distributor)</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="field" value={email} required
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input id="password" type="password" className="field" value={password} required minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>

            {error && <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">{error}</p>}
            {notice && <p className="text-[13px] text-[#5d4f2e] border border-gold/40 bg-gold/10 rounded-card px-4 py-3">{notice}</p>}

            <button type="submit" disabled={busy} className="btn-gold w-full disabled:opacity-50">
              {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button onClick={handleGoogle} className="btn-ghost w-full mt-4">Continue with Google</button>

          <div className="mt-8 text-[13px] text-ash flex justify-between">
            {mode === "signup" ? (
              <span>Already a member? <Link href="/login" className="text-ink underline underline-offset-4 hover:text-gold">Sign in</Link></span>
            ) : (
              <>
                <span>New here? <Link href="/signup" className="text-ink underline underline-offset-4 hover:text-gold">Create account</Link></span>
                <Link href="/reset-password" className="hover:text-gold">Forgot password?</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
