import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import { formatBudget } from "@/lib/format";
import { formatFormat, formatCountry, formatStage } from "@/lib/film-identity";

export const dynamic = "force-dynamic";

export default async function MyProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data: profile } = await supabase
    .from("profiles").select("full_name").eq("id", user.id).single();

  // Include synopsis and pitch_deck_path — no match data needed on this page
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, genre, format, stage, country, language, logline, synopsis, budget_currency, funding_needed_usd, finance_secured_usd, budget_usd, poster_path, pitch_deck_path, script_path, has_script_doc, has_budget_doc, has_lookbook, love_count, is_public, admin_hidden, created_at, director_name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  // Bulk fetch anchored proofs for all user projects
  const projectIds = (projects ?? []).map((p: any) => p.id);
  const anchoredSet = new Set<string>();
  if (projectIds.length > 0) {
    const { data: anchoredProofs } = await supabase
      .from("project_proofs")
      .select("project_id")
      .in("project_id", projectIds)
      .eq("ots_status", "anchored");
    (anchoredProofs ?? []).forEach((r: any) => anchoredSet.add(r.project_id));
  }

  const hasProjects = (projects ?? []).length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="eyebrow mb-3">My Films</p>
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

      {/* Project grid */}
      {hasProjects && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(projects ?? []).map((p: any) => (
            <div
              key={p.id}
              className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all relative"
            >
              {/* Visibility badge — top left of thumbnail */}
              <div className="relative">
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

                {/* Pitch deck badge — top right */}
                {p.pitch_deck_path && (
                  <span className="absolute top-2 right-2 z-10 text-[10px] tracking-[0.1em] uppercase bg-white/90 text-ash border border-line/60 px-2.5 py-0.5 rounded-full">
                    Deck ↗
                  </span>
                )}

                <Link href={`/dashboard/projects/${p.id}?from=projects`} className="block">
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

                {/* Title */}
                <Link href={`/dashboard/projects/${p.id}?from=projects`}>
                  <h2
                    className="font-display font-bold text-[18px] mb-2 group-hover:text-gold transition-colors leading-tight uppercase"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {p.title}
                  </h2>
                </Link>

                {/* Metadata row */}
                <p className="text-[12px] text-ash mb-0.5 leading-tight">
                  {[
                    formatFormat(p.format),
                    p.genre,
                    (() => { const c = formatCountry(p.country); return c?.flag ? `${c.flag} ${c.name}` : c?.name ?? null; })(),
                    p.language,
                    formatStage(p.stage),
                  ].filter(Boolean).join(" · ")}
                </p>

                {/* Director */}
                {(p.director_name || profile?.full_name) && (
                  <p className="text-[12px] text-ash mb-3 leading-tight">
                    <span className="text-[10px] font-medium tracking-[0.08em] uppercase text-ash/60 mr-1">Dir.</span>
                    {p.director_name ?? profile?.full_name}
                  </p>
                )}

                {/* Logline */}
                {p.logline && (
                  <p className="italic text-[13px] leading-[1.55] text-ash line-clamp-2 mb-3">
                    {p.logline}
                  </p>
                )}

                {/* Synopsis — truncated, no logline duplication */}
                {p.synopsis && !p.logline && (
                  <p className="text-[13px] leading-[1.6] text-ash line-clamp-3 mb-3">
                    {p.synopsis}
                  </p>
                )}
                {p.synopsis && p.logline && (
                  <p className="text-[12px] leading-[1.55] text-ash/70 line-clamp-2 mb-3">
                    {p.synopsis}
                  </p>
                )}

                {/* Package */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[
                    { label: "Deck",     present: !!(p as any).pitch_deck_path },
                    { label: "Script",   present: !!(p as any).has_script_doc || !!(p as any).script_path },
                    { label: "Budget",   present: !!(p as any).has_budget_doc  || !!(p as any).budget_usd },
                    { label: "Lookbook", present: !!(p as any).has_lookbook },
                  ].map(({ label, present }) => (
                    <span key={label} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                      padding: "3px 8px", borderRadius: 20,
                      border: `1px solid ${present ? "rgba(191,153,83,0.3)" : "rgba(26,24,21,0.08)"}`,
                      background: present ? "rgba(191,153,83,0.06)" : "rgba(26,24,21,0.02)",
                      color: present ? "#7a5e1a" : "#8A857C",
                      fontFamily: "Montserrat, sans-serif",
                    }}>
                      <span style={{ fontSize: 10 }}>{present ? "✓" : "✕"}</span>
                      {label}
                    </span>
                  ))}
                </div>

                {/* Footer — metadata only, no scores */}
                <div className="mt-auto pt-4 border-t border-line flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3 text-[12px] text-ash">
                    {(p.love_count ?? 0) > 0 && (
                      <span>♥ {p.love_count}</span>
                    )}
                    {p.budget_usd && (
                      <span className="text-ash">
                        {formatBudget(p.budget_usd, p.budget_currency)}
                      </span>
                    )}
                    {anchoredSet.has(p.id) && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                        padding: "3px 8px", borderRadius: 20,
                        border: "1px solid rgba(191,153,83,0.35)",
                        background: "rgba(191,153,83,0.07)",
                        color: "#BF9953",
                        fontFamily: "Montserrat, sans-serif",
                      }}>
                        ₿ Anchored
                      </span>
                    )}
                  </div>
                  {p.funding_needed_usd && (
                    <span className="text-[12px] text-gold shrink-0">
                      Seeking {formatBudget(p.funding_needed_usd, p.budget_currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
