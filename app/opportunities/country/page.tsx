import type { Metadata } from "next";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import JsonLd from "@/components/JsonLd";
import AuthAwareCta from "@/components/AuthAwareCta";
import { loadIndexableOpportunities, countriesWithCounts } from "@/lib/hubs";
import { absoluteUrl, ROBOTS_INDEX } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Film Funding by Country — Grants, Funds & Tax Incentives | PITCH.FYLYM",
  description:
    "Find verified film grants, funds, labs and tax incentives by country. Eligibility, awards and deadlines for filmmakers worldwide.",
  alternates: { canonical: absoluteUrl("/opportunities/country") },
  robots: ROBOTS_INDEX,
};

export default async function CountryDirectory() {
  const all = await loadIndexableOpportunities();
  const countries = countriesWithCounts(all);

  return (
    <div className="min-h-screen bg-ivory">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Opportunities", path: "/opportunities" },
            { name: "By country", path: "/opportunities/country" },
          ]),
          itemListSchema(
            countries.map((c) => ({ name: c.name, path: `/opportunities/country/${c.slug}` })),
            "Film funding by country",
          ),
        ]}
      />
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <AuthAwareCta authedHref="/dashboard" authedLabel="Dashboard" authedClassName="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
            <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
          </AuthAwareCta>
        </div>
      </header>
      <main className="max-w-[980px] mx-auto px-6 py-14">
        <p className="eyebrow mb-3">Opportunities</p>
        <h1 className="font-display text-[44px] md:text-[54px] font-[400] leading-[1.1] text-ink">Film funding by country</h1>
        <p className="mt-6 text-[16px] leading-[1.7] text-ash max-w-[70ch]">
          Verified grants, funds, labs, markets and tax incentives, organised by country. Only countries with three or more verified opportunities are listed.
        </p>
        {countries.length === 0 ? (
          <p className="mt-12 text-[14px] text-ash">Country hubs appear here as verified records are added.</p>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 gap-x-12 gap-y-1 card p-6">
            {countries.map((c) => (
              <Link key={c.slug} href={`/opportunities/country/${c.slug}`} className="flex items-baseline justify-between py-2.5 border-b border-line/60 group">
                <span className="text-[16px] text-ink group-hover:text-gold transition-colors">{c.name}</span>
                <span className="text-[12px] text-ash">{c.count}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-10">
          <Link href="/opportunities/type" className="btn-ghost !text-[12px]">Browse by category →</Link>
        </div>
      </main>
    </div>
  );
}
