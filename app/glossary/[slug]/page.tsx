// app/glossary/[slug]/page.tsx
//
// DefinedTerm schema. Definitional content is disproportionately quoted by
// answer engines, and this is the markup that makes the quote attributable.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata, absoluteUrl } from "@/lib/seo";
import { GLOSSARY, glossaryBySlug } from "@/lib/glossary";

export const revalidate = 86400;

export function generateStaticParams() {
  return GLOSSARY.map(t => ({ slug: t.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const t = glossaryBySlug(slug);
  if (!t) return pageMetadata({ title: "Not found", description: "", path: "/glossary", index: false });
  return pageMetadata({
    title: `${t.term} — Film Financing`,
    description: t.short,
    path: `/glossary/${t.slug}`,
    type: "article",
  });
}

export default async function GlossaryTermPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const t = glossaryBySlug(slug);
  if (!t) notFound();

  const related = t.related.map(glossaryBySlug).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    url: absoluteUrl(`/glossary/${t.slug}`),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "PITCH.FYLYM Film Financing Glossary",
      url: absoluteUrl("/glossary"),
    },
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/glossary" className="hover:text-ink">Glossary</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">{t.term}</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[44px] font-normal leading-[1.08]">{t.term}</h1>
      <p className="mt-6 text-[18px] leading-[1.75] text-ink">{t.definition}</p>

      {t.hub && (
        <Link href={t.hub.href} className="btn-gold mt-9 inline-block">{t.hub.label}</Link>
      )}

      {related.length > 0 && (
        <section className="mt-14 border-t border-line pt-8">
          <p className="eyebrow mb-4">Related terms</p>
          <div className="flex flex-wrap gap-2">
            {related.map(r => (
              <Link key={r!.slug} href={`/glossary/${r!.slug}`}
                className="rounded-full border border-line px-4 py-2 text-[12px] text-ash hover:border-gold hover:text-ink">
                {r!.term}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
