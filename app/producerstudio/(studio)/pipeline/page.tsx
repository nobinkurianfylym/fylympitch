import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usd, STAGE_LABEL, formatBudget } from "@/lib/format";
import { formatFormat, formatCountry, formatStage } from "@/lib/film-identity";

export const dynamic = "force-dynamic";

type Stage = "saved" | "shortlisted" | "in_review" | "meeting_set" | "deal_active";

export default async function ProducerPipelinePage() {
  // Moved inside function — avoids Worker cold-start CPU cost
  const PIPELINE_STAGES = [
    { key: "saved"       as Stage, label: "Saved",       color: "text-ash" },
    { key: "shortlisted" as Stage, label: "Shortlisted", color: "text-blue-700" },
    { key: "in_review"   as Stage, label: "In review",   color: "text-amber-700" },
    { key: "meeting_set" as Stage, label: "Meeting set", color: "text-emerald-700" },
    { key: "deal_active" as Stage, label: "Deal active", color: "text-gold" },
  ];
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
        logline, budget_currency, funding_needed_usd, finance_secured_usd, poster_path, is_public,
        director_name, filmmaker:profiles!projects_owner_id_fkey(full_name)
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
        <Link href="/producerstudio/projects" className="btn-gold">
          Browse all projects
        </Link>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="card py-16 text-center">
          <p className="font-display text-[22px] mb-3">Your pipeline is empty</p>
          <p className="text-ash text-[15px] mb-6">Browse projects and save the ones you're interested in.</p>
          <Link href="/producerstudio/projects" className="btn-gold">Browse all projects</Link>
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
                        <Link key={row.id} href={`/producerstudio/projects/${p.id}`}
                          className="card p-4 hover:border-gold transition-colors block">
                          {thumb && (
                            <img src={thumb} alt={p.title} className="w-full rounded-card mb-3 object-cover" style={{ aspectRatio: "16/9" }} />
                          )}
                          {/* L1: Title */}
                          <p
                            className="font-display font-bold text-[14px] leading-tight uppercase mb-1.5"
                            style={{ letterSpacing: "-0.01em" }}
                          >
                            {p.title}
                          </p>
                          {/* L2: Metadata */}
                          <p className="text-[11px] text-ash mb-0.5 leading-tight">
                            {[
                              formatFormat(p.format),
                              p.genre,
                              (() => { const c = formatCountry(p.country); return c?.flag ? `${c.flag} ${c.name}` : c?.name ?? null; })(),
                            ].filter(Boolean).join(" · ")}
                          </p>
                          {/* Director line */}
                          {((p as any).director_name || (p as any).filmmaker?.full_name) && (
                            <p className="text-[11px] text-ash mb-1.5 leading-tight">
                              <span className="text-[10px] font-medium tracking-[0.08em] uppercase text-ash/60 mr-1">Dir.</span>
                              {(p as any).director_name ?? (p as any).filmmaker?.full_name}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.is_public ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {p.is_public ? "Public" : "Private"}
                            </span>
                            {row.rating && (
                              <span className="text-[11px] text-gold">{"★".repeat(row.rating)}</span>
                            )}
                          </div>
                          {(p as any).finance_secured_usd && (
                            <p className="mt-1 text-[12px] text-emerald-700">Secured {formatBudget((p as any).finance_secured_usd, (p as any).budget_currency)}</p>
                          )}
                          {p.funding_needed_usd && (
                            <p className="mt-1 text-[12px] text-gold">{formatBudget(p.funding_needed_usd, (p as any).budget_currency)}</p>
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
          { label: "In pipeline",  val: (rows ?? []).length },
          { label: "In progress",  val: (byStage.shortlisted?.length ?? 0) + (byStage.in_review?.length ?? 0) },
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
        <Link href="/producerstudio/projects?filter=passed" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink">
          View passed projects
        </Link>
      </div>
    </div>
  );
}
