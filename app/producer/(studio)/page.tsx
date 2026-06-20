import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usd } from "@/lib/format";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import AddToPipelineButton from "@/components/AddToPipelineButton";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

const CAREER_LABEL: Record<string, string> = {
  debut: "Debut", second_film: "2nd Film",
  established: "Established", veteran: "Veteran",
};

function scoreProject(
  project: { genre: string | null; format: string | null; country: string | null; budget_usd: number | null },
  profile: { genres: string[]; formats: string[]; territories: string[]; budget_range: string | null }
): number {
  let score = 0;
  const norm = (s: string | null) => (s ?? "").toLowerCase().trim();
  if (profile.genres.length === 0 || profile.genres.some((g) => norm(g) === norm(project.genre))) score += 40;
  if (profile.formats.length === 0 || profile.formats.some((f) => norm(f) === norm(project.format))) score += 25;
  if (profile.territories.length === 0 || profile.territories.some((t) => norm(t) === norm(project.country))) score += 25;
  const ranges: Record<string, [number, number]> = {
    micro: [0, 100_000], low: [100_000, 500_000],
    mid: [500_000, 2_000_000], high: [2_000_000, Number.MAX_SAFE_INTEGER],
  };
  if (profile.budget_range && project.budget_usd != null) {
    const [min, max] = ranges[profile.budget_range] ?? [0, Infinity];
    if (project.budget_usd >= min && project.budget_usd <= max) score += 10;
  } else {
    score += 5;
  }
  return score;
}

function scoreBadgeStyle(score: number) {
  if (score >= 80) return "bg-emerald-600 text-white";
  if (score >= 60) return "bg-gold text-white";
  return "bg-ink/70 text-ivory";
}

export default async function ProducerDiscoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: producerProfile } = await supabase
    .from("producer_profiles")
    .select("genres, formats, territories, budget_range, country")
    .eq("user_id", user.id)
    .single();

  if (!producerProfile) redirect("/producer/onboarding");

  const [{ data: projects }, { data: pipelineRows }, { data: loves }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, genre, format, country, budget_usd, funding_needed_usd, logline, poster_path, love_count, is_public, filmmaker:profiles!projects_owner_id_fkey(full_name, career_stage)")
      .eq("admin_hidden", false)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("producer_projects")
      .select("project_id")
      .eq("producer_id", user.id)
      .neq("status", "passed"),
    supabase
      .from("project_loves")
      .select("project_id")
      .eq("user_id", user.id),
  ]);

  const pipelineCount = pipelineRows?.length ?? 0;
  const pipelineSet   = new Set((pipelineRows ?? []).map((r: any) => r.project_id));
  const lovedSet      = new Set((loves ?? []).map((r: any) => r.project_id));

  // Score all 50, take top 9 — enforces focus, eliminates decision fatigue
  const top9 = (projects ?? [])
    .map((p) => ({ ...p, _score: scoreProject(p, producerProfile) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 9);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="p-6 md:p-10">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">FYLYMPITCH Engine · Producer Studio</p>
          <h1 className="font-display text-[32px]">Discover</h1>
          <p className="text-[14px] text-ash mt-1">Your top 9 matches today</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/producer/pipeline" className="btn-ghost relative">
            Pipeline
            {pipelineCount > 0 && (
              <span className="ml-2 bg-gold text-white text-[10px] px-2 py-0.5 rounded-full">
                {pipelineCount}
              </span>
            )}
          </Link>
          <Link href="/producer/projects" className="btn-gold">Browse all</Link>
        </div>
      </div>

      {top9.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="font-display text-[22px] mb-3">No public projects yet</p>
          <p className="text-ash text-[15px] mb-6">Check back soon as filmmakers submit their work.</p>
          <Link href="/producer/profile" className="btn-ghost">Update taste profile</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {top9.map((p: any) => {
            const filmmaker = Array.isArray(p.filmmaker) ? p.filmmaker[0] : p.filmmaker;
            return (
              <div key={p.id}
                className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all">

                {/* Thumbnail with match score badge */}
                <div className="relative">
                  <Link href={`/producer/projects/${p.id}`}>
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
                  {/* Private badge — top left */}
                  {!p.is_public && (
                    <span className="absolute top-2 left-2 text-[10px] tracking-[0.14em] uppercase font-medium px-2 py-0.5 rounded-full bg-ink/80 text-ivory">
                      Private
                    </span>
                  )}
                  {/* Match score badge — top right corner */}
                  <span className={`absolute top-2 right-2 text-[11px] tracking-[0.1em] font-medium px-2 py-0.5 rounded-full ${scoreBadgeStyle(p._score)}`}>
                    {p._score} match
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-2">
                    {p.genre} · {p.format?.charAt(0).toUpperCase() + (p.format?.slice(1) ?? "")}
                  </p>

                  <Link href={`/producer/projects/${p.id}`}>
                    <h2 className="font-display text-[20px] font-[400] mb-2 group-hover:text-gold transition-colors leading-snug">
                      {p.title}
                    </h2>
                  </Link>

                  {p.logline && (
                    <p className="font-display italic text-[13px] leading-[1.55] text-ash line-clamp-2 flex-1">
                      "{p.logline}"
                    </p>
                  )}

                  {/* Filmmaker credit line */}
                  {filmmaker?.full_name && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-ash">
                      <span>{filmmaker.full_name}</span>
                      {filmmaker.career_stage && (
                        <span className="text-[10px] tracking-[0.1em] uppercase bg-parchment border border-line px-2 py-0.5 rounded-full">
                          {CAREER_LABEL[filmmaker.career_stage] ?? filmmaker.career_stage}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Love + share row */}
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <LoveButton
                        projectId={p.id}
                        initialCount={p.love_count ?? 0}
                        initialLiked={lovedSet.has(p.id)}
                        isLoggedIn={true}
                        size="sm"
                      />
                      <ShareButton
                        projectId={p.id}
                        title={p.title}
                        genre={p.genre}
                        country={p.country}
                        size="sm"
                      />
                    </div>
                    {p.funding_needed_usd && (
                      <span className="text-[11px] text-gold shrink-0">{usd(p.funding_needed_usd)}</span>
                    )}
                  </div>

                  {/* Pipeline button — full width at bottom */}
                  <div className="mt-3">
                    <AddToPipelineButton
                      projectId={p.id}
                      inPipeline={pipelineSet.has(p.id)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer links */}
      <div className="mt-10 flex items-center justify-between">
        <Link href="/producer/projects"
          className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
          Browse all projects →
        </Link>
        <Link href="/producer/profile"
          className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
          Update taste profile
        </Link>
      </div>
    </div>
  );
}
