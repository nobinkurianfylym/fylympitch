"use client";

import { useState, useTransition } from "react";
import { adminCreateOpportunity } from "@/lib/actions";

const OPP_TYPE_OPTIONS = [
  { value: "grant",              label: "Grant" },
  { value: "fund",               label: "Fund" },
  { value: "lab",                label: "Lab" },
  { value: "co_production",      label: "Co-production" },
  { value: "market",             label: "Market" },
  { value: "distribution",       label: "Distribution" },
  { value: "investor",           label: "Investor" },
  { value: "broadcaster",        label: "Broadcaster" },
  { value: "streamer",           label: "Streamer" },
  { value: "sales_agent",        label: "Sales Agent" },
  { value: "brand_integration",  label: "Brand Integration" },
  { value: "crowdfunding",       label: "Crowdfunding" },
  { value: "producer",           label: "Producer" },
  { value: "production_company", label: "Production Company" },
  { value: "studio",             label: "Studio" },
  { value: "sponsor",            label: "Sponsor" },
  { value: "pre_sale",           label: "Pre-Sale" },
  { value: "tax_incentive",      label: "Tax Incentive" },
];

export function AdminCreateOpportunityForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await adminCreateOpportunity(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="card mt-14 p-6 sm:p-8">
      <p className="eyebrow">Add opportunity</p>
      <h2 className="font-display text-[24px] font-normal mt-1">New opportunity</h2>

      <form action={handleSubmit} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* ── Core ── */}
        <label className="block sm:col-span-2">
          <span className="eyebrow">Title *</span>
          <input name="title" required className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Type *</span>
          <select name="opp_type" required className="field mt-1.5" defaultValue="grant">
            {OPP_TYPE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="eyebrow">Country</span>
          <input name="country" placeholder="e.g. Netherlands, Global" className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Region</span>
          <input name="region" placeholder="e.g. Europe, Asia-Pacific" className="field mt-1.5" />
        </label>

        <label className="block sm:col-span-2">
          <span className="eyebrow">Description</span>
          <textarea name="description" rows={3} className="field mt-1.5" />
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
          <input name="formats" placeholder="feature, documentary" className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Stages (comma-separated)</span>
          <input name="stages" placeholder="development, production" className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Languages (comma-separated)</span>
          <input name="languages" className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Gender focus</span>
          <input name="gender_focus" placeholder="e.g. Women filmmakers, All" className="field mt-1.5" />
        </label>

        <div className="block">
          <span className="eyebrow">Flags</span>
          <div className="mt-2.5 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input type="checkbox" name="copro_required" className="w-4 h-4 accent-gold" />
              Co-production required
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input type="checkbox" name="festival_affiliated" className="w-4 h-4 accent-gold" />
              Festival affiliated
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input type="checkbox" name="ott_affiliated" className="w-4 h-4 accent-gold" />
              OTT / Streaming affiliated
            </label>
          </div>
        </div>

        {/* ── Budget & Award ── */}
        <div className="sm:col-span-2 pt-2 border-t border-line">
          <p className="eyebrow text-ash mb-3">Budget & award</p>
        </div>

        <label className="block">
          <span className="eyebrow">Min budget USD</span>
          <input name="min_budget_usd" type="number" min={0} className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Max budget USD</span>
          <input name="max_budget_usd" type="number" min={0} className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Max award USD</span>
          <input name="max_award_usd" type="number" min={0} className="field mt-1.5" />
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
          <span className="eyebrow">Website URL</span>
          <input name="url" type="url" placeholder="https://" className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Application / submission URL</span>
          <input name="app_link" type="url" placeholder="https://" className="field mt-1.5" />
        </label>

        {/* ── Contact ── */}
        <div className="sm:col-span-2 pt-2 border-t border-line">
          <p className="eyebrow text-ash mb-3">Contact</p>
        </div>

        <label className="block">
          <span className="eyebrow">Key person</span>
          <input name="key_person" placeholder="Name or role" className="field mt-1.5" />
        </label>

        <label className="block">
          <span className="eyebrow">Contact email</span>
          <input name="contact_email" type="email" placeholder="contact@fund.org" className="field mt-1.5" />
        </label>

        {/* ── Submit ── */}
        <div className="sm:col-span-2 pt-2 border-t border-line flex items-center gap-4">
          <button type="submit" disabled={isPending} className="btn-gold disabled:opacity-50">
            {isPending ? "Creating…" : "Create opportunity"}
          </button>
          {error && <p className="text-[13px] text-red-600 font-normal">{error}</p>}
        </div>
      </form>
    </div>
  );
}
