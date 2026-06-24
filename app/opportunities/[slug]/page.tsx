import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import { usd, TYPE_LABEL, STAGE_LABEL } from "@/lib/format";
import type { Opportunity } from "@/types";

export const revalidate = 3600; // ISR — re-generate at most once per hour

type Props = { params: Promise<{ slug: string }> };

// ── SEO metadata ──────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("opportunities")
    .select("title, opp_type, description, country, region, deadline, max_award_usd")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<Pick<Opportunity, "title" | "opp_type" | "description" | "country" | "region" | "deadline" | "max_award_usd">>();

  if (!opp) return { title: "Fund Not Found — PITCH.FYLYM" };

  const typeLabel   = TYPE_LABEL[opp.opp_type] ?? opp.opp_type;
  const location    = opp.country || opp.region || "International";
  const award       = opp.max_award_usd ? ` · Up to ${usd(opp.max_award_usd)}` : "";
  const description = opp.description
    ? opp.description.slice(0, 155) + (opp.description.length > 155 ? "…" : "")
    : `${opp.title} is a ${typeLabel.toLowerCase()} opportunity for independent filmmakers based in ${location}. Discover eligibility, deadlines and apply through PITCH.FYLYM.`;

  const title = `${opp.title} — ${typeLabel} · ${location}${award} | PITCH.FYLYM`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://pitch.fylym.com/funds/${slug}`,
      siteName: "PITCH.FYLYM",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `https://pitch.fylym.com/funds/${slug}`,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function FundDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase  = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<Opportunity & { slug: string; key_person?: string | null; contact_email?: string | null; gender_focus?: string | null; copro_required?: boolean; festival_affiliated?: boolean; ott_affiliated?: boolean; deadline_note?: string | null; app_link?: string | null }>();

  if (!opp) notFound();

  // Role-aware dashboard link
  let dashboardHref = "/dashboard";
  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if ((me as any)?.role === "producer") dashboardHref = "/producerstudio";
  }

  const typeLabel  = TYPE_LABEL[opp.opp_type] ?? opp.opp_type;
  const location   = [opp.country, opp.region].filter(Boolean).join(" · ") || "Worldwide";
  const officialLink = opp.app_link ?? opp.url ?? null;

  function formatDeadline(d: string | null, note: string | null): string {
    if (d) {
      return new Date(d).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
    }
    return note || "Check official website";
  }

  const tags: { label: string; value: string }[] = [
    ...(opp.genres?.length       ? [{ label: "Genres",    value: opp.genres.join(", ") }]                               : []),
    ...(opp.formats?.length      ? [{ label: "Formats",   value: opp.formats.map((f: string) => f.charAt(0).toUpperCase() + f.slice(1)).join(", ") }] : []),
    ...(opp.stages?.length       ? [{ label: "Stages",    value: opp.stages.map((s: string) => STAGE_LABEL[s] ?? s).join(", ") }] : []),
    ...(opp.languages?.length    ? [{ label: "Languages", value: opp.languages.join(", ") }]                            : []),
    ...(opp.gender_focus         ? [{ label: "Focus",     value: opp.gender_focus }]                                    : []),
    ...(opp.copro_required       ? [{ label: "Co-production", value: "Required" }]                                      : []),
    ...(opp.festival_affiliated  ? [{ label: "Festival",  value: "Affiliated" }]                                        : []),
    ...(opp.ott_affiliated       ? [{ label: "Platform",  value: "OTT / Streaming" }]                                   : []),
  ];

  // ── JSON-LD structured data ───────────────────────────────────────────────
  const BASE = "https://pitch.fylym.com";
  const pageUrl = `${BASE}/funds/${(opp as any).slug}`;

  // BreadcrumbList — always present
  const breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Funds", "item": `${BASE}/funds` },
      { "@type": "ListItem", "position": 2, "name": opp.title, "item": pageUrl },
    ],
  };

  // Main entity — type-aware
  const GRANT_TYPES = new Set(["grant", "fund", "lab"]);
  const TAX_TYPES   = new Set(["tax_incentive"]);

  let mainEntity: Record<string, any>;

  if (GRANT_TYPES.has(opp.opp_type)) {
    mainEntity = {
      "@type": "Grant",
      "name": opp.title,
      ...(opp.description && { "description": opp.description }),
      "url": pageUrl,
      ...(officialLink && { "sameAs": [officialLink] }),
      "funder": { "@type": "Organization", "name": opp.title },
      ...(opp.max_award_usd && {
        "fundingAmount": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "maxValue": opp.max_award_usd,
        },
      }),
      ...(opp.deadline && { "endDate": opp.deadline }),
      ...((opp.country || opp.region) && {
        "areaServed": { "@type": "Place", "name": opp.country || opp.region },
      }),
    };
  } else if (TAX_TYPES.has(opp.opp_type)) {
    mainEntity = {
      "@type": "GovernmentService",
      "name": opp.title,
      ...(opp.description && { "description": opp.description }),
      "url": officialLink ?? pageUrl,
      ...(opp.country && {
        "areaServed": { "@type": "Country", "name": opp.country },
        "provider": { "@type": "GovernmentOrganization", "addressCountry": opp.country },
      }),
      ...(opp.region && !opp.country && {
        "areaServed": { "@type": "Place", "name": opp.region },
      }),
    };
  } else {
    // Organization — production companies, studios, distributors, sales agents,
    // investors, broadcasters, streamers, crowdfunding platforms, etc.
    mainEntity = {
      "@type": "Organization",
      "name": opp.title,
      ...(opp.description && { "description": opp.description }),
      "url": officialLink ?? pageUrl,
      ...(officialLink && { "sameAs": [officialLink] }),
      ...((opp as any).contact_email && { "email": (opp as any).contact_email }),
      ...((opp as any).contact_phone && { "telephone": (opp as any).contact_phone }),
      ...((opp as any).key_person && {
        "employee": { "@type": "Person", "name": (opp as any).key_person },
      }),
      ...(opp.country && {
        "address": { "@type": "PostalAddress", "addressCountry": opp.country },
      }),
    };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [breadcrumb, mainEntity],
  };

  return (
    <div className="min-h-screen bg-ivory">

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features"  className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/filmprojects"   className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/opportunities"      className="text-ink">Opportunities</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={dashboardHref} className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
                {dashboardHref === "/producerstudio" ? "Producer Studio" : "Dashboard"}
              </Link>
            ) : (
              <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-6 py-14">

        {/* Breadcrumb */}
        <Link
          href="/opportunities"
          className="text-[11px] tracking-[0.18em] uppercase text-ash hover:text-ink transition-colors"
        >
          ← All funds
        </Link>

        {/* Hero */}
        <div className="mt-8 pb-10 border-b border-line">
          <p className="eyebrow mb-4">{typeLabel} · {location}</p>
          <h1 className="font-display text-[46px] md:text-[58px] font-[400] leading-[1.1] text-ink">
            {opp.title}
          </h1>

          {/* Key facts strip */}
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {opp.max_award_usd != null && (
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Award</p>
                <p className="font-display text-[20px] text-gold">Up to {usd(opp.max_award_usd)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Deadline</p>
              <p className="font-display text-[20px] text-ink">
                {formatDeadline(opp.deadline, opp.deadline_note ?? null)}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Location</p>
              <p className="font-display text-[20px] text-ink">{location}</p>
            </div>
            {(opp.min_budget_usd != null || opp.max_budget_usd != null) && (
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Budget range</p>
                <p className="font-display text-[20px] text-ink">
                  {opp.min_budget_usd != null && opp.max_budget_usd != null
                    ? `${usd(opp.min_budget_usd)} – ${usd(opp.max_budget_usd)}`
                    : opp.min_budget_usd != null
                    ? `From ${usd(opp.min_budget_usd)}`
                    : `Up to ${usd(opp.max_budget_usd!)}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {opp.description && (
          <div className="mt-10 pb-10 border-b border-line">
            <p className="font-display text-[22px] leading-[1.7] text-ink">
              {opp.description}
            </p>
          </div>
        )}

        {/* Eligibility & details grid */}
        {tags.length > 0 && (
          <div className="mt-10 pb-10 border-b border-line">
            <p className="eyebrow mb-6">Eligibility & details</p>
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-5">
              {tags.map((t) => (
                <div key={t.label}>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">{t.label}</p>
                  <p className="text-[15px] text-ink">{t.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key person */}
        {opp.key_person && (
          <div className="mt-10 pb-10 border-b border-line">
            <p className="eyebrow mb-3">Key contact</p>
            <p className="text-[17px] text-ink">{opp.key_person}</p>
            {opp.contact_email && (
              <a
                href={`mailto:${opp.contact_email}`}
                className="mt-1 text-[14px] text-ash hover:text-gold transition-colors inline-block"
              >
                {opp.contact_email}
              </a>
            )}
          </div>
        )}

        {/* PITCH.FYLYM CTA */}
        <div className="mt-12 card p-8">
          <p className="eyebrow mb-3">Apply through PITCH.FYLYM</p>
          <h2 className="font-display text-[24px] font-[400] mb-2">
            Is {opp.title} right for your film?
          </h2>
          <p className="text-[14px] text-ash mb-6 max-w-md">
            Submit your project and the PITCH.FYLYM engine scores your match against
            {` ${opp.title}`} and hundreds of other funds, labs and co-producers worldwide.
          </p>
          {user ? (
            <Link href="/dashboard" className="btn-gold">
              Go to your dashboard →
            </Link>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="btn-gold">Submit your project</Link>
              <Link href="/login" className="btn-ghost">Sign in</Link>
            </div>
          )}
        </div>

        {/* Official website — bottom anchor */}
        {officialLink && (
          <div className="mt-10 pt-10 border-t border-line flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] uppercase text-ash mb-1">Official website</p>
              <p className="text-[13px] text-ash">{officialLink.replace(/^https?:\/\//, "").split("/")[0]}</p>
            </div>
            <a
              href={officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Visit {opp.title} ↗
            </a>
          </div>
        )}

      </main>

      {/* Footer signal */}
      <div className="border-t border-line mt-16">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <Wordmark />
          <p className="text-[12px] text-ash">
            The intelligence layer for cinema.
          </p>
          <Link href="/opportunities" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
            Browse all funds →
          </Link>
        </div>
      </div>

    </div>
  );
}
