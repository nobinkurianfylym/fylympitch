import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import { usd, formatBudget } from "@/lib/format";
import { formatFormat, formatCountry, formatStage } from "@/lib/film-identity";

export const dynamic = "force-dynamic";

function scoreBadgeStyle(score: number) {
  if (score >= 80) return "bg-emerald-600 text-white";
  if (score >= 60) return "bg-gold text-white";
  return "bg-ink/60 text-ivory";
}

export default async function MyProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, genre, format, stage, country, language, logline, budget_currency, funding_needed_usd, finance_secured_usd, poster_path, love_count, is_public, admin_hidden, created_at, director_name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p: any) => p.id);

  const { data: matchData } = projectIds.length
    ? await supabase
        .from("matches")
        .select("project_id, score")
        .in("project_id", projectIds)
        .order("score", { ascending: false })
    : { data: [] as any[] };

  const bestScoreByProject: Record<string, number> = {};
  const matchCountByProject: Record<string, number> = {};
  for (const m of matchData ?? []) {
    if (bestScoreByProject[m.project_id] == null) bestScoreByProject[m.project_id] = m.score;
    matchCountByProject[m.project_id] = (matchCountByProject[m.project_id] ?? 0) + 1;
  }

  const hasProjects = (projects ?? []).length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="eyebrow mb-3">PITCH.FYLYM Engine</p>
          <h1 className="font-display text-[34px] font-[400]">My Projects</h1>
        </div>
        <Link href="/dashboard/projects/new" className="btn-gold">New project</Link>
      </div>

      {/* Empty state */}
      {!hasProjects && (
        <div className="py-28 text-center max-w-md mx-auto">
          <p className="font-display text-[30px] font-[400] mb-4 leading-tight">
            Your slate is empty.
          </p>
          <p className="text-[15px] text-ash leading-relaxed mb-10">
            Submit your first pitch and let the engine match your film with funds, labs and co-producers worldwide.
          </p>
          <Link href="/dashboard/projects/new" className="btn-gold">
            Submit your first pitch →
          </Link>
          <p className="mt-5 text-[12px] text-ash">
            Takes 15–20 seconds. Upload a pitch deck or fill manually.
          </p>
        </div>
      )}

      {/* Tile grid */}
      {hasProjects && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(projects ?? []).map((p: any) => {
            const best = bestScoreByProject[p.id];
            const matchCount = matchCountByProject[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all relative"
              >
                {/* Badges — top of thumbnail */}
                <div className="relative">
                  {/* Private badge — top left */}
                  {p.admin_hidden && (
                    <span className="absolute top-2 left-2 z-10 text-[10px] tracking-[0.14em] uppercase bg-red-600/90 text-white px-2.5 py-0.5 rounded-full">
                      Admin hidden
                    </span>
                  )}
                  {!p.admin_hidden && !p.is_public && (
                    <span className="absolute top-2 left-2 z-10 text-[10px] tracking-[0.14em] uppercase bg-ink/75 text-ivory px-2.5 py-0.5 rounded-full">
                      Private
                    </span>
                  )}
                  {/* Match score badge — top right */}
                  {best != null && (
                    <span className={`absolute top-2 right-2 z-10 text-[10px] tracking-[0.1em] font-medium px-2.5 py-0.5 rounded-full ${scoreBadgeStyle(best)}`}>
                      {best} match
                    </span>
                  )}
                  <Link href={`/dashboard/projects/${p.id}`} className="block">
                    <div className="aspect-[3/2] overflow-hidden">
                      <ProjectThumbnail
                        posterPath={p.poster_path}
                        title={p.title}
                        genre={p.genre}
                        supabaseUrl={supabaseUrl}
                        className="w-full h-full rounded-t-card"
                      />
                    </div>
                  </Link>
                </div>

                {/* Card body */}
                <div className="p-5 flex flex-col flex-1">
                  {/* L1: Title */}
                  <Link href={`/dashboard/projects/${p.id}`}>
                    <h2
                      className="font-display font-bold text-[18px] mb-2 group-hover:text-gold transition-colors leading-tight uppercase"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {p.title}
                    </h2>
                  </Link>
                  {/* L2: Metadata row */}
                  <p className="text-[12px] text-ash mb-0.5 leading-tight">
                    {[
                      formatFormat(p.format),
                      p.genre,
                      (() => { const c = formatCountry(p.country); return c?.flag ? `${c.flag} ${c.name}` : c?.name ?? null; })(),
                      p.language,
                      formatStage(p.stage),
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {/* Director line */}
                  {p.director_name && (
                    <p className="text-[12px] text-ash mb-2.5 leading-tight">
                      <span className="text-[10px] font-medium tracking-[0.08em] uppercase text-ash/60 mr-1">Dir.</span>
                      {p.director_name}
                    </p>
                  )}
                  {!p.director_name && <div className="mb-2.5" />}
                  {/* L5: Logline */}
                  {p.logline && (
                    <p className="italic text-[13px] leading-[1.55] text-ash line-clamp-2 flex-1">
                      {p.logline}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[12px] text-ash">
                      {matchCount > 0 && (
                        <span className="text-gold tracking-[0.06em]">
                          {matchCount} {matchCount === 1 ? "match" : "matches"}
                        </span>
                      )}
                      {(p.love_count ?? 0) > 0 && (
                        <span>♥ {p.love_count}</span>
                      )}
                    </div>
                    {p.funding_needed_usd && (
                      <span className="text-[12px] text-gold shrink-0">
                        Seeking {formatBudget(p.funding_needed_usd, (p as any).budget_currency)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
