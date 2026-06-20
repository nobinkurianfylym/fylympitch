import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usd, STAGE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = [
  { key: "saved",        label: "Saved",       color: "text-ash" },
  { key: "shortlisted",  label: "Shortlisted", color: "text-blue-700" },
  { key: "in_review",    label: "In review",   color: "text-amber-700" },
  { key: "meeting_set",  label: "Meeting set", color: "text-emerald-700" },
  { key: "deal_active",  label: "Deal active", color: "text-gold" },
] as const;

type Stage = typeof PIPELINE_STAGES[number]["key"];

export default async function ProducerPipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Fetch all CRM rows with project data
  const { data: rows } = await supabase
    .from("producer_projects")
    .select(`
      id, status, rating, notes, updated_at,
      projects:project_id (
        id, title, genre, format, stage, country, language,
        logline, funding_needed_usd, poster_path, is_public
      )
    `)
    .eq("producer_id", user.id)
    .neq("status", "passed")
    .order("updated_at", { ascending: false });

  // Group by stage
  const byStage: Record<Stage, typeof rows> = {
    saved: [], shortlisted: [], in_review: [], meeting_set: [], deal_active: [],
  };
  for (const row of rows ?? []) {
    const s = row.status as Stage;
    if (byStage[s]) byStage[s]!.push(row);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="p-6 md:p-10">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">PITCH.FYLYM Engine · Producer CRM</p>
          <h1 className="font-display text-[32px]">Pipeline</h1>
        </div>
        <Link href="/producer/projects" className="btn-gold">
          Browse all projects
        </Link>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="card py-16 text-center">
          <p className="font-display text-[22px] mb-3">Your pipeline is empty</p>
          <p className="text-ash text-[15px] mb-6">Browse projects and save the ones you're interested in.</p>
          <Link href="/producer/projects" className="btn-gold">Browse all projects</Link>
        </div>
      ) : (
        /* Kanban board */
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-[900px]">
            {PIPELINE_STAGES.map((stage) => {
              const cards = byStage[stage.key] ?? [];
              return (
                <div key={stage.key} className="flex-1 min-w-[180px]">
                  {/* Column header — border-top + label + count clearly aligned */}
                  <div className={`border-t-2 pt-3 mb-3 ${
                    stage.key === "saved"        ? "border-ash/30" :
                    stage.key === "shortlisted"  ? "border-blue-400" :
                    stage.key === "in_review"    ? "border-amber-400" :
                    stage.key === "meeting_set"  ? "border-emerald-400" :
                    "border-gold"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[12px] tracking-[0.18em] uppercase font-medium ${stage.color}`}>
                        {stage.label}
                      </span>
                      <span className="text-[11px] bg-parchment text-ash px-2 py-0.5 rounded-full shrink-0">
                        {cards.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 bg-parchment/40 rounded-card p-3 min-h-[200px]">
                    {cards.map((row: any) => {
                      const p = row.projects;
                      if (!p) return null;
                      const thumb = p.poster_path
                        ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}`
                        : null;
                      return (
                        <Link key={row.id} href={`/producer/projects/${p.id}`}
                          className="card p-4 hover:border-gold transition-colors block">
                          {thumb && (
                            <img src={thumb} alt={p.title} className="w-full rounded-card mb-3 object-cover" style={{ aspectRatio: "16/9" }} />
                          )}
                          <p className="text-[11px] tracking-[0.16em] uppercase text-ash mb-1">
                            {p.genre} · {p.format}
                          </p>
                          <p className="font-display text-[15px] leading-snug mb-2">{p.title}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.is_public ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {p.is_public ? "Public" : "Private"}
                            </span>
                            {row.rating && (
                              <span className="text-[11px] text-gold">{"★".repeat(row.rating)}</span>
                            )}
                          </div>
                          {p.funding_needed_usd && (
                            <p className="mt-2 text-[12px] text-gold">{usd(p.funding_needed_usd)}</p>
                          )}
                        </Link>
                      );
                    })}
                    {cards.length === 0 && (
                      <p className="text-[12px] text-ash text-center pt-6">No projects here</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats — bottom of page */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10">
        {[
          { label: "In pipeline", val: (rows ?? []).length },
          { label: "Shortlisted", val: (byStage.shortlisted?.length ?? 0) + (byStage.in_review?.length ?? 0) },
          { label: "Meetings set", val: byStage.meeting_set?.length ?? 0 },
          { label: "Deals active", val: byStage.deal_active?.length ?? 0 },
        ].map((s) => (
          <div key={s.label} className="card px-5 py-4">
            <p className="text-[12px] text-ash mb-1">{s.label}</p>
            <p className="font-display text-[28px]">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Passed projects link */}
      <div className="mt-8 text-center">
        <Link href="/producer/projects?filter=passed" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink">
          View passed projects
        </Link>
      </div>
    </div>
  );
}
