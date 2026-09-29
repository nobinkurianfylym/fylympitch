// components/FilmmakerMatchesPreview.tsx
//
// The right-hand column of the homepage "For filmmakers" section: three real
// matches for one real public pitch, with the funder's logo where we hold one.
// Server component, no client JavaScript. Data: getFilmmakerSectionMatches.
//
// Logos sit on a small white tile so every mark — dark, light or boxed —
// reads the same on the section's parchment ground. With no logo on file the
// tile shows the funder's initials instead; never a guessed logo.

import Link from "next/link";
import type { FilmmakerMatches } from "@/components/HomepageDemo";

export default function FilmmakerMatchesPreview({ data }: { data: FilmmakerMatches | null }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="eyebrow">Matched opportunities</p>
        {data && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ash">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
            Live engine output
          </span>
        )}
      </div>

      {data ? (
        <>
          <p className="mb-6 text-[13px] text-ash">
            For{" "}
            <Link href={data.project.href} className="uppercase tracking-[0.04em] text-ink underline decoration-line underline-offset-4 transition-colors hover:text-gold">
              {data.project.title}
            </Link>
            {" · "}
            {data.matches.length} of its {data.total} matches
          </p>

          <div>
            {data.matches.map((m) => (
              <div key={m.name} className="hairline flex items-center gap-4 py-5">
                {/* Landscape tile: most funder marks are wide (Torino FilmLab, Creative Europe, Eurimages). */}
                <div className="flex h-[52px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-white">
                  {m.logo ? (
                    <img
                      src={m.logo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span aria-hidden="true" className="font-display text-[15px] text-ash">{m.monogram}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 line-clamp-2 text-[15px] leading-snug">{m.name}</p>
                  <p className="text-[11px] uppercase leading-[1.5] tracking-[0.1em] text-ash sm:text-[12px] sm:tracking-[0.13em]">
                    {m.typeLabel} · {m.deadline}
                  </p>
                </div>

                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] tabular-nums text-gold"
                  style={{ border: "1px solid rgba(191,153,83,0.35)" }}
                  title={`Match score ${m.score} out of 100`}
                >
                  {m.score}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="hairline py-5 text-[14px] text-ash">
          Every live grant, fund, lab and market is scored against your project the moment you submit it.
        </p>
      )}

      <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-ash/50">
        Free for filmmakers — no verification needed
      </p>
    </div>
  );
}
