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

// ── Section divider ───────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
      color: "rgba(245,245,240,0.35)", fontWeight: 600, marginBottom: 12,
    }}>
      {children}
    </p>
  );
}

// ── Props ─────────────────────────────────────────────────────────────
type Props = {
  discovery:            FundingDiscovery;
  readiness:            FundingReadiness | null;
  ranked:               MatchRow[];
  producerMatches:      ProducerMatch[];
  dream:                DreamScenario | null;
  projectId:            string;
  requestedProducerIds: string[];
};

export default function ProjectIntelligenceSidebar({
  discovery, readiness, ranked, producerMatches,
  dream, projectId, requestedProducerIds,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);
  const requested = new Set(requestedProducerIds);
  const readScore = useCountUp(mounted ? (readiness?.score ?? 0) : 0, 1100);

  const DIV = "1px solid rgba(255,255,255,0.07)";

  return (
    <div style={{
      background:   "#1A1815",
      borderRadius: 10,
      overflow:     "hidden",
      fontSize:     13,
      color:        "#F5F5F0",
    }}>

      {/* ── ENGINE HEADER ────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 16px", borderBottom: DIV }}>
        <p style={{ fontSize: 8, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(245,245,240,0.28)", marginBottom: 8 }}>
          PITCH.FYLYM ENGINE™
        </p>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "#F5F5F0", lineHeight: 1.25, marginBottom: 4 }}>
          Can raise{" "}
          <span style={{ color: "#BF9953" }}>{usd(discovery.total_usd)}</span>
        </p>
        <p style={{ fontSize: 10, color: "rgba(245,245,240,0.35)", marginBottom: 14 }}>
          {discovery.source_counts?.total ?? ranked.length} matched sources
        </p>

        {/* Readiness bar */}
        {readiness && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,245,240,0.35)" }}>
                Funding Readiness
              </span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#BF9953", lineHeight: 1 }}>
                {readScore}<span style={{ fontSize: 11, color: "rgba(245,245,240,0.3)" }}>/100</span>
              </span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "#BF9953", borderRadius: 2,
                width: mounted ? `${readiness.score}%` : "0%",
                transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── TOP MATCHES ──────────────────────────────────────── */}
      <div style={{ padding: "16px 18px", borderBottom: DIV }}>
        <SectionLabel>Top Matches</SectionLabel>
        {ranked.length === 0
          ? <p style={{ fontSize: 11, color: "rgba(245,245,240,0.3)" }}>Run engine to see matches.</p>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ranked.slice(0, 6).map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/opportunities/${m.id}?project=${projectId}`}
                  className="intel-row"
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 8px", borderRadius: 7,
                    border: "0.5px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                    textDecoration: "none", transition: "background 0.15s",
                  }}
                >
                  <span style={{
                    fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "2px 5px", borderRadius: 4,
                    background: "rgba(255,255,255,0.07)", color: "rgba(245,245,240,0.4)",
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    {OPP_LABELS[m.opp_type] ?? m.opp_type}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: "#F5F5F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 1 }}>
                      {m.title}
                    </p>
                    {(m.max_award_usd || m.deadline_note || m.deadline) && (
                      <p style={{ fontSize: 9, color: "rgba(245,245,240,0.28)" }}>
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
              <Link href="/dashboard/opportunities" style={{
                fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "rgba(191,153,83,0.55)", textDecoration: "none",
                display: "inline-block", marginTop: 6,
              }}>
                View all {ranked.length} →
              </Link>
            </div>
          )}
      </div>

      {/* ── PRODUCERS & INVESTORS ─────────────────────────────── */}
      {producerMatches.length > 0 && (
        <div style={{ padding: "16px 18px", borderBottom: DIV }}>
          <SectionLabel>Producers & Investors</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {producerMatches.slice(0, 4).map((pm, i) => {
              const done = requested.has(pm.profile.id);
              const initials = pm.profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={pm.profile.id} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "9px 0",
                  borderBottom: i < Math.min(producerMatches.length, 4) - 1 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(255,255,255,0.1)", overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, color: "#F5F5F0",
                  }}>
                    {pm.profile.avatar_url
                      ? <img src={pm.profile.avatar_url} alt={pm.profile.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: "#F5F5F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pm.profile.full_name}
                      {pm.profile.company && (
                        <span style={{ color: "rgba(245,245,240,0.35)" }}> · {pm.profile.company}</span>
                      )}
                    </p>
                    <span style={{
                      fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase",
                      padding: "1px 5px", borderRadius: 100, marginTop: 2, display: "inline-block",
                      background: "rgba(191,153,83,0.12)", color: "#BF9953",
                    }}>
                      {pm.profile.role === "investor" ? "Investor" : pm.profile.role === "organization" ? "Org" : "Producer"}
                    </span>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginRight: 4 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: "#BF9953" }}><N v={pm.score} /></div>
                  </div>
                  {done
                    ? <span style={{ fontSize: 9, color: "#86efac", whiteSpace: "nowrap", flexShrink: 0 }}>✓</span>
                    : (
                      <form action={requestProducerIntroduction} style={{ flexShrink: 0 }}>
                        <input type="hidden" name="producer_user_id" value={pm.profile.id} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <button type="submit" style={{
                          fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                          padding: "4px 8px", borderRadius: 5,
                          border: "0.5px solid rgba(255,255,255,0.16)",
                          background: "transparent", color: "rgba(245,245,240,0.5)",
                          cursor: "pointer", whiteSpace: "nowrap",
                        }}>
                          Connect
                        </button>
                      </form>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DREAM SCENARIO ────────────────────────────────────── */}
      {dream && (
        <div style={{ padding: "16px 18px" }}>
          <SectionLabel>Dream Scenario</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
            {([
              ["Total funding",     usd(dream.funding_usd)],
              ["Production start",  dream.production_start],
              ["Festival premiere", dream.festival_premiere],
              ["Projected ROI",     `${dream.projected_roi}×`],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} style={{ borderRadius: 7, padding: "9px 10px", background: "rgba(255,255,255,0.04)" }}>
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
              <N v={dream.distribution_probability} d={1100} />% distribution
            </span>
          </div>
        </div>
      )}

      <style>{`.intel-row:hover { background: rgba(255,255,255,0.07) !important; }`}</style>
    </div>
  );
}
