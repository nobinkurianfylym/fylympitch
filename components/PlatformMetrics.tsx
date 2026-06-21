// components/PlatformMetrics.tsx
// Server component — reads daily snapshot from platform_metrics table.
// Falls back to live aggregate queries if no snapshot exists yet.
// Rendered above IntelligenceTicker on the homepage.

import { createClient } from "@/lib/supabase/server";

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 10_000)    return `${Math.round(n / 1_000)}K+`;
  if (n >= 1_000)     return n.toLocaleString("en-US");
  return n.toString();
}

function fmtMoney(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B+`;
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(0)}M+`;
  if (usd >= 1_000)         return `$${(usd / 1_000).toFixed(0)}K+`;
  return `$${usd}`;
}

// ─── Data ──────────────────────────────────────────────────────────────────

interface Metrics {
  active_opportunities:     number;
  partner_organizations:    number;
  festivals:                number;
  markets:                  number;
  funding_tracked_usd:      number;
  computed_at:              string | null;
}

const FALLBACK: Metrics = {
  active_opportunities:  0,
  partner_organizations: 0,
  festivals:             0,
  markets:               0,
  funding_tracked_usd:   0,
  computed_at:           null,
};

async function fetchMetrics(): Promise<Metrics> {
  try {
    const supabase = await createClient();

    // Try latest snapshot first (fast single-row read)
    const { data: snap, error } = await supabase
      .from("platform_metrics")
      .select(
        "active_opportunities, partner_organizations, festivals, markets, funding_tracked_usd, computed_at"
      )
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && snap) {
      return snap as Metrics;
    }

    // No snapshot yet — run live aggregates as fallback
    const [opps, orgs, fests, mkts, fundingResult] = await Promise.all([
      supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("funding_sources")
        .select("id", { count: "exact", head: true })
        .eq("crawl_active", true),
      supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("festival_affiliated", true),
      supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("opp_type", "market"),
      supabase
        .from("opportunities")
        .select("max_award_usd")
        .eq("is_active", true)
        .not("max_award_usd", "is", null),
    ]);

    const totalFunding = (fundingResult.data ?? []).reduce(
      (s: number, r: any) => s + (r.max_award_usd ?? 0),
      0
    );

    return {
      active_opportunities:  opps.count   ?? 0,
      partner_organizations: orgs.count   ?? 0,
      festivals:             fests.count  ?? 0,
      markets:               mkts.count   ?? 0,
      funding_tracked_usd:   totalFunding,
      computed_at:           null,
    };
  } catch {
    return FALLBACK;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default async function PlatformMetrics() {
  const m = await fetchMetrics();

  const STATS = [
    {
      value: fmtCount(m.active_opportunities),
      label: "Active Opportunities",
      sub:   "Grants · Funds · Labs · Co-pros",
    },
    {
      value: fmtCount(m.partner_organizations),
      label: "Partner Organisations",
      sub:   "Verified global partners",
    },
    {
      value: fmtCount(m.festivals),
      label: "Festivals",
      sub:   "Currently tracked",
    },
    {
      value: fmtCount(m.markets),
      label: "Markets",
      sub:   "Co-production & pitch",
    },
    {
      value: fmtMoney(m.funding_tracked_usd),
      label: "Funding Tracked",
      sub:   "Across all active opportunities",
    },
  ];

  // Formatted update timestamp
  const updatedStr = m.computed_at
    ? new Date(m.computed_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <section
      aria-label="Platform metrics"
      style={{
        background:   "var(--color-ink, #1A1815)",
        borderBottom: "1px solid rgba(191,153,83,0.18)",
        overflow:     "hidden",
      }}
    >
      {/* ── Header row ───────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "14px 40px 0",
          flexWrap:       "wrap",
          gap:            8,
        }}
      >
        <span
          style={{
            fontSize:      9,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color:         "#BF9953",
            fontWeight:    600,
            fontFamily:    "var(--font-body, Montserrat, sans-serif)",
          }}
        >
          Platform Intelligence
        </span>

        <span
          style={{
            display:       "flex",
            alignItems:    "center",
            gap:           6,
            fontSize:      8.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color:         "rgba(255,255,255,0.28)",
            fontFamily:    "var(--font-body, Montserrat, sans-serif)",
          }}
        >
          {/* Pulse dot */}
          <span
            style={{
              display:      "inline-block",
              width:        5,
              height:       5,
              borderRadius: "50%",
              background:   "#4ade80",
              boxShadow:    "0 0 6px rgba(74,222,128,0.8)",
              animation:    "fyp-pulse 2.4s ease-in-out infinite",
            }}
          />
          {updatedStr ? `Updated ${updatedStr}` : "Live"}
        </span>
      </div>

      {/* ── Metrics grid ─────────────────────────────────────── */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          padding:             "16px 32px 22px",
          gap:                 0,
        }}
        className="platform-metrics-grid"
      >
        {STATS.map(({ value, label, sub }, i) => (
          <div
            key={label}
            style={{
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              textAlign:     "center",
              padding:       "8px 12px 6px",
              borderLeft:    i > 0
                ? "1px solid rgba(191,153,83,0.14)"
                : undefined,
            }}
          >
            {/* Big number */}
            <div
              style={{
                fontFamily:        "var(--font-display, 'Playfair Display', Georgia, serif)",
                fontSize:          "clamp(28px, 3.8vw, 52px)",
                fontWeight:        700,
                color:             "#F5F5F0",
                lineHeight:        1,
                letterSpacing:     "-0.01em",
                fontVariantNumeric:"tabular-nums",
                marginBottom:      8,
              }}
            >
              {value}
            </div>

            {/* Label */}
            <div
              style={{
                fontSize:      10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         "#BF9953",
                fontWeight:    600,
                fontFamily:    "var(--font-body, Montserrat, sans-serif)",
                marginBottom:  4,
                lineHeight:    1.3,
              }}
            >
              {label}
            </div>

            {/* Sub-label */}
            <div
              style={{
                fontSize:      8.5,
                letterSpacing: "0.1em",
                color:         "rgba(255,255,255,0.25)",
                fontFamily:    "var(--font-body, Montserrat, sans-serif)",
                lineHeight:    1.4,
              }}
            >
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Keyframes injected inline (no CSS file needed) ────── */}
      <style>{`
        @keyframes fyp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(0.7); }
        }
        @media (max-width: 767px) {
          .platform-metrics-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 12px 20px 18px !important;
          }
          .platform-metrics-grid > div:nth-child(5) {
            grid-column: 1 / -1;
            border-left: none !important;
            border-top: 1px solid rgba(191,153,83,0.14);
            padding-top: 14px !important;
          }
        }
      `}</style>
    </section>
  );
}
