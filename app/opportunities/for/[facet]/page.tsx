// app/opportunities/for/[facet]/page.tsx
//
// One page per facet. Same contract as the family and country hubs: the intro
// sentence is generated from live numbers so no two read alike, and the page
// only asks to be indexed when it is both substantial and distinct from the
// full catalogue.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import { hubItemListSchema, hubDatasetSchema, newestVerified } from "@/lib/schema";
import { loadIndexableOpportunities, hubStats, hubIntro } from "@/lib/hubs";
import {
  FACETS, FACET_GROUPS, facetBySlug, rowsForFacet, facetIndexability,
} from "@/lib/opportunity-facets";
import HubList from "@/components/HubList";

export const revalidate = 3600;

export function generateStaticParams() {
  return FACETS.map(f => ({ facet: f.slug }));
}

async function load(slug: string) {
  const facet = facetBySlug(slug);
  if (!facet) return null;
  const all = await loadIndexableOpportunities();
  return { facet, rows: rowsForFacet(facet, all), total: all.length };
}

export async function generateMetadata(
  { params }: { params: Promise<{ facet: string }> },
): Promise<Metadata> {
  const { facet: slug } = await params;
  const data = await load(slug);
  if (!data)
    return pageMetadata({ title: "Not found", description: "", path: "/opportunities/for", index: false });

  const { facet, rows, total } = data;
  const s = hubStats(rows);

  return pageMetadata({
    title: facet.heading,
    titleShort: facet.label,
    description: facet.meta.replace("%n", s.count.toLocaleString("en-US")),
    path: `/opportunities/for/${facet.slug}`,
    index: facetIndexability(rows.length, total).index,
  });
}

export default async function FacetHub(
  { params }: { params: Promise<{ facet: string }> },
) {
  const { facet: slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { facet, rows } = data;
  const s = hubStats(rows);

  const pageUrl = absoluteUrl(`/opportunities/for/${facet.slug}`);
  const jsonLd = [
    hubItemListSchema(facet.heading, pageUrl, rows),
    hubDatasetSchema({
      name: facet.heading,
      description: `${s.count} verified ${facet.noun} on PITCH.FYLYM.`,
      pageUrl,
      jsonUrl: absoluteUrl(`/api/public/for/${facet.slug}`),
      dateModified: newestVerified(rows),
      keywords: ["film funding", facet.label],
    }),
  ].filter(Boolean);

  const siblings = FACETS.filter(f => f.group === facet.group && f.slug !== facet.slug);
  const otherGroups = FACET_GROUPS.filter(g => g.key !== facet.group);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/opportunities" className="hover:text-ink">Opportunities</Link>
        <span className="mx-2 text-ash/40">/</span>
        <Link href="/opportunities/for" className="hover:text-ink">For</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">{facet.label}</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        {facet.heading}
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {hubIntro(facet.noun, null, s)}
      </p>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-ash/80">{facet.blurb}</p>

      <div className="mt-12">
        <HubList rows={rows} />
      </div>

      {siblings.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <p className="eyebrow mb-4">
            {FACET_GROUPS.find(g => g.key === facet.group)?.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {siblings.map(f => (
              <Link key={f.slug} href={`/opportunities/for/${f.slug}`}
                className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
                {f.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {otherGroups.map(g => (
        <section key={g.key} className="mt-10">
          <p className="eyebrow mb-4">{g.label}</p>
          <div className="flex flex-wrap gap-2">
            {FACETS.filter(f => f.group === g.key).map(f => (
              <Link key={f.slug} href={`/opportunities/for/${f.slug}`}
                className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
                {f.label}
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-12 border-t border-line pt-10">
        <div className="flex flex-wrap gap-2">
          <Link href="/opportunities/country"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            By country
          </Link>
          <Link href="/organisations"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            By organisation
          </Link>
          <Link href="/deadlines"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            Closing soon
          </Link>
        </div>
      </section>
    </main>
  );
}
