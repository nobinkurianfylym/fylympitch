import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { usd, STAGE_LABEL, TYPE_LABEL } from "@/lib/format";
import { upsertProducerProject, requestMeeting } from "@/lib/actions";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = [
  { key: "saved",       label: "Saved" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "in_review",   label: "In review" },
  { key: "meeting_set", label: "Meeting set" },
  { key: "deal_active", label: "Deal active" },
];

export default async function ProducerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("approval_status").eq("id", user.id).single();
  if (profile?.approval_status !== "approved") redirect("/producer/pending");

  // Fetch project (approved producers see all via RLS)
  const { data: project } = await supabase
    .from("projects")
    .select("*, profiles!projects_owner_id_fkey(id, full_name, company)")
    .eq("id", id)
    .single();

  if (!project) notFound();

  // Fetch CRM row
  const { data: crm } = await supabase
    .from("producer_projects")
    .select("*")
    .eq("producer_id", user.id)
    .eq("project_id", id)
    .single();

  // Fetch existing meeting request
  const { data: meeting } = await supabase
    .from("meeting_requests")
    .select("*")
    .eq("producer_id", user.id)
    .eq("project_id", id)
    .maybeSingle();

  // Signed URLs for deck and script
  const deckUrl = project.pitch_deck_path
    ? (await supabase.storage.from("pitch-decks").createSignedUrl(project.pitch_deck_path, 3600)).data?.signedUrl
    : null;
  const scriptUrl = project.script_path
    ? (await supabase.storage.from("scripts").createSignedUrl(project.script_path, 3600)).data?.signedUrl
    : null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const posterUrl = project.poster_path
    ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${project.poster_path}`
    : null;

  const filmmaker = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      {/* Breadcrumb */}
      <p className="text-[11px] tracking-[0.14em] uppercase text-ash mb-6">
        <Link href="/producer/projects" className="hover:text-ink">Projects</Link>
        <span className="mx-2">›</span>
        <span className="text-ink">{project.title}</span>
      </p>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        {/* LEFT: project content */}
        <div>
          {posterUrl && (
            <img src={posterUrl} alt={project.title} className="w-full rounded-card mb-6 object-cover" style={{ maxHeight: 360 }} />
          )}

          <p className="eyebrow mb-2">
            {project.genre} · {project.format} · {STAGE_LABEL[project.stage] ?? project.stage}
          </p>
          <h1 className="font-display text-[34px] mb-1">{project.title}</h1>
          <p className="text-[14px] text-ash mb-4">
            {[project.country, project.language].filter(Boolean).join(" · ")}
            {filmmaker?.full_name ? ` · by ${filmmaker.full_name}` : ""}
            {filmmaker?.company ? ` (${filmmaker.company})` : ""}
          </p>

          {project.logline && (
            <p className="font-display italic text-[17px] leading-[1.6] text-ink/80 mb-6">
              "{project.logline}"
            </p>
          )}

          <div className="flex flex-wrap gap-6 text-[13px] text-ash mb-8">
            <span>Budget — <span className="text-ink">{usd(project.budget_usd)}</span></span>
            <span>Seeking — <span className="text-gold font-normal">{usd(project.funding_needed_usd)}</span></span>
            <span className={`${project.is_public ? "text-emerald-700" : "text-amber-700"}`}>
              {project.is_public ? "Public project" : "Private project"}
            </span>
          </div>

          {(deckUrl || scriptUrl) && (
            <div className="flex gap-3 mb-8">
              {deckUrl && <a href={deckUrl} target="_blank" rel="noreferrer" className="btn-ghost !px-5 !py-2.5">View pitch deck</a>}
              {scriptUrl && <a href={scriptUrl} target="_blank" rel="noreferrer" className="btn-ghost !px-5 !py-2.5">Read script</a>}
            </div>
          )}

          {project.synopsis && (
            <section className="mb-8">
              <h2 className="eyebrow mb-3">Synopsis</h2>
              <p className="text-[17px] leading-[1.7] text-ink/85 whitespace-pre-line">{project.synopsis}</p>
            </section>
          )}
          {project.director_statement && (
            <section className="mb-8">
              <h2 className="eyebrow mb-3">Director's statement</h2>
              <p className="text-[17px] leading-[1.7] text-ink/85 whitespace-pre-line">{project.director_statement}</p>
            </section>
          )}
          {project.producer_info && (
            <section className="mb-8">
              <h2 className="eyebrow mb-3">Producers</h2>
              <p className="text-[17px] leading-[1.7] text-ink/85 whitespace-pre-line">{project.producer_info}</p>
            </section>
          )}
        </div>

        {/* RIGHT: CRM panel */}
        <div className="space-y-4">

          {/* Pipeline stage */}
          <div className="card p-5">
            <p className="eyebrow mb-3">Pipeline stage</p>
            <form action={upsertProducerProject} className="space-y-3">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="rating" value={crm?.rating ?? ""} />
              <input type="hidden" name="notes" value={crm?.notes ?? ""} />
              <div className="flex flex-col gap-2">
                {PIPELINE_STAGES.map((s) => (
                  <label key={s.key} className={`flex items-center gap-3 p-3 rounded-card border cursor-pointer transition-colors ${crm?.status === s.key ? "border-gold bg-gold/5" : "border-line hover:border-line"}`}>
                    <input type="radio" name="status" value={s.key} defaultChecked={crm?.status === s.key}
                      className="accent-[#BF9953]" />
                    <span className="text-[13px]">{s.label}</span>
                  </label>
                ))}
              </div>
              <button type="submit" className="btn-gold w-full !py-2 text-[13px]">Update stage</button>
            </form>
          </div>

          {/* Internal rating */}
          <div className="card p-5">
            <p className="eyebrow mb-3">Internal rating</p>
            <form action={upsertProducerProject} className="space-y-3">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="status" value={crm?.status ?? "saved"} />
              <input type="hidden" name="notes" value={crm?.notes ?? ""} />
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="cursor-pointer">
                    <input type="radio" name="rating" value={n} defaultChecked={crm?.rating === n} className="sr-only" />
                    <span className={`text-[22px] ${(crm?.rating ?? 0) >= n ? "text-gold" : "text-ash/30"}`}>★</span>
                  </label>
                ))}
              </div>
              <button type="submit" className="btn-ghost w-full !py-2 text-[13px]">Save rating</button>
            </form>
          </div>

          {/* Private notes */}
          <div className="card p-5">
            <p className="eyebrow mb-3">Private notes</p>
            <form action={upsertProducerProject} className="space-y-3">
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="status" value={crm?.status ?? "saved"} />
              <input type="hidden" name="rating" value={crm?.rating ?? ""} />
              <textarea name="notes" rows={4} defaultValue={crm?.notes ?? ""}
                placeholder="Only you can see these notes…"
                className="field text-[13px] w-full" />
              <button type="submit" className="btn-ghost w-full !py-2 text-[13px]">Save notes</button>
            </form>
          </div>

          {/* Meeting request */}
          <div className="card p-5">
            <p className="eyebrow mb-3">Meeting</p>
            {meeting ? (
              <div>
                <p className="text-[13px] text-ash mb-1">
                  Request sent — <span className="text-ink capitalize">{meeting.status}</span>
                </p>
                {meeting.status === "accepted" && (
                  <p className="text-[12px] text-emerald-700">The filmmaker accepted. Check your email to confirm.</p>
                )}
              </div>
            ) : (
              <form action={requestMeeting} className="space-y-3">
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="filmmaker_id" value={filmmaker?.id ?? project.owner_id} />
                <textarea name="message" rows={3} placeholder="Introduce yourself and explain your interest…" className="field text-[13px] w-full" />
                <button type="submit" className="btn-gold w-full !py-2 text-[13px]">Request meeting</button>
              </form>
            )}
          </div>

          {/* Pass on project */}
          {crm?.status !== "passed" && (
            <form action={upsertProducerProject}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="status" value="passed" />
              <button type="submit" className="text-[12px] text-ash hover:text-red-600 transition-colors w-full text-center pt-2">
                Pass on this project
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
