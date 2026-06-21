"use client";

import { useEffect, useRef, useState } from "react";
import { usd } from "@/lib/format";
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

type Props = {
  discovery: FundingDiscovery;
  readiness: FundingReadiness | null;
  dream:     DreamScenario | null;
};

export default function ProjectIntelligenceSidebar({ discovery, readiness, dream }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);

  const score     = useCountUp(mounted ? (readiness?.score ?? 0) : 0, 1100);
  const scoreVal  = readiness?.score ?? 0;

  // SVG ring
  const r    = 42;
  const cx   = 52;
  const circ = 2 * Math.PI * r;
  const dash = mounted ? (scoreVal / 100) * circ : 0;

  const BOX: React.CSSProperties = {
    background:   "#1A1815",
    borderRadius: 10,
    overflow:     "hidden",
    marginBottom: 10,
  };
  const HDR: React.CSSProperties = {
    fontSize: 8.5, letterSpacing: "0.24em", textTransform: "uppercase",
    color: "rgba(245,245,240,0.28)", fontWeight: 600,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── BOX 1: READINESS SCORE ─────────────────────────────── */}
      {readiness && (
        <div style={BOX}>
          <div style={{ padding: "16px 18px 18px" }}>
            <p style={{ ...HDR, marginBottom: 14 }}>Funding Readiness</p>

            {/* Ring + number centred */}
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
                  fill="rgba(245,245,240,0.3)" fontSize={11} fontFamily="Montserrat, sans-serif">
                  /100
                </text>
              </svg>

              {/* Bar */}
              <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "#BF9953", borderRadius: 2,
                  width: mounted ? `${scoreVal}%` : "0%",
                  transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
              <p style={{ fontSize: 10, color: "rgba(245,245,240,0.35)", letterSpacing: "0.1em", textAlign: "center" }}>
                {scoreVal >= 80 ? "Strong readiness"
                  : scoreVal >= 60 ? "Good readiness"
                  : scoreVal >= 40 ? "Building readiness"
                  : "Early stage"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── BOX 2: CAN RAISE ──────────────────────────────────────── */}
      <div style={BOX}>
        <div style={{ padding: "16px 18px 18px" }}>
          <p style={{ ...HDR, marginBottom: 10 }}>PITCH.FYLYM ENGINE™</p>
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.38)", marginBottom: 8 }}>
            Can raise
          </p>
          <p style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 28, fontWeight: 700, color: "#BF9953",
            lineHeight: 1, marginBottom: 8, letterSpacing: "-0.01em",
          }}>
            {usd(discovery.total_usd)}
          </p>
          <p style={{ fontSize: 10, color: "rgba(245,245,240,0.35)", marginBottom: 14, lineHeight: 1.5 }}>
            {discovery.source_counts?.total ?? 0} matched sources across grants, labs, co-production &amp; investors
          </p>

          {/* Breakdown chips */}
          {(discovery.breakdown?.length ?? 0) > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {discovery.breakdown!.slice(0, 4).map((item: any) => (
                <div key={item.label} style={{
                  borderRadius: 7, padding: "6px 10px",
                  background: "rgba(255,255,255,0.05)",
                }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: "#BF9953" }}>
                    {usd(item.amount_usd)}
                  </div>
                  <div style={{ fontSize: 7, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(245,245,240,0.28)", marginTop: 2 }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── BOX 3: DREAM SCENARIO ─────────────────────────────────── */}
      {dream && (
        <div style={BOX}>
          <div style={{ padding: "16px 18px 18px" }}>
            <p style={{ ...HDR, marginBottom: 14 }}>Dream Scenario</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
              {([
                ["Total funding",     usd(dream.funding_usd)],
                ["Production start",  dream.production_start],
                ["Festival premiere", dream.festival_premiere],
                ["Projected ROI",     `${dream.projected_roi}×`],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} style={{ borderRadius: 7, padding: "9px 10px", background: "rgba(255,255,255,0.05)" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: "#BF9953", marginBottom: 3 }}>{val}</div>
                  <div style={{ fontSize: 7, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(245,245,240,0.28)" }}>{label}</div>
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
              <span style={{ fontSize: 9, color: "rgba(245,245,240,0.32)", whiteSpace: "nowrap" }}>
                {dream.distribution_probability}% distribution
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
