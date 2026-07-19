import type { Metadata } from "next";
import Link from "next/link";
import EditorialShell from "@/components/EditorialShell";
import { GLOSSARY } from "@/lib/glossary";
import { absoluteUrl, ROBOTS_INDEX } from "@/lib/seo";
import { itemListSchema } from "@/lib/schema";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Film Financing Glossary — Grants, Tax Credits, Co-Production Terms | PITCH.FYLYM",
  description:
    "Clear definitions of film financing terms: soft money, co-production treaties, completion bonds, gap financing, sales agents, tax incentives and more.",
  alternates: { canonical: absoluteUrl("/glossary") },
  robots: ROBOTS_INDEX,
};

export default function GlossaryIndex() {
  const terms = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <EditorialShell
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "Glossary", path: "/glossary" }]}
      jsonLd={[itemListSchema(terms.map((t) => ({ name: t.term, path: `/glossary/${t.slug}` })), "Film financing glossary")]}
    >
      <p className="eyebrow mb-3">Reference</p>
      <h1 className="font-display text-[42px] md:text-[52px] font-[400] leading-[1.1] text-ink">Film financing glossary</h1>
      <p className="mt-6 text-[16px] leading-[1.7] text-ash">
        Plain-English definitions of the terms filmmakers meet when financing a film — from soft money to recoupment.
      </p>
      <div className="mt-12 card divide-y divide-line">
        {terms.map((t) => (
          <Link key={t.slug} href={`/glossary/${t.slug}`} className="block px-6 py-5 group">
            <p className="font-display text-[19px] text-ink group-hover:text-gold transition-colors">{t.term}</p>
            <p className="mt-1 text-[14px] text-ash">{t.short}</p>
          </Link>
        ))}
      </div>
    </EditorialShell>
  );
}
