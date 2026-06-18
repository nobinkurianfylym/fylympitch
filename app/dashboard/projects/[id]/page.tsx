import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MatchBadge from "@/components/MatchBadge";
import MessageButton from "@/components/MessageButton";
import { usd, STAGE_LABEL, TYPE_LABEL, timeAgo } from "@/lib/format";
import { deleteProject, respondToOffer } from "@/lib/project-actions";
import { requestProducerIntroduction } from "@/lib/actions";
import type { Opportunity, Project } from "@/types";
import type {
  FundingDiscovery,
  FundingObstacle,
  Roadmap,
  ExecutiveProducerBrief,
  DreamScenario,
  FundingReadiness,
  ProducerMatch,
} from "@/services/fylympitchEngine";
import MatchList from "@/components/MatchList";
import type { MatchRow } from "@/components/MatchList";
import RerunEngineButton from "@/components/RerunEngineButton";
import ProjectAnalysisLoader from "@/components/ProjectAnalysisLoader";
import FundingJourney, { type JourneyOpp } from "@/components/FundingJourney";

export const dynamic = "force-dynamic";

const ROADMAP_LABELS: Record<string, string> = {
  script: "Script",
  labs: "Labs",
  co_production: "Co-Production",
  grants: "Grants",
  investors: "Investors",
  production: "Production",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single<Project>();
  if (!project) notFound();
  const isOwner = project.owner_id === user!.id;

  // Load cached engine intelligence
  const { data: intel } = await supabase
    .from("project_intelligence")
    .select("*")
    .eq("project_id", id)
    .single();

  const discovery: FundingDiscovery | null = intel?.funding_discovery ?? null;
  const readiness: FundingReadiness | null = intel?.funding_readiness ?? null;
  const obstacles: FundingObstacle[] = intel?.obstacles ?? [];
  const roadmap: Roadmap | null = intel?.roadmap ?? null;
  const epBrief: ExecutiveProducerBrief | null = intel?.executive_producer ?? null;
  const dream: DreamScenario | null = intel?.dream_scenario ?? null;
  const producerMatches: ProducerMatch[] = intel?.producer_matches ?? [];

  // Fetch which producers this filmmaker has already requested introductions to
  const { data: introRequests } = await supabase
    .from("introduction_requests")
    .select("producer_user_id")
    .eq("filmmaker_id", user!.id)
    .eq("project_id", id);
  const requestedProducerIds = new Set((introRequests ?? []).map((r: { producer_user_id: string }) => r.producer_user_id));

  // Read pre-computed match scores from DB — zero live scoring on page load.
  // Scores are written by the engine at project creation and re-run.
  // Falls back to a limited live score only when matches table is empty.
  type MatchDbRow = {
    score: number; tier: string; reasons: string[];
    opportunity: { id: string; title: string; opp_type: string; country: string | null;
      max_award_usd: number | null; deadline: string | null; deadline_note: string | null;
      url: string | null; app_link: string | null; } | null;
  };
  const { data: matchRows } = await supabase
    .from("matches")
    .select("score, tier, reasons, opportunity:opportunities(id,title,opp_type,country,max_award_usd,deadline,deadline_note,url,app_link)")
    .eq("project_id", id)
    .order("score", { ascending: false }) as { data: MatchDbRow[] | null };

  let ranked: import("@/components/MatchList").MatchRow[] = [];
  let journeyOpps: JourneyOpp[] = [];

  if (matchRows && matchRows.length > 0) {
    ranked = matchRows
      .filter((m) => m.tier !== "hidden" && m.opportunity)
      .slice(0, 10)
      .map((m) => ({
        id: m.opportunity!.id, title: m.opportunity!.title, opp_type: m.opportunity!.opp_type,
        max_award_usd: m.opportunity!.max_award_usd, deadline_note: m.opportunity!.deadline_note,
        deadline: m.opportunity!.deadline, score: m.score, tier: m.tier, warnings: [],
      }));
    journeyOpps = matchRows
      .filter((m) => m.score > 0 && m.opportunity)
      .map((m) => ({
        id: m.opportunity!.id, title: m.opportunity!.title, country: m.opportunity!.country,
        opp_type: m.opportunity!.opp_type, max_award_usd: m.opportunity!.max_award_usd,
        deadline: m.opportunity!.deadline, deadline_note: m.opportunity!.deadline_note,
        score: m.score, url: m.opportunity!.url, app_link: m.opportunity!.app_link,
      }));
  } else {
    // Fallback: live scoring limited to 80 highest-weight opps (CPU-safe)
    const { data: opps } = await supabase.from("opportunities").select("*")
      .eq("is_active", true).not("match_weight", "is", null)
      .order("match_weight", { ascending: false }).limit(80);
    const { calculateMatchScore } = await import("@/services/matching");
    const scoredOpps = (opps ?? []).map((o: Opportunity) => ({ o, m: calculateMatchScore(project, o) }));
    ranked = scoredOpps.filter((r) => r.m.tier !== "hidden")
      .sort((a, b) => b.m.score - a.m.score).slice(0, 10)
      .map(({ o, m }) => ({
        id: o.id, title: o.title, opp_type: o.opp_type, max_award_usd: o.max_award_usd,
        deadline_note: (o as any).deadline_note, deadline: o.deadline,
        score: m.score, tier: m.tier, warnings: m.warnings,
      }));
    journeyOpps = scoredOpps.filter(({ m }) => m.score > 0)
      .sort((a, b) => b.m.score - a.m.score)
      .map(({ o, m }) => ({
        id: o.id, title: o.title, country: o.country ?? null, opp_type: o.opp_type,
        max_award_usd: o.max_award_usd ?? null, deadline: o.deadline ?? null,
        deadline_note: (o as any).deadline_note ?? null,
        score: m.score, url: o.url ?? null, app_link: (o as any).app_link ?? null,
      }));
  }

  const { data: offers } = isOwner
    ? await supabase
        .from("offers")
        .select("*, profiles!offers_from_user_id_fkey(full_name, company, role)")
        .eq("project_id", id).order("created_at", { ascending: false })
    : { data: [] as any[] };

  async function signedUrl(bucket: string, path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }
  const deckUrl = await signedUrl("pitch-decks", project.pitch_deck_path);
  const scriptUrl = await signedUrl("scripts", project.script_path);

  return (
    <div className="max-w-4xl">

      {/* ── ANALYSIS LOADER (auto-triggers engine when no intel exists) ── */}
      {isOwner && !discovery && (
        <ProjectAnalysisLoader projectId={project.id} />
      )}

      {/* ── HERO: FUNDING HEADLINE ── */}
      {discovery && (
        <div className="rounded-card bg-ink text-ivory px-8 py-8 mb-10">
          <p className="text-[11px] tracking-[0.28em] uppercase text-ivory/50 mb-3">FYLYMPITCH ENGINE</p>
          <h2 className="font-display text-[28px] sm:text-[34px] leading-[1.2]">
            <span className="italic">{project.title}</span> can raise{" "}
            <span className="text-gold">{usd(discovery.total_usd)}</span>
          </h2>
          <p className="mt-3 text-[14px] text-ivory/60">
            from {discovery.source_counts?.total ?? ranked.length} matched sources across grants, labs, co-production and investors
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            {discovery.breakdown?.slice(0, 4).map((item: any) => (
              <div key={item.label} className="bg-white/10 rounded-xl px-4 py-3 text-center min-w-[100px]">
                <div className="text-[18px] font-display text-gold">{usd(item.amount_usd)}</div>
                <div className="text-[10px] tracking-[0.18em] uppercase text-ivory/50 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
          {readiness && (
            <div className="mt-6 flex items-center gap-3">
              <div className="h-1.5 rounded-full bg-white/20 flex-1">
                <div className="h-1.5 rounded-full bg-gold" style={{ width: `${readiness.score}%` }} />
              </div>
              <span className="text-[12px] text-ivory/60 whitespace-nowrap">{readiness.score}/100 funding readiness</span>
            </div>
          )}
        </div>
      )}

      {/* ── FUNDING JOURNEY ── */}
      {isOwner && (
        <FundingJourney
          projectId={project.id}
          opportunities={journeyOpps}
          roadmap={roadmap}
          readiness={readiness}
        />
      )}

      {/* ── MATCHED OPPORTUNITIES — shown first, most actionable ── */}
      {isOwner && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-display text-[22px]">Matched opportunities</h2>
            <Link href="/dashboard/opportunities" className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-gold transition-colors">
              Browse all →
            </Link>
          </div>
          <p className="text-[13px] text-ash mb-6">Ranked by fit against every active opportunity.</p>
          <MatchList projectId={project.id} matches={ranked} />
        </section>
      )}

      {/* ── PROJECT HEADER ── */}
      <p className="eyebrow mb-3 mt-12">{project.genre} · {project.format} · {STAGE_LABEL[project.stage]}</p>
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-[34px]">{project.title}</h1>
        {isOwner && (
          <Link href={`/dashboard/projects/${project.id}/edit`}
            className="btn-ghost !py-2 !px-4 text-[12px] shrink-0 mt-1">
            Edit project
          </Link>
        )}
      </div>

      {project.synopsis && (
        <p className="mt-5 text-[16px] leading-[1.75] text-ash max-w-2xl whitespace-pre-line">
          {project.synopsis}
        </p>
      )}

      <p className="mt-5 text-[16px] leading-relaxed max-w-2xl font-display italic text-ink">"{project.logline}"</p>

      <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-[13px] text-ash">
        <span>Country — <span className="text-ink">{project.country}</span></span>
        <span>Language — <span className="text-ink">{project.language}</span></span>
        <span>Budget — <span className="text-ink">{usd(project.budget_usd)}</span></span>
        <span>Seeking — <span className="text-gold font-normal">{usd(project.funding_needed_usd)}</span></span>
      </div>

      {(deckUrl || scriptUrl) && (
        <div className="mt-6 flex gap-3">
          {deckUrl && <a href={deckUrl} target="_blank" rel="noreferrer" className="btn-ghost !px-5 !py-2.5">Pitch deck</a>}
          {scriptUrl && <a href={scriptUrl} target="_blank" rel="noreferrer" className="btn-ghost !px-5 !py-2.5">Script</a>}
        </div>
      )}

      {/* ── FYLYM INTELLIGENCE BRIEF ── */}
      {isOwner && epBrief && (
        <section className="mt-12 border border-gold/40 rounded-card bg-gold/5 p-6">
          <p className="eyebrow mb-3 text-gold">FYLYM Intelligence</p>
          <h3 className="font-display text-[20px] mb-2">{epBrief.next_best_move?.title}</h3>
          <p className="text-[14px] text-ash leading-relaxed">{epBrief.summary}</p>
          {epBrief.next_best_move && (
            <div className="mt-4 flex flex-wrap gap-5 text-[13px]">
              <span className="text-ash">Funding range — <span className="text-ink">{epBrief.next_best_move.funding_range}</span></span>
              <span className="text-ash">Success chance — <span className="text-ink">{epBrief.next_best_move.success_chance}%</span></span>
              {epBrief.next_best_move.deadline_days && (
                <span className="text-ash">Deadline — <span className="text-gold">{epBrief.next_best_move.deadline_days} days</span></span>
              )}
            </div>
          )}
          {epBrief.next_best_move?.opportunity_id && (
            <Link href={`/dashboard/opportunities/${epBrief.next_best_move.opportunity_id}?project=${project.id}`} className="btn-gold mt-5 inline-flex">
              {epBrief.next_best_move.action_label ?? "Apply now"} →
            </Link>
          )}
        </section>
      )}

      {/* ── ROADMAP ── */}
      {isOwner && roadmap && (
        <section className="mt-12">
          <h2 className="font-display text-[22px] mb-2">Financing roadmap</h2>
          <p className="text-[13px] text-ash mb-6">{roadmap.recommendation}</p>
          <div className="flex flex-wrap items-center gap-0">
            {roadmap.stages.map((stage: any, i: number) => (
              <div key={stage.key} className="flex items-center">
                <div className={`flex flex-col items-center ${stage.key === roadmap.current ? "opacity-100" : stage.reachable ? "opacity-70" : "opacity-30"}`}>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px]
                    ${stage.key === roadmap.current ? "border-gold bg-gold text-ivory" : "border-line bg-ivory text-ash"}`}>
                    {i + 1}
                  </div>
                  <span className="text-[10px] tracking-[0.14em] uppercase mt-2 text-ash whitespace-nowrap">
                    {ROADMAP_LABELS[stage.key] ?? stage.key}
                  </span>
                </div>
                {i < roadmap.stages.length - 1 && (
                  <div className="w-8 sm:w-12 h-px bg-line mx-1 mb-5" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-ash">Success probability — <span className="text-ink">{roadmap.success_probability}%</span></p>
        </section>
      )}

      {/* ── FUNDING OBSTACLES ── */}
      {isOwner && obstacles.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-[22px] mb-6">Funding obstacles</h2>
          <div className="space-y-3">
            {obstacles.map((ob: FundingObstacle) => (
              <div key={ob.id} className="card p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full
                      ${ob.severity === "high" ? "bg-red-100 text-red-700" : ob.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-line text-ash"}`}>
                      {ob.severity}
                    </span>
                    <span className="font-normal text-[15px]">{ob.label}</span>
                  </div>
                </div>
                {ob.action_href && (
                  <Link href={ob.action_href} className="btn-ghost !px-4 !py-2 text-[12px] whitespace-nowrap shrink-0">
                    Solve →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── PRODUCER MATCHES ── */}
      {isOwner && producerMatches.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-[22px] mb-2">Producer matches</h2>
          <p className="text-[13px] text-ash mb-6">Producers on FYLYMPITCH whose interests match your project.</p>
          <div className="space-y-4">
            {producerMatches.slice(0, 5).map((pm: ProducerMatch, i: number) => {
              const alreadyRequested = requestedProducerIds.has(pm.profile.id);
              return (
                <div key={pm.profile.id} className={`card p-6 ${i === 0 ? "border-gold/50" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-parchment border border-line shrink-0 flex items-center justify-center">
                        {pm.profile.avatar_url ? (
                          <img src={pm.profile.avatar_url} alt={pm.profile.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-[14px] text-ash">
                            {pm.profile.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-normal text-[16px]">
                          {pm.profile.full_name}
                          {pm.profile.company ? <span className="text-ash"> · {pm.profile.company}</span> : null}
                        </div>
                        <div className="mt-0.5 text-[12px] tracking-[0.14em] uppercase text-ash">
                          {pm.profile.countries?.[0] ?? ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-[22px] text-gold">{pm.score}</div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-ash">match</div>
                    </div>
                  </div>
                  {pm.reasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pm.reasons.map((r: string) => (
                        <span key={r} className="text-[11px] tracking-[0.12em] uppercase bg-parchment text-ash px-3 py-1 rounded-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-line">
                    {alreadyRequested ? (
                      <span className="text-[12px] text-emerald-600 tracking-wide">✓ Introduction requested</span>
                    ) : (
                      <form action={requestProducerIntroduction}>
                        <input type="hidden" name="producer_user_id" value={pm.profile.id} />
                        <input type="hidden" name="project_id" value={project.id} />
                        <button type="submit" className="btn-ghost !py-2 text-[13px]">
                          Request Introduction →
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── DREAM SCENARIO ── */}
      {isOwner && dream && (
        <section className="mt-12 rounded-card border border-line bg-parchment/50 p-7">
          <p className="eyebrow mb-4">Dream scenario</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <div className="font-display text-[24px] text-gold">{usd(dream.funding_usd)}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ash mt-1">Total funding</div>
            </div>
            <div>
              <div className="font-display text-[24px]">{dream.production_start}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ash mt-1">Production start</div>
            </div>
            <div>
              <div className="font-display text-[24px]">{dream.festival_premiere}</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ash mt-1">Festival premiere</div>
            </div>
            <div>
              <div className="font-display text-[24px]">{dream.projected_roi}×</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-ash mt-1">Projected ROI</div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1.5 rounded-full bg-line flex-1">
              <div className="h-1.5 rounded-full bg-gold" style={{ width: `${dream.distribution_probability}%` }} />
            </div>
            <span className="text-[12px] text-ash whitespace-nowrap">{dream.distribution_probability}% distribution probability</span>
          </div>
        </section>
      )}

      {/* ── PROJECT DETAILS ── */}
      {project.director_statement && (
        <section className="mt-10 max-w-2xl">
          <h2 className="eyebrow mb-3">Director's statement</h2>
          <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{project.director_statement}</p>
        </section>
      )}
      {project.producer_info && (
        <section className="mt-10 max-w-2xl">
          <h2 className="eyebrow mb-3">Producers</h2>
          <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{project.producer_info}</p>
        </section>
      )}

      {/* ── OFFERS ── */}
      {isOwner && (offers?.length ?? 0) > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[22px] mb-6">Offers</h2>
          <div className="space-y-4">
            {offers!.map((o: any) => (
              <div key={o.id} className="card p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-normal text-[15px]">
                    {o.profiles?.full_name}
                    {o.profiles?.company ? <span className="text-ash"> · {o.profiles.company}</span> : null}
                    <span className="eyebrow ml-3">{o.offer_type.replace("_", "-")} · {timeAgo(o.created_at)}</span>
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
                    <MessageButton otherUserId={o.from_user_id} label="Reply" className="btn-ghost !px-5 !py-2.5 gap-2" />
                  </div>
                ) : (
                  <p className="mt-4 eyebrow">{o.status}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RE-RUN ENGINE (compact, data exists) ── */}
      {isOwner && !!discovery && (
        <div className="mt-12 mb-4">
          <RerunEngineButton projectId={project.id} hasData={true} />
        </div>
      )}

      {/* ── DELETE ── */}
      {isOwner && (
        <form action={deleteProject} className="mt-16 hairline pt-8">
          <input type="hidden" name="project_id" value={project.id} />
          <button className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-red-700">Delete this project</button>
        </form>
      )}
    </div>
  );
}
