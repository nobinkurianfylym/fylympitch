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

// ── Opportunity → MonetaryGrant | Event ──────────────────────────────────────

// Time-bound programmes/gatherings model best as Event; everything else that
// represents money awarded or available models as MonetaryGrant.
const EVENT_TYPES = new Set([
  "lab",
  "residency",
  "mentorship",
  "pitch_forum",
  "co_production",
  "market",
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
  if (!opp.organization_name) return undefined;
  return { "@type": "Organization", name: opp.organization_name };
}

/**
 * Build the primary JSON-LD for an opportunity record page. Returns null when
 * the record lacks a slug (so we never emit a schema pointing nowhere).
 */
export function opportunitySchema(opp: OpportunityLike): Json | null {
  if (!opp.slug || !opp.title) return null;
  const url = absoluteUrl(`/opportunities/${opp.slug}`);
  const location =
    opp.country || opp.region
      ? { "@type": "Place", name: [opp.region, opp.country].filter(Boolean).join(", ") }
      : undefined;

  if (opp.opp_type && EVENT_TYPES.has(opp.opp_type)) {
    return clean({
      "@context": "https://schema.org",
      "@type": "Event",
      name: opp.title,
      description: opp.description ?? undefined,
      url,
      location,
      organizer: funder(opp),
      // Deadline is an application window, not the event date — surfaced in
      // visible content/FAQ instead of an inaccurate startDate.
    });
  }

  return clean({
    "@context": "https://schema.org",
    "@type": "MonetaryGrant",
    name: opp.title,
    description: opp.description ?? undefined,
    url,
    funder: funder(opp),
    amount: monetaryAmount(opp),
    sponsor: funder(opp),
  });
}

/** Human label for an opp_type, falling back to the raw value. */
export function typeLabel(oppType?: string | null): string {
  if (!oppType) return "Opportunity";
  return TYPE_LABEL[oppType] ?? oppType;
}
