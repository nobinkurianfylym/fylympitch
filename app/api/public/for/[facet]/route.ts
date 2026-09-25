// GET /api/public/for/[facet]
import { loadIndexableOpportunities } from "@/lib/hubs";
import { publicJson, notFoundJson } from "@/lib/public-api";
import { facetBySlug, rowsForFacet } from "@/lib/opportunity-facets";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ facet: string }> },
) {
  const { facet: slug } = await params;
  const facet = facetBySlug(slug);
  if (!facet) return notFoundJson("Unknown facet.");

  const all = await loadIndexableOpportunities();
  const rows = rowsForFacet(facet, all);

  return publicJson({
    name: facet.heading,
    description: `${rows.length} verified ${facet.noun} on PITCH.FYLYM.`,
    pageUrl: absoluteUrl(`/opportunities/for/${facet.slug}`),
    rows,
  });
}
