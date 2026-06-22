"use client";

import { useState, useTransition } from "react";
import { adminUpdateOpportunity, adminToggleOpportunity } from "@/lib/actions";

const OPP_TYPES = [
  // Development
  { value: "lab",                label: "Lab" },
  { value: "grant",              label: "Grant" },
  { value: "fund",               label: "Fund" },
  // Packaging & Markets
  { value: "co_production",      label: "Co-production" },
  { value: "market",             label: "Market" },
  // Early Financing
  { value: "crowdfunding",       label: "Crowdfunding" },
  // Tax Incentives
  { value: "tax_incentive",      label: "Tax Incentive" },
  // Private Financing
  { value: "investor",           label: "Investor" },
  { value: "brand_integration",  label: "Brand Integration" },
  { value: "sponsor",            label: "Sponsor" },
  // Production
  { value: "producer",           label: "Producer" },
  { value: "production_company", label: "Production Company" },
  { value: "studio",             label: "Studio" },
  // Buyers & Sales
  { value: "sales_agent",        label: "Sales Agent" },
  { value: "broadcaster",        label: "Broadcaster" },
  { value: "streamer",           label: "Streamer" },
  { value: "pre_sale",           label: "Pre-Sale" },
  // Release & Distribution
  { value: "distribution",       label: "Distribution" },
];

type Opportunity = {
  id: string;
  title: string;
  opp_type: string;
  country: string | null;
  region: string | null;
  genres: string[] | null;
  formats: string[] | null;
  stages: string[] | null;
  languages: string[] | null;
  min_budget_usd: number | null;
  max_budget_usd: number | null;
  max_award_usd: number | null;
  deadline: string | null;
  deadline_note: string | null;
  url: string | null;
  app_link: string | null;
  description: string | null;
  is_active: boolean;
  key_person: string | null;
  contact_email: string | null;
  gender_focus: string | null;
  eligible_countries: string[] | null;
  copro_required: boolean | null;
  festival_affiliated: boolean | null;
  ott_affiliated: boolean | null;
};

export function OpportunityEditForm({ opp }: { opp: Opportunity }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await adminUpdateOpportunity(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
      }
    });
  }

  const typeLabel = OPP_TYPES.find(t => t.value === opp.opp_type)?.label ?? opp.opp_type;

  return (
    <div>
      {/* Summary row */}
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-normal text-ink">{opp.title}</p>
          <p className="text-[12px] text-ash font-normal mt-0.5">
            {[typeLabel, opp.country || opp.region || "Worldwide"].filter(Boolean).join(" · ")}
            {opp.max_award_usd ? ` · up to $${opp.max_award_usd.toLocaleString()}` : ""}
            {opp.deadline ? ` · deadline ${new Date(opp.deadline).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[12px] uppercase tracking-[0.14em] font-normal ${opp.is_active ? "text-emerald-700" : "text-ash"}`}>
            {opp.is_active ? "Active" : "Inactive"}
          </span>
          <button
            onClick={() => { setOpen((o: boolean) => !o); setError(null); setSaved(false); }}
            className="btn-ghost !py-1.5 !px-4 text-[14px]"
          >
            {open ? "Close" : "Edit"}
          </button>
          <form action={adminToggleOpportunity}>
            <input type="hidden" name="opportunity_id" value={opp.id} />
            <input type="hidden" name="active" value={opp.is_active ? "false" : "true"} />
            <button className={opp.is_active ? "btn-ghost !py-1.5 !px-4 text-[14px]" : "btn-gold !py-1.5 !px-4 text-[14px]"}>
              {opp.is_active ? "Deactivate" : "Activate"}
            </button>
          </form>
        </div>
      </div>

      {/* Inline edit panel */}
      {open && (
        <div className="px-5 pb-6 pt-3 bg-[#F8F5F0] border-t border-line">
          <form action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="hidden" name="opportunity_id" value={opp.id} />

            {/* ── Core ── */}
            <label className="block sm:col-span-2">
              <span className="eyebrow">Title *</span>
              <input name="title" required defaultValue={opp.title} className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Type *</span>
              <select name="opp_type" required defaultValue={opp.opp_type} className="field mt-1.5">
                {OPP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="eyebrow">Country</span>
              <input name="country" defaultValue={opp.country ?? ""} placeholder="e.g. Netherlands, Global" className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Region</span>
              <input name="region" defaultValue={opp.region ?? ""} placeholder="e.g. Europe, Asia-Pacific" className="field mt-1.5" />
            </label>

            <label className="block sm:col-span-2">
              <span className="eyebrow">Description</span>
              <textarea name="description" rows={3} defaultValue={opp.description ?? ""} className="field mt-1.5" />
            </label>

            {/* ── Eligibility ── */}
            <div className="sm:col-span-2 pt-2 border-t border-line">
              <p className="eyebrow text-ash mb-3">Eligibility</p>
            </div>

            <label className="block">
              <span className="eyebrow">Genres (comma-separated)</span>
              <input name="genres" defaultValue={(opp.genres ?? []).join(", ")} placeholder="Drama, Documentary" className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Formats (comma-separated)</span>
              <input name="formats" defaultValue={(opp.formats ?? []).join(", ")} placeholder="feature, documentary" className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Stages (comma-separated)</span>
              <input name="stages" defaultValue={(opp.stages ?? []).join(", ")} placeholder="development, production" className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Languages (comma-separated)</span>
              <input name="languages" defaultValue={(opp.languages ?? []).join(", ")} className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Gender focus</span>
              <input name="gender_focus" defaultValue={opp.gender_focus ?? ""} placeholder="e.g. Women filmmakers, All" className="field mt-1.5" />
            </label>

            <label className="block sm:col-span-2">
              <span className="eyebrow">Eligible countries (comma-separated)</span>
              <input name="eligible_countries" defaultValue={(opp.eligible_countries ?? []).join(", ")} placeholder="e.g. India, Nigeria, Brazil — leave blank for worldwide" className="field mt-1.5" />
            </label>

            <div className="block">
              <span className="eyebrow">Flags</span>
              <div className="mt-2.5 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                  <input type="checkbox" name="copro_required" defaultChecked={!!opp.copro_required} className="w-4 h-4 accent-gold" />
                  Co-production required
                </label>
                <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                  <input type="checkbox" name="festival_affiliated" defaultChecked={!!opp.festival_affiliated} className="w-4 h-4 accent-gold" />
                  Festival affiliated
                </label>
                <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                  <input type="checkbox" name="ott_affiliated" defaultChecked={!!opp.ott_affiliated} className="w-4 h-4 accent-gold" />
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
              <input name="min_budget_usd" type="number" min={0} defaultValue={opp.min_budget_usd ?? ""} className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Max budget USD</span>
              <input name="max_budget_usd" type="number" min={0} defaultValue={opp.max_budget_usd ?? ""} className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Max award USD</span>
              <input name="max_award_usd" type="number" min={0} defaultValue={opp.max_award_usd ?? ""} className="field mt-1.5" />
            </label>

            {/* ── Deadline ── */}
            <div className="sm:col-span-2 pt-2 border-t border-line">
              <p className="eyebrow text-ash mb-3">Deadline</p>
            </div>

            <label className="block">
              <span className="eyebrow">Deadline date</span>
              <input name="deadline" type="date" defaultValue={opp.deadline ?? ""} className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Deadline note</span>
              <input name="deadline_note" defaultValue={opp.deadline_note ?? ""} placeholder="e.g. Annual — opens Jan/Feb" className="field mt-1.5" />
            </label>

            {/* ── Links ── */}
            <div className="sm:col-span-2 pt-2 border-t border-line">
              <p className="eyebrow text-ash mb-3">Links</p>
            </div>

            <label className="block">
              <span className="eyebrow">Website URL</span>
              <input name="url" type="url" defaultValue={opp.url ?? ""} placeholder="https://" className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Application / submission URL</span>
              <input name="app_link" type="url" defaultValue={opp.app_link ?? ""} placeholder="https://" className="field mt-1.5" />
            </label>

            {/* ── Contact ── */}
            <div className="sm:col-span-2 pt-2 border-t border-line">
              <p className="eyebrow text-ash mb-3">Contact</p>
            </div>

            <label className="block">
              <span className="eyebrow">Key person</span>
              <input name="key_person" defaultValue={opp.key_person ?? ""} placeholder="Name or role" className="field mt-1.5" />
            </label>

            <label className="block">
              <span className="eyebrow">Contact email</span>
              <input name="contact_email" type="email" defaultValue={opp.contact_email ?? ""} placeholder="contact@fund.org" className="field mt-1.5" />
            </label>

            {/* ── Actions ── */}
            <div className="sm:col-span-2 pt-2 border-t border-line flex items-center gap-4">
              <button type="submit" disabled={isPending} className="btn-gold !py-1.5 !px-5 text-[14px] disabled:opacity-50">
                {isPending ? "Saving…" : "Save changes"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost !py-1.5 !px-4 text-[14px]">
                Cancel
              </button>
              {saved  && <span className="text-[13px] text-emerald-700 font-normal">Saved.</span>}
              {error  && <span className="text-[13px] text-red-600 font-normal">{error}</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
