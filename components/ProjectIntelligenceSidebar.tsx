"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usd } from "@/lib/format";
import FundingJourneyMini from "@/components/FundingJourneyMini";
import type {
  FundingDiscovery, FundingReadiness, DreamScenario,
} from "@/services/fylympitchEngine";

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!target) return;
    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      setCount(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return count;
}

// ── Overlay Modal ──────────────────────────────────────────────────────────
function Modal({ onClose, title, children }: {
  onClose: () => void; title: string; children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position:       "fixed", inset: 0, zIndex: 99999,
        background:     "rgba(10,9,8,0.82)",
        display:        "flex", alignItems: "center", justifyContent: "center",
        padding:        24,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:        "100%", maxWidth: 480,
          maxHeight:    "85vh",
          background:   "#1A1815",
          borderRadius: 14,
          overflow:     "hidden",
          display:      "flex", flexDirection: "column",
          boxShadow:    "0 24px 80px rgba(0,0,0,0.6)",
          border:       "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{
          display:        "flex", alignItems: "center",
          justifyContent: "space-between",
          padding:        "16px 20px",
          borderBottom:   "1px solid rgba(255,255,255,0.08)",
          flexShrink:     0,
        }}>
          <p style={{
            fontSize:      9, letterSpacing: "0.26em",
            textTransform: "uppercase",
            color:         "rgba(245,245,240,0.72)", fontWeight: 700,
          }}>{title}</p>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "none",
              borderRadius: 6, width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(245,245,240,0.5)",
              fontSize: 14, transition: "background 0.15s",
            }}
          >✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "20px 20px 24px", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Modal row ──────────────────────────────────────────────────────────────
function MRow({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "rgba(245,245,240,0.6)", letterSpacing: "0.03em" }}>{label}</span>
        <span style={{ fontSize: 12, color: "#F5F5F0", fontWeight: 600 }}>{value}</span>
      </div>
      {bar !== undefined && (
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${bar}%`, background: "#BF9953", borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

function MDivider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0" }} />;
}

// ── Clickable card ─────────────────────────────────────────────────────────
function ClickCard({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:    hover ? "#201E1B" : "#1A1815",
        borderRadius:  10,
        overflow:      "hidden",
        marginBottom:  10,
        cursor:        "pointer",
        border:        `1px solid ${hover ? "rgba(191,153,83,0.35)" : "rgba(255,255,255,0.06)"}`,
        transition:    "all 0.2s ease",
        boxShadow:     hover ? "0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(191,153,83,0.1)" : "0 2px 8px rgba(0,0,0,0.15)",
        transform:     hover ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {children}
      <div style={{
        padding:        "5px 18px 8px",
        display:        "flex",
        alignItems:     "center",
        gap:            4,
        borderTop:      "1px solid rgba(255,255,255,0.05)",
        opacity:        hover ? 1 : 0.45,
        transition:     "opacity 0.2s",
      }}>
        <span style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(191,153,83,0.7)" }}>
          Tap to understand this
        </span>
        <span style={{ fontSize: 10, color: "rgba(191,153,83,0.7)" }}>→</span>
      </div>
    </div>
  );
}

// ── Actual FRS fields mirroring engine FRS_CHECKS ─────────────────────────
// Labels must match exactly what computeFundingReadiness() puts in missing[].
const FRS_FIELDS: { label: string; weight: number }[] = [
  { label: "Pitch deck",           weight: 15 },
  { label: "Synopsis",             weight: 15 },
  { label: "Budget",               weight: 15 },
  { label: "Logline",              weight: 10 },
  { label: "Director's statement", weight: 10 },
  { label: "Co-producer (if any)", weight: 10 },
  { label: "Funding need",         weight: 10 },
  { label: "Script",               weight: 10 },
  { label: "Title",                weight: 5  },
];

// ── Props ──────────────────────────────────────────────────────────────────
type Props = {
  discovery: FundingDiscovery;
  readiness: FundingReadiness | null;
  dream?:    DreamScenario | null;  // kept for type compat — not rendered
  roadmap?:  any;
};

export default function ProjectIntelligenceSidebar({ discovery, readiness, roadmap }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);

  const [modal, setModal] = useState<"readiness" | "engine" | null>(null);

  const score    = useCountUp(mounted ? (readiness?.score ?? 0) : 0, 1100);
  const scoreVal = readiness?.score ?? 0;

  const r    = 42;
  const cx   = 52;
  const circ = 2 * Math.PI * r;
  const dash = mounted ? (scoreVal / 100) * circ : 0;

  const HDR: React.CSSProperties = {
    fontSize: 8.5, letterSpacing: "0.24em", textTransform: "uppercase",
    color: "rgba(245,245,240,0.72)", fontWeight: 600, marginBottom: 14,
  };

  // Realistic range (5–15% of ceiling) — honest industry estimate
  const realisticLow  = discovery.total_usd * 0.05;
  const realisticHigh = discovery.total_usd * 0.15;

  // Which FRS fields are missing vs completed
  const missingSet = new Set(readiness?.missing ?? []);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── BOX 1: READINESS SCORE ───────────────────────────────── */}
      {readiness && (
        <ClickCard onClick={() => setModal("readiness")}>
          <div style={{ padding: "16px 18px 10px" }}>
            <p style={HDR}>Funding Readiness</p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <svg width={cx * 2} height={cx * 2} viewBox={`0 0 ${cx * 2} ${cx * 2}`}>
                <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
                <circle
                  cx={cx} cy={cx} r={r} fill="none"
                  stroke="#BF9953" strokeWidth={6}
                  strokeDasharray={circ}
                  strokeDashoffset={circ - dash}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cx})`}
                  style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.4,0,0.2,1)" }}
                />
                <text x={cx} y={cx - 4} textAnchor="middle" dominantBaseline="middle"
                  fill="#F5F5F0" fontSize={28} fontFamily="'Playfair Display', Georgia, serif" fontWeight={700}>
                  {score}
                </text>
                <text x={cx} y={cx + 18} textAnchor="middle"
                  fill="rgba(245,245,240,0.55)" fontSize={11} fontFamily="Montserrat, sans-serif">
                  /100
                </text>
              </svg>
              <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "#BF9953", borderRadius: 2,
                  width: mounted ? `${scoreVal}%` : "0%",
                  transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
            </div>
          </div>
        </ClickCard>
      )}

      {/* ── BOX 2: ENGINE — REALISTIC FUNDING RANGE ──────────────── */}
      <ClickCard onClick={() => setModal("engine")}>
        <div style={{ padding: "16px 18px 10px" }}>
          <p style={{ fontSize: 8, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(245,245,240,0.72)", fontWeight: 600, marginBottom: 6 }}>
            PITCH.FYLYM ENGINE™
          </p>
          <p style={{ fontSize: 10, color: "rgba(245,245,240,0.50)", marginBottom: 4 }}>Realistic funding range</p>
          <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: "#F5F5F0", lineHeight: 1, marginBottom: 4, letterSpacing: "-0.01em" }}>
            {usd(realisticLow)} – {usd(realisticHigh)}
          </p>
          <p style={{ fontSize: 10, color: "rgba(245,245,240,0.35)", marginBottom: 14 }}>
            of {usd(discovery.total_usd)} ceiling · {discovery.source_counts?.total ?? 0} matched sources
          </p>
          {(discovery.breakdown?.length ?? 0) > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {discovery.breakdown!.slice(0, 4).map((item: any) => (
                <div key={item.label} style={{ borderRadius: 7, padding: "5px 9px", background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, color: "#BF9953" }}>{usd(item.amount_usd)}</div>
                  <div style={{ fontSize: 7, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(245,245,240,0.50)", marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ClickCard>

      {/* ── FUNDING JOURNEY MINI ─────────────────────────────────────── */}
      <FundingJourneyMini readiness={readiness} roadmap={roadmap} />

      {/* ══ MODALS ═══════════════════════════════════════════════════════ */}

      {/* Readiness Modal — actual FRS fields only */}
      {modal === "readiness" && readiness && (
        <Modal title="Funding Readiness Score" onClose={() => setModal(null)}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 56, color: "#BF9953", lineHeight: 1, fontWeight: 700 }}>
              {scoreVal}
            </span>
            <span style={{ fontSize: 18, color: "rgba(245,245,240,0.45)" }}>/100</span>
          </div>
          <p style={{ fontSize: 14, color: "rgba(245,245,240,0.55)", marginBottom: 20 }}>
            {scoreVal >= 80 ? "Your project is strongly positioned for most matched opportunities."
              : scoreVal >= 60 ? "Good foundation — complete the remaining fields to improve your match rate."
              : scoreVal >= 40 ? "Fill in the missing fields below to raise your score."
              : "Complete the fundamentals first to unlock more matched opportunities."}
          </p>

          <MDivider />
          <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,245,240,0.45)", marginBottom: 14 }}>
            Profile completeness
          </p>

          {FRS_FIELDS.map(({ label, weight }) => {
            const done = !missingSet.has(label);
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, lineHeight: 1,
                      color: done ? "#BF9953" : "rgba(245,245,240,0.25)",
                    }}>{done ? "✓" : "✕"}</span>
                    <span style={{ fontSize: 12, color: done ? "rgba(245,245,240,0.75)" : "rgba(245,245,240,0.4)" }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: done ? "#BF9953" : "rgba(245,245,240,0.25)" }}>
                    {weight}pts
                  </span>
                </div>
                <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: done ? "100%" : "0%", background: "#BF9953", borderRadius: 1 }} />
                </div>
              </div>
            );
          })}

          <MDivider />
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.4)", lineHeight: 1.65 }}>
            Score is calculated from profile completeness only — each field above contributes its stated points. A score above 70 means the profile is competitive for most of the {discovery.source_counts?.total ?? 0} matched sources.
          </p>
        </Modal>
      )}

      {/* Engine Modal */}
      {modal === "engine" && (
        <Modal title="PITCH.FYLYM ENGINE™ — Funding Range" onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: "rgba(245,245,240,0.5)", marginBottom: 12 }}>Realistic funding range</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, color: "#F5F5F0", lineHeight: 1, fontWeight: 700 }}>
              {usd(realisticLow)} – {usd(realisticHigh)}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.35)", marginBottom: 20 }}>
            5–15% of {usd(discovery.total_usd)} theoretical ceiling across {discovery.source_counts?.total ?? 0} matched sources
          </p>

          <MDivider />
          <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,245,240,0.45)", marginBottom: 14 }}>
            How it's calculated
          </p>
          <MRow label="Matched opportunities"    value={`${discovery.source_counts?.total ?? 0} sources`} />
          <MRow label="Matching threshold"       value="Score ≥ 60 out of 100" />
          <MRow label="Theoretical ceiling"      value={usd(discovery.total_usd)} />
          <MRow label="Realistic low (5%)"       value={usd(realisticLow)} />
          <MRow label="Realistic high (15%)"     value={usd(realisticHigh)} />
          {(discovery.breakdown?.length ?? 0) > 0 && <>
            <MDivider />
            <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,245,240,0.45)", marginBottom: 14 }}>
              Breakdown by category
            </p>
            {discovery.breakdown!.map((item: any) => (
              <MRow key={item.label} label={item.label} value={usd(item.amount_usd)}
                bar={Math.round((item.amount_usd / discovery.total_usd) * 100)} />
            ))}
          </>}
          <MDivider />
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.4)", lineHeight: 1.65 }}>
            The theoretical ceiling assumes winning every matched opportunity — which never happens in practice. Industry data shows filmmakers typically secure 5–15% of their total match ceiling through active applications over 18–24 months.
          </p>
        </Modal>
      )}
    </div>
  );
}
