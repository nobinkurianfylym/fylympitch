// app/opportunities/for/page.tsx
// The facet directory: who the money is for, what it funds, and when in the
// life of a project it arrives. Each entry carries its live count, so this
// page never sends anyone into an empty one.

import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { loadIndexableOpportunities, hubStats, hubIntro } from "@/lib/hubs";
import { FACETS, FACET_GROUPS, rowsForFacet } from "@/lib/opportunity-facets";
import { OPPORTUNITY_FAMILIES } from "@/lib/opportunity-taxonomy";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const rows = await loadIndexableOpportunities();
  return pageMetadata({
    title: "Film Funding by Who and What It Is For",
    titleShort: "Film Funding by Who It Is For",
    description: `Find funding by career stage, format and production stage: ${rows.length} verified grants, funds and labs sorted by who can apply and what they pay for.`,
    path: "/opportunities/for",
  });
}

export default async function FacetDirectory() {
  const rows = await loadIndexableOpportunities();
  const s = hubStats(rows);

  const counts = new Map(FACETS.map(f => [f.slug, rowsForFacet(f, rows).length]));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/opportunities" className="hover:text-ink">Opportunities</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">For</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        Funding <span className="italic text-gold">for your film</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {hubIntro("funding opportunities", null, s)}
      </p>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-ash/80">
        Three ways to narrow it: by how many films you have made, by what you
        are making, and by how far along it is.
      </p>

      {FACET_GROUPS.map(g => (
        <section key={g.key} className="mt-12">
          <p className="eyebrow mb-4">{g.label}</p>
          <div className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
            {FACETS.filter(f => f.group === g.key).map(f => (
              <Link key={f.slug} href={`/opportunities/for/${f.slug}`}
                className="hairline flex items-baseline justify-between gap-4 py-3.5 hover:text-gold">
                <span className="text-[15px]">{f.label}</span>
                <span className="text-[13px] text-ash tabular-nums">{counts.get(f.slug) ?? 0}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-16 border-t border-line pt-10">
        <p className="eyebrow mb-4">Browse another way</p>
        <div className="flex flex-wrap gap-2">
          {OPPORTUNITY_FAMILIES.map(f => (
            <Link key={f.slug} href={`/opportunities/type/${f.slug}`}
              className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
              {f.label}
            </Link>
          ))}
          <Link href="/opportunities/country"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            By country
          </Link>
          <Link href="/organisations"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            By organisation
          </Link>
        </div>
      </section>
    </main>
  );
}
