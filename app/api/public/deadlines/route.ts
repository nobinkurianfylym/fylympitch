// GET /api/public/deadlines — what is closing, and what is open right now.
import { loadIndexableOpportunities } from "@/lib/hubs";
import { publicJson } from "@/lib/public-api";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export async function GET() {
  const all = await loadIndexableOpportunities();
  const today = new Date().toISOString().slice(0, 10);
  const rows = all.filter(r =>
    (r.deadline && r.deadline >= today) || r.deadline_type === "rolling");

  return publicJson({
    name: "PITCH.FYLYM open film funding deadlines",
    description: `${rows.length} film funding programmes currently open or with a future deadline.`,
    pageUrl: absoluteUrl("/deadlines"),
    rows,
  });
}
