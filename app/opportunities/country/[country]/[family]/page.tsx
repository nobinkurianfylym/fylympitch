import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityHubView from "@/components/OpportunityHubView";
import { loadIndexableOpportunities, hubStats, hubIntro, HUB_MIN_RECORDS, type HubRow } from "@/lib/hubs";
import { familyBySlug, countrySlug } from "@/lib/opportunity-taxonomy";
import { absoluteUrl, ROBOTS_INDEX, ROBOTS_NOINDEX } from "@/lib/seo";

export const revalidate = 3600;
type Props = { params: Promise<{ country: string; family: string }> };

function resolveCountry(rows: HubRow[], slug: string): string | null {
  for (const r of rows) if (r.country && countrySlug(r.country) === slug) return r.country;
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: cslug, family: fslug } = await params;
  const family = familyBySlug(fslug);
  if (!family) return { title: "Not found — PITCH.FYLYM" };
  const all = await loadIndexableOpportunities();
  const name = resolveCountry(all, cslug);
  if (!name) return { title: "Not found — PITCH.FYLYM" };
  const rows = all.filter((r) => r.country === name && family.types.includes(r.opp_type ?? ""));
  const path = `/opportunities/country/${cslug}/${family.slug}`;
  return {
    title: `${family.label} in ${name} | PITCH.FYLYM`,
    description: `${rows.length} verified ${family.noun} in ${name}. Awards, eligibility and deadlines on PITCH.FYLYM.`,
    alternates: { canonical: absoluteUrl(path) },
    robots: rows.length >= HUB_MIN_RECORDS ? ROBOTS_INDEX : ROBOTS_NOINDEX,
  };
}

export default async function CountryFamilyHub({ params }: Props) {
  const { country: cslug, family: fslug } = await params;
  const family = familyBySlug(fslug);
  if (!family) notFound();
  const all = await loadIndexableOpportunities();
  const name = resolveCountry(all, cslug);
  if (!name) notFound();

  const rows = all
    .filter((r) => r.country === name && family.types.includes(r.opp_type ?? ""))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  if (rows.length === 0) notFound();

  const stats = hubStats(rows);
  const intro = hubIntro(family.noun, `in ${name}`, stats);
  const path = `/opportunities/country/${cslug}/${family.slug}`;

  const siblings = [
    {
      heading: `More in ${name}`,
      links: [{ label: `All film funding in ${name}`, href: `/opportunities/country/${cslug}` }],
    },
    {
      heading: `${family.label} elsewhere`,
      links: [{ label: `All ${family.label}`, href: `/opportunities/type/${family.slug}` }],
    },
  ];

  return (
    <OpportunityHubView
      eyebrow={`${family.label} · ${name}`}
      title={`${family.label} in ${name}`}
      intro={intro}
      rows={rows}
      canonicalPath={path}
      breadcrumbs={[
        { name: "Opportunities", path: "/opportunities" },
        { name: name, path: `/opportunities/country/${cslug}` },
        { name: family.label, path },
      ]}
      siblings={siblings}
    />
  );
}
