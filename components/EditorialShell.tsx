import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import JsonLd from "@/components/JsonLd";
import AuthAwareCta from "@/components/AuthAwareCta";
import { breadcrumbSchema } from "@/lib/schema";

// Shared chrome for editorial pages (glossary, guides, deadlines). No server
// auth → fully edge-cacheable.
export default function EditorialShell({
  breadcrumbs,
  jsonLd,
  children,
}: {
  breadcrumbs: { name: string; path: string }[];
  jsonLd?: (Record<string, unknown> | null)[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ivory">
      <JsonLd data={[breadcrumbSchema(breadcrumbs), ...(jsonLd ?? [])]} />
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/opportunities" className="hover:text-ink transition-colors">Opportunities</Link>
            <Link href="/guides" className="hover:text-ink transition-colors">Guides</Link>
            <Link href="/glossary" className="hover:text-ink transition-colors">Glossary</Link>
          </nav>
          <AuthAwareCta authedHref="/dashboard" authedLabel="Dashboard" authedClassName="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
            <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
          </AuthAwareCta>
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-6 py-14">
        <nav className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.14em] uppercase text-ash mb-8">
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
        {children}
      </main>

      <div className="border-t border-line mt-16">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <Wordmark />
          <Link href="/opportunities" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
            Browse all opportunities →
          </Link>
        </div>
      </div>
    </div>
  );
}
