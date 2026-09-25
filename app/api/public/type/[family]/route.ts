// GET /api/public/type/[family]
import { loadIndexableOpportunities } from "@/lib/hubs";
import { publicJson, notFoundJson } from "@/lib/public-api";
import { familyBySlug, familyForType } from "@/lib/opportunity-taxonomy";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ family: string }> },
) {
  const { family: slug } = await params;
  const family = familyBySlug(slug);
  if (!family) return notFoundJson("Unknown funding family.");

  const all = await loadIndexableOpportunities();
  const rows = all.filter(r => familyForType(r.opp_type)?.slug === family.slug);

  return publicJson({
    name: family.label,
    description: `${rows.length} verified ${family.noun} for filmmakers worldwide.`,
    pageUrl: absoluteUrl(`/opportunities/type/${family.slug}`),
    rows,
  });
}
