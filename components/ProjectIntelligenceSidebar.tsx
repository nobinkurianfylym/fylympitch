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
        background:    "#1A1815",
        borderRadius:  10,
        overflow:      "hidden",
        marginBottom:  10,
        cursor:        "pointer",
        border:        `1px solid ${hover ? "rgba(191,153,83,0.3)" : "transparent"}`,
        transition:    "border-color 0.2s, box-shadow 0.2s",
        boxShadow:     hover ? "0 0 0 3px rgba(191,153,83,0.08)" : "none",
      }}
    >
      {children}
      {/* Subtle "tap to learn more" hint */}
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

// ── Props ──────────────────────────────────────────────────────────────────
type Props = {
  discovery: FundingDiscovery;
  readiness: FundingReadiness | null;
  dream:     DreamScenario | null;
  roadmap?:  any;
};

export default function ProjectIntelligenceSidebar({ discovery, readiness, dream, roadmap }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);

  const [modal, setModal] = useState<"readiness" | "engine" | "dream" | null>(null);

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

  // Realistic range (5–15% of ceiling)
  const realisticLow  = discovery.total_usd * 0.05;
  const realisticHigh = discovery.total_usd * 0.15;
  const breakdown = (readiness as any)?.breakdown ?? [];

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
              <p style={{ fontSize: 10, color: "rgba(245,245,240,0.60)", letterSpacing: "0.1em", textAlign: "center" }}>
                {scoreVal >= 80 ? "Strong readiness" : scoreVal >= 60 ? "Good readiness" : scoreVal >= 40 ? "Building readiness" : "Early stage"}
              </p>
            </div>
          </div>
        </ClickCard>
      )}

      {/* ── BOX 2: ENGINE — REALISTIC VALUE AS HEADER ────────────── */}
      <ClickCard onClick={() => setModal("engine")}>
        <div style={{ padding: "16px 18px 10px" }}>
          <p style={{ fontSize: 8, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(245,245,240,0.72)", fontWeight: 600, marginBottom: 6 }}>
            PITCH.FYLYM ENGINE™
          </p>
          {/* Realistic range — primary header */}
          <p style={{ fontSize: 10, color: "rgba(245,245,240,0.50)", marginBottom: 4 }}>Realistic funding range</p>
          <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: "#F5F5F0", lineHeight: 1, marginBottom: 4, letterSpacing: "-0.01em" }}>
            {usd(realisticLow)} – {usd(realisticHigh)}
          </p>
          {/* Theoretical ceiling as context */}
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

      {/* ── BOX 3: DREAM SCENARIO ────────────────────────────────────── */}
      {dream && (
        <ClickCard onClick={() => setModal("dream")}>
          <div style={{ padding: "16px 18px 10px" }}>
            <p style={HDR}>Dream Scenario</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
              {([
                ["Total funding",     usd(dream.funding_usd)],
                ["Production start",  dream.production_start],
                ["Festival premiere", dream.festival_premiere],
                ["Projected ROI",     `${dream.projected_roi}×`],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} style={{ borderRadius: 7, padding: "9px 10px", background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: "#BF9953", marginBottom: 3 }}>{val}</div>
                  <div style={{ fontSize: 7, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(245,245,240,0.55)" }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: "0.5px solid rgba(255,255,255,0.07)" }}>
              <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "#BF9953", borderRadius: 2,
                  width: mounted ? `${dream.distribution_probability}%` : "0%",
                  transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
              <span style={{ fontSize: 9, color: "rgba(245,245,240,0.55)", whiteSpace: "nowrap" }}>
                {dream.distribution_probability}% distribution
              </span>
            </div>
          </div>
        </ClickCard>
      )}

      {/* ── FUNDING JOURNEY MINI ─────────────────────────────────────── */}
      <FundingJourneyMini readiness={readiness} roadmap={roadmap} />

      {/* ══ MODALS ═══════════════════════════════════════════════════════ */}

      {/* Readiness Modal */}
      {modal === "readiness" && readiness && (
        <Modal title="Funding Readiness Score" onClose={() => setModal(null)}>
          {/* Big score */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 56, color: "#BF9953", lineHeight: 1, fontWeight: 700 }}>
              {scoreVal}
            </span>
            <span style={{ fontSize: 18, color: "rgba(245,245,240,0.45)" }}>/100</span>
          </div>
          <p style={{ fontSize: 14, color: "rgba(245,245,240,0.55)", marginBottom: 20 }}>
            {scoreVal >= 80 ? "Your project is strongly positioned for most matched opportunities."
              : scoreVal >= 60 ? "Good foundation — strengthen the weaker areas to improve your win rate."
              : scoreVal >= 40 ? "Your project is building readiness. Focus on the factors below."
              : "Early stage — address the fundamentals first to unlock more opportunities."}
          </p>

          <MDivider />
          <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,245,240,0.45)", marginBottom: 14 }}>
            How it's calculated
          </p>

          {breakdown.length > 0
            ? breakdown.map((b: any) => <MRow key={b.factor} label={b.factor} value={`${b.score}/100`} bar={b.score} />)
            : <>
                <MRow label="Script & Story Development"  value="20% weight" bar={scoreVal} />
                <MRow label="Budget Structure & Clarity"  value="20% weight" bar={Math.min(100, scoreVal + 5)} />
                <MRow label="Creative Team Experience"    value="20% weight" bar={Math.max(0, scoreVal - 7)} />
                <MRow label="Market & Genre Fit"          value="20% weight" bar={Math.min(100, scoreVal + 2)} />
                <MRow label="Financing Plan Completeness" value="20% weight" bar={Math.max(0, scoreVal - 4)} />
              </>
          }
          <MDivider />
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.4)", lineHeight: 1.65 }}>
            A score above 70 means your project is competitive for most of the {discovery.source_counts?.total ?? 0} sources matched to it. Below 60, focus on completing your pitch deck, adding co-production attachments, and clarifying your budget structure.
          </p>
        </Modal>
      )}

      {/* Engine Modal */}
      {modal === "engine" && (
        <Modal title="PITCH.FYLYM ENGINE™ — Can Raise" onClose={() => setModal(null)}>
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

      {/* Dream Scenario Modal */}
      {modal === "dream" && dream && (
        <Modal title="Dream Scenario — AI Projection" onClose={() => setModal(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {([
              ["Total Funding",     usd(dream.funding_usd),          "Sum of top 10 match ceiling"],
              ["Production Start",  dream.production_start,           "Genre & stage timeline average"],
              ["Festival Premiere", dream.festival_premiere,          "Comparable film premiere data"],
              ["Projected ROI",     `${dream.projected_roi}×`,        "Production cost vs. distribution"],
            ] as [string, string, string][]).map(([label, val, note]) => (
              <div key={label} style={{ borderRadius: 8, padding: "12px 14px", background: "rgba(255,255,255,0.05)" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#BF9953", marginBottom: 4 }}>{val}</div>
                <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(245,245,240,0.7)", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 9, color: "rgba(245,245,240,0.35)", lineHeight: 1.4 }}>{note}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "rgba(245,245,240,0.6)" }}>Distribution probability</span>
              <span style={{ fontSize: 14, color: "#BF9953", fontWeight: 700 }}>{dream.distribution_probability}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${dream.distribution_probability}%`, background: "#BF9953", borderRadius: 3 }} />
            </div>
          </div>

          <MDivider />
          <p style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,245,240,0.45)", marginBottom: 14 }}>
            How it's calculated
          </p>
          <MRow label="Funding basis"         value="Top 10 match combination" />
          <MRow label="Comparables database"  value="Similar genre & budget films" />
          <MRow label="Timeline method"       value="Stage & market averages" />
          <MRow label="ROI methodology"       value="Production cost vs. typical distribution revenue" />
          <MDivider />
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.4)", lineHeight: 1.65 }}>
            This is an optimistic but achievable target based on your highest-scoring matches. Actual outcomes depend on applications submitted, jury decisions, and market conditions. Use it as a north star, not a guarantee.
          </p>
        </Modal>
      )}
    </div>
  );
}
