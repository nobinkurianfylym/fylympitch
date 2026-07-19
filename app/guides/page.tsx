import type { Metadata } from "next";
import Link from "next/link";
import EditorialShell from "@/components/EditorialShell";
import { GUIDES } from "@/lib/guides";
import { absoluteUrl, ROBOTS_INDEX } from "@/lib/seo";
import { itemListSchema } from "@/lib/schema";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Film Financing Guides — Grants, Tax Credits, Co-Production | PITCH.FYLYM",
  description:
    "Practical guides to financing a film: how tax credits work, how to win film grants, co-production, and building a capital stack.",
  alternates: { canonical: absoluteUrl("/guides") },
  robots: ROBOTS_INDEX,
};

export default function GuidesIndex() {
  return (
    <EditorialShell
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }]}
      jsonLd={[itemListSchema(GUIDES.map((g) => ({ name: g.title, path: `/guides/${g.slug}` })), "Film financing guides")]}
    >
      <p className="eyebrow mb-3">Learn</p>
      <h1 className="font-display text-[42px] md:text-[52px] font-[400] leading-[1.1] text-ink">Film financing guides</h1>
      <p className="mt-6 text-[16px] leading-[1.7] text-ash">Practical, plain-English guides to funding a film — written for working filmmakers.</p>
      <div className="mt-12 card divide-y divide-line">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="block px-6 py-6 group">
            <p className="font-display text-[22px] text-ink group-hover:text-gold transition-colors">{g.title}</p>
            <p className="mt-1.5 text-[14px] text-ash leading-[1.6] max-w-[68ch]">{g.description}</p>
          </Link>
        ))}
      </div>
    </EditorialShell>
  );
}
