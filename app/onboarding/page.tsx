"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
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
        <rect x="2" y="7" width="14" height="10" rx="2" />
        <path d="M16 10l5-3v10l-5-3V10z" />
      </svg>
    ),
  },
  {
    value: "producer",
    label: "Producer",
    description: "I'm a producer or production company looking for projects and co-productions.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    value: "investor",
    label: "Investor",
    description: "I represent a fund, broadcaster, streamer or private investor.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
        <circle cx="12" cy="12" r="5" />
      </svg>
    ),
  },
  {
    value: "organization",
    label: "Organisation",
    description: "I represent a film lab, festival, market or industry body.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
      </svg>
    ),
  },
];

function OnboardingForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

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

  const isIndustry = role && role !== "filmmaker";

  return (
    <main className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-7">
        <Wordmark />
      </header>

      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <p className="eyebrow mb-4">Welcome to FYLYMPITCH</p>
          <h1 className="font-display text-[34px]">Tell us about yourself</h1>
          <p className="mt-3 text-[17px] text-ash leading-relaxed">
            This takes 30 seconds. We use it to match you with the right projects and opportunities.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-8">
            <input type="hidden" name="role" value={role ?? ""} />
            <input type="hidden" name="next" value={next} />

            {/* Role selection */}
            <div>
              <label className="field-label mb-4 block">I am a…</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex items-start gap-4 p-5 rounded-card border text-left transition-all ${
                      role === r.value
                        ? "border-gold bg-gold/5"
                        : "border-line bg-white/70 hover:border-ink"
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${role === r.value ? "text-gold" : "text-ash"}`}>
                      {r.icon}
                    </span>
                    <div>
                      <div className={`font-display text-[17px] ${role === r.value ? "text-ink" : "text-ink"}`}>
                        {r.label}
                      </div>
                      <div className="mt-1 text-[13px] text-ash leading-relaxed">{r.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name + company */}
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="field-label" htmlFor="full_name">Your name *</label>
                <input
                  id="full_name"
                  name="full_name"
                  className="field"
                  placeholder="First and last name"
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="company">
                  {role === "filmmaker" ? "Production company (optional)" : "Company / organisation"}
                </label>
                <input
                  id="company"
                  name="company"
                  className="field"
                  placeholder={role === "filmmaker" ? "Leave blank if independent" : "Your company name"}
                  autoComplete="organization"
                />
              </div>
            </div>

            {/* Industry approval note */}
            {isIndustry && (
              <div className="border border-gold/40 bg-gold/5 rounded-card px-5 py-4 text-[14px]">
                <span className="font-normal">Verification required.</span>{" "}
                <span className="text-ash">
                  Producer, investor and organisation accounts are reviewed by our team — usually within 48 hours. 
                  You can explore the platform while you wait.
                </span>
              </div>
            )}

            {error && (
              <p className="text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!role || isPending}
              className="btn-gold w-full disabled:opacity-40"
            >
              {isPending ? "Saving…" : "Enter FYLYMPITCH →"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
