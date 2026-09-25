// app/glossary/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { GLOSSARY } from "@/lib/glossary";

export const revalidate = 86400;

export const metadata: Metadata = pageMetadata({
  title: "Film Financing Glossary",
  description: `Plain definitions of ${GLOSSARY.length} film-financing terms: co-production treaties, soft money, gap financing, minimum guarantees and more.`,
  path: "/glossary",
});

export default function GlossaryIndex() {
  const terms = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        Film financing <span className="italic text-gold">glossary</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {terms.length} terms a filmmaker meets when raising money, defined plainly.
      </p>

      <div className="mt-12 border-t border-line">
        {terms.map(t => (
          <Link key={t.slug} href={`/glossary/${t.slug}`} className="hairline block py-4 hover:no-underline">
            <p className="font-display text-[19px] font-normal hover:text-gold">{t.term}</p>
            <p className="mt-1 max-w-2xl text-[14px] leading-[1.6] text-ash">{t.short}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
