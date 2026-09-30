// components/ProducerShowcasePreview.tsx
//
// The right-hand column of the homepage "For producers" section: three real
// public pitches with their posters. Server component, no client JavaScript.
//
// It replaced three invented titles with invented match scores (94, 87, 82).
// Nothing calculated those numbers, so nothing here shows a score: only what
// the filmmaker published — title, genre, format, stage, territory.
//
// Posters arrive in every shape (2:3 one-sheets, squares, landscape key art).
// Each sits whole in a uniform 2:3 frame; a blurred copy of the same image
// fills the rest, as on the homepage Featured card. Same URL for both layers,
// so the browser downloads it once.

import Link from "next/link";
import { sized, srcSet2x } from "@/lib/image-url";
import { preferThumb } from "@/lib/poster-url";
import { supabaseUrl } from "@/lib/supabase/env";
import { formatCountry, formatFormat, formatStage } from "@/lib/film-identity";
import { getProducerSampleProjects, type SampleProject } from "@/lib/cached-queries";
import { getEngineDemo } from "@/components/HomepageDemo";

function posterUrl(path: string): string | null {
  try {
    return `${supabaseUrl()}/storage/v1/object/public/thumbnails/${preferThumb(path)}`;
  } catch {
    return null; // env missing at build time; the frame shows its plate
  }
}

/**
 * The column with its data, streamed on the homepage like the engine demo.
 * Never shows a pitch the engine section above is already showing.
 */
export async function ProducerShowcaseLive() {
  const [candidates, demo] = await Promise.all([getProducerSampleProjects(), getEngineDemo()]);
  const shown = new Set(demo.ids);
  return <ProducerShowcasePreview projects={candidates.filter((p) => !shown.has(p.id)).slice(0, 3)} />;
}

export default function ProducerShowcasePreview({ projects }: { projects: SampleProject[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="eyebrow">From the project showcase</p>
        {projects.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ash">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
            Live · public
          </span>
        )}
      </div>

      {projects.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          {projects.map((p) => {
            const url = posterUrl(p.poster_path);
            const src = url ? sized(url, 240) : "";
            const srcSet = url ? srcSet2x(url, 240) || undefined : undefined;
            const format = formatFormat(p.format);
            const stage = formatStage(p.stage);
            const country = formatCountry(p.country)?.name;
            return (
              <Link
                key={p.id}
                href={`/filmprojects/${p.slug ?? p.id}`}
                className="group block min-w-0"
              >
                <div className="relative aspect-[2/3] max-w-full overflow-hidden rounded-[10px] border border-line bg-parchment shadow-[0_18px_36px_-26px_rgba(26,24,21,0.55)] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                  {src && (
                    <>
                      <img
                        src={src}
                        srcSet={srcSet}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full scale-[1.2] object-cover blur-[18px] brightness-90"
                      />
                      <img
                        src={src}
                        srcSet={srcSet}
                        alt={`${p.title} poster`}
                        loading="lazy"
                        decoding="async"
                        className="relative block h-full w-full object-contain"
                      />
                    </>
                  )}
                </div>

                {/* Project titles are always shown in capitals on the platform. */}
                <p className="mb-1.5 mt-3 line-clamp-2 min-h-[2.5em] font-display text-[13px] uppercase leading-[1.25] tracking-[0.04em] transition-colors group-hover:text-gold sm:mt-3.5 sm:text-[15px]">
                  {p.title}
                </p>
                <div className="text-[9.5px] uppercase leading-[1.5] tracking-[0.05em] text-ash sm:text-[10.5px] sm:tracking-[0.12em]">
                  {(p.genre || format) && (
                    <p className="truncate">
                      {p.genre}
                      {format && <span className="hidden sm:inline">{p.genre ? " · " : ""}{format}</span>}
                    </p>
                  )}
                  {stage && <p className="truncate">{stage}</p>}
                  {country && <p className="truncate">{country}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="hairline mt-8 flex flex-wrap items-center justify-between gap-3 pt-4">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-ash/70">
          Private projects unlock once your producer account is approved
        </p>
        <Link
          href="/filmprojects"
          className="border-b border-gold pb-0.5 text-[10.5px] uppercase tracking-[0.14em] text-gold transition-colors hover:text-ink"
        >
          Browse all projects →
        </Link>
      </div>
    </div>
  );
}
