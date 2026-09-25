// app/opportunities/country/[slug]/page.tsx
//
// One page per country that clears HUB_MIN_RECORDS. Countries below the
// threshold render noindex rather than 404: the page is still useful to a
// person who lands on it, it just should not be in the index.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import { hubItemListSchema, hubDatasetSchema, newestVerified } from "@/lib/schema";
import {
  loadIndexableOpportunities, countriesWithCounts,
  hubStats, hubIntro, HUB_MIN_RECORDS,
} from "@/lib/hubs";
import { countrySlug, OPPORTUNITY_FAMILIES, familyForType } from "@/lib/opportunity-taxonomy";
import HubList from "@/components/HubList";

export const revalidate = 3600;

export async function generateStaticParams() {
  const rows = await loadIndexableOpportunities();
  return countriesWithCounts(rows).map(c => ({ slug: c.slug }));
}

async function load(slug: string) {
  const all = await loadIndexableOpportunities();
  const rows = all.filter(r => r.country && countrySlug(r.country) === slug);
  if (rows.length === 0) return null;
  return { name: rows[0].country as string, rows };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return pageMetadata({ title: "Not found", description: "", path: "/opportunities/country", index: false });

  const s = hubStats(data.rows);
  return pageMetadata({
    title: `Film Funding in ${data.name}`,
    description: `${s.count} verified film grants, funds, labs and incentives in ${data.name}, with deadlines, award sizes and eligibility.`,
    path: `/opportunities/country/${slug}`,
    index: data.rows.length >= HUB_MIN_RECORDS,
  });
}

export default async function CountryHub(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { name, rows } = data;
  const s = hubStats(rows);

  // Which kinds of funding this country actually has, for internal links
  // that go somewhere real.
  const families = OPPORTUNITY_FAMILIES
    .map(f => ({ f, n: rows.filter(r => familyForType(r.opp_type)?.slug === f.slug).length }))
    .filter(x => x.n > 0);

  const pageUrl = absoluteUrl(`/opportunities/country/${slug}`);
  const jsonLd = [
    hubItemListSchema(`Film funding in ${name}`, pageUrl, rows),
    hubDatasetSchema({
      name: `Film funding in ${name}`,
      description: `${s.count} verified film funding opportunities in ${name}.`,
      pageUrl,
      jsonUrl: absoluteUrl(`/api/public/country/${slug}`),
      dateModified: newestVerified(rows),
      keywords: ["film funding", "film grants", name],
    }),
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/opportunities" className="hover:text-ink">Opportunities</Link>
        <span className="mx-2 text-ash/40">/</span>
        <Link href="/opportunities/country" className="hover:text-ink">By country</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">{name}</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        Film funding in <span className="italic text-gold">{name}</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {hubIntro("funding opportunities", `in ${name}`, s)}
      </p>

      {families.length > 1 && (
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3">
          {families.map(({ f, n }) => (
            <div key={f.slug}>
              <dt className="font-display text-[26px] font-normal leading-none">{n}</dt>
              <dd className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-ash/60">{f.label}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-12">
        <HubList rows={rows} />
      </div>

      <section className="mt-16 border-t border-line pt-10">
        <p className="eyebrow mb-4">Browse by kind</p>
        <div className="flex flex-wrap gap-2">
          {OPPORTUNITY_FAMILIES.map(f => (
            <Link key={f.slug} href={`/opportunities/type/${f.slug}`}
              className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
              {f.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
