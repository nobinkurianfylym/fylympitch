"use client";

import { useState, useTransition } from "react";
import { adminCreateOpportunity } from "@/lib/actions";

const OPP_TYPE_GROUPS = [
  {
    label: "Development",
    options: [
      { value: "script_lab",          label: "Script Labs" },
      { value: "lab",                 label: "Development Labs" },
      { value: "residency",           label: "Residencies" },
      { value: "mentorship",          label: "Mentorships" },
      { value: "grant",               label: "Development Grants" },
      { value: "fund",                label: "Development Funds" },
      { value: "writing_fellowship",  label: "Writing Fellowships" },
    ],
  },
  {
    label: "Packaging & Markets",
    options: [
      { value: "pitch_forum",    label: "Pitch Forums" },
      { value: "co_production",  label: "Co-Production Markets" },
      { value: "market",         label: "Film Markets" },
    ],
  },
  {
    label: "Early Financing",
    options: [
      { value: "crowdfunding",        label: "Crowdfunding" },
      { value: "donation",            label: "Donations" },
      { value: "fiscal_sponsorship",  label: "Fiscal Sponsorship" },
      { value: "seed_funding",        label: "Seed Funding" },
      { value: "community_funding",   label: "Community Funding" },
    ],
  },
  {
    label: "Tax Incentives",
    options: [
      { value: "tax_incentive",      label: "Tax Credits" },
      { value: "cash_rebate",        label: "Cash Rebates" },
      { value: "production_rebate",  label: "Production Rebates" },
      { value: "regional_incentive", label: "Regional Incentives" },
      { value: "location_incentive", label: "Location Incentives" },
    ],
  },
  {
    label: "Private Financing",
    options: [
      { value: "investor",            label: "Equity Investors" },
      { value: "angel_investor",      label: "Angel Investors" },
      { value: "venture_capital",     label: "Venture Capital" },
      { value: "gap_financing",       label: "Gap Financing" },
      { value: "brand_integration",   label: "Brand Integration" },
      { value: "product_placement",   label: "Product Placement" },
      { value: "sponsor",             label: "Corporate Sponsorship" },
      { value: "private_fund",        label: "Private Funds" },
    ],
  },
  {
    label: "Production",
    options: [
      { value: "producer",            label: "Producers" },
      { value: "co_producer",         label: "Co-Producers" },
      { value: "production_company",  label: "Production Companies" },
      { value: "studio",              label: "Studios" },
    ],
  },
  {
    label: "Post Production",
    options: [
      { value: "post_production_grant", label: "Post-Production Grants" },
      { value: "post_production_fund",  label: "Post-Production Funds" },
    ],
  },
  {
    label: "Buyers & Sales",
    options: [
      { value: "sales_agent",    label: "Sales Agents" },
      { value: "world_sales",    label: "World Sales" },
      { value: "broadcaster",    label: "Broadcasters" },
      { value: "streamer",       label: "Streamers" },
      { value: "pre_sale",       label: "Pre-Sales" },
      { value: "content_buyer",  label: "Content Buyers" },
      { value: "music_rights",   label: "Music Rights" },
    ],
  },
  {
    label: "Release & Distribution",
    options: [
      { value: "film_festival",             label: "Film Festivals" },
      { value: "distribution",              label: "Distribution Companies" },
      { value: "theatrical_distribution",   label: "Theatrical Distribution" },
      { value: "ott_distribution",          label: "OTT Distribution" },
      { value: "tv_distribution",           label: "TV Distribution" },
      { value: "digital_aggregator",        label: "Digital Aggregators" },
      { value: "educational_distribution",  label: "Educational Distribution" },
      { value: "airline_distribution",      label: "Airline & Inflight Distribution" },
    ],
  },
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
            {OPP_TYPE_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
            ))}
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

        <label className="block sm:col-span-2">
          <span className="eyebrow">Eligible countries (comma-separated)</span>
          <input name="eligible_countries" placeholder="e.g. India, Nigeria, Brazil — leave blank for worldwide" className="field mt-1.5" />
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
