import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MatchBadge from "@/components/MatchBadge";
import { usd, timeAgo, TYPE_LABEL } from "@/lib/format";
import { tierOf } from "@/services/matching";
import { respondToOffer } from "@/lib/actions";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  const isIndustry = profile && ["producer", "investor", "organization"].includes(profile.role);

  // Profile completion
  const fields = [profile?.full_name, profile?.country, profile?.bio, profile?.company, profile?.website || profile?.imdb_url];
  const completion = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  const { data: projects } = await supabase
    .from("projects").select("id, title, stage, genre").eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const { data: topMatches } = projectIds.length
    ? await supabase
        .from("matches")
        .select("score, confidence, project_id, opportunities!inner(id, title, opp_type, deadline, max_award_usd)")
        .in("project_id", projectIds)
        .order("score", { ascending: false })
        .limit(5)
    : { data: [] as any[] };

  const { count: appCount } = await supabase
    .from("applications").select("id", { count: "exact", head: true }).eq("applicant_id", user.id);
  const { count: savedCount } = await supabase
    .from("saved_opportunities").select("opportunity_id", { count: "exact", head: true }).eq("user_id", user.id);

  const { data: notifications } = await supabase
    .from("notifications").select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(4);

  const { data: offers } = projectIds.length
    ? await supabase
        .from("offers")
        .select("id, amount_usd, offer_type, message, status, created_at, project_id, profiles!offers_from_user_id_fkey(full_name, company, role)")
        .in("project_id", projectIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const bestScore = topMatches?.[0]?.score ?? null;
  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  return (
    <div>
      <p className="eyebrow mb-3">Overview</p>
      <h1 className="font-display text-[34px]">Good to see you, {firstName}.</h1>

      {/* Stat strip */}
      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Profile complete", `${completion}%`, "/dashboard/profile"],
          ["Top match score", bestScore != null ? `${bestScore}` : "—", "/dashboard/opportunities"],
          ["Applications", `${appCount ?? 0}`, "/dashboard/applications"],
          ["Saved", `${savedCount ?? 0}`, "/dashboard/saved"],
        ].map(([label, value, href]) => (
          <Link key={label} href={href} className="card p-5 hover:border-gold transition-colors">
            <div className="font-display text-[30px]">{value}</div>
            <div className="eyebrow mt-1">{label}</div>
          </Link>
        ))}
      </div>

      {/* Pending offers — the moment that matters most */}
      {(offers?.length ?? 0) > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-[22px] mb-6">Offers awaiting your reply</h2>
          <div className="space-y-4">
            {offers!.map((o: any) => (
              <div key={o.id} className="card p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-normal text-[15px]">
                    {o.profiles?.full_name}
                    {o.profiles?.company ? <span className="text-ash"> · {o.profiles.company}</span> : null}
                    <span className="eyebrow ml-3">{o.offer_type.replace("_", "-")}</span>
                  </div>
                  <div className="font-display text-[20px] text-gold">{usd(o.amount_usd)}</div>
                </div>
                <p className="mt-3 text-[14px] text-ash leading-relaxed">{o.message}</p>
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

      {/* Recommended opportunities */}
      {!isIndustry && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[22px]">Recommended for your projects</h2>
            <Link href="/dashboard/opportunities" className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold">View all</Link>
          </div>
          <div className="mt-6 space-y-px">
            {(topMatches ?? []).map((m: any) => (
              <Link key={`${m.project_id}-${m.opportunities.id}`} href={`/dashboard/opportunities/${m.opportunities.id}`}
                className="hairline py-5 flex items-center justify-between gap-6 hover:bg-parchment/60 transition-colors px-2 -mx-2">
                <div>
                  <div className="font-normal text-[15px]">{m.opportunities.title}</div>
                  <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                    {TYPE_LABEL[m.opportunities.opp_type]} {m.opportunities.max_award_usd ? `· up to ${usd(m.opportunities.max_award_usd)}` : ""}
                    {m.opportunities.deadline ? ` · deadline ${m.opportunities.deadline}` : ""}
                  </div>
                </div>
                <MatchBadge score={m.score} tier={tierOf(m.score)} />
              </Link>
            ))}
            {(!topMatches || topMatches.length === 0) && (
              <div className="hairline py-10 text-[14px] text-ash">
                {(projects?.length ?? 0) === 0 ? (
                  <>No matches yet — <Link className="text-ink underline underline-offset-4 hover:text-gold" href="/dashboard/projects/new">submit your first project</Link> and the engine will rank every live opportunity for you.</>
                ) : (
                  <>Matches are being computed. Open an opportunity to see its score for your project.</>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {isIndustry && (
        <section className="mt-14">
          <h2 className="font-display text-[22px] mb-4">Find your next project</h2>
          <p className="text-[14px] text-ash max-w-lg">Browse verified filmmaker projects with loglines, synopses, decks and scripts — and send an offer when something fits your slate.</p>
          <Link href="/dashboard/discover" className="btn-gold mt-6">Discover projects</Link>
        </section>
      )}

      {/* Recent notifications */}
      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[22px]">Recent activity</h2>
          <Link href="/dashboard/notifications" className="text-[12px] tracking-[0.16em] uppercase text-ash hover:text-gold">All notifications</Link>
        </div>
        <div className="mt-6">
          {(notifications ?? []).map((n) => (
            <div key={n.id} className="hairline py-4 flex justify-between gap-6">
              <div className="text-[14px]">
                <span className={n.read ? "text-ash" : "font-normal"}>{n.title}</span>
                {n.body && <span className="text-ash"> — {n.body}</span>}
              </div>
              <span className="text-[12px] text-ash shrink-0">{timeAgo(n.created_at)}</span>
            </div>
          ))}
          {(!notifications || notifications.length === 0) && (
            <p className="hairline py-6 text-[14px] text-ash">Nothing yet. Activity on your projects and applications will appear here.</p>
          )}
        </div>
      </section>
    </div>
  );
}
