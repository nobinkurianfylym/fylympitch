import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MatchBadge from "@/components/MatchBadge";
import { usd, TYPE_LABEL, STAGE_LABEL } from "@/lib/format";
import { calculateMatchScore } from "@/services/matching";
import { applyToOpportunity, toggleSaved } from "@/lib/actions";
import type { Opportunity, Project } from "@/types";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ project?: string }> }) {
  const { id } = await params;
  const { project: projectParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: opp } = await supabase.from("opportunities").select("*").eq("id", id).single<Opportunity>();
  if (!opp) notFound();

  const { data: projects } = await supabase.from("projects").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
  const selected = (projects as Project[] | null)?.find((p) => p.id === projectParam) ?? (projects as Project[] | null)?.[0] ?? null;
  const match = selected ? calculateMatchScore(selected, opp) : null;

  const { data: existing } = selected
    ? await supabase.from("applications").select("id, status").eq("project_id", selected.id).eq("opportunity_id", id).maybeSingle()
    : { data: null };

  const { data: savedRow } = await supabase
    .from("saved_opportunities").select("opportunity_id")
    .eq("user_id", user!.id).eq("opportunity_id", id).maybeSingle();

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-3">{TYPE_LABEL[opp.opp_type]}{opp.region ? ` · ${opp.region}` : opp.country ? ` · ${opp.country}` : " · Worldwide"}</p>
      <h1 className="font-display text-[34px]">{opp.title}</h1>

      <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-[13px] text-ash">
        {opp.max_award_usd != null && <span>Up to — <span className="text-gold font-normal">{usd(opp.max_award_usd)}</span></span>}
        {opp.deadline && <span>Deadline — <span className="text-ink">{opp.deadline}</span></span>}
        {opp.stages?.length > 0 && <span>Stages — <span className="text-ink">{opp.stages.map((s) => STAGE_LABEL[s]).join(", ")}</span></span>}
        {opp.formats?.length > 0 && <span>Formats — <span className="text-ink">{opp.formats.join(", ")}</span></span>}
      </div>

      {opp.description && <p className="mt-8 text-[21px] leading-[1.7] text-ink">{opp.description}</p>}

      <div className="mt-6 flex gap-3">
        {opp.url && <a href={opp.url} target="_blank" rel="noreferrer" className="btn-ghost !px-5 !py-2.5">Official site</a>}
        <form action={toggleSaved}>
          <input type="hidden" name="opportunity_id" value={opp.id} />
          <button className="btn-ghost !px-5 !py-2.5">{savedRow ? "Saved ★" : "Save for later"}</button>
        </form>
      </div>

      {match && selected && (
        <section className="mt-14 card p-7">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="eyebrow mb-2">Match for</p>
              <p className="font-display text-[20px]">{selected.title}</p>
            </div>
            <MatchBadge score={match.score} tier={match.tier} />
          </div>

          {match.strengths.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-3">Why it fits</p>
              <ul className="space-y-2 text-[14px]">
                {match.strengths.map((s) => <li key={s} className="flex gap-3"><span className="text-gold">—</span>{s}</li>)}
              </ul>
            </div>
          )}
          {match.warnings.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-3">Watch out for</p>
              <ul className="space-y-2 text-[14px] text-[#9a6b1f]">
                {match.warnings.map((w) => <li key={w} className="flex gap-3"><span>—</span>{w}</li>)}
              </ul>
            </div>
          )}

          {(projects?.length ?? 0) > 1 && (
            <form className="mt-6" action={`/dashboard/opportunities/${opp.id}`} method="get">
              <label className="field-label" htmlFor="project">Check another project</label>
              <div className="flex gap-3">
                <select id="project" name="project" defaultValue={selected.id} className="field !w-72">
                  {projects!.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <button className="btn-ghost !px-5 !py-2.5">Re-score</button>
              </div>
            </form>
          )}

          <div className="hairline mt-8 pt-7">
            {existing ? (
              <p className="text-[14px] text-ash">Application already sent — status: <span className="text-ink uppercase tracking-[0.12em] text-[12px]">{existing.status}</span></p>
            ) : (
              <form action={async (fd: FormData) => { "use server"; await applyToOpportunity(fd); }} className="space-y-4">
                <input type="hidden" name="project_id" value={selected.id} />
                <input type="hidden" name="opportunity_id" value={opp.id} />
                <div>
                  <label className="field-label" htmlFor="cover_note">Cover note (optional)</label>
                  <textarea id="cover_note" name="cover_note" rows={3} className="field" placeholder="One paragraph on why this project and this fund belong together." />
                </div>
                <button className="btn-gold">Apply with this project</button>
              </form>
            )}
          </div>
        </section>
      )}

      {!selected && (
        <p className="mt-12 text-[14px] text-ash hairline pt-8">
          Submit a project to see your match score and apply.
        </p>
      )}
    </div>
  );
}
