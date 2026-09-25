// app/opportunities/type/[family]/page.tsx
//
// One page per funding family. The intro sentence is generated from live
// numbers — count, award range, next deadline — so no two of these read
// alike, which is what keeps a programmatic set on the right side of
// scaled-content guidance.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { loadIndexableOpportunities, hubStats, hubIntro, HUB_MIN_RECORDS } from "@/lib/hubs";
import { OPPORTUNITY_FAMILIES, familyBySlug, familyForType } from "@/lib/opportunity-taxonomy";
import HubList from "@/components/HubList";

export const revalidate = 3600;

export function generateStaticParams() {
  return OPPORTUNITY_FAMILIES.map(f => ({ family: f.slug }));
}

async function load(familySlug: string) {
  const family = familyBySlug(familySlug);
  if (!family) return null;
  const all = await loadIndexableOpportunities();
  const rows = all.filter(r => familyForType(r.opp_type)?.slug === family.slug);
  return { family, rows };
}

export async function generateMetadata(
  { params }: { params: Promise<{ family: string }> },
): Promise<Metadata> {
  const { family: slug } = await params;
  const data = await load(slug);
  if (!data) return pageMetadata({ title: "Not found", description: "", path: "/opportunities", index: false });

  const s = hubStats(data.rows);
  return pageMetadata({
    title: `${data.family.label} for Filmmakers`,
    description: `${s.count} verified ${data.family.noun} for filmmakers worldwide. ${data.family.description}`,
    path: `/opportunities/type/${data.family.slug}`,
    // A family with almost nothing in it is a thin page; say so honestly
    // rather than asking to be indexed for it.
    index: data.rows.length >= HUB_MIN_RECORDS,
  });
}

export default async function FamilyHub(
  { params }: { params: Promise<{ family: string }> },
) {
  const { family: slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { family, rows } = data;
  const s = hubStats(rows);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/opportunities" className="hover:text-ink">Opportunities</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">{family.label}</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        {family.label}
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">{hubIntro(family.noun, null, s)}</p>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-ash/80">{family.description}</p>

      <div className="mt-12">
        <HubList rows={rows} />
      </div>

      <section className="mt-16 border-t border-line pt-10">
        <p className="eyebrow mb-4">Other kinds of funding</p>
        <div className="flex flex-wrap gap-2">
          {OPPORTUNITY_FAMILIES.filter(f => f.slug !== family.slug).map(f => (
            <Link key={f.slug} href={`/opportunities/type/${f.slug}`}
              className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
              {f.label}
            </Link>
          ))}
          <Link href="/opportunities/country"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            By country
          </Link>
        </div>
      </section>
    </main>
  );
}
