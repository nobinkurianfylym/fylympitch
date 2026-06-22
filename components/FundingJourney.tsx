"use client";

import { useState, useRef } from "react";
import { usd } from "@/lib/format";

export interface JourneyOpp {
  id: string;
  title: string;
  country: string | null;
  opp_type: string;
  max_award_usd: number | null;
  deadline: string | null;
  deadline_note: string | null;
  score: number;
  url: string | null;
  app_link: string | null;
}

type StageStatus = "completed" | "current" | "ready" | "upcoming" | "locked";

const MAX_MATCHES = 25;

// ── 9 Master Categories ──────────────────────────────────────────────────────
const CATEGORY_DEFS = [
  {
    id: "development",
    label: "Development",
    subtypes: ["Script Labs", "Development Labs", "Residencies", "Mentorships", "Development Grants", "Development Funds", "Writing Fellowships"],
    types: ["script_lab", "lab", "residency", "mentorship", "grant", "fund", "writing_fellowship"],
    order: 0,
  },
  {
    id: "packaging_markets",
    label: "Packaging & Markets",
    subtypes: ["Pitch Forums", "Co-Production Markets", "Film Markets"],
    types: ["pitch_forum", "co_production", "market"],
    order: 1,
  },
  {
    id: "early_financing",
    label: "Early Financing",
    subtypes: ["Crowdfunding", "Donations", "Fiscal Sponsorship", "Seed Funding", "Community Funding"],
    types: ["crowdfunding", "donation", "fiscal_sponsorship", "seed_funding", "community_funding"],
    order: 2,
  },
  {
    id: "tax_incentives",
    label: "Tax Incentives",
    subtypes: ["Tax Credits", "Cash Rebates", "Production Rebates", "Regional Incentives", "Location Incentives"],
    types: ["tax_incentive", "cash_rebate", "production_rebate", "regional_incentive", "location_incentive"],
    order: 3,
  },
  {
    id: "private_financing",
    label: "Private Financing",
    subtypes: ["Equity Investors", "Angel Investors", "Venture Capital", "Gap Financing", "Brand Integration", "Product Placement", "Corporate Sponsorship", "Private Funds"],
    types: ["investor", "angel_investor", "venture_capital", "gap_financing", "brand_integration", "product_placement", "sponsor", "private_fund"],
    order: 4,
  },
  {
    id: "production",
    label: "Production",
    subtypes: ["Producers", "Co-Producers", "Production Companies", "Studios"],
    types: ["producer", "co_producer", "production_company", "studio"],
    order: 5,
  },
  {
    id: "post_production",
    label: "Post Production",
    subtypes: ["Post-Production Grants", "Post-Production Funds"],
    types: ["post_production_grant", "post_production_fund"],
    order: 6,
  },
  {
    id: "buyers_sales",
    label: "Buyers & Sales",
    subtypes: ["Sales Agents", "World Sales", "Broadcasters", "Streamers", "Pre-Sales", "Content Buyers", "Music Rights"],
    types: ["sales_agent", "world_sales", "broadcaster", "streamer", "pre_sale", "content_buyer", "music_rights"],
    order: 7,
  },
  {
    id: "release_distribution",
    label: "Release & Distribution",
    subtypes: ["Film Festivals", "Distribution Companies", "Theatrical Distribution", "OTT Distribution", "TV Distribution", "Digital Aggregators", "Educational Distribution", "Airline & Inflight Distribution"],
    types: ["film_festival", "distribution", "theatrical_distribution", "ott_distribution", "tv_distribution", "digital_aggregator", "educational_distribution", "airline_distribution"],
    order: 8,
  },
] as const;

// Roadmap stage key → category order index
const ROADMAP_TO_ORDER: Record<string, number> = {
  script: 0, labs: 0, grants: 0,
  co_production: 1,
  investors: 4,
  production: 5,
};

function buildCategories(opps: JourneyOpp[], roadmap: any) {
  const currentOrder =
    roadmap?.current != null ? (ROADMAP_TO_ORDER[roadmap.current] ?? -1) : -1;

  return CATEGORY_DEFS.map((def) => {
    const matched =
      def.types.length > 0
        ? opps
            .filter((o) => (def.types as string[]).includes(o.opp_type))
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_MATCHES)
        : [];

    let status: StageStatus = "upcoming";
    if (currentOrder >= 0) {
      if (def.order < currentOrder)           status = "completed";
      else if (def.order === currentOrder)    status = "current";
      else if (def.order === currentOrder + 1) status = "ready";
      else if (def.order <= currentOrder + 3) status = "upcoming";
      else                                    status = "locked";
    }

    return { ...def, status, opportunities: matched };
  });
}

const STATUS_STYLES: Record<StageStatus, { bg: string; border: string; badge: string; badgeText: string; label: string }> = {
  completed: { bg: "rgba(191,153,83,0.08)", border: "#BF9953",             badge: "rgba(191,153,83,0.18)", badgeText: "#7a5e1a", label: "Completed"   },
  current:   { bg: "rgba(191,153,83,0.06)", border: "#BF9953",             badge: "rgba(191,153,83,0.22)", badgeText: "#7a5e1a", label: "Current"     },
  ready:     { bg: "#ffffff",               border: "rgba(26,24,21,0.14)", badge: "rgba(42,107,42,0.12)",  badgeText: "#2a6b2a", label: "Ready"       },
  upcoming:  { bg: "#fafafa",               border: "rgba(26,24,21,0.10)", badge: "rgba(26,24,21,0.08)",   badgeText: "#8A857C", label: "Upcoming"    },
  locked:    { bg: "#f7f7f7",               border: "rgba(26,24,21,0.07)", badge: "rgba(26,24,21,0.05)",   badgeText: "#b0aba4", label: "Coming Soon" },
};

function ScoreBadge({ score }: { score: number }) {
  const [bg, color, label] =
    score >= 88 ? ["rgba(191,153,83,0.15)", "#7a5e1a", "Excellent"] :
    score >= 72 ? ["rgba(42,107,42,0.12)",  "#2a6b2a", "Strong"]    :
                  ["rgba(26,24,21,0.08)",   "#8A857C", "Possible"];
  return (
    <span style={{ background: bg, color, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", padding: "2px 8px", borderRadius: "20px", fontFamily: "'Montserrat',sans-serif", whiteSpace: "nowrap" }}>
      {score}% · {label}
    </span>
  );
}

function OppCard({ opp, projectId }: { opp: JourneyOpp; projectId: string }) {
  const applyHref = opp.app_link ?? opp.url ?? null;
  const deadline = opp.deadline_note ?? opp.deadline ?? "Open";
  return (
    <div style={{ border: "0.5px solid rgba(26,24,21,0.12)", borderRadius: "10px", padding: "14px 16px", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 500, color: "#1A1815", fontFamily: "'Montserrat',sans-serif", lineHeight: 1.3 }}>{opp.title}</div>
          {opp.country && <div style={{ fontSize: "11px", color: "#8A857C", marginTop: "2px" }}>{opp.country}</div>}
        </div>
        <ScoreBadge score={opp.score} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px", fontSize: "12px", color: "#8A857C", marginBottom: applyHref ? "12px" : "0" }}>
        {opp.max_award_usd && <span>Award — <span style={{ color: "#1A1815" }}>{usd(opp.max_award_usd)}</span></span>}
        <span>Deadline — <span style={{ color: "#1A1815" }}>{deadline}</span></span>
      </div>
      {applyHref && (
        <div style={{ display: "flex", gap: "8px" }}>
          <a href={applyHref} target="_blank" rel="noreferrer"
            style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", background: "#1A1815", color: "#F8F5F0", padding: "7px 14px", borderRadius: "6px", textDecoration: "none", fontFamily: "'Montserrat',sans-serif" }}>
            Apply →
          </a>
          <a href={`/dashboard/opportunities/${opp.id}?project=${projectId}`}
            style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", border: "0.5px solid rgba(26,24,21,0.2)", color: "#1A1815", padding: "7px 14px", borderRadius: "6px", textDecoration: "none", fontFamily: "'Montserrat',sans-serif" }}>
            Details
          </a>
        </div>
      )}
    </div>
  );
}

function ExpandedPanel({ cat, projectId, onClose }: { cat: ReturnType<typeof buildCategories>[0]; projectId: string; onClose: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? cat.opportunities : cat.opportunities.slice(0, 4);
  const remaining = cat.opportunities.length - 4;

  return (
    <div style={{ marginTop: "12px", border: "0.5px solid rgba(26,24,21,0.14)", borderRadius: "12px", background: "#fff", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#1A1815", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
          <div>
            <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(248,245,240,0.5)", marginBottom: "4px" }}>Category</p>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "18px", fontWeight: 400, color: "#F8F5F0", margin: 0 }}>{cat.label}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "22px", color: "#BF9953" }}>{cat.opportunities.length}</span>
            <span style={{ fontSize: "12px", color: "rgba(248,245,240,0.5)" }}>
              {cat.opportunities.length === MAX_MATCHES ? `top ${MAX_MATCHES} matches` : cat.opportunities.length === 1 ? "match" : "matches"}
            </span>
            <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(248,245,240,0.2)", borderRadius: "50%", width: "28px", height: "28px", color: "rgba(248,245,240,0.6)", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>

        {/* Sub-types chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {cat.subtypes.map((st) => (
            <span key={st} style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "rgba(191,153,83,0.15)", color: "rgba(191,153,83,0.9)", padding: "3px 8px", borderRadius: "20px", fontFamily: "'Montserrat',sans-serif", whiteSpace: "nowrap" }}>
              {st}
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      {cat.opportunities.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#8A857C", marginBottom: "6px" }}>No matches found for this category yet.</p>
          <p style={{ fontSize: "12px", color: "#b0aba4" }}>Opportunities across {cat.subtypes.length} sub-types are being curated and will appear here.</p>
        </div>
      ) : (
        <div style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "12px" }}>
            {visible.map((opp) => <OppCard key={opp.id} opp={opp} projectId={projectId} />)}
          </div>
          {!showAll && remaining > 0 && (
            <button onClick={() => setShowAll(true)}
              style={{ marginTop: "14px", width: "100%", padding: "10px", border: "0.5px solid rgba(26,24,21,0.14)", borderRadius: "8px", background: "transparent", fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A857C", cursor: "pointer", fontFamily: "'Montserrat',sans-serif" }}>
              View {remaining} more opportunit{remaining === 1 ? "y" : "ies"} ↓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function FundingJourney({
  projectId,
  opportunities,
  roadmap,
  readiness,
}: {
  projectId: string;
  opportunities: JourneyOpp[];
  roadmap: any;
  readiness: any;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const categories = buildCategories(opportunities, roadmap);
  const progress = (readiness as any)?.score ?? (readiness as any)?.overall_score ?? 0;
  const currentCat = categories.find((c) => c.status === "current");
  const nextCat    = categories.find((c) => (c.status === "ready" || c.status === "upcoming") && c.opportunities.length > 0);
  const expandedCat = selected ? categories.find((c) => c.id === selected) : null;

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  }

  return (
    <div style={{ marginBottom: "48px" }}>
      <style>{`@keyframes fylym-glow { 0%,100%{box-shadow:0 0 0 0 rgba(191,153,83,0.15)} 50%{box-shadow:0 0 0 8px rgba(191,153,83,0.06)} } .fy-cat-card:hover{transform:translateY(-2px);transition:transform 0.2s}`}</style>

      {/* Header row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "26px", fontWeight: 400, color: "#1A1815", marginBottom: "6px" }}>
            Funding Journey
          </h2>
          <p style={{ fontSize: "13px", color: "#8A857C", maxWidth: "460px", lineHeight: 1.65 }}>
            The complete financing pathway across all 9 categories. Each shows AI-matched opportunities tailored to your film.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative" }}>
        <button onClick={() => scroll("left")} aria-label="Scroll left" style={{ position: "absolute", left: "-14px", top: "52px", zIndex: 2, background: "#fff", border: "0.5px solid rgba(26,24,21,0.14)", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>

        <div ref={scrollRef} style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          <div style={{ display: "flex", alignItems: "stretch", width: "max-content", padding: "4px 28px 0" }}>
            {categories.map((cat, i) => {
              const s = STATUS_STYLES[cat.status];
              const isSelected = selected === cat.id;
              const isCurrent  = cat.status === "current";
              const hasTypes   = cat.types.length > 0;
              const count      = cat.opportunities.length;

              return (
                <div key={cat.id} style={{ display: "flex", alignItems: "center" }}>
                  {/* Card */}
                  <div
                    className="fy-cat-card"
                    onClick={() => setSelected(isSelected ? null : cat.id)}
                    style={{
                      width: "148px", minHeight: "148px", padding: "14px 13px 12px",
                      background: s.bg,
                      border: `${isCurrent ? "1.5px" : "0.5px"} solid ${isSelected ? "#BF9953" : s.border}`,
                      borderRadius: "10px", cursor: "pointer",
                      animation: isCurrent ? "fylym-glow 3s ease-in-out infinite" : "none",
                      boxShadow: isSelected ? "0 0 0 2px rgba(191,153,83,0.3)" : "none",
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                  >
                    {/* Category name */}
                    <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: cat.status === "locked" ? "#b0aba4" : "#8A857C", fontFamily: "'Montserrat',sans-serif", lineHeight: 1.35, marginBottom: "6px" }}>
                      {cat.label}
                    </div>

                    {/* Sub-type count pill */}
                    <div style={{ fontSize: "9px", color: cat.status === "locked" ? "#c8c4be" : "#b0aba4", marginBottom: "6px", letterSpacing: "0.06em" }}>
                      {cat.subtypes.length} sub-types
                    </div>

                    {/* Match count */}
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "26px", color: count > 0 ? "#BF9953" : (cat.status === "locked" ? "#c8c4be" : "#1A1815"), marginBottom: "4px", lineHeight: 1 }}>
                      {hasTypes ? (count === MAX_MATCHES ? `${MAX_MATCHES}+` : count) : "—"}
                    </div>

                    {/* Sub-label */}
                    <div style={{ fontSize: "10px", color: cat.status === "locked" ? "#c8c4be" : "#8A857C", marginBottom: "10px" }}>
                      {hasTypes ? (count === 1 ? "match" : "matches") : "curating"}
                    </div>

                    {/* Status badge */}
                    <span style={{ display: "inline-block", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", background: s.badge, color: s.badgeText, padding: "3px 8px", borderRadius: "20px", fontFamily: "'Montserrat',sans-serif", alignSelf: "flex-start" }}>
                      {s.label}
                    </span>
                  </div>

                  {/* Connector */}
                  {i < categories.length - 1 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24px", flexShrink: 0 }}>
                      <div style={{ height: "1px", width: "100%", background: i < categories.findIndex(c => c.status === "current") ? "#BF9953" : "rgba(26,24,21,0.12)", marginTop: "74px" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={() => scroll("right")} aria-label="Scroll right" style={{ position: "absolute", right: "-14px", top: "52px", zIndex: 2, background: "#fff", border: "0.5px solid rgba(26,24,21,0.14)", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>→</button>
      </div>

      {/* Expanded panel */}
      {expandedCat && (
        <ExpandedPanel cat={expandedCat} projectId={projectId} onClose={() => setSelected(null)} />
      )}

      {/* Bottom tip */}
      <p style={{ marginTop: "16px", fontSize: "12px", color: "#8A857C", textAlign: "center" }}>
        Progressing through categories in order significantly increases your success rate in securing funding.
      </p>
    </div>
  );
}
