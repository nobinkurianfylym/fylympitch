"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "@/lib/actions";
import Wordmark from "@/components/Wordmark";
import { Suspense } from "react";

const ROLES = [
  {
    value: "filmmaker",
    label: "Filmmaker",
    description: "I'm submitting a project to find funding, co-production and market access.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="7" width="14" height="10" rx="2"/>
        <path d="M16 10l5-3v10l-5-3V10z"/>
      </svg>
    ),
    note: "Instant access — your dashboard is ready immediately.",
  },
  {
    value: "producer",
    label: "Producer",
    description: "I'm a producer or production company looking to discover, fund and co-produce projects.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
    note: "Requires admin approval — usually within 24 hours.",
  },
];

function OnboardingForm() {
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await completeOnboarding(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-7">
        <Wordmark />
      </header>
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <p className="eyebrow mb-4">Welcome</p>
          <h1 className="font-display text-[34px]">How will you use FYLYMPITCH?</h1>
          <p className="mt-3 text-[17px] text-ash leading-relaxed">
            Pick your role and we'll set up the right workspace for you.
          </p>
          <form onSubmit={handleSubmit} className="mt-10 space-y-8">
            <input type="hidden" name="role" value={role ?? ""} />
            <div className="flex flex-col gap-4">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex items-start gap-5 p-6 rounded-card border text-left transition-all ${
                    role === r.value ? "border-gold bg-gold/5" : "border-line bg-white/70 hover:border-ink"
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${role === r.value ? "text-gold" : "text-ash"}`}>
                    {r.icon}
                  </span>
                  <div>
                    <div className="font-display text-[20px] mb-1">{r.label}</div>
                    <div className="text-[14px] text-ash leading-relaxed">{r.description}</div>
                    <div className={`mt-2 text-[12px] tracking-wide ${role === r.value ? "text-gold" : "text-ash"}`}>
                      {r.note}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="field-label" htmlFor="full_name">Your name *</label>
                <input id="full_name" name="full_name" className="field" placeholder="First and last name" required autoComplete="name"/>
              </div>
              <div>
                <label className="field-label" htmlFor="company">
                  {role === "producer" ? "Company name *" : "Production company (optional)"}
                </label>
                <input id="company" name="company" className="field"
                  placeholder={role === "producer" ? "Your production company" : "Leave blank if independent"}
                  autoComplete="organization"
                  required={role === "producer"}/>
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">{error}</p>
            )}

            <button type="submit" disabled={!role || isPending} className="btn-gold w-full disabled:opacity-40">
              {isPending ? "Setting up…" : role === "producer" ? "Request producer access →" : "Enter FYLYMPITCH →"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return <Suspense><OnboardingForm /></Suspense>;
}
