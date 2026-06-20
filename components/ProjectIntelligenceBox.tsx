"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usd } from "@/lib/format";
import { requestProducerIntroduction } from "@/lib/actions";
import type {
  FundingDiscovery,
  FundingReadiness,
  DreamScenario,
  ProducerMatch,
} from "@/services/fylympitchEngine";
import type { MatchRow } from "@/components/MatchList";

// ── Helpers ───────────────────────────────────────────────────────────
const OPP_LABELS: Record<string, string> = {
  grant: "Grant", lab: "Lab", co_production: "Co-Pro",
  fund: "Fund", market: "Market", producer: "Producer", investor: "Investor",
};

function roleLabel(role: string): string {
  if (role === "investor")    return "Investor";
  if (role === "organization") return "Org / Fund";
  return "Producer";
}

function roleBg(role: string): string {
  if (role === "investor")    return "rgba(255,255,255,0.08)";
  return "rgba(191,153,83,0.15)";
}

function roleColor(role: string): string {
  if (role === "investor")    return "rgba(245,245,240,0.55)";
  return "#BF9953";
}

// ── CountUp hook ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 820) {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!target) return;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return count;
}

function CountUp({ value, duration }: { value: number; duration?: number }) {
  const n = useCountUp(value, duration);
  return <>{n}</>;
}


type Tab = "matches" | "producers" | "dream";

type Props = {
  discovery: FundingDiscovery;
  readiness: FundingReadiness | null;
  ranked: MatchRow[];
  producerMatches: ProducerMatch[];
  dream: DreamScenario | null;
  projectId: string;
  requestedProducerIds: string[];
};

// ── Component ─────────────────────────────────────────────────────────
export default function ProjectIntelligenceBox({
  discovery, readiness, ranked, producerMatches,
  dream, projectId, requestedProducerIds,
}: Props) {
  const [tab, setTab] = useState<Tab>("matches");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);
  const requested = new Set(requestedProducerIds);

  const tabs: { key: Tab; label: string }[] = [
    { key: "matches",   label: "Top Matches" },
    { key: "producers", label: "Producers & Investors" },
    { key: "dream",     label: "Dream Scenario" },
  ];

  return (
    <div className="rounded-card overflow-hidden mb-8" style={{ background: "#1A1815" }}>

      {/* ── HEADER ── */}
      <div className="px-7 pt-7 pb-1">
        <p style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(245,245,240,0.35)", marginBottom: 10 }}>
          PITCH.FYLYM ENGINE
        </p>
        <h2 className="font-display" style={{ fontSize: 26, lineHeight: 1.15, color: "#F5F5F0", marginBottom: 4 }}>
          Can raise{" "}
          <span style={{ color: "#BF9953" }}>{usd(discovery.total_usd)}</span>
        </h2>
        <p style={{ fontSize: 12, color: "rgba(245,245,240,0.45)", marginBottom: 18 }}>
          from {discovery.source_counts?.total ?? ranked.length} matched sources across grants, labs, co-production and investors
        </p>

        {/* Breakdown chips */}
        {(discovery.breakdown?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-3 mb-5">
            {discovery.breakdown!.slice(0, 4).map((item: any) => (
              <div key={item.label} className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="font-display" style={{ fontSize: 15, color: "#BF9953" }}>{usd(item.amount_usd)}</div>
                <div style={{ fontSize: 7.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,245,240,0.38)", marginTop: 2 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Readiness bar */}
        {readiness && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full" style={{
                width: mounted ? `${readiness.score}%` : "0%",
                background: "#BF9953",
                transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
            <span style={{ fontSize: 10, color: "rgba(245,245,240,0.4)", whiteSpace: "nowrap" }}>
              <CountUp value={readiness.score} duration={1100} />/100 funding readiness
            </span>
          </div>
        )}
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex" style={{ borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 transition-colors"
            style={{
              fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
              fontWeight: 500, padding: "11px 4px", background: "transparent",
              border: "none", cursor: "pointer",
              borderBottom: tab === key ? "2px solid #BF9953" : "2px solid transparent",
              color: tab === key ? "#F5F5F0" : "rgba(245,245,240,0.35)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div key={tab} className="fylym-fade-in px-7 py-5" style={{ minHeight: 180 }}>

        {/* TOP MATCHES */}
        {tab === "matches" && (
          ranked.length === 0
            ? <p style={{ fontSize: 13, color: "rgba(245,245,240,0.45)" }}>No matches yet — run the engine to generate your funding matches.</p>
            : <>
                <div className="space-y-2">
                  {ranked.slice(0, 6).map((m) => (
                    <Link
                      key={m.id}
                      href={`/dashboard/opportunities/${m.id}?project=${projectId}`}
                      className="group flex items-center gap-3 p-3 rounded-[10px] transition-all hover:border-white/25 hover:bg-white/[0.07]"
                      style={{
                        border: "0.5px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.04)",
                        textDecoration: "none",
                        display: "flex",
                      }}
                    >
                      {/* Type badge */}
                      <span
                        className="shrink-0 rounded-md"
                        style={{
                          fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                          padding: "3px 7px", background: "rgba(255,255,255,0.08)",
                          color: "rgba(245,245,240,0.55)", whiteSpace: "nowrap",
                        }}
                      >
                        {OPP_LABELS[m.opp_type] ?? m.opp_type}
                      </span>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate group-hover:text-gold transition-colors"
                          style={{ fontSize: 13, color: "#F5F5F0", marginBottom: 1 }}
                        >
                          {m.title}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(245,245,240,0.35)" }}>
                          {m.max_award_usd ? usd(m.max_award_usd) : ""}
                          {(m.max_award_usd && (m.deadline_note || m.deadline)) ? " · " : ""}
                          {m.deadline_note
                            ? m.deadline_note
                            : m.deadline
                            ? new Date(m.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : ""}
                        </p>
                      </div>

                      {/* Score */}
                      <div
                        className="font-display shrink-0"
                        style={{ fontSize: 18, color: "#BF9953", minWidth: 28, textAlign: "right" }}
                      >
                        <CountUp value={m.score} />
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href="/dashboard/opportunities"
                  style={{
                    fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "rgba(191,153,83,0.7)", textDecoration: "none",
                    display: "inline-block", marginTop: 14,
                  }}
                >
                  View all {ranked.length} matches →
                </Link>
              </>
        )}

        {/* PRODUCERS & INVESTORS */}
        {tab === "producers" && (
          producerMatches.length === 0
            ? <p style={{ fontSize: 13, color: "rgba(245,245,240,0.45)" }}>No producer or investor matches yet.</p>
            : <>
                {producerMatches.slice(0, 5).map((pm, i) => {
                  const alreadyRequested = requested.has(pm.profile.id);
                  const initials = pm.profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <div
                      key={pm.profile.id}
                      className="flex items-center gap-3 py-3"
                      style={{ borderBottom: i < Math.min(producerMatches.length, 5) - 1 ? "0.5px solid rgba(255,255,255,0.07)" : "none" }}
                    >
                      {/* Avatar */}
                      <div className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
                        style={{ width: 32, height: 32, background: "rgba(255,255,255,0.1)", fontSize: 11, color: "#F5F5F0" }}>
                        {pm.profile.avatar_url
                          ? <img src={pm.profile.avatar_url} alt={pm.profile.full_name} className="w-full h-full object-cover" />
                          : initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ fontSize: 13, color: "#F5F5F0" }}>
                          {pm.profile.full_name}
                          {pm.profile.company && (
                            <span style={{ color: "rgba(245,245,240,0.4)" }}> · {pm.profile.company}</span>
                          )}
                        </p>
                        <span className="inline-block mt-1" style={{
                          fontSize: 7.5, letterSpacing: "0.12em", textTransform: "uppercase",
                          padding: "2px 7px", borderRadius: 100,
                          background: roleBg(pm.profile.role), color: roleColor(pm.profile.role),
                        }}>
                          {roleLabel(pm.profile.role)}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="shrink-0 text-right mr-2">
                        <div className="font-display" style={{ fontSize: 18, color: "#BF9953" }}><CountUp value={pm.score} /></div>
                        <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(245,245,240,0.3)" }}>match</div>
                      </div>

                      {/* Action */}
                      {alreadyRequested
                        ? <span style={{ fontSize: 10, color: "#86efac", whiteSpace: "nowrap" }}>✓ Sent</span>
                        : (
                          <form action={requestProducerIntroduction}>
                            <input type="hidden" name="producer_user_id" value={pm.profile.id} />
                            <input type="hidden" name="project_id" value={projectId} />
                            <button type="submit" style={{
                              fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                              padding: "5px 10px", borderRadius: 7,
                              border: "0.5px solid rgba(255,255,255,0.2)",
                              background: "transparent", color: "rgba(245,245,240,0.6)",
                              cursor: "pointer", whiteSpace: "nowrap",
                            }}>
                              Connect →
                            </button>
                          </form>
                        )}
                    </div>
                  );
                })}
              </>
        )}

        {/* DREAM SCENARIO */}
        {tab === "dream" && (
          !dream
            ? <p style={{ fontSize: 13, color: "rgba(245,245,240,0.45)" }}>Dream scenario not yet generated. Re-run the engine to see projections.</p>
            : <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {([
                    ["Total funding",    usd(dream.funding_usd)],
                    ["Production start", dream.production_start],
                    ["Festival premiere", dream.festival_premiere],
                    ["Projected ROI",    `${dream.projected_roi}×`],
                  ] as [string, string][]).map(([label, val]) => (
                    <div key={label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="font-display mb-1" style={{ fontSize: 20, color: "#BF9953" }}>{val}</div>
                      <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,245,240,0.35)" }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-3" style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full" style={{
                      width: mounted ? `${dream.distribution_probability}%` : "0%",
                      background: "#BF9953",
                      transition: "width 1100ms cubic-bezier(0.4,0,0.2,1)",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(245,245,240,0.4)", whiteSpace: "nowrap" }}>
                    <CountUp value={dream.distribution_probability} duration={1100} />% distribution probability
                  </span>
                </div>
              </>
        )}
      </div>
    </div>
  );
}
