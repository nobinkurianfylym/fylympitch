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

const STAGE_DEFS = [
  { id: "script",             label: "Script",                types: [],                     isPrimary: false, order: 0  },
  { id: "script_labs",        label: "Script Labs",           types: ["lab"],                isPrimary: false, order: 1  },
  { id: "development_labs",   label: "Development Labs",      types: ["lab"],                isPrimary: true,  order: 2  },
  { id: "development_grants", label: "Development Grants",    types: ["grant"],              isPrimary: true,  order: 3  },
  { id: "project_packaging",  label: "Project Packaging",     types: ["producer"],           isPrimary: true,  order: 4  },
  { id: "coproduction",       label: "Co-Production Markets", types: ["market"],             isPrimary: true,  order: 5  },
  { id: "film_markets",       label: "Film Markets",          types: ["market"],             isPrimary: false, order: 6  },
  { id: "production_funds",   label: "Production Funds",      types: ["fund"],               isPrimary: true,  order: 7  },
  { id: "equity",             label: "Equity Investors",      types: ["fund"],               isPrimary: false, order: 8  },
  { id: "tax_incentives",     label: "Tax Incentives",        types: ["fund"],               isPrimary: false, order: 9  },
  { id: "gap_financing",      label: "Gap Financing",         types: ["fund"],               isPrimary: false, order: 10 },
  { id: "production",         label: "Production",            types: ["fund"],               isPrimary: false, order: 11 },
  { id: "festival",           label: "Festival Premiere",     types: [],                     isPrimary: false, order: 12 },
  { id: "sales_agent",        label: "Sales Agent",           types: ["broadcaster"],        isPrimary: true,  order: 13 },
  { id: "distribution",       label: "Distribution",          types: ["streamer"],           isPrimary: true,  order: 14 },
];

// Maps roadmap stage keys to journey order index
const ROADMAP_TO_ORDER: Record<string, number> = {
  script: 0, labs: 2, grants: 3, co_production: 5, investors: 7, production: 11,
};

function buildStages(opps: JourneyOpp[], roadmap: any) {
  const currentOrder = roadmap?.current != null
    ? (ROADMAP_TO_ORDER[roadmap.current] ?? -1)
    : -1;

  return STAGE_DEFS.map((def) => {
    const stageOpps = def.isPrimary
      ? opps.filter((o) => def.types.includes(o.opp_type)).sort((a, b) => b.score - a.score)
      : [];

    let status: StageStatus = "upcoming";
    if (currentOrder >= 0) {
      if (def.order < currentOrder)      status = "completed";
      else if (def.order === currentOrder) status = "current";
      else if (def.order === currentOrder + 1) status = "ready";
      else if (def.order <= currentOrder + 3) status = "upcoming";
      else status = "locked";
    }

    return { ...def, status, opportunities: stageOpps };
  });
}

const STATUS_STYLES: Record<StageStatus, { bg: string; border: string; dot: string; badge: string; badgeText: string; label: string }> = {
  completed: { bg: "rgba(191,153,83,0.08)", border: "#BF9953",              dot: "#BF9953",              badge: "rgba(191,153,83,0.18)", badgeText: "#7a5e1a", label: "Completed"    },
  current:   { bg: "rgba(191,153,83,0.06)", border: "#BF9953",              dot: "#BF9953",              badge: "rgba(191,153,83,0.22)", badgeText: "#7a5e1a", label: "Current"      },
  ready:     { bg: "#ffffff",               border: "rgba(26,24,21,0.14)",  dot: "#2a6b2a",              badge: "rgba(42,107,42,0.12)",  badgeText: "#2a6b2a", label: "Ready"        },
  upcoming:  { bg: "#fafafa",               border: "rgba(26,24,21,0.10)",  dot: "rgba(26,24,21,0.25)",  badge: "rgba(26,24,21,0.08)",   badgeText: "#8A857C", label: "Upcoming"     },
  locked:    { bg: "#f7f7f7",               border: "rgba(26,24,21,0.07)",  dot: "rgba(26,24,21,0.15)",  badge: "rgba(26,24,21,0.05)",   badgeText: "#b0aba4", label: "Coming Soon"  },
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

function ExpandedPanel({ stage, projectId, onClose }: { stage: ReturnType<typeof buildStages>[0]; projectId: string; onClose: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? stage.opportunities : stage.opportunities.slice(0, 4);
  const remaining = stage.opportunities.length - 4;

  return (
    <div style={{ marginTop: "12px", border: "0.5px solid rgba(26,24,21,0.14)", borderRadius: "12px", background: "#fff", overflow: "hidden", animation: "none" }}>
      <div style={{ background: "#1A1815", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(248,245,240,0.5)", marginBottom: "4px" }}>Stage</p>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "18px", fontWeight: 400, color: "#F8F5F0", margin: 0 }}>{stage.label}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "22px", color: "#BF9953" }}>{stage.opportunities.length}</span>
          <span style={{ fontSize: "12px", color: "rgba(248,245,240,0.5)" }}>matches</span>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(248,245,240,0.2)", borderRadius: "50%", width: "28px", height: "28px", color: "rgba(248,245,240,0.6)", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
      </div>

      {stage.opportunities.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#8A857C", marginBottom: "6px" }}>No matches found for this stage yet.</p>
          <p style={{ fontSize: "12px", color: "#b0aba4" }}>More opportunities for this stage are being curated and will appear here.</p>
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

  const stages = buildStages(opportunities, roadmap);
  const progress = (readiness as any)?.score ?? (readiness as any)?.overall_score ?? 0;
  const currentStage = stages.find((s) => s.status === "current");
  const nextStage = stages.find((s) => (s.status === "ready" || s.status === "upcoming") && s.opportunities.length > 0);
  const expandedStage = selected ? stages.find((s) => s.id === selected) : null;

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  }

  return (
    <div style={{ marginBottom: "48px" }}>
      <style>{`@keyframes fylym-glow { 0%,100%{box-shadow:0 0 0 0 rgba(191,153,83,0.15)} 50%{box-shadow:0 0 0 8px rgba(191,153,83,0.06)} } .fy-stage-card:hover{transform:translateY(-2px);transition:transform 0.2s}`}</style>

      {/* Header row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "26px", fontWeight: 400, color: "#1A1815", marginBottom: "6px" }}>
            Funding Journey
          </h2>
          <p style={{ fontSize: "13px", color: "#8A857C", maxWidth: "460px", lineHeight: 1.65 }}>
            Follow the complete financing pathway for your project. Each stage shows AI-matched opportunities tailored to your film.
          </p>
        </div>

        {/* Progress card */}
        <div style={{ background: "#F8F5F0", border: "0.5px solid rgba(26,24,21,0.12)", borderRadius: "12px", padding: "16px 20px", minWidth: "300px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A857C", marginBottom: "10px" }}>Funding Journey Progress</p>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "12px" }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "30px", color: "#BF9953", lineHeight: 1, flexShrink: 0 }}>{progress}%</span>
            <div style={{ display: "flex", gap: "24px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#8A857C", marginBottom: "2px" }}>Current Stage</div>
                <div style={{ fontSize: "13px", color: "#1A1815", fontFamily: "'Montserrat',sans-serif" }}>{currentStage?.label ?? "—"}</div>
              </div>
              {nextStage && (
                <div>
                  <div style={{ fontSize: "10px", color: "#8A857C", marginBottom: "2px" }}>Next Recommended</div>
                  <div style={{ fontSize: "13px", color: "#1A1815", fontFamily: "'Montserrat',sans-serif" }}>{nextStage.label}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ height: "3px", background: "rgba(26,24,21,0.1)", borderRadius: "2px" }}>
            <div style={{ height: "3px", background: "#BF9953", borderRadius: "2px", width: `${Math.min(Math.max(progress, 0), 100)}%`, transition: "width 0.8s ease" }} />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative" }}>
        <button onClick={() => scroll("left")} aria-label="Scroll left" style={{ position: "absolute", left: "-14px", top: "44px", zIndex: 2, background: "#fff", border: "0.5px solid rgba(26,24,21,0.14)", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>

        <div ref={scrollRef} style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          <div style={{ display: "flex", alignItems: "stretch", width: "max-content", padding: "4px 28px 0" }}>
            {stages.map((stage, i) => {
              const s = STATUS_STYLES[stage.status];
              const isSelected = selected === stage.id;
              const isCurrent = stage.status === "current";
              return (
                <div key={stage.id} style={{ display: "flex", alignItems: "center" }}>
                  {/* Card */}
                  <div
                    className="fy-stage-card"
                    onClick={() => setSelected(isSelected ? null : stage.id)}
                    style={{
                      width: "136px", minHeight: "118px", padding: "12px 12px 10px",
                      background: s.bg,
                      border: `${isCurrent ? "1.5px" : "0.5px"} solid ${isSelected ? "#BF9953" : s.border}`,
                      borderRadius: "10px", cursor: "pointer",
                      animation: isCurrent ? "fylym-glow 3s ease-in-out infinite" : "none",
                      boxShadow: isSelected ? "0 0 0 2px rgba(191,153,83,0.3)" : "none",
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                  >
                    {/* Stage name */}
                    <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: stage.status === "locked" ? "#b0aba4" : "#8A857C", fontFamily: "'Montserrat',sans-serif", lineHeight: 1.3, marginBottom: "8px" }}>
                      {stage.label}
                    </div>
                    {/* Match count */}
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "22px", color: stage.opportunities.length > 0 ? "#BF9953" : (stage.status === "locked" ? "#c8c4be" : "#1A1815"), marginBottom: "6px" }}>
                      {stage.isPrimary ? stage.opportunities.length : "—"}
                    </div>
                    {/* Sub-label */}
                    <div style={{ fontSize: "10px", color: stage.status === "locked" ? "#c8c4be" : "#8A857C", marginBottom: "8px" }}>
                      {stage.isPrimary ? (stage.opportunities.length === 1 ? "match" : "matches") : "curating"}
                    </div>
                    {/* Status badge */}
                    <span style={{ display: "inline-block", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", background: s.badge, color: s.badgeText, padding: "3px 8px", borderRadius: "20px", fontFamily: "'Montserrat',sans-serif", alignSelf: "flex-start" }}>
                      {s.label}
                    </span>
                  </div>

                  {/* Connector */}
                  {i < stages.length - 1 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "24px", flexShrink: 0 }}>
                      <div style={{ height: "1px", width: "100%", background: i < stages.findIndex(s => s.status === "current") ? "#BF9953" : "rgba(26,24,21,0.12)", marginTop: "59px" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={() => scroll("right")} aria-label="Scroll right" style={{ position: "absolute", right: "-14px", top: "44px", zIndex: 2, background: "#fff", border: "0.5px solid rgba(26,24,21,0.14)", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>→</button>
      </div>

      {/* Expanded panel */}
      {expandedStage && (
        <ExpandedPanel stage={expandedStage} projectId={projectId} onClose={() => setSelected(null)} />
      )}

      {/* Bottom tip */}
      <p style={{ marginTop: "16px", fontSize: "12px", color: "#8A857C", textAlign: "center" }}>
        Progressing through stages in order significantly increases your success rate in securing funding.
      </p>
    </div>
  );
}
