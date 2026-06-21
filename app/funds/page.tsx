import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { TYPE_LABEL } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Film Funds, Grants & Opportunities — PITCH.FYLYM",
  description:
    "Discover 180+ film grants, labs, funds, co-productions, sales agents, distributors, tax incentives and investors from 38+ countries. Find the right financing for your independent film.",
  openGraph: {
    title: "Film Funds, Grants & Opportunities — PITCH.FYLYM",
    description:
      "Discover 180+ film grants, labs, funds, co-productions, sales agents, distributors, tax incentives and investors from 38+ countries.",
    url: "https://pitch.fylym.com/funds",
    siteName: "PITCH.FYLYM",
    type: "website",
  },
  alternates: {
    canonical: "https://pitch.fylym.com/funds",
  },
};

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
  grant:              "GRANT",
  fund:               "FUND",
  lab:                "LAB",
  co_production:      "CO-PROD",
  market:             "MARKET",
  distribution:       "DISTRIBUTION",
  investor:           "INVESTOR",
  broadcaster:        "BROADCASTER",
  streamer:           "STREAMING",
  sales_agent:        "SALES AGENT",
  producer:           "PRODUCER",
  production_company: "PRODUCTION CO",
  studio:             "STUDIO",
  brand_integration:  "BRAND",
  crowdfunding:       "CROWDFUNDING",
  sponsor:            "SPONSOR",
  pre_sale:           "PRE-SALE",
  tax_incentive:      "TAX INCENTIVE",
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
  { label: "All",                  value: ""                   },
  { label: "Development",          value: "development"        },
  { label: "Early Financing",      value: "early_financing"    },
  { label: "Production",           value: "production"         },
  { label: "Private Financing",    value: "private_financing"  },
  { label: "Packaging & Markets",  value: "packaging_markets"  },
  { label: "Buyers & Sales",       value: "buyers_sales"       },
  { label: "Release & Distribution", value: "release_distribution" },
  { label: "Tax Incentives",       value: "tax_incentives"     },
];

export default async function FundsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type, q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dashboardHref = "/dashboard";
  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if ((me as any)?.role === "producer") dashboardHref = "/producer";
  }
  const dashboardLabel = dashboardHref === "/producer" ? "Producer Studio" : "Dashboard";

  // Map category key → opp_type values
  const CATEGORY_TYPES: Record<string, string[]> = {
    development:          ["lab", "grant", "fund"],
    early_financing:      ["crowdfunding"],
    production:           ["producer", "production_company", "studio"],
    private_financing:    ["investor", "sponsor", "brand_integration"],
    packaging_markets:    ["co_production", "market"],
    buyers_sales:         ["broadcaster", "streamer", "pre_sale", "sales_agent"],
    release_distribution: ["distribution"],
    tax_incentives:       ["tax_incentive"],
  };

  let query = supabase
    .from("opportunities")
    .select("id, slug, title, opp_type, description, country, region, deadline, deadline_note, languages, url, app_link")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (type && CATEGORY_TYPES[type]) {
    query = query.in("opp_type", CATEGORY_TYPES[type]);
  }
  if (q?.trim()) query = (query as any).or(`title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);

  const { data: opps } = await query;

  return (
    <div className="min-h-screen bg-ivory">

      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/projects"  className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/funds"     className="text-ink">Opportunities</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={dashboardHref} className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
                {dashboardLabel}
              </Link>
            ) : (
              <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="eyebrow mb-3">Grants · Support · Growth</p>
          <h1 className="font-display text-[38px] font-[400]">Opportunities</h1>
          <p className="mt-3 text-[15px] text-ash max-w-lg">
            Grants, funding programs and development initiatives from 38 countries — open for filmmakers to discover and apply.
          </p>
          <div className="mt-7 flex flex-wrap gap-2 items-center">
            {TABS.map((tab) => {
              const isActive = (!type && tab.value === "") || type === tab.value;
              const href = tab.value
                ? `/funds?type=${tab.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`
                : `/funds${q ? `?q=${encodeURIComponent(q)}` : ""}`;
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
            {/* Search bar — right side */}
            <div className="ml-auto">
              <SearchInput placeholder="Search funds…" basePath="/funds" />
            </div>
          </div>
          {q && (
            <p className="mt-4 text-[13px] text-ash">
              {opps?.length ?? 0} result{opps?.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
            </p>
          )}
        </div>

        {(!opps || opps.length === 0) ? (
          <div className="py-24 text-center text-ash text-[15px]">
            {q ? `No funds found for "${q}".` : `No opportunities found${type ? " in this category" : ""}.`}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(opps as any[]).map((o) => {
              const p         = PALETTES[hashTitle(o.title) % PALETTES.length];
              const location  = o.country || o.region || "Worldwide";
              const bandLabel = BAND_LABEL[o.opp_type] ?? (o.opp_type as string).toUpperCase();
              const langs     = (o.languages as string[] | null) ?? [];
              const link      = (o.app_link as string | null) || (o.url as string | null) || undefined;

              return (
                <Link key={o.id}
                  href={`/funds/${(o as any).slug}`}
                  className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all"
                  style={{ textDecoration: "none", color: "inherit" }}>

                  <div style={{
                    background: p.bg, aspectRatio: "3/2",
                    position: "relative", display: "flex",
                    alignItems: "center", justifyContent: "center", padding: "24px",
                  }}>
                    <div style={{ position:"absolute", top:12,   left:12,  width:7, height:7, borderRadius:2, background:p.band }} />
                    <div style={{ position:"absolute", top:12,   right:12, width:7, height:7, borderRadius:2, background:p.band }} />
                    <p className="font-display text-[22px] font-[400] text-center leading-snug" style={{ color: p.tx }}>
                      {o.title}
                    </p>
                  </div>

                  <div style={{ background: p.band, position: "relative" }}
                    className="px-4 py-3 flex items-center justify-center">
                    <div style={{ position:"absolute", bottom:10, left:12,  width:7, height:7, borderRadius:2, background:p.bg }} />
                    <div style={{ position:"absolute", bottom:10, right:12, width:7, height:7, borderRadius:2, background:p.bg }} />
                    <span className="text-[10px] tracking-[0.14em] uppercase font-[600]" style={{ color: p.tx }}>
                      {bandLabel}
                    </span>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <p className="text-[11px] tracking-[0.24em] uppercase text-ash mb-2">
                      {TYPE_LABEL[o.opp_type as string] ?? o.opp_type} · {location}
                    </p>
                    <h2 className="font-display text-[24px] font-[400] mb-3 group-hover:text-gold transition-colors leading-snug">
                      {o.title}
                    </h2>
                    {o.description && (
                      <p className="font-display italic text-[14px] leading-[1.55] text-ash line-clamp-3 flex-1">
                        &ldquo;{o.description as string}&rdquo;
                      </p>
                    )}
                    <div className="mt-4 pt-4 border-t border-line flex flex-col gap-1 text-[12px]">
                      <span className="text-ink font-[500]">
                        {formatDeadline(o.deadline as string | null, o.deadline_note as string | null)}
                      </span>
                      <span className="text-ash">
                        {location}{langs.length > 0 ? ` · ${langs[0]}` : ""}
                      </span>
                    </div>
                  </div>

                </Link>
              );
            })}
          </div>
        )}
      </main>

      {!user && (
        <div className="border-t border-line mt-16">
          <div className="max-w-[1180px] mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
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
