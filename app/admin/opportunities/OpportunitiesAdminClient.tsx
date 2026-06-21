"use client";

import { useState, useMemo } from "react";
import { CATEGORY_CONFIG, OPP_CATEGORY_MAP } from "@/lib/format";
import { OpportunityEditForm } from "./OpportunityEditForm";

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
  copro_required: boolean | null;
  festival_affiliated: boolean | null;
  ott_affiliated: boolean | null;
};

const PAGE_SIZE = 30;

function CategoryBlock({
  cat,
  items,
  forceOpen,
}: {
  cat: { key: string; label: string; sub: string };
  items: Opportunity[];
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const isOpen = forceOpen || open;
  const active   = items.filter(o => o.is_active);
  const inactive = items.filter(o => !o.is_active);
  const shown    = items.slice(0, visible);
  const remaining = items.length - visible;

  if (items.length === 0) return null;

  return (
    <div className="border border-line rounded-[4px] overflow-hidden">
      {/* Category header row */}
      <button
        onClick={() => { setOpen(o => !o); setVisible(PAGE_SIZE); }}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#F8F5F0] transition-colors"
      >
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[18px] font-normal text-ink">{cat.label}</span>
          <span className="text-[11px] tracking-[0.12em] uppercase text-ash font-normal">{cat.sub}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="flex items-center gap-2 text-[12px] font-normal">
            <span className="text-emerald-700">{active.length} active</span>
            {inactive.length > 0 && (
              <>
                <span className="text-line">·</span>
                <span className="text-ash">{inactive.length} inactive</span>
              </>
            )}
          </div>
          <span className="text-ash text-[18px] leading-none select-none">
            {isOpen ? "−" : "+"}
          </span>
        </div>
      </button>

      {/* Items */}
      {isOpen && (
        <div className="border-t border-line divide-y divide-line">
          {shown.map(o => (
            <div key={o.id} className={o.is_active ? "" : "opacity-50"}>
              <OpportunityEditForm opp={o} />
            </div>
          ))}

          {remaining > 0 && (
            <div className="px-5 py-4">
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors font-normal"
              >
                Show {Math.min(remaining, PAGE_SIZE)} more
                <span className="text-ash/50 ml-1">({remaining} remaining)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OpportunitiesAdminClient({ opps }: { opps: Opportunity[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return opps;
    return opps.filter(o =>
      o.title.toLowerCase().includes(q) ||
      (o.country ?? "").toLowerCase().includes(q) ||
      (o.region ?? "").toLowerCase().includes(q) ||
      (o.opp_type ?? "").toLowerCase().includes(q) ||
      (o.description ?? "").toLowerCase().includes(q)
    );
  }, [opps, q]);

  // Group filtered results by category
  const grouped = CATEGORY_CONFIG.map(cat => ({
    ...cat,
    items: filtered.filter(o => OPP_CATEGORY_MAP[o.opp_type] === cat.key),
  }));

  const uncategorised = filtered.filter(o => !OPP_CATEGORY_MAP[o.opp_type]);

  const totalActive   = opps.filter(o => o.is_active).length;
  const totalInactive = opps.filter(o => !o.is_active).length;

  return (
    <div>
      {/* Stats row */}
      <p className="text-[13px] text-ash font-normal mt-1">
        {opps.length} total
        <span className="mx-1.5 text-line">·</span>
        <span className="text-emerald-700">{totalActive} active</span>
        <span className="mx-1.5 text-line">·</span>
        <span className="text-ash">{totalInactive} inactive</span>
      </p>

      {/* Search */}
      <div className="mt-6 mb-8">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search opportunities by name, country, type…"
          className="field w-full max-w-xl"
        />
        {q && (
          <p className="mt-2 text-[12px] text-ash font-normal">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* Category accordions */}
      <div className="space-y-3">
        {grouped.map(cat => (
          <CategoryBlock
            key={cat.key}
            cat={cat}
            items={cat.items}
            forceOpen={!!q && cat.items.length > 0}
          />
        ))}

        {uncategorised.length > 0 && (
          <CategoryBlock
            cat={{ key: "other", label: "Other", sub: "Uncategorised types" }}
            items={uncategorised}
            forceOpen={!!q && uncategorised.length > 0}
          />
        )}

        {filtered.length === 0 && (
          <p className="text-[14px] text-ash font-normal py-8">
            No opportunities match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
