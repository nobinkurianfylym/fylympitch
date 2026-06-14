import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MatchBadge from "@/components/MatchBadge";
import MessageButton from "@/components/MessageButton";
import { usd, STAGE_LABEL, TYPE_LABEL, timeAgo } from "@/lib/format";
import { deleteProject, respondToOffer } from "@/lib/actions";
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

  // Live-rank against active opportunities (fresh, not cached — for the matches list)
  const { data: opps } = await supabase.from("opportunities").select("*").eq("is_active", true);
  const { calculateMatchScore } = await import("@/services/matching");
  const ranked = (opps as Opportunity[] | null ?? [])
    .map((o) => ({ o, m: calculateMatchScore(project, o) }))
    .filter((r) => r.m.tier !== "hidden")
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, 10);

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

      {/* ── PROJECT HEADER ── */}
      <p className="eyebrow mb-3">{project.genre} · {project.format} · {STAGE_LABEL[project.stage]}</p>
      <h1 className="font-display text-[34px]">{project.title}</h1>
      <p className="mt-4 text-[16px] leading-relaxed max-w-2xl font-display italic text-ink/80">"{project.logline}"</p>

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

      {/* ── AI EXECUTIVE PRODUCER BRIEF ── */}
      {isOwner && epBrief && (
        <section className="mt-12 border border-gold/40 rounded-card bg-gold/5 p-6">
          <p className="eyebrow mb-3 text-gold">AI Executive Producer</p>
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

      {/* ── MATCHED OPPORTUNITIES ── */}
      {isOwner && (
        <section className="mt-12">
          <h2 className="font-display text-[22px] mb-2">Matched opportunities</h2>
          <p className="text-[13px] text-ash mb-6">Ranked live against every active opportunity.</p>
          <div>
            {ranked.map(({ o, m }) => (
              <Link key={o.id} href={`/dashboard/opportunities/${o.id}?project=${project.id}`}
                className="hairline py-5 flex items-center justify-between gap-6 hover:bg-parchment/60 px-2 -mx-2 transition-colors">
                <div className="min-w-0">
                  <div className="font-normal text-[15px] truncate">{o.title}</div>
                  <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                    {TYPE_LABEL[o.opp_type]}{o.max_award_usd ? ` · up to ${usd(o.max_award_usd)}` : ""}
                    {(o as any).deadline_note ? ` · ${(o as any).deadline_note}` : o.deadline ? ` · ${o.deadline}` : ""}
                  </div>
                  {m.warnings.length > 0 && (
                    <div className="mt-1 text-[12px] text-[#9a6b1f]">{m.warnings[0]}</div>
                  )}
                </div>
                <MatchBadge score={m.score} tier={m.tier} />
              </Link>
            ))}
            {ranked.length === 0 && (
              <p className="hairline py-8 text-[14px] text-ash">
                No opportunities clear the 60-point bar yet. Add budget and funding details to sharpen your matches.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── PRODUCER MATCHES ── */}
      {isOwner && producerMatches.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-[22px] mb-6">Producer matches</h2>
          <div className="space-y-4">
            {producerMatches.slice(0, 3).map((pm: ProducerMatch, i: number) => (
              <div key={pm.profile.id} className={`card p-6 ${i === 0 ? "border-gold/50" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-normal text-[16px]">{pm.profile.full_name}{pm.profile.company ? <span className="text-ash"> · {pm.profile.company}</span> : null}</div>
                    <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                      {pm.profile.countries?.[0] ?? ""}{pm.profile.available_funding_usd ? ` · up to ${usd(pm.profile.available_funding_usd)}` : ""}
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
              </div>
            ))}
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
      {project.synopsis && (
        <section className="mt-14 max-w-2xl">
          <h2 className="eyebrow mb-3">Synopsis</h2>
          <p className="text-[21px] leading-[1.7] text-ink/85 whitespace-pre-line">{project.synopsis}</p>
        </section>
      )}
      {project.director_statement && (
        <section className="mt-10 max-w-2xl">
          <h2 className="eyebrow mb-3">Director's statement</h2>
          <p className="text-[21px] leading-[1.7] text-ink/85 whitespace-pre-line">{project.director_statement}</p>
        </section>
      )}
      {project.producer_info && (
        <section className="mt-10 max-w-2xl">
          <h2 className="eyebrow mb-3">Producers</h2>
          <p className="text-[21px] leading-[1.7] text-ink/85 whitespace-pre-line">{project.producer_info}</p>
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
