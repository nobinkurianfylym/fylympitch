import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, STAGE_LABEL } from "@/lib/format";
import { formatFormat, formatCountry, formatStage } from "@/lib/film-identity";
import { respondToOffer } from "@/lib/project-actions";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import Greeting from "@/components/Greeting";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

function scoreBadgeStyle(score: number) {
  if (score >= 80) return "bg-emerald-600 text-white";
  if (score >= 60) return "bg-gold text-white";
  return "bg-ink/60 text-ivory";
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, stage, genre, format, country, language, logline, funding_needed_usd, is_public, created_at, poster_path, love_count")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [
    { data: allMatches },
    { count: appCount },
    { data: offers },
    { data: upcomingDeadlines },
    { data: introRequests },
  ] = await Promise.all([
    projectIds.length
      ? supabase.from("matches")
          .select("score, project_id, opportunities!inner(id, title, opp_type, deadline, max_award_usd)")
          .in("project_id", projectIds)
          .order("score", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as any[] }),

    supabase.from("applications")
      .select("id", { count: "exact", head: true }).eq("applicant_id", user.id),

    projectIds.length
      ? supabase.from("offers")
          .select("id, amount_usd, offer_type, message, status, created_at, project_id, profiles!offers_from_user_id_fkey(full_name, company)")
          .in("project_id", projectIds).eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),

    projectIds.length
      ? supabase.from("matches")
          .select("score, project_id, opportunities!inner(id, title, deadline, opp_type, max_award_usd)")
          .in("project_id", projectIds)
          .gte("opportunities.deadline", new Date().toISOString())
          .lte("opportunities.deadline", new Date(Date.now() + 90 * 86_400_000).toISOString())
          .gte("score", 60)
          .order("opportunities.deadline")
          .limit(8)
      : Promise.resolve({ data: [] as any[] }),

    projectIds.length
      ? supabase.from("introduction_requests")
          .select("id, created_at, filmmaker_id, producer_user_id, project_id, profiles!introduction_requests_producer_user_id_fkey(full_name, company, avatar_url), projects!introduction_requests_project_id_fkey(title)")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const bestScoreByProject: Record<string, number> = {};
  const matchCountByProject: Record<string, number> = {};
  for (const m of allMatches ?? []) {
    const pid = m.project_id;
    if (bestScoreByProject[pid] == null || m.score > bestScoreByProject[pid])
      bestScoreByProject[pid] = m.score;
    matchCountByProject[pid] = (matchCountByProject[pid] ?? 0) + 1;
  }

  const totalLoves = (projects ?? []).reduce((s, p) => s + (p.love_count ?? 0), 0);
  const totalMatches = Object.values(matchCountByProject).reduce((s, c) => s + c, 0);
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";
  const hasProjects = (projects?.length ?? 0) > 0;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const completionFields = [profile?.full_name, profile?.country, profile?.bio, profile?.company, profile?.website || profile?.imdb_url];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">Filmmaker Dashboard</p>
          <Greeting name={firstName} />
        </div>
        <Link href="/dashboard/projects/new" className="btn-gold shrink-0 mt-2">+ New project</Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { label: "Projects",    value: projects?.length ?? 0 },
          { label: "Matches",     value: totalMatches },
          { label: "Applications", value: appCount ?? 0 },
          { label: "Loves ♥",    value: totalLoves },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-[10px] tracking-[0.2em] uppercase text-ash mb-1">{s.label}</p>
            <p className="font-display text-[28px] text-ink leading-none">{s.value}</p>
          </div>
        ))}
      </div>


      {/* Pending offers */}
      {(offers?.length ?? 0) > 0 && (
        <section className="mb-10">
          <p className="eyebrow mb-4">
            {offers!.length === 1 ? "An offer awaits your reply" : `${offers!.length} offers await your reply`}
          </p>
          <div className="space-y-4">
            {offers!.map((o: any) => (
              <div key={o.id} className="card p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[15px]">
                    {o.profiles?.full_name}
                    {o.profiles?.company && <span className="text-ash"> · {o.profiles.company}</span>}
                    <span className="eyebrow ml-3">{o.offer_type.replace("_", "-")}</span>
                  </div>
                  <div className="font-display text-[20px] text-gold">{usd(o.amount_usd)}</div>
                </div>
                {o.message && <p className="mt-3 text-[14px] text-ash leading-relaxed">{o.message}</p>}
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
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Your Slate — full width ── */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <p className="eyebrow mb-1">PITCH.FYLYM Engine</p>
            <h2 className="font-display text-[24px]">Your slate</h2>
          </div>
          {hasProjects && (
            <Link href="/dashboard/projects/new"
              className="text-[11px] tracking-[0.16em] uppercase text-ash hover:text-gold transition-colors">
              + Add project
            </Link>
          )}
        </div>

        {!hasProjects ? (
          <div className="card p-8 text-center max-w-lg mx-auto">
            <p className="font-display text-[22px] mb-2">Your slate is empty</p>
            <p className="text-[14px] text-ash max-w-sm mx-auto mb-6 leading-relaxed">
              Submit your first project and the PITCH.FYLYM engine will score every live
              funding opportunity, build your financing roadmap, and generate an EP brief.
            </p>
            <Link href="/dashboard/projects/new" className="btn-gold inline-flex">
              Submit your first project →
            </Link>
            <p className="mt-4 text-[12px] text-ash">Takes 15–20 seconds. Upload a pitch deck or fill manually.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(projects ?? []).map((p) => {
              const best = bestScoreByProject[p.id];
              const matchCount = matchCountByProject[p.id] ?? 0;
              return (
                <div key={p.id} className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all relative">

                  {/* Badges */}
                  <div className="relative">
                    {!p.is_public && (
                      <span className="absolute top-2 left-2 z-10 text-[10px] tracking-[0.14em] uppercase bg-ink/75 text-ivory px-2.5 py-0.5 rounded-full">
                        Private
                      </span>
                    )}
                    {best != null && (
                      <span className={`absolute top-2 right-2 z-10 text-[10px] tracking-[0.1em] font-medium px-2.5 py-0.5 rounded-full ${scoreBadgeStyle(best)}`}>
                        {best} match
                      </span>
                    )}
                    <Link href={`/dashboard/projects/${p.id}`} className="block">
                      <div className="aspect-[3/2] overflow-hidden">
                        <ProjectThumbnail
                          posterPath={p.poster_path}
                          title={p.title}
                          genre={p.genre}
                          supabaseUrl={supabaseUrl}
                          className="w-full h-full rounded-t-card"
                        />
                      </div>
                    </Link>
                  </div>

                  {/* Card body */}
                  <div className="p-5 flex flex-col flex-1">
                    {/* L1: Title */}
                    <Link href={`/dashboard/projects/${p.id}`}>
                      <h3
                        className="font-display font-bold text-[18px] group-hover:text-gold transition-colors leading-tight uppercase mb-2"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {p.title}
                      </h3>
                    </Link>
                    {/* L2: Metadata row — Format · Genre · Country · Language · Stage */}
                    <p className="text-[12px] text-ash mb-2.5 leading-tight">
                      {[
                        formatFormat(p.format),
                        p.genre,
                        (() => { const c = formatCountry(p.country); return c?.flag ? `${c.flag} ${c.name}` : c?.name ?? null; })(),
                        (p as any).language,
                        formatStage(p.stage),
                      ].filter(Boolean).join(" · ")}
                    </p>
                    {/* L5: Logline — no quotes */}
                    {(p as any).logline && (
                      <p className="italic text-[13px] leading-[1.55] text-ash line-clamp-2 flex-1">
                        {(p as any).logline}
                      </p>
                    )}
                    <div className="mt-auto pt-3 border-t border-line flex flex-wrap items-center gap-2 text-[12px]">
                      {matchCount > 0 && (
                        <span className="text-gold tracking-[0.06em]">
                          {matchCount} {matchCount === 1 ? "match" : "matches"}
                        </span>
                      )}
                      {(p.love_count ?? 0) > 0 && (
                        <span className="text-ash">♥ {p.love_count}</span>
                      )}
                      {p.funding_needed_usd && (
                        <span className="text-gold ml-auto shrink-0">{usd(p.funding_needed_usd)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Upcoming deadlines + Producer interest — right-aligned ── */}
      {hasProjects && (
        <div className="flex justify-end">
          <div className="w-full md:max-w-sm space-y-8">

            {/* Upcoming deadlines */}
            {(upcomingDeadlines?.length ?? 0) > 0 && (
              <section>
                <p className="eyebrow mb-4">Upcoming deadlines</p>
                <div className="space-y-2">
                  {(upcomingDeadlines ?? []).map((m: any) => {
                    const opp = m.opportunities;
                    const days = daysUntil(opp.deadline);
                    return (
                      <Link key={opp.id} href={`/dashboard/opportunities/${opp.id}`}
                        className="card p-4 flex items-start justify-between gap-3 hover:border-gold transition-colors">
                        <div className="min-w-0">
                          <p className="text-[13px] text-ink font-medium leading-snug truncate">{opp.title}</p>
                          <p className="text-[11px] tracking-[0.12em] uppercase text-ash mt-0.5">
                            {opp.opp_type}
                            {opp.max_award_usd ? ` · ${usd(opp.max_award_usd)}` : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[11px] tracking-[0.1em] px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          days <= 7
                            ? "bg-red-50 border-red-200 text-red-600"
                            : days <= 30
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-parchment border-line text-ash"
                        }`}>
                          {days}d
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <Link href="/dashboard/opportunities"
                  className="mt-3 block text-[11px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
                  All opportunities →
                </Link>
              </section>
            )}

            {/* Producer interest */}
            {(introRequests?.length ?? 0) > 0 && (
              <section>
                <p className="eyebrow mb-4">Producer interest</p>
                <div className="space-y-2">
                  {(introRequests ?? []).map((r: any) => {
                    const producer = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
                    const project  = Array.isArray(r.projects) ? r.projects[0] : r.projects;
                    const initials = (producer?.full_name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                    const ago = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3_600_000);
                    return (
                      <div key={r.id} className="card p-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-parchment border border-line flex items-center justify-center shrink-0">
                          {producer?.avatar_url
                            ? <img src={producer.avatar_url} alt={producer.full_name} className="w-full h-full object-cover" />
                            : <span className="font-display text-[11px] text-ash">{initials}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] text-ink leading-snug">
                            <span className="font-medium">{producer?.full_name ?? "A producer"}</span>
                            {" "}requested an introduction
                          </p>
                          <p className="text-[11px] text-ash mt-0.5">
                            {project?.title ?? "Your project"}
                            {producer?.company ? ` · ${producer.company}` : ""}
                            {ago < 24 ? ` · ${ago}h ago` : ` · ${Math.floor(ago / 24)}d ago`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
