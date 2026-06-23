import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { upsertProducerProject } from "@/lib/actions";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";
import MessageButton from "@/components/MessageButton";
import FRSButton from "@/components/FRSButton";
import FilmIdentity from "@/components/FilmIdentity";
import { formatBudget } from "@/lib/format";

export const dynamic = "force-dynamic";

const PIPELINE_PILL: Record<string, string> = {
  saved:       "bg-parchment text-ash",
  shortlisted: "bg-blue-50 text-blue-700",
  in_review:   "bg-amber-50 text-amber-700",
  meeting_set: "bg-emerald-50 text-emerald-700",
  deal_active: "bg-gold/10 text-gold",
};
const PIPELINE_LABEL: Record<string, string> = {
  saved: "Saved", shortlisted: "Shortlisted", in_review: "In Review",
  meeting_set: "Meeting Set", deal_active: "Deal Active",
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
      .select("id, title, genre, format, stage, country, language, budget_currency, budget_usd, finance_secured_usd, funding_needed_usd, logline, poster_path, love_count, is_public, director_name, owner_id, created_at, filmmaker:profiles!projects_owner_id_fkey(full_name, career_stage)")
      .eq("admin_hidden", false)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("producer_projects")
      .select("project_id, status")
      .eq("producer_id", user.id)
      .neq("status", "passed"),
    supabase
      .from("project_loves")
      .select("project_id")
      .eq("user_id", user.id),
  ]);

  const pipelineCount   = pipelineRows?.length ?? 0;
  const crmByProject    = new Map((pipelineRows ?? []).map((r: any) => [r.project_id, r]));
  const lovedSet        = new Set((loves ?? []).map((r: any) => r.project_id));

  // Score all 50, take top 9
  const top9 = (projects ?? [])
    .map((p) => ({ ...p, _score: scoreProject(p, producerProfile) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 9);

  // Fetch funding readiness scores for top 9
  const top9Ids = top9.map((p) => p.id);
  const { data: intelligenceRows } = top9Ids.length
    ? await supabase
        .from("project_intelligence")
        .select("project_id, funding_readiness")
        .in("project_id", top9Ids)
    : { data: [] };

  const frsMap = new Map<string, { score: number; missing: string[]; fund_requirements?: string[] }>(
    (intelligenceRows ?? [])
      .filter((r: any) => r.funding_readiness?.score != null)
      .map((r: any) => [r.project_id as string, r.funding_readiness])
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="p-6 md:p-10">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">PITCH.FYLYM Engine · Producer Studio</p>
          <h1 className="font-display text-[32px]">Discover</h1>
          <p className="text-[14px] text-ash mt-1">Top 9 projects matched to your taste profile</p>
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
            const crm       = crmByProject.get(p.id);
            const pillCls   = crm ? PIPELINE_PILL[crm.status] : null;
            const pillLbl   = crm ? PIPELINE_LABEL[crm.status] : null;
            const frs       = frsMap.get(p.id);

            return (
              <FilmIdentity
                key={p.id}
                variant="compact-card"
                project={{ ...p, filmmaker }}
                supabaseUrl={supabaseUrl}
                href={`/producer/projects/${p.id}`}
                actions={
                  <div className="space-y-2.5">

                    {/* Stage pill — only when in pipeline */}
                    {pillCls && pillLbl && (
                      <span className={`inline-flex text-[10px] font-medium tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border border-line ${pillCls}`}>
                        {pillLbl}
                      </span>
                    )}

                    {/* Action row: FRS · Message · Like · Share */}
                    <div className="flex items-center gap-2">
                      <FRSButton
                        score={frs?.score ?? null}
                        missing={frs?.missing ?? []}
                        fundRequirements={frs?.fund_requirements}
                        projectTitle={p.title}
                      />
                      <MessageButton
                        projectId={p.id}
                        producerId={user.id}
                        filmakerId={p.owner_id}
                        label="Message"
                        className="btn-ghost !py-1.5 !px-3 text-[12px] gap-1.5 flex-1"
                      />
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

                    {/* Pipeline action */}
                    {crm ? (
                      <Link
                        href="/producer/pipeline"
                        className="block text-center text-[12px] text-gold hover:underline py-1.5"
                      >
                        Open in Pipeline →
                      </Link>
                    ) : (
                      <form action={upsertProducerProject} className="w-full">
                        <input type="hidden" name="project_id" value={p.id} />
                        <input type="hidden" name="status" value="saved" />
                        <button className="btn-ghost !py-1.5 w-full text-[12px]">+ Add to Pipeline</button>
                      </form>
                    )}
                  </div>
                }
              />
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
