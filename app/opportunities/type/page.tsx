import type { Metadata } from "next";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import JsonLd from "@/components/JsonLd";
import AuthAwareCta from "@/components/AuthAwareCta";
import { loadIndexableOpportunities } from "@/lib/hubs";
import { OPPORTUNITY_FAMILIES } from "@/lib/opportunity-taxonomy";
import { absoluteUrl, ROBOTS_INDEX } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Film Funding by Category — Grants, Funds, Labs, Incentives | PITCH.FYLYM",
  description:
    "Browse verified film funding by category: grants and funds, labs and residencies, markets and co-production, tax incentives, and investors.",
  alternates: { canonical: absoluteUrl("/opportunities/type") },
  robots: ROBOTS_INDEX,
};

export default async function TypeDirectory() {
  const all = await loadIndexableOpportunities();
  const counts = new Map<string, number>();
  for (const r of all) {
    const t = r.opp_type ?? "";
    for (const f of OPPORTUNITY_FAMILIES) if (f.types.includes(t)) counts.set(f.slug, (counts.get(f.slug) ?? 0) + 1);
  }
  const families = OPPORTUNITY_FAMILIES.map((f) => ({ ...f, count: counts.get(f.slug) ?? 0 }));

  return (
    <div className="min-h-screen bg-ivory">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Opportunities", path: "/opportunities" },
            { name: "By category", path: "/opportunities/type" },
          ]),
          itemListSchema(
            families.filter((f) => f.count > 0).map((f) => ({ name: f.label, path: `/opportunities/type/${f.slug}` })),
            "Film funding categories",
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
        <h1 className="font-display text-[44px] md:text-[54px] font-[400] leading-[1.1] text-ink">Film funding by category</h1>
        <p className="mt-6 text-[16px] leading-[1.7] text-ash max-w-[70ch]">
          Every funding route for filmmakers, organised by what it does — from non-repayable grants to tax incentives and private financing. All records are verified.
        </p>
        <div className="mt-12 card divide-y divide-line">
          {families.map((f) => (
            <Link key={f.slug} href={`/opportunities/type/${f.slug}`} className="block px-6 py-5 group">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-display text-[20px] text-ink group-hover:text-gold transition-colors">{f.label}</p>
                <p className="text-[11px] tracking-[0.14em] uppercase text-ash shrink-0">{f.count} verified</p>
              </div>
              <p className="mt-1 text-[13px] text-ash max-w-[68ch]">{f.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-10">
          <Link href="/opportunities/country" className="btn-ghost !text-[12px]">Browse by country →</Link>
        </div>
      </main>
    </div>
  );
}
