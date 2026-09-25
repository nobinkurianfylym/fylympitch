// app/guides/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { GUIDES } from "@/lib/guides";

export const revalidate = 86400;

export const metadata: Metadata = pageMetadata({
  title: "Film Financing Guides",
  description: "Practical guides to film funding: tax incentives, co-production, development finance and how producers actually assemble a budget.",
  path: "/guides",
});

export default function GuidesIndex() {
  const guides = [...GUIDES].sort((a, b) => b.updated.localeCompare(a.updated));
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        Film financing <span className="italic text-gold">guides</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        How the money actually works, written for filmmakers rather than for
        search engines.
      </p>

      <div className="mt-12 border-t border-line">
        {guides.map(g => (
          <article key={g.slug} className="hairline py-6">
            <h2 className="font-display text-[22px] font-normal leading-[1.25]">
              <Link href={`/guides/${g.slug}`} className="hover:text-gold">{g.title}</Link>
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-[1.7] text-ash">{g.description}</p>
            <p className="mt-2 text-[12px] text-ash/60">
              Updated {new Date(g.updated).toLocaleDateString("en-GB",
                { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
