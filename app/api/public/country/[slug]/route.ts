// GET /api/public/country/[slug]
import { loadIndexableOpportunities } from "@/lib/hubs";
import { publicJson, notFoundJson } from "@/lib/public-api";
import { countrySlug } from "@/lib/opportunity-taxonomy";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const all = await loadIndexableOpportunities();
  const rows = all.filter(r => r.country && countrySlug(r.country) === slug);
  if (rows.length === 0) return notFoundJson("No opportunities for that country.");

  const name = rows[0].country as string;
  return publicJson({
    name: `Film funding in ${name}`,
    description: `${rows.length} verified film funding opportunities in ${name}.`,
    pageUrl: absoluteUrl(`/opportunities/country/${slug}`),
    rows,
  });
}
