"use client";

import { useState, useEffect } from "react";

// Mirrors FRS_CHECKS in fylympitchEngine.ts — keep in sync if weights change
const FRS_ITEMS = [
  { label: "Title",                weight: 5  },
  { label: "Logline",              weight: 10 },
  { label: "Synopsis",             weight: 15 },
  { label: "Director's statement", weight: 10 },
  { label: "Producer information", weight: 10 },
  { label: "Budget",               weight: 15 },
  { label: "Funding need",         weight: 10 },
  { label: "Pitch deck",           weight: 15 },
  { label: "Script",               weight: 10 },
] as const;

interface Props {
  score:            number | null;
  missing:          string[];
  fundRequirements?: string[];
  /** Optional: project title shown in modal header */
  projectTitle?:    string;
}

function scoreMessage(score: number | null): string {
  if (score == null) return "No engine analysis has run for this project yet.";
  if (score >= 80)   return "Excellent — competitive for the majority of matched funding sources.";
  if (score >= 70)   return "Strong — competitive for most matched funding sources.";
  if (score >= 50)   return "Building readiness. Focus on the factors below.";
  return "Complete the items below to strengthen your funding readiness.";
}

function scoreColor(score: number | null): string {
  if (score == null)  return "text-ash";
  if (score >= 70)    return "text-gold";
  if (score >= 50)    return "text-amber-400";
  return "text-red-400";
}

export default function FRSButton({ score, missing, fundRequirements = [], projectTitle }: Props) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Tile button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="btn-ghost !py-1.5 !px-3 !text-[12px] !text-gold !border-gold/40 hover:!border-gold shrink-0"
        title="Funding Readiness Score"
      >
        FRS {score != null ? score : "—"}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(26,24,21,0.85)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-[440px] relative"
            style={{
              background: "#1A1815",
              border: "1px solid rgba(229,224,213,0.15)",
              borderRadius: "14px",
              padding: "32px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-5 right-5 w-7 h-7 flex items-center justify-center rounded-full transition-colors"
              style={{ color: "#8A857C", background: "rgba(255,255,255,0.06)" }}
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Eyebrow */}
            <p style={{
              fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
              color: "#8A857C", fontWeight: 500, marginBottom: 24,
            }}>
              Funding Readiness Score
              {projectTitle && (
                <span style={{ display: "block", marginTop: 4, fontSize: 10, letterSpacing: "0.12em", opacity: 0.6 }}>
                  {projectTitle}
                </span>
              )}
            </p>

            {/* Score display */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              <span
                className={`font-display ${scoreColor(score)}`}
                style={{ fontSize: 64, lineHeight: 1 }}
              >
                {score ?? "—"}
              </span>
              <span style={{ fontSize: 22, color: "#8A857C", lineHeight: 1 }}>/100</span>
            </div>
            <p style={{ fontSize: 14, color: "rgba(245,245,240,0.65)", marginBottom: 28, lineHeight: 1.5 }}>
              {scoreMessage(score)}
            </p>

            {/* Divider */}
            <div style={{ borderTop: "1px solid rgba(229,224,213,0.12)", marginBottom: 24 }} />

            {/* Breakdown */}
            <p style={{
              fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
              color: "rgba(138,133,124,0.7)", fontWeight: 500, marginBottom: 20,
            }}>
              How it's calculated
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {FRS_ITEMS.map((item) => {
                const done = !missing.includes(item.label);
                return (
                  <div key={item.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: done ? "rgba(245,245,240,0.9)" : "rgba(245,245,240,0.45)", display: "flex", alignItems: "center", gap: 8 }}>
                        {done && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="6" cy="6" r="5.5" stroke="#BF9953" strokeWidth="1"/>
                            <path d="M3.5 6l2 2 3-3" stroke="#BF9953" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {!done && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="6" cy="6" r="5.5" stroke="rgba(138,133,124,0.4)" strokeWidth="1"/>
                          </svg>
                        )}
                        {item.label}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(138,133,124,0.6)", flexShrink: 0, marginLeft: 12 }}>
                        {item.weight}% weight
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 2, background: "rgba(229,224,213,0.12)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: done ? "100%" : "0%",
                        background: done ? "#BF9953" : "transparent",
                        borderRadius: 2,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fund-specific requirements */}
            {fundRequirements.length > 0 && (
              <div style={{
                marginTop: 24, padding: "16px",
                border: "1px solid rgba(191,153,83,0.2)",
                borderRadius: 10, background: "rgba(191,153,83,0.05)",
              }}>
                <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(191,153,83,0.7)", fontWeight: 500, marginBottom: 12 }}>
                  Fund-specific requirements
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {fundRequirements.map((req, i) => (
                    <li key={i} style={{ fontSize: 12, color: "rgba(245,245,240,0.6)", lineHeight: 1.5 }}>
                      — {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer note */}
            <p style={{
              fontSize: 11, color: "rgba(138,133,124,0.5)", marginTop: 24,
              lineHeight: 1.6, borderTop: "1px solid rgba(229,224,213,0.08)", paddingTop: 20,
            }}>
              A score above 70 means your project is competitive for most matched funding sources.
              Below 60, focus on completing your pitch deck, adding co-production attachments,
              and clarifying your budget structure.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
