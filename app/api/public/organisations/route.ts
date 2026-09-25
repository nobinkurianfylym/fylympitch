// GET /api/public/organisations — the funding bodies and how much each runs.
import { NextResponse } from "next/server";
import { loadIndexableOpportunities, organisationsWithCounts } from "@/lib/hubs";
import { PUBLIC_LICENCE } from "@/lib/public-api";
import { absoluteUrl, SITE } from "@/lib/seo";
import { newestVerified } from "@/lib/schema";

export const revalidate = 3600;

export async function GET() {
  const rows = await loadIndexableOpportunities();
  const orgs = organisationsWithCounts(rows);

  return NextResponse.json({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Film funding organisations on PITCH.FYLYM",
    description: `${orgs.length} funding bodies and the number of programmes each runs.`,
    url: absoluteUrl("/organisations"),
    creator: { "@type": "Organization", name: SITE.name, url: SITE.host },
    license: PUBLIC_LICENCE,
    dateModified: newestVerified(rows),
    count: orgs.length,
    generated_at: new Date().toISOString(),
    organisations: orgs.map(o => ({
      name: o.name,
      programmes: o.count,
      url: absoluteUrl(`/organisations/${o.slug}`),
      json: absoluteUrl(`/api/public/organisations/${o.slug}`),
    })),
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
