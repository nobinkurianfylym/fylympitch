// GET /api/public/opportunities — the whole indexable catalogue.
import { loadIndexableOpportunities } from "@/lib/hubs";
import { publicJson } from "@/lib/public-api";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function GET() {
  const rows = await loadIndexableOpportunities();
  return publicJson({
    name: "PITCH.FYLYM film funding catalogue",
    description: `${rows.length} verified film funding opportunities worldwide: grants, funds, labs, markets, co-production programmes and tax incentives.`,
    pageUrl: absoluteUrl("/opportunities"),
    rows,
  });
}
