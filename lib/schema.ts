// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD builders. Every builder emits ONLY fields backed by real data — the
// honest-data rule applied to structured markup. Schema must always mirror the
// visible content, so anything omitted on the page is omitted here too.
// ─────────────────────────────────────────────────────────────────────────────

import { SITE, absoluteUrl, type OpportunityLike } from "@/lib/seo";
import { TYPE_LABEL } from "@/lib/format";

type Json = Record<string, unknown>;

/** Strip null/undefined/empty values so we never emit hollow properties. */
function clean<T extends Json>(obj: T): T {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

// ── Site-level entities ──────────────────────────────────────────────────────

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.host,
    logo: `${SITE.host}/logos/fylym-mark.png`,
    description:
      "PITCH.FYLYM is a verified directory and matching platform connecting filmmakers with film grants, funds, producers, co-productions, labs, markets, investors and tax incentives worldwide.",
    sameAs: [] as string[],
  };
}

export function websiteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.host,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.host}/opportunities?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function faqPageSchema(faqs: { question: string; answer: string }[]): Json | null {
  const valid = faqs.filter((f) => f.question?.trim() && f.answer?.trim());
  if (valid.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: valid.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function itemListSchema(
  items: { name: string; path: string }[],
  listName?: string,
): Json {
  return clean({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.path),
    })),
  });
}

// ── Opportunity → MonetaryGrant | GovernmentService | Event | Organization ────
//
// One record page, many funding shapes. Map each opp_type family to the most
// accurate schema.org type. Fields are only emitted when backed by real data.

const EVENT_TYPES = new Set([
  "lab",
  "residency",
  "mentorship",
  "pitch_forum",
  "co_production",
  "market",
]);

const TAX_TYPES = new Set([
  "tax_incentive",
  "cash_rebate",
  "production_rebate",
  "regional_incentive",
  "location_incentive",
]);

// Named-entity families that are organizations rather than money programmes.
const ORG_TYPES = new Set([
  "sales_agent",
  "distributor",
  "broadcaster",
  "streamer",
  "production_company",
]);

function monetaryAmount(opp: OpportunityLike): Json | undefined {
  if (opp.max_award_usd == null && opp.min_award_usd == null) return undefined;
  return clean({
    "@type": "MonetaryAmount",
    currency: "USD",
    minValue: opp.min_award_usd ?? undefined,
    maxValue: opp.max_award_usd ?? undefined,
  });
}

function funder(opp: OpportunityLike): Json | undefined {
  // Only attribute a funder when we actually have the funding organisation's
  // name. Never fall back to the programme title (that misstates the entity).
  if (!opp.organization_name) return undefined;
  return { "@type": "Organization", name: opp.organization_name };
}

function place(opp: OpportunityLike): Json | undefined {
  const name = [opp.region, opp.country].filter(Boolean).join(", ");
  return name ? { "@type": "Place", name } : undefined;
}

/**
 * Build the primary JSON-LD for an opportunity record page. Returns null when
 * the record lacks a slug/title (so we never emit a schema pointing nowhere).
 */
export function opportunitySchema(
  opp: OpportunityLike & {
    url?: string | null;
    app_link?: string | null;
    key_person?: string | null;
    contact_email?: string | null;
  },
): Json | null {
  if (!opp.slug || !opp.title) return null;
  const pageUrl = absoluteUrl(`/opportunities/${opp.slug}`);
  const official = opp.app_link || opp.url || null;
  const t = opp.opp_type ?? "";

  // Tax incentives / rebates → GovernmentService
  if (TAX_TYPES.has(t)) {
    return clean({
      "@context": "https://schema.org",
      "@type": "GovernmentService",
      name: opp.title,
      description: opp.description ?? undefined,
      url: official ?? pageUrl,
      areaServed: opp.country
        ? { "@type": "Country", name: opp.country }
        : place(opp),
      provider: opp.organization_name
        ? { "@type": "GovernmentOrganization", name: opp.organization_name }
        : undefined,
    });
  }

  // Labs / residencies / markets / forums → Event
  if (EVENT_TYPES.has(t)) {
    return clean({
      "@context": "https://schema.org",
      "@type": "Event",
      name: opp.title,
      description: opp.description ?? undefined,
      url: pageUrl,
      location: place(opp),
      organizer: funder(opp),
      sameAs: official ? [official] : undefined,
    });
  }

  // Named entities (sales agents, distributors, broadcasters, streamers) → Organization
  if (ORG_TYPES.has(t)) {
    return clean({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: opp.title,
      description: opp.description ?? undefined,
      url: official ?? pageUrl,
      sameAs: official ? [official] : undefined,
      email: opp.contact_email ?? undefined,
      address: opp.country
        ? { "@type": "PostalAddress", addressCountry: opp.country }
        : undefined,
    });
  }

  // Everything else (grants, funds, fellowships, investors, crowdfunding…) → MonetaryGrant
  return clean({
    "@context": "https://schema.org",
    "@type": "MonetaryGrant",
    name: opp.title,
    description: opp.description ?? undefined,
    url: pageUrl,
    sameAs: official ? [official] : undefined,
    funder: funder(opp),
    amount: monetaryAmount(opp),
    areaServed: place(opp),
  });
}

/** Human label for an opp_type, falling back to the raw value. */
export function typeLabel(oppType?: string | null): string {
  if (!oppType) return "Opportunity";
  return TYPE_LABEL[oppType] ?? oppType;
}
