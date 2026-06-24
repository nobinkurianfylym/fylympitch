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
import SaveToPipelineButton from "@/components/SaveToPipelineButton";

export const dynamic = "force-dynamic";

// scoreProject: all array fields guarded against null (DB JSONB may return null not [])
function scoreProject(
  project: { genre: string | null; format: string | null; country: string | null; budget_usd: number | null },
  profile: { genres: string[] | null; formats: string[] | null; territories: string[] | null; budget_range: string | null }
): number {
  const genres     = profile.genres     ?? [];
  const formats    = profile.formats    ?? [];
  const territories = profile.territories ?? [];
  let score = 0;
  const norm = (s: string | null) => (s ?? "").toLowerCase().trim();
  if (genres.length === 0     || genres.some((g) => norm(g) === norm(project.genre)))       score += 40;
  if (formats.length === 0    || formats.some((f) => norm(f) === norm(project.format)))     score += 25;
  if (territories.length === 0 || territories.some((t) => norm(t) === norm(project.country))) score += 25;
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
  // Module-level constants moved inside function — avoids Worker cold-start CPU cost
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

  // Exclusive pitches — projects pitched directly to this producer
  const { data: exclusivePitches } = await supabase
    .from("projects")
    .select("id, title, genre, format, stage, country, language, budget_currency, budget_usd, finance_secured_usd, funding_needed_usd, logline, poster_path, love_count, is_public, director_name, owner_id, created_at, filmmaker:profiles!projects_owner_id_fkey(full_name, career_stage)")
    .eq("target_producer_id", user.id)
    .order("created_at", { ascending: false });

  const exclusiveSet = new Set((exclusivePitches ?? []).map((p: any) => p.id));

  const pipelineCount   = pipelineRows?.length ?? 0;
  const crmByProject    = new Map((pipelineRows ?? []).map((r: any) => [r.project_id, r]));
  const lovedSet        = new Set((loves ?? []).map((r: any) => r.project_id));

  // Score all 50, take top 9 (exclude already-shown exclusive pitches)
  const top9 = (projects ?? []).filter((p: any) => !exclusiveSet.has(p.id))
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
          <p className="text-[14px] text-ash mt-1">
            {(exclusivePitches ?? []).length > 0
              ? `${(exclusivePitches ?? []).length} exclusive pitch${(exclusivePitches ?? []).length > 1 ? "es" : ""} · Top 9 matched projects`
              : "Top 9 projects matched to your taste profile"}
          </p>
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

      {/* ── Exclusive pitches — no limit ── */}
      {(exclusivePitches ?? []).length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-[0.14em] uppercase font-semibold bg-gold/10 text-gold border border-gold/30">
              ✦ Exclusive Pitches
            </span>
            <span className="text-[12px] text-ash">Submitted directly to you</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(exclusivePitches ?? []).map((p: any) => {
              const filmmaker = Array.isArray(p.filmmaker) ? p.filmmaker[0] : p.filmmaker;
              const crm       = crmByProject.get(p.id);
              const pillCls   = crm ? PIPELINE_PILL[crm.status] : null;
              const pillLbl   = crm ? PIPELINE_LABEL[crm.status] : null;
              const frs       = frsMap.get(p.id);
              return (
                <FilmIdentity
                  key={p.id}
                  variant="compact-card"
                  project={{
                    id: p.id, title: p.title, genre: p.genre, format: p.format,
                    stage: p.stage, country: p.country, language: p.language,
                    logline: p.logline, poster_path: p.poster_path,
                    budget_usd: p.budget_usd, budget_currency: p.budget_currency,
                    financing_secured_usd: p.finance_secured_usd ?? null,
                    funding_needed_usd: p.funding_needed_usd ?? null,
                    is_public: p.is_public, director_name: p.director_name ?? null,
                    filmmaker: filmmaker ? { full_name: filmmaker.full_name, username: filmmaker.username ?? null, career_stage: filmmaker.career_stage ?? null } : null,
                  }}
                  supabaseUrl={supabaseUrl}
                  actions={
                    <div className="flex flex-col gap-1.5 w-full">
                      {pillCls && pillLbl ? (
                        <Link href="/producer/pipeline" className={`block text-center text-[12px] ${pillCls} rounded-full px-3 py-1.5`}>{pillLbl}</Link>
                      ) : (
                        <SaveToPipelineButton projectId={p.id} />
                      )}
                      <MessageButton projectId={p.id} producerId={user.id} filmakerId={p.owner_id} filmmakerName={filmmaker?.full_name ?? ""} size="sm" />
                    </div>
                  }
                />
              );
            })}
          </div>
          {top9.length > 0 && <div className="h-px bg-line mt-10 mb-8" />}
        </div>
      )}

      {top9.length === 0 && (exclusivePitches ?? []).length === 0 ? (
        <div className="card py-16 text-center">
          <p className="font-display text-[22px] mb-3">No public projects yet</p>
          <p className="text-ash text-[15px] mb-6">Check back soon as filmmakers submit their work.</p>
          <Link href="/producer/profile" className="btn-ghost">Update taste profile</Link>
        </div>
      ) : top9.length > 0 ? (
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
                      <SaveToPipelineButton projectId={p.id} />
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : null}
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
