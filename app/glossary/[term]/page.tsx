import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditorialShell from "@/components/EditorialShell";
import { GLOSSARY, glossaryBySlug } from "@/lib/glossary";
import { absoluteUrl, ROBOTS_INDEX } from "@/lib/seo";

export const revalidate = 86400;
type Props = { params: Promise<{ term: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { term: slug } = await params;
  const t = glossaryBySlug(slug);
  if (!t) return { title: "Not found — PITCH.FYLYM" };
  return {
    title: `${t.term} — Film Financing Glossary | PITCH.FYLYM`,
    description: t.short,
    alternates: { canonical: absoluteUrl(`/glossary/${t.slug}`) },
    robots: ROBOTS_INDEX,
  };
}

export default async function GlossaryTermPage({ params }: Props) {
  const { term: slug } = await params;
  const t = glossaryBySlug(slug);
  if (!t) notFound();
  const related = t.related.map(glossaryBySlug).filter(Boolean) as typeof GLOSSARY;

  const definedTerm = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    url: absoluteUrl(`/glossary/${t.slug}`),
    inDefinedTermSet: absoluteUrl("/glossary"),
  };

  return (
    <EditorialShell
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Glossary", path: "/glossary" },
        { name: t.term, path: `/glossary/${t.slug}` },
      ]}
      jsonLd={[definedTerm]}
    >
      <p className="eyebrow mb-3">Film financing glossary</p>
      <h1 className="font-display text-[40px] md:text-[48px] font-[400] leading-[1.1] text-ink">{t.term}</h1>
      <p className="mt-6 text-[17px] leading-[1.75] text-ink/90">{t.definition}</p>

      {t.hub && (
        <div className="mt-8">
          <Link href={t.hub.href} className="btn-gold">{t.hub.label} →</Link>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-12">
          <p className="eyebrow mb-4">Related terms</p>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/glossary/${r.slug}`} className="btn-ghost !text-[12px]">{r.term}</Link>
            ))}
          </div>
        </div>
      )}
    </EditorialShell>
  );
}
