import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MatchBadge from "@/components/MatchBadge";
import { usd, TYPE_LABEL, STAGE_LABEL } from "@/lib/format";
import { applyToOpportunity, toggleSaved } from "@/lib/actions";
import { ExportPacketButton } from "@/components/ExportPacketButton";
import TrackOpportunityView from "@/components/TrackOpportunityView";
import ShareLinkButton from "@/components/ShareLinkButton";
import type { Opportunity, Project } from "@/types";
import { getProjectAllowance } from "@/lib/project-limits";

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
  const match = selected
    ? (await import("@/services/matching")).calculateMatchScore(selected, opp)
    : null;

  const { data: existing } = selected
    ? await supabase.from("applications").select("id, status").eq("project_id", selected.id).eq("opportunity_id", id).maybeSingle()
    : { data: null };

  const { data: savedRow } = await supabase
    .from("saved_opportunities").select("opportunity_id")
    .eq("user_id", user!.id).eq("opportunity_id", id).maybeSingle();

  // A filmmaker who already has projects saw only a picker. The offer to add
  // a new one lived in the no-projects branch below, which they never reach --
  // so someone with two projects and a third idea had nowhere to go from here.
  const allowance = await getProjectAllowance(supabase, user!.id);

  // ── Producer brief vs external fund ───────────────────────────────────────
  // These are two different actions wearing the same form. An external fund is
  // applied for on the fund's own site and our form is only a tracker entry. A
  // producer-posted brief is submitted *here*: applyToOpportunity writes
  // target_producer_id onto the project, turning it into an exclusive pitch to
  // that producer. Same markup, so the copy has to carry the difference — and
  // the second one needs the filmmaker's explicit consent.
  const isProducerPost = !!(opp as any).posted_by_producer_id;
  const producerName   = ((opp as any).key_person as string | null) || "this producer";
  // applyToOpportunity only reassigns a project that isn't already spoken for,
  // so a project already pitched elsewhere stays where it is.
  const alreadyTargeted = !!(selected as any)?.target_producer_id;
  const goesExclusive   = isProducerPost && !alreadyTargeted;

  return (
    <div className="max-w-3xl">
      <TrackOpportunityView opportunityId={opp.id} />
      <p className="eyebrow mb-3">{TYPE_LABEL[opp.opp_type]}{opp.region ? ` · ${opp.region}` : opp.country ? ` · ${opp.country}` : " · Worldwide"}</p>
      <div className="flex items-start justify-between gap-6">
        <h1 className="font-display text-[34px]">{opp.title}</h1>
        {/* Shares the PUBLIC page, never this one. /dashboard/opportunities/[id]
            needs a login, so sending that link hands the recipient a sign-in
            screen instead of the fund. Only offered when there is a public page
            to point at — a slug, and still active. */}
        {(opp as any).slug && opp.is_active && (
          <div className="shrink-0 mt-1">
            <ShareLinkButton
              compact
              label="Share this opportunity"
              path={`/opportunities/${(opp as any).slug}`}
              title={`${opp.title} on PITCH.FYLYM`}
              text={`${opp.title}${
                opp.max_award_usd != null ? ` — up to ${usd(opp.max_award_usd)}` : ""
              }. Found on PITCH.FYLYM.`}
            />
          </div>
        )}
      </div>

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

          {/* On a producer brief this is shown even with a single project, so the
              filmmaker always sees which project is about to be sent rather than
              submitting whatever happened to be pre-selected. */}
          {((projects?.length ?? 0) > 1 || isProducerPost) && (
            <form className="mt-6" action={`/dashboard/opportunities/${opp.id}`} method="get">
              <label className="field-label" htmlFor="project">
                {isProducerPost ? "Project you are pitching" : "Check another project"}
              </label>
              <div className="flex gap-3">
                <select id="project" name="project" defaultValue={selected.id} className="field !w-72">
                  {projects!.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                {(projects?.length ?? 0) > 1 && (
                  <button className="btn-ghost !px-5 !py-2.5">Re-score</button>
                )}
              </div>

              {/* Deliberately a plain link, with no ?producer= on it. Creating
                  a project WITH a target producer pitches it immediately, which
                  would route around the consent checkbox this page exists to
                  show. So: make the project, come back, submit it here through
                  the one gated path. */}
              {allowance.canCreate ? (
                <p className="mt-3 text-[12px] text-ash">
                  Not the right project?{" "}
                  <Link href="/dashboard/projects/new" className="underline underline-offset-4 decoration-line hover:text-gold">
                    Add a new one
                  </Link>
                  {!allowance.exempt && allowance.remaining !== null && (
                    <span className="text-ash/70"> · {allowance.remaining} of {allowance.max} slots left</span>
                  )}
                </p>
              ) : (
                <p className="mt-3 text-[12px] text-ash/70">
                  Using {allowance.used} of {allowance.max} project slots. Delete one you are no longer
                  pitching to add another.
                </p>
              )}
            </form>
          )}

          <div className="hairline mt-8 pt-7">
            {/* Apply method badge */}
            {selected && (opp.apply_method === "one_click" || opp.app_link || opp.url) && (
              <div className="mb-6 flex items-center gap-3 flex-wrap">
                {opp.apply_method === "one_click" && opp.form_url ? (
                  <a
                    href={`${opp.form_url}?fylym=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2
                      bg-gold/10 border border-gold/40 rounded-sm
                      text-gold text-[11px] tracking-[0.14em] uppercase font-medium
                      hover:bg-gold/20 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                    One Click Apply →
                  </a>
                ) : null}
                <ExportPacketButton projectId={selected.id} opportunityId={opp.id} />
              </div>
            )}

            {/* Direct link to the fund's official site. Never on a producer brief:
                a producer may well paste their company site into the url field,
                and telling a filmmaker to "submit at the official website" would
                send them away from the one place the submission actually happens. */}
            {!isProducerPost && (opp.url || opp.app_link) && (
              <div className="mb-6 p-4 rounded-card bg-parchment border border-line">
                <p className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2">Official submission</p>
                <a
                  href={opp.app_link ?? opp.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold inline-flex items-center gap-2"
                >
                  Apply directly at {opp.title} →
                </a>
                <p className="mt-3 text-[12px] text-ash leading-relaxed">
                  You'll need to submit directly at the fund's official website.
                  Use the form below to log this application in your PITCH.FYLYM tracker.
                </p>
              </div>
            )}

            {existing ? (
              <p className="text-[14px] text-ash">
                Logged in tracker — status:{" "}
                <span className="text-ink uppercase tracking-[0.12em] text-[12px]">{existing.status}</span>
              </p>
            ) : (
              <form action={async (fd: FormData) => { "use server"; await applyToOpportunity(fd); }} className="space-y-4">
                <input type="hidden" name="project_id" value={selected.id} />
                <input type="hidden" name="opportunity_id" value={opp.id} />

                {isProducerPost && (
                  <div className="p-4 rounded-card bg-parchment border border-line">
                    <p className="text-[11px] tracking-[0.18em] uppercase text-ash mb-2">Direct submission</p>
                    <p className="text-[13px] text-ink leading-relaxed">
                      {producerName} posted this brief on PITCH.FYLYM, so sending it here is the
                      submission. There is no external form to fill in afterwards.
                    </p>
                    {goesExclusive ? (
                      <p className="mt-3 text-[12px] text-ash leading-relaxed">
                        This makes <span className="text-ink">{selected.title}</span> an exclusive
                        pitch to {producerName} — they receive the project and its materials, and
                        it is no longer offered to other producers. You can still apply to funds
                        and labs with it.
                      </p>
                    ) : (
                      <p className="mt-3 text-[12px] text-ash leading-relaxed">
                        <span className="text-ink">{selected.title}</span> is already an exclusive
                        pitch to another producer. Sending it here records the application but
                        will not move it.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="field-label" htmlFor="cover_note">
                    Cover note{" "}
                    <span className="font-normal text-ash">
                      {isProducerPost
                        ? "(optional — the producer reads this first)"
                        : "(optional — saved to your tracker)"}
                    </span>
                  </label>
                  <textarea
                    id="cover_note"
                    name="cover_note"
                    rows={3}
                    className="field"
                    placeholder={
                      isProducerPost
                        ? "One paragraph on why this project belongs with this producer."
                        : "One paragraph on why this project and this fund belong together."
                    }
                  />
                </div>

                {/* Consent. Handing a project to a producer exclusively is not
                    something to do by pre-selection, so it takes a deliberate
                    tick. applyToOpportunity enforces the same thing server-side. */}
                {goesExclusive && (
                  <label className="flex items-start gap-3 text-[13px] text-ash leading-relaxed">
                    <input
                      type="checkbox"
                      name="confirm_exclusive"
                      value="yes"
                      required
                      className="mt-[3px] shrink-0 accent-gold"
                    />
                    <span>
                      Send <span className="text-ink">{selected.title}</span> to {producerName} as an
                      exclusive pitch.
                    </span>
                  </label>
                )}

                <button className="btn-ghost">
                  {isProducerPost ? "Send this pitch to the producer →" : "Log this application →"}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* A filmmaker with no projects used to land on a bare sentence with
          nowhere to go. The whole page is useless to them until they add one,
          so the link is the point of the block, not a footnote. */}
      {!selected && (
        <div className="mt-12 hairline pt-8">
          <p className="eyebrow mb-3">Nothing to pitch yet</p>
          <p className="text-[14px] text-ash max-w-prose leading-relaxed">
            You don&apos;t have a project on PITCH.FYLYM yet. Add one — title, logline and a
            little detail is enough to start — and you&apos;ll see your match score for this
            {isProducerPost ? " brief and be able to pitch it." : " opportunity and be able to apply."}
          </p>
          <Link href="/dashboard/projects/new" className="btn-gold inline-flex mt-5">
            Add your project →
          </Link>
        </div>
      )}
    </div>
  );
}
