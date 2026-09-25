// GET /api/public/organisations/[slug]
import { loadIndexableOpportunities, rowsForOrganisation } from "@/lib/hubs";
import { publicJson, notFoundJson } from "@/lib/public-api";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const all = await loadIndexableOpportunities();
  const rows = rowsForOrganisation(all, slug);
  if (rows.length === 0) return notFoundJson("No opportunities for that organisation.");

  const name = rows[0].organization_name!.trim();
  return publicJson({
    name: `${name} funding programmes`,
    description: `${rows.length} film funding programmes run by ${name}.`,
    pageUrl: absoluteUrl(`/organisations/${slug}`),
    rows,
  });
}
