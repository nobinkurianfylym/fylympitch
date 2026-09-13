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

/** Filmmakers, projects and verified producers. Fetched separately from the
 *  catalogue snapshot because RLS hides private and exclusively-pitched
 *  projects from an anonymous visitor — counting them from here would report
 *  the public subset and label it the total. The RPC (migration 076) returns
 *  integers only. */
interface Community {
  registered_filmmakers: number;
  projects_submitted:    number;
  verified_producers:    number;
}

async function fetchCommunity(): Promise<Community> {
  const empty = { registered_filmmakers: 0, projects_submitted: 0, verified_producers: 0 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("community_metrics");
    if (error) return empty;                       // migration not run yet
    const row = Array.isArray(data) ? data[0] : data;
    return {
      registered_filmmakers: row?.registered_filmmakers ?? 0,
      projects_submitted:    row?.projects_submitted    ?? 0,
      verified_producers:    row?.verified_producers    ?? 0,
    };
  } catch {
    return empty;
  }
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
  const [m, c] = await Promise.all([fetchMetrics(), fetchCommunity()]);

  // ── Band 1: what the platform tracks ──────────────────────────────────────
  const CATALOGUE = [
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

  // ── Band 2: who is on it ──────────────────────────────────────────────────
  // A zero renders as an absence, not as modesty: "0 Verified Producers" beside
  // "593 Active Opportunities" reads as a platform nobody has joined. Each tile
  // appears only once it has something to say, and the band disappears entirely
  // until then.
  const COMMUNITY = [
    {
      value: fmtCount(c.registered_filmmakers),
      label: "Filmmakers",
      sub:   "Registered on the platform",
      n:     c.registered_filmmakers,
    },
    {
      value: fmtCount(c.projects_submitted),
      label: "Projects Submitted",
      sub:   "Public and private",
      n:     c.projects_submitted,
    },
    {
      value: fmtCount(c.verified_producers),
      label: "Verified Producers",
      sub:   "Identity checked",
      n:     c.verified_producers,
    },
  ].filter((s) => s.n > 0);

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
        borderTop:    "1px solid rgba(26,24,21,0.08)",
        borderBottom: "1px solid rgba(26,24,21,0.08)",
        overflow:     "hidden",
      }}
    >
      {/* Two bands, because these are two different claims. The first is what
          the platform has catalogued; the second is who has turned up. Running
          them together in one row of eight would read as a single undifferentiated
          scoreboard and let the small numbers borrow authority from the large
          ones. A quiet label over each says which is which. */}

      <Band
        eyebrow="What we track"
        stats={CATALOGUE}
        columns={5}
        gridClass="platform-metrics-grid"
      />

      {COMMUNITY.length > 0 && (
        <Band
          eyebrow="Who's on the platform"
          stats={COMMUNITY}
          columns={COMMUNITY.length}
          gridClass="platform-community-grid"
          divider
        />
      )}

      {/* ── Updated timestamp — bottom right, unobtrusive ────── */}
      {updatedStr && (
        <div
          style={{
            display:        "flex",
            justifyContent: "flex-end",
            alignItems:     "center",
            gap:            5,
            padding:        "0 40px 10px",
            maxWidth:       1152,
            margin:         "0 auto",
          }}
        >
          <span
            style={{
              display:      "inline-block",
              width:        4,
              height:       4,
              borderRadius: "50%",
              background:   "#4ade80",
              boxShadow:    "0 0 5px rgba(74,222,128,0.7)",
              animation:    "fyp-pulse 2.4s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize:      7.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         "#8A857C",
              fontFamily:    "var(--font-body, Montserrat, sans-serif)",
            }}
          >
            Updated {updatedStr}
          </span>
        </div>
      )}

      <style>{`
        @keyframes fyp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.65); }
        }
        @media (max-width: 767px) {
          .platform-metrics-grid,
          .platform-community-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 0 20px !important;
          }
          /* Funding Tracked is the widest value in its band and the community
             band can end on an orphan — let the last tile of an odd row span. */
          .platform-metrics-grid > div:nth-child(5),
          .platform-community-grid > div:nth-child(3) {
            grid-column: 1 / -1;
            border-left: none !important;
            border-top: 1px solid rgba(26,24,21,0.07);
          }
          .platform-metrics-grid > div:nth-child(odd),
          .platform-community-grid > div:nth-child(odd) {
            border-left: none !important;
          }
        }
      `}</style>
    </section>
  );
}

// ─── Band ──────────────────────────────────────────────────────────────────

function Band({
  eyebrow,
  stats,
  columns,
  gridClass,
  divider = false,
}: {
  eyebrow: string;
  stats: { value: string; label: string; sub: string }[];
  columns: number;
  gridClass: string;
  divider?: boolean;
}) {
  return (
    <div style={divider ? { borderTop: "1px solid rgba(26,24,21,0.07)" } : undefined}>
      <div
        style={{
          maxWidth: 1152,
          margin: "0 auto",
          padding: divider ? "22px 32px 0" : "24px 32px 0",
        }}
      >
        <p
          style={{
            fontSize: 9,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: "#8A857C",
            fontFamily: "var(--font-body, Montserrat, sans-serif)",
            fontWeight: 500,
            textAlign: "center",
            margin: 0,
          }}
        >
          {eyebrow}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          maxWidth: 1152,
          margin: "0 auto",
          padding: "0 32px",
        }}
        className={gridClass}
      >
        {stats.map(({ value, label, sub }, i) => (
          <div
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "18px 16px 26px",
              borderLeft: i > 0 ? "1px solid rgba(26,24,21,0.07)" : undefined,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)",
                fontSize: "clamp(30px, 3.6vw, 52px)",
                fontWeight: 700,
                color: "#1A1815",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
                marginBottom: 10,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#BF9953",
                fontWeight: 600,
                fontFamily: "var(--font-body, Montserrat, sans-serif)",
                marginBottom: 5,
                lineHeight: 1.4,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 8,
                letterSpacing: "0.08em",
                color: "#8A857C",
                fontFamily: "var(--font-body, Montserrat, sans-serif)",
                lineHeight: 1.4,
              }}
            >
              {sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
