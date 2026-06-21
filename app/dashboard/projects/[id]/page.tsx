import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usd, timeAgo } from "@/lib/format";
import { deleteProject, respondToOffer } from "@/lib/project-actions";
import { requestProducerIntroduction } from "@/lib/actions";
import type { Opportunity, Project } from "@/types";
import type {
  FundingDiscovery, FundingObstacle, Roadmap,
  ExecutiveProducerBrief, DreamScenario, FundingReadiness, ProducerMatch,
} from "@/services/fylympitchEngine";
import type { MatchRow } from "@/components/MatchList";
import RerunEngineButton from "@/components/RerunEngineButton";
import ProjectAnalysisLoader from "@/components/ProjectAnalysisLoader";
import FundingJourney, { type JourneyOpp } from "@/components/FundingJourney";
import ProjectIntelligenceBox from "@/components/ProjectIntelligenceBox";
import MessageButton from "@/components/MessageButton";
import FilmIdentity from "@/components/FilmIdentity";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("*, profiles!projects_owner_id_fkey(full_name)")
    .eq("id", id)
    .single<Project>();
  if (!project) notFound();
  const isOwner = project.owner_id === user!.id;

  // ── Engine intelligence ────────────────────────────────────────────
  const { data: intel } = await supabase
    .from("project_intelligence")
    .select("*")
    .eq("project_id", id)
    .single();

  const discovery: FundingDiscovery | null = intel?.funding_discovery ?? null;
  const readiness: FundingReadiness | null = intel?.funding_readiness ?? null;
  const obstacles: FundingObstacle[]       = intel?.obstacles ?? [];
  const roadmap: Roadmap | null            = intel?.roadmap ?? null;
  const epBrief: ExecutiveProducerBrief | null = intel?.executive_producer ?? null;
  const dream: DreamScenario | null        = intel?.dream_scenario ?? null;
  const producerMatches: ProducerMatch[]   = intel?.producer_matches ?? [];

  // ── Introduction requests ──────────────────────────────────────────
  const { data: introRequests } = await supabase
    .from("introduction_requests")
    .select("producer_user_id")
    .eq("filmmaker_id", user!.id)
    .eq("project_id", id);
  const requestedProducerIds = (introRequests ?? []).map(
    (r: { producer_user_id: string }) => r.producer_user_id
  );

  // ── Match scores ───────────────────────────────────────────────────
  type MatchDbRow = {
    score: number; tier: string; reasons: string[];
    opportunity: {
      id: string; title: string; opp_type: string; country: string | null;
      max_award_usd: number | null; deadline: string | null;
      deadline_note: string | null; url: string | null; app_link: string | null;
    } | null;
  };
  const { data: matchRows } = (await supabase
    .from("matches")
    .select(
      "score, tier, reasons, opportunity:opportunities(id,title,opp_type,country,max_award_usd,deadline,deadline_note,url,app_link)"
    )
    .eq("project_id", id)
    .order("score", { ascending: false })) as { data: MatchDbRow[] | null };

  // Completed films only show Buyers & Sales + Release & Distribution
  const COMPLETED_TYPES = new Set([
    "broadcaster", "streamer", "pre_sale", "sales_agent", "distribution",
  ]);
  const isCompleted = project.stage === "completed";

  let ranked: MatchRow[] = [];
  let journeyOpps: JourneyOpp[] = [];

  if (matchRows && matchRows.length > 0) {
    ranked = matchRows
      .filter((m) => m.tier !== "hidden" && m.opportunity)
      .filter((m) => !isCompleted || COMPLETED_TYPES.has(m.opportunity!.opp_type))
      .slice(0, 10)
      .map((m) => ({
        id: m.opportunity!.id, title: m.opportunity!.title,
        opp_type: m.opportunity!.opp_type, max_award_usd: m.opportunity!.max_award_usd,
        deadline_note: m.opportunity!.deadline_note, deadline: m.opportunity!.deadline,
        score: m.score, tier: m.tier, warnings: [],
      }));
    journeyOpps = matchRows
      .filter((m) => m.score > 0 && m.opportunity)
      .filter((m) => !isCompleted || COMPLETED_TYPES.has(m.opportunity!.opp_type))
      .map((m) => ({
        id: m.opportunity!.id, title: m.opportunity!.title,
        country: m.opportunity!.country, opp_type: m.opportunity!.opp_type,
        max_award_usd: m.opportunity!.max_award_usd, deadline: m.opportunity!.deadline,
        deadline_note: m.opportunity!.deadline_note, score: m.score,
        url: m.opportunity!.url, app_link: m.opportunity!.app_link,
      }));
  } else {
    // Fallback: live scoring (CPU-safe, limited to 80 opps)
    let fallbackQuery = supabase
      .from("opportunities")
      .select("*")
      .eq("is_active", true)
      .not("match_weight", "is", null)
      .order("match_weight", { ascending: false })
      .limit(80);

    // For completed films, restrict at DB level too
    if (isCompleted) {
      fallbackQuery = (fallbackQuery as any).in("opp_type", [...COMPLETED_TYPES]);
    }

    const { data: opps } = await fallbackQuery;
    const { calculateMatchScore } = await import("@/services/matching");
    const scoredOpps = (opps ?? []).map((o: Opportunity) => ({
      o, m: calculateMatchScore(project, o),
    }));
    ranked = scoredOpps
      .filter((r) => r.m.tier !== "hidden")
      .sort((a, b) => b.m.score - a.m.score)
      .slice(0, 10)
      .map(({ o, m }) => ({
        id: o.id, title: o.title, opp_type: o.opp_type,
        max_award_usd: o.max_award_usd, deadline_note: (o as any).deadline_note,
        deadline: o.deadline, score: m.score, tier: m.tier, warnings: m.warnings,
      }));
    journeyOpps = scoredOpps
      .filter(({ m }) => m.score > 0)
      .sort((a, b) => b.m.score - a.m.score)
      .map(({ o, m }) => ({
        id: o.id, title: o.title, country: o.country ?? null,
        opp_type: o.opp_type, max_award_usd: o.max_award_usd ?? null,
        deadline: o.deadline ?? null, deadline_note: (o as any).deadline_note ?? null,
        score: m.score, url: o.url ?? null, app_link: (o as any).app_link ?? null,
      }));
  }

  // ── Offers ─────────────────────────────────────────────────────────
  const { data: offers } = isOwner
    ? await supabase
        .from("offers")
        .select("*, profiles!offers_from_user_id_fkey(full_name, company, role)")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  // ── Signed URLs ────────────────────────────────────────────────────
  async function signedUrl(bucket: string, path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }
  const deckUrl   = await signedUrl("pitch-decks", project.pitch_deck_path);
  const scriptUrl = await signedUrl("scripts",     project.script_path);

  return (
    <div className="max-w-4xl">

      {/* ── AUTO-TRIGGER ENGINE ── */}
      {isOwner && !discovery && (
        <ProjectAnalysisLoader projectId={project.id} />
      )}

      {/* ════════════════════════════════════════════════════════════
          1. FILM IDENTITY — standardised header (L1–L8)
      ════════════════════════════════════════════════════════════ */}
      <div className="mb-10 pb-8 border-b border-line">
        <FilmIdentity
          variant="full"
          project={{
            ...project,
            filmmaker: (project as any).profiles
              ? { full_name: (project as any).profiles.full_name, career_stage: null }
              : null,
          }}
          supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {isOwner && (
                <Link
                  href={`/dashboard/projects/${project.id}/edit`}
                  className="btn-ghost !py-2.5 !px-5 text-[13px] flex items-center gap-1.5"
                >
                  Edit project ✎
                </Link>
              )}
              {deckUrl && (
                <a href={deckUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-2.5 !px-5 text-[13px]">
                  Pitch deck ↗
                </a>
              )}
              {scriptUrl && (
                <a href={scriptUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-2.5 !px-5 text-[13px]">
                  Script ↗
                </a>
              )}
            </div>
          }
        />

        {/* Director's statement + Producer info — narrative, below identity */}
        {(project.director_statement || project.producer_info) && (
          <div className="mt-8 space-y-6">
            {project.director_statement && (
              <div className="max-w-2xl">
                <p className="eyebrow mb-2">Director&rsquo;s statement</p>
                <p className="text-[15px] leading-[1.75] text-ink whitespace-pre-line">
                  {project.director_statement}
                </p>
              </div>
            )}
            {project.producer_info && (
              <div className="max-w-2xl">
                <p className="eyebrow mb-2">Producers</p>
                <p className="text-[15px] leading-[1.7] text-ink whitespace-pre-line">
                  {project.producer_info}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          2. INTELLIGENCE BLACK BOX (tabs: matches / producers / dream)
      ════════════════════════════════════════════════════════════ */}
      {isOwner && discovery && (
        <ProjectIntelligenceBox
          discovery={discovery}
          readiness={readiness}
          ranked={ranked}
          producerMatches={producerMatches}
          dream={dream}
          projectId={project.id}
          requestedProducerIds={requestedProducerIds}
        />
      )}

      {/* ════════════════════════════════════════════════════════════
          3. AI EXECUTIVE PRODUCER (separate box)
      ════════════════════════════════════════════════════════════ */}
      {isOwner && epBrief && (
        <section className="mb-10 border border-gold/40 rounded-card bg-gold/5 p-6">
          <p className="eyebrow text-gold mb-3">AI Executive Producer</p>
          <h3 className="font-display text-[20px] mb-2">
            {epBrief.next_best_move?.title}
          </h3>
          <p className="text-[14px] text-ash leading-relaxed mb-4">
            {epBrief.summary}
          </p>
          {epBrief.next_best_move && (
            <div className="flex flex-wrap gap-5 text-[13px] mb-5">
              <span className="text-ash">
                Funding range —{" "}
                <span className="text-ink">{epBrief.next_best_move.funding_range}</span>
              </span>
              <span className="text-ash">
                Success chance —{" "}
                <span className="text-ink">{epBrief.next_best_move.success_chance}%</span>
              </span>
              {epBrief.next_best_move.deadline_days && (
                <span className="text-ash">
                  Deadline —{" "}
                  <span className="text-gold">{epBrief.next_best_move.deadline_days} days</span>
                </span>
              )}
            </div>
          )}
          {epBrief.next_best_move?.opportunity_id && (
            <Link
              href={`/dashboard/opportunities/${epBrief.next_best_move.opportunity_id}?project=${project.id}`}
              className="btn-gold inline-flex"
            >
              {epBrief.next_best_move.action_label ?? "Apply now"} →
            </Link>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════
          4. FUNDING JOURNEY (original component, kept)
      ════════════════════════════════════════════════════════════ */}
      {isOwner && (
        <FundingJourney
          projectId={project.id}
          opportunities={journeyOpps}
          roadmap={roadmap}
          readiness={readiness}
        />
      )}

      {/* ════════════════════════════════════════════════════════════
          5. STRENGTHEN BEFORE APPLYING (obstacles — renamed)
      ════════════════════════════════════════════════════════════ */}
      {isOwner && obstacles.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-[20px] mb-1">Strengthen before applying</h2>
          <p className="text-[13px] text-ash mb-5">
            Address these to improve your match scores and application success rates.
          </p>
          <div className="space-y-3">
            {obstacles.map((ob: FundingObstacle) => (
              <div key={ob.id} className="card p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full
                      ${ob.severity === "high"   ? "bg-red-100 text-red-700"
                      : ob.severity === "medium" ? "bg-amber-100 text-amber-700"
                      :                            "bg-line text-ash"}`}>
                      {ob.severity}
                    </span>
                    <span className="text-[15px]">{ob.label}</span>
                  </div>
                </div>
                {ob.action_href && (
                  <Link href={ob.action_href} className="btn-ghost !px-4 !py-2 text-[12px] whitespace-nowrap shrink-0">
                    Fix this →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════
          8. OFFERS
      ════════════════════════════════════════════════════════════ */}
      {isOwner && (offers?.length ?? 0) > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[22px] mb-6">Offers</h2>
          <div className="space-y-4">
            {offers!.map((o: any) => (
              <div key={o.id} className="card p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[15px]">
                    {o.profiles?.full_name}
                    {o.profiles?.company && (
                      <span className="text-ash"> · {o.profiles.company}</span>
                    )}
                    <span className="eyebrow ml-3">
                      {o.offer_type.replace("_", "-")} · {timeAgo(o.created_at)}
                    </span>
                  </div>
                  <div className="font-display text-[20px] text-gold">{usd(o.amount_usd)}</div>
                </div>
                <p className="mt-3 text-[14px] text-ash leading-relaxed">{o.message}</p>
                {o.status === "pending" ? (
                  <div className="mt-5 flex gap-3">
                    <form action={respondToOffer}>
                      <input type="hidden" name="offer_id" value={o.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <button className="btn-gold !px-5 !py-2.5">Accept</button>
                    </form>
                    <form action={respondToOffer}>
                      <input type="hidden" name="offer_id" value={o.id} />
                      <input type="hidden" name="decision" value="declined" />
                      <button className="btn-ghost !px-5 !py-2.5">Decline</button>
                    </form>
                    <MessageButton
                      projectId={project.id}
                      producerId={o.from_user_id}
                      filmakerId={user!.id}
                      label="Reply"
                      className="btn-ghost !px-5 !py-2.5 gap-2"
                      inboxPath="/dashboard/messages"
                    />
                  </div>
                ) : (
                  <p className="mt-4 eyebrow">{o.status}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RE-RUN ENGINE ── */}
      {isOwner && !!discovery && (
        <div className="mt-12 mb-4">
          <RerunEngineButton projectId={project.id} hasData={true} />
        </div>
      )}

      {/* ── DELETE ── */}
      {isOwner && (
        <form action={deleteProject} className="mt-16 hairline pt-8">
          <input type="hidden" name="project_id" value={project.id} />
          <button className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-red-700">
            Delete this project
          </button>
        </form>
      )}
    </div>
  );
}
