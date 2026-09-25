// app/organisations/page.tsx
//
// The funding bodies themselves. Possible only since migration 093
// attributed 417 records that had no organisation at all; before that this
// page would have covered a quarter of the catalogue.
//
// People search organisation names far more than they search category
// phrases, and an organisation is the one entity here that a search engine
// already knows about independently.

import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import { loadIndexableOpportunities, organisationsWithCounts, hubStats, hubIntro } from "@/lib/hubs";
import { hubDatasetSchema, newestVerified } from "@/lib/schema";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const rows = await loadIndexableOpportunities();
  const orgs = organisationsWithCounts(rows);
  return pageMetadata({
    title: "Film Funding Bodies & Organisations",
    description: `${orgs.length} film funds, institutes, agencies and foundations, with every programme each one runs and when it closes.`,
    path: "/organisations",
  });
}

export default async function OrganisationsIndex() {
  const rows = await loadIndexableOpportunities();
  const orgs = organisationsWithCounts(rows);
  const s = hubStats(rows);

  const jsonLd = hubDatasetSchema({
    name: "Film funding organisations on PITCH.FYLYM",
    description: `${orgs.length} funding bodies and the programmes each one runs.`,
    pageUrl: absoluteUrl("/organisations"),
    jsonUrl: absoluteUrl("/api/public/organisations"),
    dateModified: newestVerified(rows),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        Film funding <span className="italic text-gold">organisations</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {hubIntro("funding opportunities", null, s)} They are run by the{" "}
        {orgs.length} bodies below.
      </p>

      <div className="mt-12 grid gap-x-8 gap-y-0 sm:grid-cols-2">
        {orgs.map(o => (
          <Link key={o.slug} href={`/organisations/${o.slug}`}
            className="hairline flex items-baseline justify-between gap-4 py-3.5 hover:text-gold">
            <span className="text-[15px]">{o.name}</span>
            <span className="text-[13px] tabular-nums text-ash">{o.count}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
