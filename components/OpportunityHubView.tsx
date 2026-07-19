import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import JsonLd from "@/components/JsonLd";
import AuthAwareCta from "@/components/AuthAwareCta";
import { usd, TYPE_LABEL } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import type { HubRow } from "@/lib/hubs";

type SiblingGroup = { heading: string; links: { label: string; href: string }[] };

export default function OpportunityHubView({
  eyebrow,
  title,
  intro,
  rows,
  canonicalPath,
  breadcrumbs,
  siblings,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  rows: HubRow[];
  canonicalPath: string;
  breadcrumbs: { name: string; path: string }[];
  siblings?: SiblingGroup[];
}) {
  const items = rows.map((r) => ({
    name: r.title,
    url: absoluteUrl(`/opportunities/${r.slug}`),
  }));

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: intro,
    url: absoluteUrl(canonicalPath),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        url: it.url,
      })),
    },
  };

  function facts(r: HubRow): string {
    const parts: string[] = [];
    const loc = [r.country, r.region].filter(Boolean).join(" · ");
    if (loc) parts.push(loc);
    if (r.max_award_usd != null) parts.push(`Up to ${usd(r.max_award_usd)}`);
    else if (r.min_award_usd != null) parts.push(`From ${usd(r.min_award_usd)}`);
    if (r.deadline)
      parts.push(
        `Deadline ${new Date(r.deadline).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`,
      );
    return parts.join("  ·  ");
  }

  return (
    <div className="min-h-screen bg-ivory">
      <JsonLd data={[breadcrumbSchema(breadcrumbs), collectionSchema]} />

      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/filmprojects" className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/opportunities" className="text-ink">Opportunities</Link>
          </nav>
          <AuthAwareCta authedHref="/dashboard" authedLabel="Dashboard" authedClassName="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
            <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
          </AuthAwareCta>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-6 py-14">
        {/* Breadcrumb (visible) */}
        <nav className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.14em] uppercase text-ash">
          {breadcrumbs.map((b, i) => (
            <span key={b.path} className="flex items-center gap-2">
              {i > 0 && <span className="text-line">/</span>}
              {i < breadcrumbs.length - 1 ? (
                <Link href={b.path} className="hover:text-ink transition-colors">{b.name}</Link>
              ) : (
                <span className="text-ink">{b.name}</span>
              )}
            </span>
          ))}
        </nav>

        <p className="eyebrow mt-8 mb-3">{eyebrow}</p>
        <h1 className="font-display text-[40px] md:text-[52px] font-[400] leading-[1.1] text-ink max-w-[16ch]">
          {title}
        </h1>
        <p className="mt-6 text-[16px] leading-[1.7] text-ash max-w-[70ch]">{intro}</p>

        {/* Record list */}
        <div className="mt-12 card divide-y divide-line">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/opportunities/${r.slug}`}
              className="block px-6 py-5 group"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="font-display text-[19px] text-ink group-hover:text-gold transition-colors">
                  {r.title}
                </p>
                <p className="text-[11px] tracking-[0.14em] uppercase text-ash shrink-0">
                  {TYPE_LABEL[r.opp_type ?? ""] ?? r.opp_type}
                </p>
              </div>
              {facts(r) && <p className="mt-1 text-[13px] text-ash">{facts(r)}</p>}
            </Link>
          ))}
        </div>

        {/* Sibling / related hubs (internal linking) */}
        {siblings?.map((group) => (
          <div key={group.heading} className="mt-12">
            <p className="eyebrow mb-4">{group.heading}</p>
            <div className="flex flex-wrap gap-2">
              {group.links.map((l) => (
                <Link key={l.href} href={l.href} className="btn-ghost !text-[12px]">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {/* Learn more — hub -> editorial internal links */}
        <div className="mt-12 pt-8 border-t border-line">
          <p className="eyebrow mb-4">Learn more</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/guides" className="btn-ghost !text-[12px]">Film financing guides</Link>
            <Link href="/glossary" className="btn-ghost !text-[12px]">Glossary</Link>
            <Link href="/deadlines" className="btn-ghost !text-[12px]">Upcoming deadlines</Link>
          </div>
        </div>
      </main>

      <div className="border-t border-line mt-16">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <Wordmark />
          <p className="text-[12px] text-ash">The intelligence layer for cinema.</p>
          <Link href="/opportunities" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
            Browse all opportunities →
          </Link>
        </div>
      </div>
    </div>
  );
}
