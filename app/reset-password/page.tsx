"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile`,
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-7"><Wordmark /></header>
      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md">
          <h1 className="font-display text-[32px]">Reset your password</h1>
          {sent ? (
            <p className="mt-6 text-[14px] text-ash">
              If an account exists for {email}, a reset link is on its way. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label className="field-label" htmlFor="email">Email</label>
                <input id="email" type="email" className="field" value={email} required
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p className="text-[13px] text-red-700">{error}</p>}
              <button type="submit" className="btn-gold w-full">Send reset link</button>
            </form>
          )}
          <p className="mt-8 text-[13px] text-ash">
            <Link href="/login" className="text-ink underline underline-offset-4 hover:text-gold">Back to sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
