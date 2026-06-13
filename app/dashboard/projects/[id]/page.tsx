import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MatchBadge from "@/components/MatchBadge";
import { usd, STAGE_LABEL, TYPE_LABEL, timeAgo } from "@/lib/format";
import { calculateMatchScore, tierOf } from "@/services/matching";
import { deleteProject, respondToOffer } from "@/lib/actions";
import type { Opportunity, Project } from "@/types";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single<Project>();
  if (!project) notFound();
  const isOwner = project.owner_id === user!.id;

  // Live-rank against all active opportunities (always fresh)
  const { data: opps } = await supabase.from("opportunities").select("*").eq("is_active", true);
  const ranked = (opps as Opportunity[] | null ?? [])
    .map((o) => ({ o, m: calculateMatchScore(project, o) }))
    .filter((r) => r.m.tier !== "hidden")
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, 12);

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
    <div>
      <p className="eyebrow mb-3">{project.genre} · {project.format} · {STAGE_LABEL[project.stage]}</p>
      <h1 className="font-display text-[34px]">{project.title}</h1>
      <p className="mt-4 text-[16px] leading-relaxed max-w-2xl font-display italic text-ink/80">"{project.logline}"</p>

      <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-[13px] text-ash">
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

      {project.synopsis && (
        <section className="mt-12 max-w-2xl">
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

      {isOwner && (offers?.length ?? 0) > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[22px] mb-6">Offers</h2>
          <div className="space-y-4">
            {offers!.map((o: any) => (
              <div key={o.id} className="card p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-normal text-[15px]">
                    {o.profiles?.full_name}{o.profiles?.company ? <span className="text-ash"> · {o.profiles.company}</span> : null}
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
                  </div>
                ) : (
                  <p className="mt-4 eyebrow">{o.status}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isOwner && (
        <section className="mt-14">
          <h2 className="font-display text-[22px] mb-2">Matched opportunities</h2>
          <p className="text-[13px] text-ash mb-6">Ranked live against every active opportunity. Scores under 60 are hidden.</p>
          <div>
            {ranked.map(({ o, m }) => (
              <Link key={o.id} href={`/dashboard/opportunities/${o.id}?project=${project.id}`}
                className="hairline py-5 flex items-center justify-between gap-6 hover:bg-parchment/60 px-2 -mx-2 transition-colors">
                <div className="min-w-0">
                  <div className="font-normal text-[15px] truncate">{o.title}</div>
                  <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                    {TYPE_LABEL[o.opp_type]}{o.max_award_usd ? ` · up to ${usd(o.max_award_usd)}` : ""}{o.deadline ? ` · ${o.deadline}` : ""}
                  </div>
                  {m.warnings.length > 0 && (
                    <div className="mt-1 text-[12px] text-[#9a6b1f]">{m.warnings[0]}</div>
                  )}
                </div>
                <MatchBadge score={m.score} tier={m.tier} />
              </Link>
            ))}
            {ranked.length === 0 && <p className="hairline py-8 text-[14px] text-ash">No opportunities clear the 60-point bar yet. Add budget and funding details to sharpen your matches.</p>}
          </div>
        </section>
      )}

      {isOwner && (
        <form action={deleteProject} className="mt-16 hairline pt-8">
          <input type="hidden" name="project_id" value={project.id} />
          <button className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-red-700">Delete this project</button>
        </form>
      )}
    </div>
  );
}
