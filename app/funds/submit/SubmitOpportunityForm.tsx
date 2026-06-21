"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitPublicOpportunity } from "@/lib/actions";

const OPP_TYPES = [
  { value: "grant",              label: "Grant" },
  { value: "fund",               label: "Fund" },
  { value: "lab",                label: "Lab / Fellowship" },
  { value: "co_production",      label: "Co-production" },
  { value: "market",             label: "Market" },
  { value: "distribution",       label: "Distribution" },
  { value: "investor",           label: "Investor" },
  { value: "broadcaster",        label: "Broadcaster" },
  { value: "streamer",           label: "Streaming Platform" },
  { value: "sales_agent",        label: "Sales Agent" },
  { value: "brand_integration",  label: "Brand Integration" },
  { value: "crowdfunding",       label: "Crowdfunding" },
  { value: "producer",           label: "Producer" },
  { value: "production_company", label: "Production Company" },
  { value: "studio",             label: "Studio" },
  { value: "sponsor",            label: "Sponsor / Brand" },
  { value: "pre_sale",           label: "Pre-Sale" },
  { value: "tax_incentive",      label: "Tax Incentive" },
];

export function SubmitOpportunityForm() {
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [isPending, start]  = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result = await submitPublicOpportunity(formData);
      if (result?.error) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 rounded-full border border-gold/40 flex items-center justify-center mx-auto mb-6 text-gold text-[18px]">✓</div>
        <h2 className="font-display text-[28px] font-[400] mb-3">Thank you</h2>
        <p className="text-[14px] text-ash max-w-sm mx-auto leading-relaxed">
          Your submission is under review. Our team will add it to the database once verified.
        </p>
        <Link href="/funds" className="mt-8 inline-block text-[12px] tracking-[0.16em] uppercase text-ash hover:text-ink transition-colors">
          ← Back to Opportunities
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">

      {/* ── Core ── */}
      <label className="block sm:col-span-2">
        <span className="eyebrow">Title *</span>
        <input name="title" required placeholder="e.g. Sundance Documentary Fund" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Type *</span>
        <select name="opp_type" required defaultValue="grant" className="field mt-1.5">
          {OPP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow">Country</span>
        <input name="country" placeholder="e.g. United States, India" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Region</span>
        <input name="region" placeholder="e.g. North America, Asia-Pacific" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Max award (USD)</span>
        <input name="max_award_usd" type="number" min={0} placeholder="e.g. 50000" className="field mt-1.5" />
      </label>

      <label className="block sm:col-span-2">
        <span className="eyebrow">Description</span>
        <textarea name="description" rows={3} placeholder="Brief description of what this fund/grant supports…" className="field mt-1.5" />
      </label>

      {/* ── Eligibility ── */}
      <div className="sm:col-span-2 pt-2 border-t border-line">
        <p className="eyebrow text-ash mb-3">Eligibility</p>
      </div>

      <label className="block">
        <span className="eyebrow">Genres (comma-separated)</span>
        <input name="genres" placeholder="Drama, Documentary" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Formats (comma-separated)</span>
        <input name="formats" placeholder="feature, short, documentary" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Stages (comma-separated)</span>
        <input name="stages" placeholder="development, production" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Eligible countries (comma-separated)</span>
        <input name="eligible_countries" placeholder="Leave blank for worldwide" className="field mt-1.5" />
      </label>

      {/* ── Deadline ── */}
      <div className="sm:col-span-2 pt-2 border-t border-line">
        <p className="eyebrow text-ash mb-3">Deadline</p>
      </div>

      <label className="block">
        <span className="eyebrow">Deadline date</span>
        <input name="deadline" type="date" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Deadline note</span>
        <input name="deadline_note" placeholder="e.g. Annual — opens Jan/Feb" className="field mt-1.5" />
      </label>

      {/* ── Links ── */}
      <div className="sm:col-span-2 pt-2 border-t border-line">
        <p className="eyebrow text-ash mb-3">Links</p>
      </div>

      <label className="block">
        <span className="eyebrow">Website URL *</span>
        <input name="url" type="url" required placeholder="https://" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Application URL</span>
        <input name="app_link" type="url" placeholder="https://" className="field mt-1.5" />
      </label>

      {/* ── Your details ── */}
      <div className="sm:col-span-2 pt-2 border-t border-line">
        <p className="eyebrow text-ash mb-1">Your details</p>
        <p className="text-[12px] text-ash/70 font-normal mb-3">So we can follow up if we need more info.</p>
      </div>

      <label className="block">
        <span className="eyebrow">Your name</span>
        <input name="submitted_by_name" placeholder="Full name" className="field mt-1.5" />
      </label>

      <label className="block">
        <span className="eyebrow">Your email</span>
        <input name="submitted_by_email" type="email" placeholder="you@email.com" className="field mt-1.5" />
      </label>

      {/* ── Submit ── */}
      <div className="sm:col-span-2 pt-4 border-t border-line flex items-center gap-4">
        <button type="submit" disabled={isPending} className="btn-gold disabled:opacity-50">
          {isPending ? "Submitting…" : "Submit for review"}
        </button>
        <p className="text-[12px] text-ash font-normal">Our team reviews all submissions before publishing.</p>
      </div>

      {error && <p className="sm:col-span-2 text-[13px] text-red-600 font-normal border border-red-200 bg-red-50 rounded-card px-4 py-3">{error}</p>}
    </form>
  );
}
