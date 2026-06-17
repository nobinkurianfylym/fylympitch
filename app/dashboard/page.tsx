import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MatchBadge from "@/components/MatchBadge";
import OpportunitiesExpand from "@/components/OpportunitiesExpand";
import { usd, STAGE_LABEL } from "@/lib/format";
import { tierOf } from "@/services/matching";
import { respondToOffer } from "@/lib/actions";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();

  // Profile completion
  const completionFields = [profile?.full_name, profile?.country, profile?.bio, profile?.company, profile?.website || profile?.imdb_url];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  // Projects (filmmaker slate)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, stage, genre, format, country, funding_needed_usd, is_public, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  // Matches per project
  const { data: allMatches } = projectIds.length
    ? await supabase
        .from("matches")
        .select("score, project_id, opportunities!inner(id, title, opp_type, deadline, max_award_usd)")
        .in("project_id", projectIds)
        .order("score", { ascending: false })
        .limit(50)
    : { data: [] as any[] };

  const bestScoreByProject: Record<string, number> = {};
  const matchCountByProject: Record<string, number> = {};
  for (const m of allMatches ?? []) {
    const pid = m.project_id;
    if (bestScoreByProject[pid] == null || m.score > bestScoreByProject[pid]) bestScoreByProject[pid] = m.score;
    matchCountByProject[pid] = (matchCountByProject[pid] ?? 0) + 1;
  }

  const seenOppIds = new Set<string>();
  const dedupedMatches: any[] = [];
  for (const m of allMatches ?? []) {
    if (!seenOppIds.has(m.opportunities.id)) {
      seenOppIds.add(m.opportunities.id);
      dedupedMatches.push(m);
    }
  }

  const { count: appCount } = await supabase
    .from("applications").select("id", { count: "exact", head: true }).eq("applicant_id", user.id);
  const { count: savedCount } = await supabase
    .from("saved_opportunities").select("opportunity_id", { count: "exact", head: true }).eq("user_id", user.id);

  // Pending offers on filmmaker's projects
  const { data: offers } = projectIds.length
    ? await supabase
        .from("offers")
        .select("id, amount_usd, offer_type, message, status, created_at, project_id, profiles!offers_from_user_id_fkey(full_name, company)")
        .in("project_id", projectIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  // Deadlines this month from matched opportunities
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: upcomingDeadlines } = projectIds.length
    ? await supabase
        .from("matches")
        .select("score, opportunities!inner(id, title, deadline, opp_type, max_award_usd)")
        .in("project_id", projectIds)
        .gte("opportunities.deadline", new Date().toISOString())
        .lte("opportunities.deadline", thirtyDaysFromNow)
        .gte("score", 65)
        .order("opportunities.deadline")
        .limit(5)
    : { data: [] as any[] };

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";
  const hasProjects = (projects?.length ?? 0) > 0;

  return (
    <div>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-[34px] leading-tight">
          Good to see you, {firstName}.
        </h1>
        <Link href="/dashboard/projects/new" className="btn-gold shrink-0 mt-1">
          + New project
        </Link>
      </div>

      {/* ── Profile completion ────────────────────────────────── */}
      {completion < 70 && (
        <Link href="/dashboard/profile"
          className="mt-7 flex items-center gap-4 py-4 px-5 card hover:border-gold transition-colors">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-ink" style={{ fontWeight: 500 }}>Complete your profile</div>
            <div className="text-[12px] text-ash mt-0.5">
              A fuller profile unlocks better matches — you're {completion}% there.
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-20 h-[3px] bg-line rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <span className="text-[11px] tracking-[0.2em] uppercase text-ash">{completion}%</span>
          </div>
        </Link>
      )}

      {/* ── Pending offers ────────────────────────────────────── */}
      {(offers?.length ?? 0) > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-[22px] mb-5">
            {offers!.length === 1 ? "An offer awaits your reply" : `${offers!.length} offers await your reply`}
          </h2>
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

      {/* ── Filmmaker slate ───────────────────────────────────── */}
      {/* ── Deadline strip ──────────────────────────────────── */}
      {(upcomingDeadlines?.length ?? 0) > 0 && (
        <section className="mt-10">
          <p className="eyebrow mb-3">Deadlines this month</p>
          <div className="flex flex-wrap gap-3">
            {(upcomingDeadlines ?? []).map((m: any) => {
              const opp = m.opportunities;
              const days = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86_400_000);
              return (
                <Link key={opp.id} href={`/dashboard/opportunities/${opp.id}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-white/60 px-4 py-3 hover:border-gold transition-colors">
                  <span className={`text-[11px] font-medium tabular-nums ${days <= 7 ? "text-red-600" : "text-gold"}`}>
                    {days}d
                  </span>
                  <span className="text-[13px] text-ink truncate max-w-[180px]">{opp.title}</span>
                  <span className="text-[11px] text-ash ml-auto">{m.score}/100</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="eyebrow mb-1">FYLYMPITCH Engine</p>
            <h2 className="font-display text-[24px]">Your slate</h2>
          </div>
          {hasProjects && (
            <span className="text-[12px] tracking-[0.16em] uppercase text-ash">
              {projects!.length} {projects!.length === 1 ? "project" : "projects"}
            </span>
          )}
        </div>

        {(projects ?? []).map((p) => {
          const best = bestScoreByProject[p.id];
          const matchCount = matchCountByProject[p.id] ?? 0;
          return (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="hairline py-6 flex items-start justify-between gap-6 hover:bg-parchment/40 -mx-2 px-2 rounded-card transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="font-display text-[22px] group-hover:text-gold transition-colors">{p.title}</div>
                <div className="mt-1.5 text-[12px] tracking-[0.14em] uppercase text-ash">
                  {[p.genre, p.format, STAGE_LABEL[p.stage] ?? p.stage, p.country].filter(Boolean).join(" · ")}
                  {p.funding_needed_usd ? ` · seeking ${usd(p.funding_needed_usd)}` : ""}
                </div>
                {matchCount > 0 && (
                  <div className="mt-3 text-[12px] tracking-[0.14em] uppercase text-gold">
                    {matchCount} funding {matchCount === 1 ? "match" : "matches"} — view intelligence report →
                  </div>
                )}
              </div>
              {best != null && (
                <div className="shrink-0 pt-1">
                  <MatchBadge score={best} tier={tierOf(best)} />
                </div>
              )}
            </Link>
          );
        })}

        {!hasProjects && (
          <div className="mt-6 rounded-card border border-line bg-white/50 p-8 text-center">
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
        )}

        {hasProjects && (
          <div className="pt-4">
            <Link href="/dashboard/projects/new"
              className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold transition-colors">
              + Add another project
            </Link>
          </div>
        )}
      </section>

      {/* ── Matched opportunities ─────────────────────────────── */}
      {dedupedMatches.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-display text-[22px]">Funding opportunities</h2>
            <Link href="/dashboard/opportunities"
              className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold transition-colors">
              All →
            </Link>
          </div>
          <p className="text-[13px] text-ash mb-6">
            Matched to your {projects!.length === 1 ? "project" : "projects"} by the FYLYMPITCH engine.
          </p>
          <OpportunitiesExpand matches={dedupedMatches} />
        </section>
      )}

      {hasProjects && dedupedMatches.length === 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[22px] mb-4">Funding opportunities</h2>
          <p className="hairline pt-6 text-[14px] text-ash">
            Matches are being computed — the engine scores every live opportunity against your project.
          </p>
        </section>
      )}

      {/* ── Status strip ──────────────────────────────────────── */}
      <div className="mt-14 pt-7 border-t border-line flex flex-wrap gap-8">
        <Link href="/dashboard/applications" className="flex items-baseline gap-2 text-ash hover:text-ink transition-colors">
          <span className="font-display text-[24px] text-ink">{appCount ?? 0}</span>
          <span className="text-[12px] tracking-[0.16em] uppercase">Application{(appCount ?? 0) !== 1 ? "s" : ""}</span>
        </Link>
        <Link href="/dashboard/saved" className="flex items-baseline gap-2 text-ash hover:text-ink transition-colors">
          <span className="font-display text-[24px] text-ink">{savedCount ?? 0}</span>
          <span className="text-[12px] tracking-[0.16em] uppercase">Saved</span>
        </Link>
      </div>

    </div>
  );
}
