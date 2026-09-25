// app/guides/[slug]/page.tsx
//
// Article + FAQPage schema. The FAQ block is the part answer engines lift
// most readily, and dateModified is the freshness signal that decides
// whether a two-year-old guide still gets quoted.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata, absoluteUrl, SITE } from "@/lib/seo";
import { GUIDES, guideBySlug } from "@/lib/guides";

export const revalidate = 86400;

export function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return pageMetadata({ title: "Not found", description: "", path: "/guides", index: false });
  return pageMetadata({
    title: g.title,
    description: g.description,
    path: `/guides/${g.slug}`,
    type: "article",
  });
}

export default async function GuidePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) notFound();

  const updated = new Date(g.updated).toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric" });

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.title,
      description: g.description,
      datePublished: g.updated,
      dateModified: g.updated,
      url: absoluteUrl(`/guides/${g.slug}`),
      mainEntityOfPage: absoluteUrl(`/guides/${g.slug}`),
      author:    { "@type": "Organization", name: SITE.name },
      publisher: { "@type": "Organization", name: SITE.name, url: SITE.host },
    },
    g.faqs.length > 0 && {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: g.faqs.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-[11px] uppercase tracking-[0.16em] text-ash">
        <Link href="/guides" className="hover:text-ink">Guides</Link>
        <span className="mx-2 text-ash/40">/</span>
        <span className="text-ink">{g.title}</span>
      </nav>

      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">{g.title}</h1>
      <p className="mt-3 text-[12px] uppercase tracking-[0.16em] text-ash/60">Updated {updated}</p>
      <p className="mt-6 text-[18px] leading-[1.8] text-ink">{g.intro}</p>

      {g.sections.map((sec, i) => (
        <section key={i} className="mt-12">
          <h2 className="font-display text-[26px] font-normal leading-[1.25]">{sec.heading}</h2>
          {sec.paragraphs.map((para, j) => (
            <p key={j} className="mt-4 text-[16px] leading-[1.8] text-ash">{para}</p>
          ))}
        </section>
      ))}

      {g.faqs.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="font-display text-[26px] font-normal mb-6">Common questions</h2>
          {g.faqs.map((f, i) => (
            <div key={i} className="hairline py-5">
              <h3 className="text-[16px] font-medium text-ink">{f.q}</h3>
              <p className="mt-2 text-[15px] leading-[1.75] text-ash">{f.a}</p>
            </div>
          ))}
        </section>
      )}

      {g.related.length > 0 && (
        <section className="mt-14 border-t border-line pt-8">
          <p className="eyebrow mb-4">Go further</p>
          <div className="flex flex-wrap gap-2">
            {g.related.map(r => (
              <Link key={r.href} href={r.href}
                className="rounded-full border border-line px-4 py-2 text-[12px] text-ash hover:border-gold hover:text-ink">
                {r.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
