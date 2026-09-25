// lib/public-api.ts
//
// The JSON face of the catalogue. Deliberately public and deliberately
// stable: the whole point is that something other than a browser can read
// it, cite it, and come back to the same shape tomorrow.
//
// Every response carries source, licence and a verified date, because a
// record quoted without those is a record nobody should trust.

import { NextResponse } from "next/server";
import type { HubRow } from "@/lib/hubs";
import { absoluteUrl, SITE } from "@/lib/seo";
import { newestVerified } from "@/lib/schema";

export const PUBLIC_LICENCE =
  "Free to read and cite with attribution to PITCH.FYLYM and a link to the source page.";

export type PublicOpportunity = {
  id: string;
  title: string;
  organisation: string | null;
  type: string | null;
  country: string | null;
  region: string | null;
  max_award_usd: number | null;
  deadline: string | null;
  deadline_type: string | null;
  typical_month: number | null;
  deadline_note: string | null;
  open_now: boolean;
  career_stages: string[];
  eligible_countries: string[];
  description: string | null;
  last_verified: string | null;
  official_url: string | null;
  url: string;
};

export function toPublic(r: HubRow): PublicOpportunity {
  return {
    id: r.id,
    title: r.title,
    organisation: r.organization_name?.trim() || null,
    type: r.opp_type ?? null,
    country: r.country?.trim() || null,
    region: r.region?.trim() || null,
    max_award_usd: r.max_award_usd ?? null,
    deadline: r.deadline ?? null,
    deadline_type: r.deadline_type ?? null,
    typical_month: r.typical_month ?? null,
    deadline_note: r.deadline_note ?? null,
    // The single most useful derived field: is this open today.
    open_now: r.deadline_type === "rolling"
      || (!!r.deadline && r.deadline >= new Date().toISOString().slice(0, 10)),
    career_stages: r.career_stages ?? [],
    eligible_countries: r.eligible_countries ?? [],
    description: r.description ?? null,
    last_verified: r.last_verified_at ? String(r.last_verified_at).slice(0, 10) : null,
    official_url: r.app_link ?? null,
    url: absoluteUrl(`/opportunities/${r.slug}`),
  };
}

/**
 * A complete, self-describing response.
 *
 * CORS is open because a closed public API is a contradiction, and every
 * response is cacheable at the edge: these change daily at most, and a
 * crawler hitting it a thousand times should cost nothing.
 */
export function publicJson(opts: {
  name: string;
  description: string;
  pageUrl: string;
  rows: HubRow[];
}) {
  const body = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: opts.name,
    description: opts.description,
    url: opts.pageUrl,
    creator: { "@type": "Organization", name: SITE.name, url: SITE.host },
    license: PUBLIC_LICENCE,
    dateModified: newestVerified(opts.rows),
    count: opts.rows.length,
    generated_at: new Date().toISOString(),
    opportunities: opts.rows.map(toPublic),
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export function notFoundJson(message: string) {
  return NextResponse.json({ error: message }, {
    status: 404,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
