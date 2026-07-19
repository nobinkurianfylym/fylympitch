import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityHubView from "@/components/OpportunityHubView";
import { loadIndexableOpportunities, hubStats, hubIntro, countriesWithCounts, HUB_MIN_RECORDS, type HubRow } from "@/lib/hubs";
import { OPPORTUNITY_FAMILIES, familyForType, countrySlug } from "@/lib/opportunity-taxonomy";
import { absoluteUrl, ROBOTS_INDEX, ROBOTS_NOINDEX } from "@/lib/seo";

export const revalidate = 3600;
type Props = { params: Promise<{ country: string }> };

function resolveCountry(rows: HubRow[], slug: string): string | null {
  for (const r of rows) if (r.country && countrySlug(r.country) === slug) return r.country;
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: slug } = await params;
  const all = await loadIndexableOpportunities();
  const name = resolveCountry(all, slug);
  if (!name) return { title: "Not found — PITCH.FYLYM" };
  const rows = all.filter((r) => r.country === name);
  const path = `/opportunities/country/${slug}`;
  return {
    title: `Film Funding in ${name} — Grants, Funds & Incentives | PITCH.FYLYM`,
    description: `${rows.length} verified film grants, funds, labs and tax incentives in ${name}. Eligibility, awards and deadlines on PITCH.FYLYM.`,
    alternates: { canonical: absoluteUrl(path) },
    robots: rows.length >= HUB_MIN_RECORDS ? ROBOTS_INDEX : ROBOTS_NOINDEX,
  };
}

export default async function CountryHub({ params }: Props) {
  const { country: slug } = await params;
  const all = await loadIndexableOpportunities();
  const name = resolveCountry(all, slug);
  if (!name) notFound();

  const rows = all
    .filter((r) => r.country === name)
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  if (rows.length === 0) notFound();

  const stats = hubStats(rows);
  const intro = hubIntro("film funding opportunities", `in ${name}`, stats);
  const path = `/opportunities/country/${slug}`;

  // Which families are present in this country (≥1 record)?
  const present = new Set(rows.map((r) => familyForType(r.opp_type)?.slug).filter(Boolean) as string[]);
  const otherCountries = countriesWithCounts(all).filter((c) => c.slug !== slug).slice(0, 10);

  const siblings = [
    ...(present.size
      ? [
          {
            heading: `Categories in ${name}`,
            links: OPPORTUNITY_FAMILIES.filter((f) => present.has(f.slug)).map((f) => ({
              label: f.label,
              href: `/opportunities/country/${slug}/${f.slug}`,
            })),
          },
        ]
      : []),
    {
      heading: "Other countries",
      links: otherCountries.map((c) => ({ label: `${c.name} (${c.count})`, href: `/opportunities/country/${c.slug}` })),
    },
  ];

  return (
    <OpportunityHubView
      eyebrow="Film funding by country"
      title={`Film Funding in ${name}`}
      intro={intro}
      rows={rows}
      canonicalPath={path}
      breadcrumbs={[
        { name: "Opportunities", path: "/opportunities" },
        { name: name, path },
      ]}
      siblings={siblings}
    />
  );
}
