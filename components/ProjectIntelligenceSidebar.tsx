"use client";

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

// ── Info toggle button ─────────────────────────────────────────────────────
function InfoBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={open ? "Hide explanation" : "How is this calculated?"}
      style={{
        background:   open ? "rgba(191,153,83,0.2)" : "rgba(255,255,255,0.08)",
        border:       "none",
        borderRadius: "50%",
        width:        18,
        height:       18,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        cursor:       "pointer",
        flexShrink:   0,
        fontSize:     10,
        color:        open ? "#BF9953" : "rgba(245,245,240,0.5)",
        transition:   "background 0.15s, color 0.15s",
        lineHeight:   1,
        fontWeight:   600,
      }}
    >
      {open ? "✕" : "ⓘ"}
    </button>
  );
}

// ── Explanation panel ──────────────────────────────────────────────────────
function ExplainPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop:    12,
      padding:      "12px 14px",
      borderRadius: 8,
      background:   "rgba(255,255,255,0.05)",
      border:       "1px solid rgba(255,255,255,0.1)",
    }}>
      {children}
    </div>
  );
}

function ExplainRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
      <span style={{ fontSize: 10, color: "rgba(245,245,240,0.5)", lineHeight: 1.5 }}>{label}</span>
      <span style={{ fontSize: 10, color: "rgba(245,245,240,0.75)", fontWeight: 600, textAlign: "right", flexShrink: 0 }}>{value}</span>
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

  const [openBox, setOpenBox] = useState<"readiness" | "engine" | "dream" | null>(null);
  const toggle = (box: "readiness" | "engine" | "dream") =>
    setOpenBox(prev => prev === box ? null : box);

  const score    = useCountUp(mounted ? (readiness?.score ?? 0) : 0, 1100);
  const scoreVal = readiness?.score ?? 0;

  const r    = 42;
  const cx   = 52;
  const circ = 2 * Math.PI * r;
  const dash = mounted ? (scoreVal / 100) * circ : 0;

  const BOX: React.CSSProperties = {
    background: "#1A1815", borderRadius: 10, overflow: "hidden", marginBottom: 10,
  };
  const HDR: React.CSSProperties = {
    fontSize: 8.5, letterSpacing: "0.24em", textTransform: "uppercase",
    color: "rgba(245,245,240,0.72)", fontWeight: 600,
  };
  const DIV = "1px solid rgba(255,255,255,0.08)";

  // Readiness breakdown labels (from readiness.breakdown if available)
  const breakdown = (readiness as any)?.breakdown ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── BOX 1: READINESS SCORE ────────────────────────────────── */}
      {readiness && (
        <div style={BOX}>
          <div style={{ padding: "16px 18px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={HDR}>Funding Readiness</p>
              <InfoBtn open={openBox === "readiness"} onClick={() => toggle("readiness")} />
            </div>

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

            {/* Explanation */}
            {openBox === "readiness" && (
              <ExplainPanel>
                <p style={{ fontSize: 10, color: "rgba(245,245,240,0.65)", lineHeight: 1.7, marginBottom: 10 }}>
                  Your score is a weighted assessment of how ready your project is to apply for and win funding from the opportunities matched to it.
                </p>
                {breakdown.length > 0
                  ? breakdown.map((b: any) => (
                      <ExplainRow key={b.factor} label={b.factor} value={`${b.score}/100`} />
                    ))
                  : <>
                      <ExplainRow label="Script & Story Development"       value="20%" />
                      <ExplainRow label="Budget Structure & Clarity"       value="20%" />
                      <ExplainRow label="Creative Team Experience"         value="20%" />
                      <ExplainRow label="Market & Genre Fit"               value="20%" />
                      <ExplainRow label="Financing Plan Completeness"      value="20%" />
                    </>
                }
                <p style={{ fontSize: 9, color: "rgba(245,245,240,0.35)", marginTop: 10, lineHeight: 1.5 }}>
                  A score of {scoreVal}+ means your project is competitive for {scoreVal >= 70 ? "most" : "some"} of your matched opportunities.
                </p>
              </ExplainPanel>
            )}
          </div>
        </div>
      )}

      {/* ── BOX 2: CAN RAISE ─────────────────────────────────────────── */}
      <div style={BOX}>
        <div style={{ padding: "16px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={HDR}>PITCH.FYLYM ENGINE™</p>
            <InfoBtn open={openBox === "engine"} onClick={() => toggle("engine")} />
          </div>
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.65)", marginBottom: 8 }}>Can raise</p>
          <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#BF9953", lineHeight: 1, marginBottom: 8 }}>
            {usd(discovery.total_usd)}
          </p>
          <p style={{ fontSize: 10, color: "rgba(245,245,240,0.55)", marginBottom: 14, lineHeight: 1.5 }}>
            {discovery.source_counts?.total ?? 0} matched sources across grants, labs, co-production &amp; investors
          </p>
          {(discovery.breakdown?.length ?? 0) > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {discovery.breakdown!.slice(0, 4).map((item: any) => (
                <div key={item.label} style={{ borderRadius: 7, padding: "6px 10px", background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "#BF9953" }}>{usd(item.amount_usd)}</div>
                  <div style={{ fontSize: 7, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(245,245,240,0.50)", marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Explanation */}
          {openBox === "engine" && (
            <ExplainPanel>
              <p style={{ fontSize: 10, color: "rgba(245,245,240,0.65)", lineHeight: 1.7, marginBottom: 10 }}>
                This is the theoretical maximum if your project won funding from every matched opportunity — the sum of all maximum award amounts across {discovery.source_counts?.total ?? 0} sources.
              </p>
              <ExplainRow label="Matching method"  value="Score ≥ 60 threshold" />
              <ExplainRow label="Sources included" value={`${discovery.source_counts?.total ?? 0} active opportunities`} />
              <ExplainRow label="Realistic range"  value={`${usd(discovery.total_usd * 0.05)} – ${usd(discovery.total_usd * 0.15)}`} />
              <p style={{ fontSize: 9, color: "rgba(245,245,240,0.35)", marginTop: 10, lineHeight: 1.5 }}>
                Realistic expectation is 5–15% of the total ceiling, depending on applications submitted and selected.
              </p>
            </ExplainPanel>
          )}
        </div>
      </div>

      {/* ── BOX 3: DREAM SCENARIO ────────────────────────────────────── */}
      {dream && (
        <div style={BOX}>
          <div style={{ padding: "16px 18px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={HDR}>Dream Scenario</p>
              <InfoBtn open={openBox === "dream"} onClick={() => toggle("dream")} />
            </div>
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

            {/* Explanation */}
            {openBox === "dream" && (
              <ExplainPanel>
                <p style={{ fontSize: 10, color: "rgba(245,245,240,0.65)", lineHeight: 1.7, marginBottom: 10 }}>
                  An AI projection of your best-case funding and release outcome, modelled on your top-scoring matches and comparable films in our database.
                </p>
                <ExplainRow label="Funding basis"         value="Top 10 match combination" />
                <ExplainRow label="Timeline method"       value="Genre & stage averages" />
                <ExplainRow label="ROI model"             value="Production cost vs. distribution" />
                <ExplainRow label="Distribution score"    value={`${dream.distribution_probability}% probability`} />
                <p style={{ fontSize: 9, color: "rgba(245,245,240,0.35)", marginTop: 10, lineHeight: 1.5 }}>
                  This is a motivational target — actual outcomes depend on applications submitted, selection criteria, and market conditions.
                </p>
              </ExplainPanel>
            )}
          </div>
        </div>
      )}

      {/* ── FUNDING JOURNEY MINI ─────────────────────────────────────── */}
      <FundingJourneyMini readiness={readiness} roadmap={roadmap} />
    </div>
  );
}
