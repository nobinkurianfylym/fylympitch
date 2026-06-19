"use client";

import { useState, useTransition } from "react";
import { completeFilmmakerOnboarding } from "@/lib/actions";

type Step = 1 | 2 | 3;

const CAREER_STAGES = [
  { value: "debut",       label: "Debut filmmaker",       sub: "First or second feature / documentary" },
  { value: "emerging",    label: "Emerging filmmaker",    sub: "3–5 credits, festival experience" },
  { value: "established", label: "Established filmmaker", sub: "Multiple features, international distribution" },
];

const FORMATS = [
  { value: "documentary", label: "Documentary", sub: "Nonfiction, observational, essay film" },
  { value: "narrative",   label: "Narrative",   sub: "Feature, series, animation" },
];

export default function OnboardingPage() {
  const [step, setStep]             = useState<Step>(1);
  const [name, setName]             = useState("");
  const [country, setCountry]       = useState("");
  const [imdb, setImdb]             = useState("");
  const [careerStage, setCareerStage] = useState("");
  const [formats, setFormats]       = useState<string[]>([]);
  const [hasDeck, setHasDeck]       = useState<boolean | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [, startTransition]         = useTransition();

  const toggleFormat = (v: string) =>
    setFormats((f: string[]) => f.includes(v) ? f.filter((x: string) => x !== v) : [...f, v]);

  function nextStep() {
    setError(null);
    if (step === 1) {
      if (!name.trim())    { setError("Please enter your name."); return; }
      if (!country.trim()) { setError("Please enter your country."); return; }
      if (!careerStage)    { setError("Please select your career stage."); return; }
    }
    if (step === 2 && !formats.length) {
      setError("Please select at least one format."); return;
    }
    setStep((s: Step) => (s + 1) as Step);
  }

  function submit() {
    setError(null);
    if (hasDeck === null) { setError("Please choose an option."); return; }
    const fd = new FormData();
    fd.set("full_name",         name.trim());
    fd.set("country",           country.trim());
    fd.set("imdb_url",          imdb.trim());
    fd.set("career_stage",      careerStage);
    fd.set("filmmaker_formats", JSON.stringify(formats));
    fd.set("next",              "/dashboard/projects/new");

    startTransition(async () => {
      const result = await completeFilmmakerOnboarding(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-ivory flex items-start justify-center pt-16 px-6 pb-16">
      <div className="w-full max-w-lg">

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-12">
          {([1, 2, 3] as Step[]).map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-medium transition-colors
                ${n < step ? "bg-ink border-ink text-ivory" : n === step ? "border-gold text-gold" : "border-line text-ash"}`}>
                {n < step ? "✓" : n}
              </div>
              {n < 3 && <div className={`h-px w-10 ${n < step ? "bg-ink" : "bg-line"}`} />}
            </div>
          ))}
          <span className="ml-2 text-[11px] tracking-[0.18em] uppercase text-ash">
            {step === 1 ? "About you" : step === 2 ? "Your work" : "Your project"}
          </span>
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div>
            <p className="eyebrow mb-3 text-gold">Step 1 of 3</p>
            <h1 className="font-display text-[32px] leading-tight mb-2">Who are you?</h1>
            <p className="text-[14px] text-ash mb-8">
              Career stage alone changes which funds you're eligible for.
            </p>
            <div className="space-y-5">
              <div>
                <label className="field-label" htmlFor="ob-name">Full name *</label>
                <input id="ob-name" className="field" value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Your full name" autoFocus />
              </div>
              <div>
                <label className="field-label" htmlFor="ob-country">Country *</label>
                <input id="ob-country" className="field" value={country}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} placeholder="India, France, USA…" />
              </div>
              <div>
                <label className="field-label" htmlFor="ob-imdb">
                  IMDb profile <span className="normal-case tracking-normal font-normal text-ash">— optional</span>
                </label>
                <input id="ob-imdb" className="field" value={imdb}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImdb(e.target.value)} placeholder="https://www.imdb.com/name/nm…" />
              </div>
              <div>
                <label className="field-label">Career stage *</label>
                <div className="space-y-3 mt-2">
                  {CAREER_STAGES.map((cs) => (
                    <label key={cs.value}
                      className={`flex items-start gap-4 p-4 rounded-card border cursor-pointer transition-colors
                        ${careerStage === cs.value ? "border-gold bg-gold/5" : "border-line bg-white/60 hover:bg-parchment/40"}`}>
                      <input type="radio" name="cs" value={cs.value} className="mt-0.5"
                        checked={careerStage === cs.value} onChange={() => setCareerStage(cs.value)} />
                      <div>
                        <div className="text-[14px] font-medium">{cs.label}</div>
                        <div className="text-[12px] text-ash mt-0.5">{cs.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div>
            <p className="eyebrow mb-3 text-gold">Step 2 of 3</p>
            <h1 className="font-display text-[32px] leading-tight mb-2">What kind of films?</h1>
            <p className="text-[14px] text-ash mb-8">
              Documentary and narrative funds are almost entirely separate ecosystems.
            </p>
            <div className="space-y-4">
              {FORMATS.map((f) => (
                <label key={f.value}
                  className={`flex items-start gap-4 p-5 rounded-card border cursor-pointer transition-colors
                    ${formats.includes(f.value) ? "border-gold bg-gold/5" : "border-line bg-white/60 hover:bg-parchment/40"}`}>
                  <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                    ${formats.includes(f.value) ? "border-gold bg-gold" : "border-ash/40"}`}>
                    {formats.includes(f.value) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-[15px] font-display">{f.label}</div>
                    <div className="text-[13px] text-ash mt-0.5">{f.sub}</div>
                  </div>
                  <input type="checkbox" className="sr-only"
                    checked={formats.includes(f.value)} onChange={() => toggleFormat(f.value)} />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div>
            <p className="eyebrow mb-3 text-gold">Step 3 of 3</p>
            <h1 className="font-display text-[32px] leading-tight mb-2">Your current project</h1>
            <p className="text-[14px] text-ash mb-8">
              Do you have a pitch deck ready to upload?
            </p>
            <div className="space-y-4">
              {[
                { val: true,  title: "Yes — I have a pitch deck", desc: "Upload your PDF and AI fills the form. Matches compute in 15–20 seconds." },
                { val: false, title: "Not yet — still developing", desc: "Fill the project form manually. Add a deck any time — AI will re-run." },
              ].map(({ val, title, desc }) => (
                <label key={String(val)}
                  className={`flex items-start gap-4 p-5 rounded-card border cursor-pointer transition-colors
                    ${hasDeck === val ? "border-gold bg-gold/5" : "border-line bg-white/60 hover:bg-parchment/40"}`}
                  onClick={() => setHasDeck(val)}>
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                    ${hasDeck === val ? "border-gold" : "border-ash/40"}`}>
                    {hasDeck === val && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                  </div>
                  <div>
                    <div className="text-[15px] font-display">{title}</div>
                    <div className="text-[13px] text-ash mt-0.5">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-5 text-[13px] text-red-700 border border-red-200 bg-red-50 rounded-card px-4 py-3">{error}</p>
        )}

        <div className="mt-10 flex items-center justify-between">
          {step > 1
            ? <button type="button" onClick={() => setStep((s: Step) => (s - 1) as Step)} className="text-[13px] text-ash hover:text-ink">← Back</button>
            : <div />}
          {step < 3
            ? <button type="button" onClick={nextStep} className="btn-gold">Continue →</button>
            : <button type="button" onClick={submit} disabled={hasDeck === null} className="btn-gold disabled:opacity-40">
                {hasDeck === false ? "Fill manually →" : "Submit my project →"}
              </button>}
        </div>
      </div>
    </div>
  );
}
