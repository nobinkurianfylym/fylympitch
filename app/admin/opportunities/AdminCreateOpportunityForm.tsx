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
      if (result?.error) {
        setError(result.error);
      }
      // On success, adminCreateOpportunity redirects — no need to handle here
    });
  }

  return (
    <div className="card mt-14 p-6 sm:p-8">
      <p className="eyebrow">Add opportunity</p>
      <h2 className="font-display text-[24px] font-normal mt-1">New opportunity</h2>

      <form action={handleSubmit} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <label className="block">
          <span className="eyebrow">Deadline</span>
          <input name="deadline" type="date" className="field mt-1.5" />
        </label>

        <label className="block sm:col-span-2">
          <span className="eyebrow">URL</span>
          <input name="url" type="url" placeholder="https://" className="field mt-1.5" />
        </label>

        <label className="block sm:col-span-2">
          <span className="eyebrow">Description</span>
          <textarea name="description" rows={3} className="field mt-1.5" />
        </label>

        <div className="sm:col-span-2 flex items-center gap-4">
          <button type="submit" disabled={isPending} className="btn-gold disabled:opacity-50">
            {isPending ? "Creating…" : "Create opportunity"}
          </button>
          {error && (
            <p className="text-[13px] text-red-600 font-normal">{error}</p>
          )}
        </div>
      </form>
    </div>
  );
}
