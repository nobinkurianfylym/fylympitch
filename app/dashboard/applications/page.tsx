import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, timeAgo } from "@/lib/format";
import { updateFilmmakerStage } from "@/lib/actions";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "qualified",     label: "Qualified",      sub: "Identified as a match" },
  { key: "script",        label: "Script",         sub: "Preparing materials" },
  { key: "profile_ready", label: "Profile Ready",  sub: "Ready to submit" },
  { key: "submitted",     label: "Submitted",      sub: "Application sent" },
  { key: "result",        label: "Result",         sub: "Response received" },
] as const;

type StageKey = typeof STAGES[number]["key"];

const NEXT: Record<StageKey, StageKey | null> = {
  qualified:     "script",
  script:        "profile_ready",
  profile_ready: "submitted",
  submitted:     "result",
  result:        null,
};
const PREV: Record<StageKey, StageKey | null> = {
  qualified:     null,
  script:        "qualified",
  profile_ready: "script",
  submitted:     "profile_ready",
  result:        "submitted",
};

const STATUS_BADGE: Record<string, string> = {
  accepted:    "bg-[rgba(46,107,78,0.08)] text-[#2E6B4E] border-[rgba(46,107,78,0.2)]",
  shortlisted: "bg-gold/8 text-[#8A6F3E] border-gold/30",
  rejected:    "bg-[rgba(26,24,21,0.05)] text-ash border-line",
  under_review:"bg-parchment text-ash border-line",
};

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: apps } = await supabase
    .from("applications")
    .select("*, projects(title), opportunities(id, title, opp_type, deadline, max_award_usd, url, app_link)")
    .eq("applicant_id", user!.id)
    .order("created_at", { ascending: false });

  const list = (apps ?? []) as any[];
  const total = list.length;

  // Group by filmmaker_stage (fallback to 'qualified' until migration runs)
  const byStage = Object.fromEntries(
    STAGES.map((s) => [s.key, list.filter((a) => (a.filmmaker_stage ?? "qualified") === s.key)])
  ) as Record<StageKey, any[]>;

  return (
    <div>
      <p className="eyebrow mb-3">My pipeline</p>
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="font-display text-[34px]">Applications</h1>
        <span className="text-[13px] text-ash">{total} logged</span>
      </div>

      {total === 0 ? (
        <div className="hairline pt-10 text-[14px] text-ash">
          No applications tracked yet. Open an{" "}
          <Link href="/dashboard/opportunities" className="text-ink underline underline-offset-4 hover:text-gold">
            opportunity
          </Link>{" "}
          and click &ldquo;Log this application&rdquo; to start tracking.
        </div>
      ) : (
        /* ── CRM COLUMNS ── */
        <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-5" style={{ minWidth: 860 }}>
            {STAGES.map((stage) => {
              const cards = byStage[stage.key];
              return (
                <div key={stage.key} className="flex-1 min-w-[160px]">
                  {/* Column header */}
                  <div className="mb-4 pb-3 border-b-2" style={{
                    borderColor: cards.length > 0 ? "#1A1815" : "#E5E0D5",
                  }}>
                    <p className="text-[11px] tracking-[0.16em] uppercase font-medium text-ink mb-0.5">
                      {stage.label}
                    </p>
                    <p className="text-[10px] text-ash">
                      {cards.length} {cards.length === 1 ? "application" : "applications"}
                    </p>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {cards.map((app) => {
                      const currentStage = (app.filmmaker_stage ?? "qualified") as StageKey;
                      const nextStage    = NEXT[currentStage];
                      const prevStage    = PREV[currentStage];
                      const showBadge    = ["accepted","shortlisted","rejected","under_review"].includes(app.status);

                      return (
                        <div key={app.id} className="card p-4">
                          {/* Fund title */}
                          <Link
                            href={`/dashboard/opportunities/${app.opportunities?.id}`}
                            className="font-display text-[13px] leading-snug hover:text-gold transition-colors block mb-1"
                          >
                            {app.opportunities?.title ?? "Opportunity"}
                          </Link>

                          {/* Project */}
                          <p className="text-[10px] tracking-[0.1em] uppercase text-ash mb-3">
                            {app.projects?.title}
                          </p>

                          {/* Meta row */}
                          <div className="flex items-center justify-between mb-3">
                            {app.match_score != null && (
                              <span className="font-display text-[16px] text-gold">{app.match_score}</span>
                            )}
                            {app.opportunities?.deadline && (
                              <span className="text-[10px] text-ash ml-auto">
                                {new Date(app.opportunities.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>

                          {/* Official status badge */}
                          {showBadge && (
                            <span className={`inline-block text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-full border mb-3 ${STATUS_BADGE[app.status] ?? ""}`}>
                              {app.status.replace("_", " ")}
                            </span>
                          )}

                          {/* Apply link */}
                          {(app.opportunities?.app_link || app.opportunities?.url) && (
                            <a
                              href={app.opportunities.app_link ?? app.opportunities.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[9px] tracking-[0.12em] uppercase text-gold hover:text-ink transition-colors mb-3"
                            >
                              Submit externally →
                            </a>
                          )}

                          {/* Stage buttons */}
                          <div className="flex items-center gap-1 pt-2 border-t border-line">
                            {prevStage && (
                              <form action={updateFilmmakerStage}>
                                <input type="hidden" name="application_id" value={app.id} />
                                <input type="hidden" name="stage" value={prevStage} />
                                <button
                                  type="submit"
                                  className="text-[9px] tracking-[0.08em] uppercase text-ash hover:text-ink transition-colors px-1 py-1"
                                  title={`Move back to ${prevStage}`}
                                >
                                  ←
                                </button>
                              </form>
                            )}
                            <span className="text-[9px] tracking-[0.08em] uppercase text-ash/50 flex-1 text-center">
                              {stage.label}
                            </span>
                            {nextStage && (
                              <form action={updateFilmmakerStage}>
                                <input type="hidden" name="application_id" value={app.id} />
                                <input type="hidden" name="stage" value={nextStage} />
                                <button
                                  type="submit"
                                  className="text-[9px] tracking-[0.08em] uppercase text-gold hover:text-ink transition-colors px-1 py-1"
                                  title={`Advance to ${nextStage}`}
                                >
                                  →
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
