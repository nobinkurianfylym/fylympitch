import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usd } from "@/lib/format";

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

  // Fetch all public projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, genre, format, country, language, budget_usd, funding_needed_usd, logline, poster_path, stage, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  // Fetch pipeline CRM count
  const { count: pipelineCount } = await supabase
    .from("producer_projects")
    .select("id", { count: "exact", head: true })
    .eq("producer_id", user.id)
    .neq("status", "passed");

  // Score + sort
  const scored = (projects ?? [])
    .map((p) => ({ ...p, _score: scoreProject(p, producerProfile) }))
    .sort((a, b) => b._score - a._score);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

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
        <div className="space-y-3">
          {scored.map((p, i) => {
            const thumb = p.poster_path
              ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}`
              : null;
            const matchTier =
              p._score >= 80 ? "Strong match" :
              p._score >= 60 ? "Good match" :
              p._score >= 40 ? "Possible match" : "Open";

            const tierColor =
              p._score >= 80 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
              p._score >= 60 ? "text-gold bg-gold/10 border-gold/30" :
              "text-ash bg-parchment border-line";

            return (
              <Link
                key={p.id}
                href={`/producer/projects/${p.id}`}
                className="card p-5 flex items-center gap-5 hover:border-gold/50 transition-colors group"
              >
                {/* Score bar */}
                <div className="shrink-0 text-center w-14">
                  <div className="font-display text-[26px] text-gold leading-none">{p._score}</div>
                  <div className="text-[9px] tracking-[0.16em] uppercase text-ash mt-0.5">match</div>
                </div>

                {/* Thumbnail */}
                {thumb ? (
                  <img src={thumb} alt={p.title} className="w-16 h-10 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-16 h-10 bg-parchment rounded shrink-0 flex items-center justify-center">
                    <span className="text-[18px] text-ash/40">🎬</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[16px] group-hover:text-gold transition-colors truncate">{p.title}</p>
                  <p className="text-[12px] text-ash mt-0.5">
                    {[p.genre, p.format, p.country].filter(Boolean).join(" · ")}
                  </p>
                  {p.logline && (
                    <p className="text-[12px] text-ash/70 mt-1 line-clamp-1 hidden sm:block">{p.logline}</p>
                  )}
                </div>

                {/* Right */}
                <div className="shrink-0 text-right hidden md:block">
                  <span className={`text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-full border ${tierColor}`}>
                    {matchTier}
                  </span>
                  {p.funding_needed_usd && (
                    <p className="text-[12px] text-gold mt-2">{usd(p.funding_needed_usd)}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Update taste profile link */}
      <div className="mt-10 text-center">
        <Link href="/producer/profile" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
          Update taste profile
        </Link>
      </div>
    </div>
  );
}
