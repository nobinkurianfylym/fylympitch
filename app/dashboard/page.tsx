import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, STAGE_LABEL } from "@/lib/format";
import { respondToOffer } from "@/lib/project-actions";
import ProjectThumbnail from "@/components/ProjectThumbnail";
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
    .select("id, title, stage, genre, format, country, funding_needed_usd, is_public, created_at, poster_path, love_count")
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
          .lte("opportunities.deadline", new Date(Date.now() + 30 * 86_400_000).toISOString())
          .gte("score", 65)
          .order("opportunities.deadline")
          .limit(5)
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
          <h1 className="font-display text-[34px] leading-tight">Good morning, {firstName}.</h1>
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

      {/* Profile completion nudge */}
      {completion < 70 && (
        <Link href="/dashboard/profile"
          className="flex items-center gap-4 py-4 px-5 card hover:border-gold transition-colors mb-8">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-ink font-medium">Complete your profile</p>
            <p className="text-[12px] text-ash mt-0.5">A fuller profile unlocks better matches — {completion}% done.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-20 h-[3px] bg-line rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-[11px] tracking-[0.2em] uppercase text-ash">{completion}%</span>
          </div>
        </Link>
      )}

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

      {/* Main 2-column layout */}
      <div className="grid md:grid-cols-[1fr_288px] gap-8 items-start">

        {/* LEFT — Your slate */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <p className="eyebrow mb-1">FYLYMPITCH Engine</p>
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
            <div className="card p-8 text-center">
              <p className="font-display text-[22px] mb-2">Your slate is empty</p>
              <p className="text-[14px] text-ash max-w-sm mx-auto mb-6 leading-relaxed">
                Submit your first project and the FYLYMPITCH engine will score every live
                funding opportunity, build your financing roadmap, and generate an EP brief.
              </p>
              <Link href="/dashboard/projects/new" className="btn-gold inline-flex">
                Submit your first project →
              </Link>
              <p className="mt-4 text-[12px] text-ash">Takes 15–20 seconds. Upload a pitch deck or fill manually.</p>
            </div>
          ) : (
            <div className={`grid gap-4 ${(projects?.length ?? 0) === 1 ? "" : "sm:grid-cols-2"}`}>
              {(projects ?? []).map((p) => {
                const best = bestScoreByProject[p.id];
                const matchCount = matchCountByProject[p.id] ?? 0;
                return (
                  <Link key={p.id} href={`/dashboard/projects/${p.id}`}
                    className="group card overflow-hidden flex flex-col hover:border-gold transition-all hover:shadow-sm">

                    {/* Thumbnail + score badge */}
                    <div className="relative">
                      <div className="aspect-[3/2] overflow-hidden">
                        <ProjectThumbnail
                          posterPath={p.poster_path}
                          title={p.title}
                          genre={p.genre}
                          supabaseUrl={supabaseUrl}
                          className="w-full h-full rounded-t-card"
                        />
                      </div>
                      {best != null && (
                        <span className={`absolute top-2 right-2 text-[11px] tracking-[0.1em] font-medium px-2 py-0.5 rounded-full ${scoreBadgeStyle(best)}`}>
                          {best} match
                        </span>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-4 flex flex-col flex-1">
                      <p className="text-[11px] tracking-[0.2em] uppercase text-ash mb-1.5">
                        {[p.genre, p.format].filter(Boolean).join(" · ")}
                      </p>
                      <h3 className="font-display text-[18px] group-hover:text-gold transition-colors leading-snug mb-3">
                        {p.title}
                      </h3>

                      {/* Stats row */}
                      <div className="mt-auto pt-3 border-t border-line flex flex-wrap items-center gap-2 text-[11px]">
                        {matchCount > 0 && (
                          <span className="text-gold tracking-[0.08em]">
                            {matchCount} {matchCount === 1 ? "match" : "matches"}
                          </span>
                        )}
                        {(p.love_count ?? 0) > 0 && (
                          <span className="text-ash">♥ {p.love_count}</span>
                        )}
                        <span className={`ml-auto tracking-[0.1em] uppercase px-2 py-0.5 rounded-full border ${
                          p.is_public
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-parchment border-line text-ash"
                        }`}>
                          {p.is_public ? "Public" : "Private"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT — Deadlines + Producer interest */}
        <div className="space-y-8">

          {/* Closing soon */}
          {(upcomingDeadlines?.length ?? 0) > 0 && (
            <section>
              <p className="eyebrow mb-4">Closing soon</p>
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
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}>
                        {days}d left
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

          {/* No right-column content — show a nudge */}
          {(upcomingDeadlines?.length ?? 0) === 0 && (introRequests?.length ?? 0) === 0 && hasProjects && (
            <div className="card p-5 text-center">
              <p className="font-display text-[16px] mb-2">No deadlines this month</p>
              <p className="text-[12px] text-ash">Matched opportunities with upcoming deadlines appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
