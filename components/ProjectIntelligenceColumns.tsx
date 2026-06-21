"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usd } from "@/lib/format";
import { requestProducerIntroduction } from "@/lib/actions";
import type {
  FundingDiscovery, FundingReadiness, DreamScenario, ProducerMatch,
} from "@/services/fylympitchEngine";
import type { MatchRow } from "@/components/MatchList";

// ── Helpers ──────────────────────────────────────────────────────────
const OPP_LABELS: Record<string, string> = {
  grant: "Grant", lab: "Lab", co_production: "Co-Pro",
  fund: "Fund", market: "Market", producer: "Producer", investor: "Investor",
};

function roleLabel(role: string) {
  if (role === "investor")    return "Investor";
  if (role === "organization") return "Org";
  return "Producer";
}

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

function N({ v, d }: { v: number; d?: number }) {
  return <>{useCountUp(v, d)}</>;
}

// ── Score ring ────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);
  const n = useCountUp(mounted ? score : 0, 1100);
  const r  = 36;
  const cx = 44;
  const circ = 2 * Math.PI * r;
  const dash = mounted ? (score / 100) * circ : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={cx * 2} height={cx * 2} viewBox={`0 0 ${cx * 2} ${cx * 2}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke="#BF9953" strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={circ - dash}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle"
          fill="#F5F5F0" fontSize={18} fontFamily="'Playfair Display', Georgia, serif" fontWeight={700}>
          {n}
        </text>
      </svg>
      <p style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,245,240,0.35)" }}>
        Readiness
      </p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────
type Props = {
  discovery:           FundingDiscovery;
  readiness:           FundingReadiness | null;
  ranked:              MatchRow[];
  producerMatches:     ProducerMatch[];
  dream:               DreamScenario | null;
  projectId:           string;
  requestedProducerIds: string[];
};

export default function ProjectIntelligenceColumns({
  discovery, readiness, ranked, producerMatches,
  dream, projectId, requestedProducerIds,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);
  const requested = new Set(requestedProducerIds);

  const COL = "rgba(255,255,255,0.05)";
  const HDR = { fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(245,245,240,0.35)", marginBottom: 14, fontWeight: 600 };
  const DIV = "0.5px solid rgba(255,255,255,0.08)";

  return (
    <div style={{ background: "#1A1815", borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>

      {/* ── ENGINE HEADER ──────────────────────────────────────────── */}
      <div style={{ padding: "28px 28px 20px", borderBottom: DIV, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 8.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(245,245,240,0.3)", marginBottom: 8 }}>
            PITCH.FYLYM ENGINE™
          </p>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(20px,2.2vw,28px)", color: "#F5F5F0", lineHeight: 1.2, marginBottom: 6 }}>
            Can raise{" "}
            <span style={{ color: "#BF9953" }}>{usd(discovery.total_usd)}</span>
          </h2>
          <p style={{ fontSize: 11, color: "rgba(245,245,240,0.4)", marginBottom: 16 }}>
            {discovery.source_counts?.total ?? ranked.length} matched sources · grants, labs, co-production & investors
          </p>

          {/* Breakdown chips */}
          {(discovery.breakdown?.length ?? 0) > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {discovery.breakdown!.slice(0, 4).map((item: any) => (
                <div key={item.label} style={{ borderRadius: 8, padding: "6px 12px", background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "#BF9953" }}>{usd(item.amount_usd)}</div>
                  <div style={{ fontSize: 7, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,245,240,0.3)", marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Readiness bar */}
          {readiness && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "#BF9953", borderRadius: 2,
                  width: mounted ? `${readiness.score}%` : "0%",
                  transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
              <span style={{ fontSize: 10, color: "rgba(245,245,240,0.4)", whiteSpace: "nowrap" }}>
                {readiness.score}/100 funding readiness
              </span>
            </div>
          )}
        </div>

        {/* Score ring */}
        {readiness && <ScoreRing score={readiness.score} />}
      </div>

      {/* ── 3-COLUMN GRID ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }} className="intel-cols">

        {/* ─ Col 1: TOP MATCHES ─ */}
        <div style={{ padding: "20px 20px 24px", borderRight: DIV }}>
          <p style={HDR}>Top Matches</p>
          {ranked.length === 0
            ? <p style={{ fontSize: 12, color: "rgba(245,245,240,0.35)" }}>Run the engine to see funding matches.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ranked.slice(0, 6).map((m) => (
                  <Link
                    key={m.id}
                    href={`/dashboard/opportunities/${m.id}?project=${projectId}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 8,
                      border: "0.5px solid rgba(255,255,255,0.09)",
                      background: COL, textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                    className="intel-match-row"
                  >
                    <span style={{
                      fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase",
                      padding: "2px 6px", borderRadius: 5,
                      background: "rgba(255,255,255,0.07)", color: "rgba(245,245,240,0.45)",
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {OPP_LABELS[m.opp_type] ?? m.opp_type}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "#F5F5F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.title}
                      </p>
                      {(m.max_award_usd || m.deadline_note || m.deadline) && (
                        <p style={{ fontSize: 9, color: "rgba(245,245,240,0.3)", marginTop: 1 }}>
                          {m.max_award_usd ? usd(m.max_award_usd) : ""}
                          {m.max_award_usd && (m.deadline_note || m.deadline) ? " · " : ""}
                          {m.deadline_note ?? (m.deadline ? new Date(m.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "")}
                        </p>
                      )}
                    </div>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#BF9953", flexShrink: 0 }}>
                      <N v={m.score} />
                    </span>
                  </Link>
                ))}
                <Link
                  href="/dashboard/opportunities"
                  style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(191,153,83,0.6)", textDecoration: "none", marginTop: 4, display: "inline-block" }}
                >
                  View all {ranked.length} →
                </Link>
              </div>
          }
        </div>

        {/* ─ Col 2: PRODUCERS & INVESTORS ─ */}
        <div style={{ padding: "20px 20px 24px", borderRight: DIV }}>
          <p style={HDR}>Producers & Investors</p>
          {producerMatches.length === 0
            ? <p style={{ fontSize: 12, color: "rgba(245,245,240,0.35)" }}>No producer matches yet.</p>
            : <div style={{ display: "flex", flexDirection: "column" }}>
                {producerMatches.slice(0, 5).map((pm, i) => {
                  const done = requested.has(pm.profile.id);
                  const initials = pm.profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <div key={pm.profile.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                      borderBottom: i < Math.min(producerMatches.length, 5) - 1 ? DIV : "none",
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(255,255,255,0.1)", overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "#F5F5F0",
                      }}>
                        {pm.profile.avatar_url
                          ? <img src={pm.profile.avatar_url} alt={pm.profile.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: "#F5F5F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {pm.profile.full_name}
                          {pm.profile.company && <span style={{ color: "rgba(245,245,240,0.35)" }}> · {pm.profile.company}</span>}
                        </p>
                        <span style={{
                          fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase",
                          padding: "2px 6px", borderRadius: 100, marginTop: 3, display: "inline-block",
                          background: "rgba(191,153,83,0.15)", color: "#BF9953",
                        }}>
                          {roleLabel(pm.profile.role)}
                        </span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginRight: 6 }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#BF9953" }}><N v={pm.score} /></div>
                        <div style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(245,245,240,0.25)" }}>match</div>
                      </div>
                      {done
                        ? <span style={{ fontSize: 9, color: "#86efac", whiteSpace: "nowrap" }}>✓ Sent</span>
                        : (
                          <form action={requestProducerIntroduction}>
                            <input type="hidden" name="producer_user_id" value={pm.profile.id} />
                            <input type="hidden" name="project_id" value={projectId} />
                            <button type="submit" style={{
                              fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                              padding: "5px 9px", borderRadius: 6,
                              border: "0.5px solid rgba(255,255,255,0.18)",
                              background: "transparent", color: "rgba(245,245,240,0.55)",
                              cursor: "pointer", whiteSpace: "nowrap",
                            }}>
                              Connect →
                            </button>
                          </form>
                        )}
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* ─ Col 3: DREAM SCENARIO ─ */}
        <div style={{ padding: "20px 20px 24px" }}>
          <p style={HDR}>Dream Scenario</p>
          {!dream
            ? <p style={{ fontSize: 12, color: "rgba(245,245,240,0.35)" }}>Re-run the engine to generate projections.</p>
            : <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {([
                    ["Total funding",    usd(dream.funding_usd)],
                    ["Production start", dream.production_start],
                    ["Festival premiere",dream.festival_premiere],
                    ["Projected ROI",    `${dream.projected_roi}×`],
                  ] as [string, string][]).map(([label, val]) => (
                    <div key={label} style={{ borderRadius: 8, padding: "10px 12px", background: "rgba(255,255,255,0.05)" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "#BF9953", marginBottom: 4 }}>{val}</div>
                      <div style={{ fontSize: 7, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,245,240,0.3)" }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: DIV, paddingTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", background: "#BF9953", borderRadius: 2,
                      width: mounted ? `${dream.distribution_probability}%` : "0%",
                      transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
                    }} />
                  </div>
                  <span style={{ fontSize: 9, color: "rgba(245,245,240,0.35)", whiteSpace: "nowrap" }}>
                    <N v={dream.distribution_probability} d={1100} />% distribution
                  </span>
                </div>
              </>
          }
        </div>
      </div>

      <style>{`
        .intel-match-row:hover { background: rgba(255,255,255,0.08) !important; }
        @media (max-width: 900px) {
          .intel-cols { grid-template-columns: 1fr !important; }
          .intel-cols > div { border-right: none !important; border-bottom: 0.5px solid rgba(255,255,255,0.08); }
          .intel-cols > div:last-child { border-bottom: none; }
        }
      `}</style>
    </div>
  );
}
