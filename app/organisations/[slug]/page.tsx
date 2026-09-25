// app/organisations/[slug]/page.tsx
//
// One page per funding body. Compiled entirely from programme information
// the organisation publishes itself, which is why it needs nobody's
// permission and states nothing that is not sourced.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import {
  loadIndexableOpportunities, organisationsWithCounts, rowsForOrganisation,
  hubStats, hubIntro, HUB_MIN_RECORDS,
} from "@/lib/hubs";
import { hubItemListSchema, hubDatasetSchema, newestVerified } from "@/lib/schema";
import { OPPORTUNITY_FAMILIES, familyForType, countrySlug } from "@/lib/opportunity-taxonomy";
import HubList from "@/components/HubList";

export const revalidate = 3600;

export async function generateStaticParams() {
  // Best effort — see the note on the country hub. A build must not depend on
  // a network read that these pages do not need in order to work.
  try {
    const rows = await loadIndexableOpportunities();
    return organisationsWithCounts(rows).map(o => ({ slug: o.slug }));
  } catch {
    return [];
  }
}

async function load(slug: string) {
  const all = await loadIndexableOpportunities();
  const rows = rowsForOrganisation(all, slug);
  if (rows.length === 0) return null;
  const names = new Map<string, number>();
  for (const r of rows) {
    const n = r.organization_name!.trim();
    names.set(n, (names.get(n) ?? 0) + 1);
  }
  const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { name, rows };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return pageMetadata({ title: "Not found", description: "", path: "/organisations", index: false });

  const s = hubStats(data.rows);
  return pageMetadata({
    title: `${data.name} — Funding Programmes`,
    description: `Every programme ${data.name} runs: ${s.count} opportunities with deadlines, award sizes and eligibility, kept current.`,
    path: `/organisations/${slug}`,
    index: data.rows.length >= HUB_MIN_RECORDS,
  });
}

export default async function OrganisationPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { name, rows } = data;
  const s = hubStats(rows);
  const pageUrl = absoluteUrl(`/organisations/${slug}`);

  const countries = [...new Set(rows.map(r => r.country?.trim()).filter(Boolean))] as string[];
  const families = OPPORTUNITY_FAMILIES
    .map(f => ({ f, n: rows.filter(r => familyForType(r.opp_type)?.slug === f.slug).length }))
    .filter(x => x.n > 0);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      url: pageUrl,
      description: `${name} runs ${s.count} film funding programmes listed on PITCH.FYLYM.`,
      ...(countries.length === 1 ? { areaServed: { "@type": "Country", name: countries[0] } } : {}),
    },
    hubItemListSchema(`Programmes run by ${name}`, pageUrl, rows),
    hubDatasetSchema({
      name: `${name} funding programmes`,
      description: `${s.count} film funding programmes run by ${name}.`,
      pageUrl,
      jsonUrl: absoluteUrl(`/api/public/organisations/${slug}`),
      dateModified: newestVerified(rows),
      keywords: ["film funding", name, ...countries],
    }),
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/organisations" className="hover:text-ink">Organisations</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">{name}</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">{name}</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {hubIntro("funding programmes", `from ${name}`, s)}
      </p>

      {(families.length > 1 || countries.length > 0) && (
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

      {countries.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <p className="eyebrow mb-4">Territories</p>
          <div className="flex flex-wrap gap-2">
            {countries.map(c => (
              <Link key={c} href={`/opportunities/country/${countrySlug(c)}`}
                className="rounded-full border border-line px-4 py-2 text-[12px] text-ash hover:border-gold hover:text-ink">
                {c}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-12 max-w-2xl text-[13px] leading-[1.7] text-ash/70">
        Compiled from programme information {name} publishes. Always confirm
        eligibility and deadlines on the organisation&rsquo;s own site before
        applying.
      </p>
    </main>
  );
}
