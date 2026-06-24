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

const BAND_LABEL: Record<string, string> = {
  // Development
  lab:                   "LAB",
  residency:             "RESIDENCY",
  mentorship:            "MENTORSHIP",
  grant:                 "GRANT",
  fund:                  "FUND",
  writing_fellowship:    "FELLOWSHIP",
  // Packaging & Markets
  pitch_forum:           "PITCH FORUM",
  co_production:         "CO-PROD",
  market:                "MARKET",
  // Early Financing
  crowdfunding:          "CROWDFUNDING",
  donation:              "DONATION",
  fiscal_sponsorship:    "FISCAL SPONSOR",
  seed_funding:          "SEED FUNDING",
  community_funding:     "COMMUNITY",
  // Tax Incentives
  tax_incentive:         "TAX CREDIT",
  cash_rebate:           "CASH REBATE",
  production_rebate:     "PROD REBATE",
  regional_incentive:    "REGIONAL",
  location_incentive:    "LOCATION",
  // Private Financing
  investor:              "EQUITY",
  angel_investor:        "ANGEL",
  venture_capital:       "VENTURE",
  gap_financing:         "GAP",
  brand_integration:     "BRAND",
  product_placement:     "PRODUCT",
  sponsor:               "SPONSOR",
  private_fund:          "PRIVATE FUND",
  // Production
  producer:              "PRODUCER",
  co_producer:           "CO-PRODUCER",
  production_company:    "PRODUCTION CO",
  studio:                "STUDIO",
  // Post Production
  post_production_grant: "POST GRANT",
  post_production_fund:  "POST FUND",
  finishing_fund:        "FINISHING FUND",
  // Buyers & Sales
  sales_agent:           "SALES AGENT",
  world_sales:           "WORLD SALES",
  broadcaster:           "BROADCASTER",
  streamer:              "STREAMING",
  pre_sale:              "PRE-SALE",
  content_buyer:         "CONTENT BUYER",
  music_rights:          "MUSIC RIGHTS",
  // Release & Distribution
  film_festival:            "FESTIVAL",
  distribution:             "DISTRIBUTION",
  theatrical_distribution:  "THEATRICAL",
  ott_distribution:         "OTT",
  tv_distribution:          "TV",
  digital_aggregator:       "DIGITAL",
  educational_distribution: "EDUCATIONAL",
  airline_distribution:     "AIRLINE",
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
  { label: "All",              value: ""                },
  { label: "Development",      value: "development"     },
  { label: "Production",       value: "production"      },
  { label: "Post Production",  value: "post_production" },
  { label: "Buyers",           value: "buyers"          },
  { label: "Distribution",     value: "distribution"    },
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
    development:     ["lab", "residency", "mentorship", "grant", "fund", "writing_fellowship"],
    production:      ["pitch_forum", "co_production", "market", "crowdfunding", "donation",
                      "fiscal_sponsorship", "seed_funding", "community_funding",
                      "tax_incentive", "cash_rebate", "production_rebate", "regional_incentive",
                      "location_incentive", "investor", "angel_investor", "venture_capital",
                      "gap_financing", "brand_integration", "product_placement", "sponsor",
                      "private_fund", "producer", "co_producer", "production_company", "studio"],
    post_production: ["post_production_grant", "post_production_fund", "finishing_fund"],
    buyers:          ["sales_agent", "world_sales", "broadcaster", "streamer", "pre_sale", "content_buyer", "music_rights"],
    distribution:    ["film_festival", "distribution", "theatrical_distribution", "ott_distribution",
                      "tv_distribution", "digital_aggregator", "educational_distribution", "airline_distribution"],
  };

  let query = supabase
    .from("opportunities")
    .select("id, slug, title, opp_type, description, country, region, deadline, deadline_note, languages, url, app_link")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(user ? 500 : 100);

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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(opps as any[]).map((o) => {
              const location  = o.country || o.region || "Worldwide";
              const bandLabel = BAND_LABEL[o.opp_type] ?? (o.opp_type as string).toUpperCase();
              const langs     = (o.languages as string[] | null) ?? [];
              const deadline  = formatDeadline(o.deadline as string | null, o.deadline_note as string | null);
              const isClosing = o.deadline && (new Date(o.deadline).getTime() - Date.now()) < 30 * 86400000;

              return (
                <Link key={o.id}
                  href={`/funds/${(o as any).slug}`}
                  className="group flex flex-col bg-white border border-line rounded-[14px] overflow-hidden hover:border-gold/50 hover:shadow-sm transition-all no-underline"
                  style={{ textDecoration: "none", color: "inherit" }}>

                  <div className="p-6 flex flex-col flex-1">
                    {/* Type pill */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] tracking-[0.18em] uppercase font-semibold bg-ink text-ivory">
                        {bandLabel}
                      </span>
                      {isClosing && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] tracking-[0.12em] uppercase font-semibold border border-gold/40 text-gold">
                          Closing soon
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="font-display text-[20px] font-[600] leading-[1.2] text-ink mb-2 group-hover:text-gold transition-colors">
                      {o.title}
                    </h2>

                    {/* Location */}
                    <p className="text-[11px] tracking-[0.1em] uppercase text-ash/60 mb-3">
                      {location}{langs.length > 0 ? ` · ${langs[0]}` : ""}
                    </p>

                    {/* Description */}
                    {o.description && (
                      <p className="text-[13px] leading-[1.65] text-ash line-clamp-2 flex-1">
                        {o.description as string}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-2">
                      <span className={`text-[12px] font-medium ${isClosing ? "text-gold" : "text-ink/70"}`}>
                        {deadline}
                      </span>
                      <span className="text-[10px] tracking-[0.1em] uppercase text-ash/40 group-hover:text-gold transition-colors">
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Submit opportunity — always visible */}
        <div className="mt-12 text-center">
          <Link
            href="/funds/submit"
            className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-ink transition-colors border-b border-ash/30 hover:border-ink pb-0.5"
          >
            + Submit an opportunity
          </Link>
        </div>

        {/* Guest gate — shown after 100 results */}
        {!user && opps && opps.length >= 100 && (
          <div className="mt-16 py-14 px-8 border border-line rounded-card text-center bg-white/60">
            <p className="font-display text-[26px] font-[400] text-ink leading-snug">
              Every great film starts with the right discovery.
            </p>
            <div className="mt-6">
              <Link
                href="https://pitch.fylym.com/signup"
                className="btn-gold !px-8 !py-3 !text-[13px] tracking-[0.18em]"
              >
                Get started
              </Link>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
