import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usd } from "@/lib/format";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import AddToPipelineButton from "@/components/AddToPipelineButton";

export const dynamic = "force-dynamic";

function scoreProject(
  project: { genre: string | null; format: string | null; country: string | null; budget_usd: number | null },
  profile: { genres: string[]; formats: string[]; territories: string[]; budget_range: string | null }
): number {
  let score = 0;
  const norm = (s: string | null) => (s ?? "").toLowerCase().trim();

  if (profile.genres.length === 0 || profile.genres.some((g) => norm(g) === norm(project.genre)))
    score += 40;
  if (profile.formats.length === 0 || profile.formats.some((f) => norm(f) === norm(project.format)))
    score += 25;
  if (profile.territories.length === 0 || profile.territories.some((t) => norm(t) === norm(project.country)))
    score += 25;

  const ranges: Record<string, [number, number]> = {
    micro: [0, 100_000],
    low:   [100_000, 500_000],
    mid:   [500_000, 2_000_000],
    high:  [2_000_000, Number.MAX_SAFE_INTEGER],
  };
  if (profile.budget_range && project.budget_usd != null) {
    const [min, max] = ranges[profile.budget_range] ?? [0, Infinity];
    if (project.budget_usd >= min && project.budget_usd <= max) score += 10;
  } else {
    score += 5;
  }

  return score;
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

  const [{ data: projects }, { data: pipelineRows }, { count: pipelineCount }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, genre, format, country, budget_usd, funding_needed_usd, logline, poster_path")
      .eq("is_public", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("producer_projects")
      .select("project_id")
      .eq("producer_id", user.id)
      .neq("status", "passed"),
    supabase
      .from("producer_projects")
      .select("id", { count: "exact", head: true })
      .eq("producer_id", user.id)
      .neq("status", "passed"),
  ]);

  const pipelineSet = new Set((pipelineRows ?? []).map((r: any) => r.project_id));

  const scored = (projects ?? [])
    .map((p) => ({ ...p, _score: scoreProject(p, producerProfile) }))
    .sort((a, b) => b._score - a._score);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const tierLabel = (score: number) =>
    score >= 80 ? "Strong match" : score >= 60 ? "Good match" : score >= 40 ? "Possible" : "Open";

  const tierColor = (score: number) =>
    score >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
    score >= 60 ? "text-gold bg-gold/10 border-gold/30" :
    "text-ash bg-parchment border-line";

  return (
    <div className="p-6 md:p-10">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">FYLYMPITCH Engine · Producer Studio</p>
          <h1 className="font-display text-[32px]">Discover</h1>
          <p className="text-[14px] text-ash mt-1">Projects matched to your taste profile</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/producer/pipeline" className="btn-ghost relative">
            Your Pipeline
            {(pipelineCount ?? 0) > 0 && (
              <span className="ml-2 bg-gold text-white text-[10px] px-2 py-0.5 rounded-full">
                {pipelineCount}
              </span>
            )}
          </Link>
          <Link href="/producer/projects" className="btn-gold">Browse all</Link>
        </div>
      </div>

      {scored.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="font-display text-[22px] mb-3">No public projects yet</p>
          <p className="text-ash text-[15px] mb-6">Check back soon as filmmakers submit their work.</p>
          <Link href="/producer/profile" className="btn-ghost">Update your taste profile</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {scored.map((p) => (
            <div
              key={p.id}
              className="card p-4 flex items-center gap-4 hover:border-gold/40 transition-colors"
            >
              {/* Score */}
              <div className="shrink-0 text-center w-12">
                <div className="font-display text-[24px] text-gold leading-none">{p._score}</div>
                <div className="text-[9px] tracking-[0.14em] uppercase text-ash mt-0.5">match</div>
              </div>

              {/* Thumbnail */}
              <ProjectThumbnail
                posterPath={p.poster_path}
                title={p.title}
                genre={p.genre}
                supabaseUrl={supabaseUrl}
                className="w-20 h-12 rounded shrink-0"
              />

              {/* Info — navigates to project */}
              <Link
                href={`/producer/projects/${p.id}`}
                className="flex-1 min-w-0 group"
              >
                <p className="font-display text-[15px] group-hover:text-gold transition-colors truncate leading-snug">
                  {p.title}
                </p>
                <p className="text-[12px] text-ash mt-0.5 truncate">
                  {[p.genre, p.format, p.country].filter(Boolean).join(" · ")}
                </p>
                {p.logline && (
                  <p className="text-[11px] text-ash/60 mt-0.5 line-clamp-1 hidden sm:block">
                    {p.logline}
                  </p>
                )}
              </Link>

              {/* Right — match tier + pipeline button */}
              <div className="shrink-0 flex flex-col items-end gap-2">
                <span className={`text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border hidden sm:inline-block ${tierColor(p._score)}`}>
                  {tierLabel(p._score)}
                </span>
                {p.funding_needed_usd && (
                  <p className="text-[11px] text-gold hidden md:block">{usd(p.funding_needed_usd)}</p>
                )}
                <AddToPipelineButton
                  projectId={p.id}
                  inPipeline={pipelineSet.has(p.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/producer/profile" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
          Update taste profile
        </Link>
      </div>
    </div>
  );
}
