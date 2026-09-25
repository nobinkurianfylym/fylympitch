// app/opportunities/country/page.tsx
// The country directory. Only countries with enough records to be worth a
// page of their own appear, so this never links into thin content.

import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { loadIndexableOpportunities, countriesWithCounts, hubStats, hubIntro } from "@/lib/hubs";
import { OPPORTUNITY_FAMILIES } from "@/lib/opportunity-taxonomy";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const rows = await loadIndexableOpportunities();
  const countries = countriesWithCounts(rows);
  return pageMetadata({
    title: "Film Funding by Country",
    description: `Film grants, funds, labs and tax incentives across ${countries.length} countries, verified and kept current.`,
    path: "/opportunities/country",
  });
}

export default async function CountryDirectory() {
  const rows = await loadIndexableOpportunities();
  const countries = countriesWithCounts(rows);
  const s = hubStats(rows);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/opportunities" className="hover:text-ink">Opportunities</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">By country</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        Film funding <span className="italic text-gold">by country</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {hubIntro("funding opportunities", null, s)}
      </p>

      <div className="mt-12 grid gap-x-8 gap-y-0 sm:grid-cols-2">
        {countries.map(c => (
          <Link key={c.slug} href={`/opportunities/country/${c.slug}`}
            className="hairline flex items-baseline justify-between gap-4 py-3.5 hover:text-gold">
            <span className="text-[15px]">{c.name}</span>
            <span className="text-[13px] text-ash tabular-nums">{c.count}</span>
          </Link>
        ))}
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
          <Link href="/opportunities/for"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            By who it is for
          </Link>
        </div>
      </section>
    </main>
  );
}
