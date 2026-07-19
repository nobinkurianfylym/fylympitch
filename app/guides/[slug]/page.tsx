import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditorialShell from "@/components/EditorialShell";
import { guideBySlug } from "@/lib/guides";
import { absoluteUrl, SITE, ROBOTS_INDEX } from "@/lib/seo";
import { faqPageSchema } from "@/lib/schema";

export const revalidate = 86400;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return { title: "Not found — PITCH.FYLYM" };
  return {
    title: `${g.title} | PITCH.FYLYM`,
    description: g.description,
    alternates: { canonical: absoluteUrl(`/guides/${g.slug}`) },
    robots: ROBOTS_INDEX,
    openGraph: { title: g.title, description: g.description, type: "article" },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    url: absoluteUrl(`/guides/${g.slug}`),
    datePublished: g.updated,
    dateModified: g.updated,
    author: { "@type": "Organization", name: SITE.name, url: SITE.host },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.host },
  };

  return (
    <EditorialShell
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Guides", path: "/guides" },
        { name: g.title, path: `/guides/${g.slug}` },
      ]}
      jsonLd={[articleSchema, faqPageSchema(g.faqs.map((f) => ({ question: f.q, answer: f.a })))]}
    >
      <p className="eyebrow mb-3">Guide</p>
      <h1 className="font-display text-[40px] md:text-[50px] font-[400] leading-[1.1] text-ink">{g.title}</h1>
      <p className="mt-6 text-[17px] leading-[1.75] text-ink/90">{g.intro}</p>

      {g.sections.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="font-display text-[24px] font-[400] text-ink mb-3">{s.heading}</h2>
          {s.paragraphs.map((para, i) => (
            <p key={i} className="text-[16px] leading-[1.8] text-ink/85 mb-4">{para}</p>
          ))}
        </section>
      ))}

      <section className="mt-12 pt-10 border-t border-line">
        <h2 className="font-display text-[24px] font-[400] text-ink mb-6">Frequently asked</h2>
        <div className="space-y-6">
          {g.faqs.map((f) => (
            <div key={f.q}>
              <p className="font-display text-[18px] text-ink mb-1">{f.q}</p>
              <p className="text-[15px] text-ash leading-[1.7]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 flex flex-wrap gap-2">
        {g.related.map((r) => (
          <Link key={r.href} href={r.href} className="btn-ghost !text-[12px]">{r.label} →</Link>
        ))}
      </div>
    </EditorialShell>
  );
}
