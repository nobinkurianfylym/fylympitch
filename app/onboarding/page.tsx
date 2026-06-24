"use client";

import { useState, useTransition } from "react";
import { completeFilmmakerOnboarding } from "@/lib/actions";

export default function OnboardingPage() {
  const [name, setName]         = useState("");
  const [country, setCountry]   = useState("");
  const [imdb, setImdb]         = useState("");
  const [isDebut, setIsDebut]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [, startTransition]     = useTransition();

  function submit() {
    setError(null);
    if (!name.trim())    { setError("Please enter your name."); return; }
    if (!country.trim()) { setError("Please enter your country."); return; }

    const fd = new FormData();
    fd.set("full_name",    name.trim());
    fd.set("country",      country.trim());
    fd.set("imdb_url",     imdb.trim());
    fd.set("career_stage", isDebut ? "debut" : "filmmaker");

    startTransition(async () => {
      const result = await completeFilmmakerOnboarding(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-10">
          <p className="eyebrow mb-3 text-gold tracking-[0.18em] uppercase text-[11px]">Welcome</p>
          <h1 className="font-display text-[34px] leading-tight mb-2 text-ink">Tell us about yourself</h1>
          <p className="text-[14px] text-ash leading-relaxed">
            A few details to personalise your funding matches.
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-5">

          <div>
            <label className="field-label" htmlFor="ob-name">Full name *</label>
            <input
              id="ob-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoFocus
            />
          </div>

          <div>
            <label className="field-label" htmlFor="ob-country">Country *</label>
            <input
              id="ob-country"
              className="field"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="India, France, USA…"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="ob-imdb">
              IMDb profile{" "}
              <span className="normal-case tracking-normal font-normal text-ash">— optional</span>
            </label>
            <input
              id="ob-imdb"
              className="field"
              value={imdb}
              onChange={(e) => setImdb(e.target.value)}
              placeholder="https://www.imdb.com/name/nm…"
            />
          </div>

          {/* Debut checkbox */}
          <label
            className={`flex items-start gap-4 p-4 rounded-card border cursor-pointer transition-colors select-none
              ${isDebut ? "border-gold bg-gold/5" : "border-line bg-white/60 hover:bg-parchment/40"}`}
            onClick={() => setIsDebut((v) => !v)}
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                ${isDebut ? "border-gold bg-gold" : "border-ash/40"}`}
            >
              {isDebut && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div>
              <div className="text-[14px] font-medium text-ink">Debut filmmaker</div>
              <div className="text-[12px] text-ash mt-0.5">First or second feature / documentary</div>
            </div>
          </label>

        </div>

        {error && (
          <p className="mt-5 text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">
            {error}
          </p>
        )}

        <div className="mt-8">
          <button type="button" onClick={submit} className="btn-gold w-full">
            Go to dashboard →
          </button>
        </div>

      </div>
    </div>
  );
}
