import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityHubView from "@/components/OpportunityHubView";
import { loadIndexableOpportunities, hubStats, hubIntro, countriesWithCounts, HUB_MIN_RECORDS } from "@/lib/hubs";
import { OPPORTUNITY_FAMILIES, familyBySlug } from "@/lib/opportunity-taxonomy";
import { absoluteUrl, ROBOTS_INDEX, ROBOTS_NOINDEX } from "@/lib/seo";

export const revalidate = 3600;
type Props = { params: Promise<{ family: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { family: slug } = await params;
  const family = familyBySlug(slug);
  if (!family) return { title: "Not found — PITCH.FYLYM" };
  const rows = (await loadIndexableOpportunities()).filter((r) => family.types.includes(r.opp_type ?? ""));
  const path = `/opportunities/type/${family.slug}`;
  return {
    title: `Film ${family.label} — Verified Directory | PITCH.FYLYM`,
    description: `${family.description} ${rows.length} verified on PITCH.FYLYM.`,
    alternates: { canonical: absoluteUrl(path) },
    robots: rows.length >= HUB_MIN_RECORDS ? ROBOTS_INDEX : ROBOTS_NOINDEX,
  };
}

export default async function FamilyHub({ params }: Props) {
  const { family: slug } = await params;
  const family = familyBySlug(slug);
  if (!family) notFound();

  const all = await loadIndexableOpportunities();
  const rows = all
    .filter((r) => family.types.includes(r.opp_type ?? ""))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  if (rows.length === 0) notFound();

  const stats = hubStats(rows);
  const intro = hubIntro(family.noun, null, stats);
  const path = `/opportunities/type/${family.slug}`;

  // Sibling internal links
  const topCountries = countriesWithCounts(rows).slice(0, 8);
  const siblings = [
    {
      heading: "Other categories",
      links: OPPORTUNITY_FAMILIES.filter((f) => f.slug !== family.slug).map((f) => ({
        label: f.label,
        href: `/opportunities/type/${f.slug}`,
      })),
    },
    ...(topCountries.length
      ? [
          {
            heading: `${family.label} by country`,
            links: topCountries.map((c) => ({
              label: `${c.name} (${c.count})`,
              href: `/opportunities/country/${c.slug}/${family.slug}`,
            })),
          },
        ]
      : []),
  ];

  return (
    <OpportunityHubView
      eyebrow="Opportunities"
      title={`Film ${family.label}`}
      intro={intro}
      rows={rows}
      canonicalPath={path}
      breadcrumbs={[
        { name: "Opportunities", path: "/opportunities" },
        { name: family.label, path },
      ]}
      siblings={siblings}
    />
  );
}
