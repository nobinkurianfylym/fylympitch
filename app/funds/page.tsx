import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { TYPE_LABEL } from "@/lib/format";
import FundCard from "@/components/FundCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Palettes — deterministic per title hash, same family as ProjectThumbnail ──
const PALETTES = [
  { bg: "#FDF5E4", band: "#F5E8C0", tx: "#7B5E1A" },
  { bg: "#E8F3EC", band: "#C8E4D0", tx: "#2A5E3A" },
  { bg: "#FDE8E4", band: "#F5C8C0", tx: "#8A3028" },
  { bg: "#E4EEF8", band: "#C0D4F0", tx: "#1E3A82" },
  { bg: "#EEE8F8", band: "#D4C8F0", tx: "#4A2888" },
  { bg: "#FEF0D8", band: "#F5DEB0", tx: "#885010" },
  { bg: "#F8E8F0", band: "#ECC0D8", tx: "#882848" },
  { bg: "#E8F0E8", band: "#C8DCC8", tx: "#2A5040" },
  { bg: "#E0E8F4", band: "#BCC8E8", tx: "#183060" },
];

function hashTitle(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const BAND_LABEL: Record<string, string> = {
  grant:        "GRANT",
  fund:         "FUND",
  lab:          "LAB",
  co_production:"CO-PROD",
  market:       "MARKET",
  distribution: "DISTRIBUTION",
  investor:     "INVESTOR",
  broadcaster:  "BROADCASTER",
  streamer:     "STREAMING",
  sales_agent:  "SALES AGENT",
  producer:     "PRODUCER",
};

function formatDeadline(deadline: string | null, note: string | null): string {
  if (deadline) {
    const d = new Date(deadline);
    return `Closes ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (note) return note.length > 52 ? note.slice(0, 50) + "…" : note;
  return "Open — check website";
}

const TABS = [
  { label: "All Funds",    value: ""             },
  { label: "Grants",       value: "grants"       },
  { label: "Labs",         value: "lab"          },
  { label: "Co-Prod",      value: "co_production"},
  { label: "Markets",      value: "market"       },
  { label: "Producers",    value: "producer"     },
];

export default async function FundsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("opportunities")
    .select("id, title, opp_type, description, country, region, deadline, deadline_note, languages, max_award_usd, url, app_link")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(60);

  // "grants" tab covers both opp_type=grant and opp_type=fund (most funding bodies)
  if (type === "grants") {
    query = query.in("opp_type", ["grant", "fund"]);
  } else if (type && type !== "") {
    query = query.eq("opp_type", type);
  }

  const { data: opps } = await query;

  return (
    <div className="min-h-screen bg-ivory">

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/projects"  className="hover:text-ink transition-colors">Projects</Link>
            <Link href="/funds"     className="text-ink">Funds</Link>
            <Link href="/#how"      className="hover:text-ink transition-colors">How it works</Link>
            <Link href="/#pricing"  className="hover:text-ink transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login"  className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">Sign in</Link>
                <Link href="/signup" className="btn-gold !px-5 !py-2.5 text-[12px]">Join</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* Page heading */}
        <div className="mb-10">
          <p className="eyebrow mb-3">Grants · Support · Growth</p>
          <h1 className="font-display text-[38px] font-[400]">Funds</h1>
          <p className="mt-3 text-[15px] text-ash max-w-lg">
            Grants, funding programs and development initiatives from 38 countries — open for filmmakers to discover and apply.
          </p>

          {/* Filter pills — matches Projects page style */}
          <div className="mt-7 flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const isActive = (!type && tab.value === "") || type === tab.value;
              const href = tab.value ? `/funds?type=${tab.value}` : "/funds";
              return (
                <Link key={tab.value} href={href}
                  className={`text-[12px] tracking-[0.12em] uppercase rounded-full px-5 py-2.5 border transition-colors ${
                    isActive
                      ? "bg-ink text-ivory border-ink"
                      : "border-line text-ash hover:border-ink hover:text-ink"
                  }`}>
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        {(!opps || opps.length === 0) ? (
          <div className="py-24 text-center text-ash text-[15px]">
            No opportunities found{type ? " in this category" : ""}.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {opps.map((o) => {
              const p       = PALETTES[hashTitle(o.title) % PALETTES.length];
              const location = o.country || o.region || "Worldwide";
              const bandLabel = BAND_LABEL[o.opp_type] ?? o.opp_type.toUpperCase();
              const langs   = (o.languages as string[] | null) ?? [];
              const link    = (o.app_link as string | null) || (o.url as string | null) || null;

              return (
                <FundCard key={o.id} link={link}
                  className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all">

                  {/* ── Top coloured section (mirrors ProjectThumbnail) ── */}
                  <div style={{
                    background: p.bg,
                    aspectRatio: "3/2",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                  }}>
                    {/* Corner dots — top */}
                    <div style={{ position:"absolute", top:12, left:12,  width:7, height:7, borderRadius:2, background:p.band }} />
                    <div style={{ position:"absolute", top:12, right:12, width:7, height:7, borderRadius:2, background:p.band }} />
                    <p className="font-display text-[22px] font-[400] text-center leading-snug"
                      style={{ color: p.tx }}>
                      {o.title}
                    </p>
                  </div>

                  {/* ── Type band ────────────────────────────────────── */}
                  <div style={{ background: p.band, position: "relative" }}
                    className="px-4 py-3 flex items-center justify-center">
                    {/* Corner dots — bottom of band */}
                    <div style={{ position:"absolute", bottom:10, left:12,  width:7, height:7, borderRadius:2, background:p.bg }} />
                    <div style={{ position:"absolute", bottom:10, right:12, width:7, height:7, borderRadius:2, background:p.bg }} />
                    <span className="text-[10px] tracking-[0.14em] uppercase font-[600]"
                      style={{ color: p.tx }}>
                      {bandLabel}
                    </span>
                  </div>

                  {/* ── Info section ─────────────────────────────────── */}
                  <div className="p-6 flex flex-col flex-1">
                    <p className="text-[11px] tracking-[0.24em] uppercase text-ash mb-2">
                      {TYPE_LABEL[o.opp_type] ?? o.opp_type} · {location}
                    </p>
                    <h2 className="font-display text-[21px] font-[400] mb-3 group-hover:text-gold transition-colors leading-snug">
                      {o.title}
                    </h2>
                    {o.description && (
                      <p className="font-display italic text-[14px] leading-[1.55] text-ash line-clamp-3 flex-1">
                        &ldquo;{o.description}&rdquo;
                      </p>
                    )}
                    <div className="mt-4 pt-4 border-t border-line flex flex-col gap-1 text-[12px]">
                      <span className="text-ink font-[500]">
                        {formatDeadline(o.deadline, o.deadline_note)}
                      </span>
                      <span className="text-ash">
                        {location}{langs.length > 0 ? ` · ${langs[0]}` : ""}
                      </span>
                    </div>
                  </div>

                </FundCard>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer CTA ────────────────────────────────────────── */}
      {!user && (
        <div className="border-t border-line mt-16">
          <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="font-display text-[22px]">Ready to pitch your film?</p>
              <p className="mt-1 text-[14px] text-ash">Submit your project and get matched with funds, labs and co-producers.</p>
            </div>
            <Link href="/signup" className="btn-gold shrink-0">Submit your project</Link>
          </div>
        </div>
      )}

    </div>
  );
}
