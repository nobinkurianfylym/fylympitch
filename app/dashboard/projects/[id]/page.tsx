import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usd, timeAgo } from "@/lib/format";
import { deleteProject, respondToOffer } from "@/lib/project-actions";
import { requestProducerIntroduction } from "@/lib/actions";
import type { Opportunity, Project } from "@/types";
import type {
  FundingDiscovery, FundingObstacle, Roadmap,
  ExecutiveProducerBrief, DreamScenario, FundingReadiness, ProducerMatch,
} from "@/services/fylympitchEngine";
import type { MatchRow } from "@/components/MatchList";
import RerunEngineButton from "@/components/RerunEngineButton";
import BookmarkButton from "@/components/BookmarkButton";
import { getSavedOpportunityIds } from "@/lib/saved-actions";
import ProjectAnalysisLoader from "@/components/ProjectAnalysisLoader";
import FundingJourney, { type JourneyOpp } from "@/components/FundingJourney";
import MessageButton from "@/components/MessageButton";
import PitchDeckTile from "@/components/PitchDeckTile";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import ProjectIntelligenceSidebar from "@/components/ProjectIntelligenceSidebar";
import FilmmakerWorkspace, { type WorkspaceDeadline } from "@/components/FilmmakerWorkspace";
import FilmmakerMotivation from "@/components/FilmmakerMotivation";
import {
  formatBudgetDisplay, formatShortId, formatCountry, STAGE_BADGE,
} from "@/lib/film-identity";

export const dynamic = "force-dynamic";

const FORMAT_LABEL: Record<string, string> = {
  feature: "Feature", short: "Short", documentary: "Documentary",
  series: "Series", animation: "Animation",
};
const STAGE_LABEL: Record<string, string> = {
  development: "Development", pre_production: "Pre-Production",
  production: "Production", post_production: "Post-Production", completed: "Completed",
};
const OPP_LABELS: Record<string, string> = {
  grant: "Grant", lab: "Lab", co_production: "Co-Pro", fund: "Fund",
  market: "Market", producer: "Producer", investor: "Investor",
};

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const simpleView = from === "projects"; // from My Projects — hide intelligence
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("*, has_script_doc, has_budget_doc, has_lookbook, profiles!projects_owner_id_fkey(full_name)")
    .eq("id", id).single<Project>();
  if (!project) notFound();
  const isOwner = project.owner_id === user!.id;

  const { data: intel } = await supabase
    .from("project_intelligence").select("*").eq("project_id", id).single();

  const discovery: FundingDiscovery | null       = intel?.funding_discovery ?? null;
  const readiness: FundingReadiness | null       = intel?.funding_readiness ?? null;
  const obstacles: FundingObstacle[]             = intel?.obstacles ?? [];
  const roadmap:   Roadmap | null                = intel?.roadmap ?? null;
  const epBrief:   ExecutiveProducerBrief | null = intel?.executive_producer ?? null;
  const dream:     DreamScenario | null          = intel?.dream_scenario ?? null;
  const producerMatches: ProducerMatch[]         = intel?.producer_matches ?? [];

  const { data: introRequests } = await supabase
    .from("introduction_requests").select("producer_user_id")
    .eq("filmmaker_id", user!.id).eq("project_id", id);
  const requestedProducerIds = new Set(
    (introRequests ?? []).map((r: { producer_user_id: string }) => r.producer_user_id)
  );

  type MatchDbRow = {
    score: number; tier: string; reasons: string[];
    opportunity: {
      id: string; title: string; opp_type: string; country: string | null;
      max_award_usd: number | null; deadline: string | null;
      deadline_note: string | null; url: string | null; app_link: string | null;
    } | null;
  };
  const { data: matchRows } = (await supabase
    .from("matches")
    .select("score, tier, reasons, opportunity:opportunities(id,title,opp_type,country,max_award_usd,deadline,deadline_note,url,app_link)")
    .eq("project_id", id)
    .order("score", { ascending: false })) as { data: MatchDbRow[] | null };

  const COMPLETED_TYPES = new Set(["broadcaster","streamer","pre_sale","sales_agent","distribution"]);
  const isCompleted = project.stage === "completed";

  let ranked: MatchRow[] = [];
  let journeyOpps: JourneyOpp[] = [];

  if (matchRows && matchRows.length > 0) {
    ranked = matchRows
      .filter(m => m.tier !== "hidden" && m.opportunity)
      .filter(m => !isCompleted || COMPLETED_TYPES.has(m.opportunity!.opp_type))
      .slice(0, 10)
      .map(m => ({
        id: m.opportunity!.id, title: m.opportunity!.title,
        opp_type: m.opportunity!.opp_type, max_award_usd: m.opportunity!.max_award_usd,
        deadline_note: m.opportunity!.deadline_note, deadline: m.opportunity!.deadline,
        score: m.score, tier: m.tier, warnings: [],
      }));
    journeyOpps = matchRows
      .filter(m => m.score > 0 && m.opportunity)
      .filter(m => !isCompleted || COMPLETED_TYPES.has(m.opportunity!.opp_type))
      .map(m => ({
        id: m.opportunity!.id, title: m.opportunity!.title,
        country: m.opportunity!.country, opp_type: m.opportunity!.opp_type,
        max_award_usd: m.opportunity!.max_award_usd, deadline: m.opportunity!.deadline,
        deadline_note: m.opportunity!.deadline_note, score: m.score,
        url: m.opportunity!.url, app_link: m.opportunity!.app_link,
      }));
  } else {
    let q = supabase.from("opportunities").select("*").eq("is_active", true)
      .not("match_weight", "is", null).order("match_weight", { ascending: false }).limit(80);
    if (isCompleted) q = (q as any).in("opp_type", [...COMPLETED_TYPES]);
    const { data: opps } = await q;
    const { calculateMatchScore } = await import("@/services/matching");
    const scored = (opps ?? []).map((o: Opportunity) => ({ o, m: calculateMatchScore(project, o) }));
    ranked = scored.filter(r => r.m.tier !== "hidden").sort((a,b) => b.m.score - a.m.score).slice(0, 10)
      .map(({ o, m }) => ({ id: o.id, title: o.title, opp_type: o.opp_type,
        max_award_usd: o.max_award_usd, deadline_note: (o as any).deadline_note,
        deadline: o.deadline, score: m.score, tier: m.tier, warnings: m.warnings }));
    journeyOpps = scored.filter(({ m }) => m.score > 0).sort((a,b) => b.m.score - a.m.score)
      .map(({ o, m }) => ({ id: o.id, title: o.title, country: o.country ?? null,
        opp_type: o.opp_type, max_award_usd: o.max_award_usd ?? null,
        deadline: o.deadline ?? null, deadline_note: (o as any).deadline_note ?? null,
        score: m.score, url: o.url ?? null, app_link: (o as any).app_link ?? null }));
  }

  // Saved opportunity IDs for this user
  const savedIds = isOwner
    ? await getSavedOpportunityIds(ranked.map(m => m.id))
    : new Set<string>();

  const { data: offers } = isOwner
    ? await supabase.from("offers")
        .select("*, profiles!offers_from_user_id_fkey(full_name, company, role)")
        .eq("project_id", id).order("created_at", { ascending: false })
    : { data: [] as any[] };

  async function signedUrl(bucket: string, path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }
  const deckUrl   = await signedUrl("pitch-decks", project.pitch_deck_path);
  const scriptUrl = await signedUrl("scripts",     project.script_path);

  // ── Workspace data (only when coming from My Projects) ──────
  let workspaceIntroCount    = 0;
  let workspaceMeetingTotal  = 0;
  let workspaceMeetingAccept = 0;

  if (simpleView && isOwner) {
    const [introRes, meetingRes] = await Promise.all([
      supabase.from("introduction_requests")
        .select("id", { count: "exact", head: true })
        .eq("filmmaker_id", user!.id).eq("project_id", id),
      supabase.from("meeting_requests")
        .select("status")
        .eq("filmmaker_id", user!.id).eq("project_id", id),
    ]);
    workspaceIntroCount    = introRes.count ?? 0;
    workspaceMeetingTotal  = (meetingRes.data ?? []).length;
    workspaceMeetingAccept = (meetingRes.data ?? []).filter((m: any) => m.status === "accepted").length;
  }

  // Upcoming deadlines for workspace (top matches with a future deadline)
  const upcomingDeadlines: WorkspaceDeadline[] = journeyOpps
    .filter(o => o.deadline && new Date(o.deadline) > new Date())
    .slice(0, 6)
    .map(o => ({
      id:            o.id,
      title:         o.title,
      opp_type:      o.opp_type,
      deadline:      o.deadline,
      deadline_note: o.deadline_note,
      max_award_usd: o.max_award_usd,
      score:         o.score,
    }));

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const director     = project.director_name ?? (project as any).profiles?.full_name ?? null;
  const secured      = project.finance_secured_usd;
  const budget       = formatBudgetDisplay(project.budget_usd);
  const securedPct   = project.budget_usd && secured
    ? Math.min(100, Math.round((secured / project.budget_usd) * 100)) : null;
  const seeking      = project.funding_needed_usd ? formatBudgetDisplay(project.funding_needed_usd) : null;
  const stageDisplay = project.stage ? (STAGE_LABEL[project.stage] ?? project.stage) : null;
  const stageBadge   = project.stage ? (STAGE_BADGE[project.stage] ?? STAGE_BADGE["development"]) : null;
  const projectId    = formatShortId(project.id);
  const country      = project.country ? formatCountry(project.country) : null;

  const metaItems = [
    project.format ? (FORMAT_LABEL[project.format] ?? project.format) : null,
    project.genre,
    country ? (country.flag ? `${country.flag} ${country.name}` : country.name) : null,
    project.language, stageDisplay,
  ].filter(Boolean) as string[];

  const S = {
    canvas:  "#FAFAF8", ink: "#1A1815", ash: "#8A857C",
    gold:    "#BF9953", line: "rgba(26,24,21,0.07)",
    surface: "#FFFFFF", mist: "rgba(26,24,21,0.03)",
  } as const;

  const hasIntel = isOwner && !!discovery && !simpleView;

  // ── Section heading style ────────────────────────────────────
  const SH: React.CSSProperties = {
    fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
    color: S.gold, fontWeight: 600, marginBottom: 18,
  };

  return (
    <div style={{ background: S.canvas, minHeight: "100vh", overflowX: "hidden" }}>
      {isOwner && !discovery && !simpleView && <ProjectAnalysisLoader projectId={project.id} />}

      {/* ── ACTION BAR ─────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: S.canvas, borderBottom: `1px solid ${S.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 52, gap: 12,
      }}>
        <Link href="/dashboard" style={{
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
          color: S.ash, textDecoration: "none",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          My Projects
        </Link>
        <span style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 13, fontWeight: 700, color: S.ink,
          letterSpacing: "-0.01em", textTransform: "uppercase",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flex: 1, textAlign: "center",
        }}>{project.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {isOwner && !!discovery && !simpleView && <RerunEngineButton projectId={project.id} hasData={true} />}
          {isOwner && (
            <Link href={`/dashboard/projects/${project.id}/edit`} style={{
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: S.ink, textDecoration: "none",
              padding: "6px 14px", border: `1px solid rgba(26,24,21,0.2)`, borderRadius: 6,
            }}>Edit</Link>
          )}
          {scriptUrl && (
            <a href={scriptUrl} target="_blank" rel="noreferrer" style={{
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: S.ash, textDecoration: "none",
              padding: "6px 14px", border: `1px solid ${S.line}`, borderRadius: 6,
            }}>Script</a>
          )}
        </div>
      </div>

      {/* ── ANCHOR NAV ─────────────────────────────────────────── */}
      {!simpleView && (
        <div style={{
          position: "sticky", top: 52, zIndex: 19,
          background: S.canvas, borderBottom: `1px solid ${S.line}`,
          display: "flex", alignItems: "center", gap: 0,
          padding: "0 32px", overflowX: "auto",
        }}>
          {[
            { href: "#overview",        label: "Overview" },
            { href: "#top-matches",     label: "Top Matches" },
            { href: "#ai-ep",           label: "AI Producer" },
            { href: "#funding-journey", label: "Funding Journey" },
            { href: "#improve",         label: "Improve" },
            { href: "#applications",    label: "Applications" },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="fyp-anchor-link" style={{
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              color: S.ash, textDecoration: "none",
              padding: "10px 16px", flexShrink: 0,
              borderBottom: "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
            }}>{label}</a>
          ))}
        </div>
      )}

      {/* ── 2-COLUMN GRID ──────────────────────────────────────── */}
      <div
        className="filmmaker-detail-grid"
        style={{
          display: "grid",
          gridTemplateColumns: hasIntel ? "1fr 284px" : simpleView ? "1fr 284px" : "1fr",
          maxWidth: 1200, margin: "0 auto",
          padding: "0 32px 80px",
          alignItems: "start", minWidth: 0,
        }}
      >

        {/* ════ MAIN COLUMN ════════════════════════════════════ */}
        <div style={{ paddingRight: (hasIntel || simpleView) ? 40 : 0, paddingTop: 40, minWidth: 0, overflow: "hidden" }}>

          {/* HERO */}
          <div id="overview" style={{
            display: "flex", gap: 28, alignItems: "flex-start",
            paddingBottom: 36, borderBottom: `1px solid ${S.line}`,
          }}>
            <div style={{
              width: 180, flexShrink: 0, borderRadius: 8,
              overflow: "hidden", boxShadow: "0 4px 24px rgba(26,24,21,0.12)",
              aspectRatio: "2/3", background: S.mist,
            }}>
              <ProjectThumbnail posterPath={project.poster_path} title={project.title}
                genre={project.genre} supabaseUrl={supabaseUrl} className="w-full h-full object-cover" />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <h1 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(24px, 2.8vw, 42px)", fontWeight: 700, color: S.ink,
                lineHeight: 1.06, letterSpacing: "-0.02em", textTransform: "uppercase",
                margin: 0, marginBottom: 14, wordBreak: "break-word",
              }}>{project.title}</h1>
              {metaItems.length > 0 && (
                <p style={{ fontSize: 12, letterSpacing: "0.1em", color: S.ash, lineHeight: 1.6, marginBottom: director ? 10 : 0 }}>
                  {metaItems.join("  ·  ")}
                </p>
              )}
              {director && (
                <p style={{ fontSize: 13, color: S.ash, marginBottom: 18 }}>
                  <span style={{ letterSpacing: "0.06em", fontSize: 10, textTransform: "uppercase", marginRight: 6 }}>Dir.</span>
                  <span style={{ color: S.ink, fontWeight: 500 }}>{director}</span>
                </p>
              )}
              {project.logline && (
                <p style={{
                  fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic",
                  fontSize: "clamp(14px, 1.3vw, 17px)", lineHeight: 1.65,
                  color: S.ink, opacity: 0.82, marginBottom: 18,
                  wordBreak: "break-word", overflowWrap: "break-word",
                }}>"{project.logline}"</p>
              )}
              {stageDisplay && stageBadge && (
                <span style={{
                  display: "inline-block", fontSize: 9.5, letterSpacing: "0.18em",
                  textTransform: "uppercase", fontWeight: 600,
                  padding: "4px 10px", borderRadius: 4,
                  background: stageBadge.bg, color: stageBadge.color,
                }}>{stageDisplay}</span>
              )}
            </div>
          </div>

          {/* PACKAGE */}
          {(() => {
            const docs = [
              { label: "Pitch Deck", present: !!project.pitch_deck_path },
              { label: "Script",     present: !!(project as any).has_script_doc || !!project.script_path },
              { label: "Budget",     present: !!(project as any).has_budget_doc || !!project.budget_usd },
              { label: "Lookbook",   present: !!(project as any).has_lookbook },
            ];
            return (
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 8,
                paddingTop: 16, paddingBottom: 20,
                borderBottom: `1px solid ${S.line}`,
              }}>
                {docs.map(({ label, present }) => (
                  <span key={label} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "4px 10px", borderRadius: 20,
                    border: `1px solid ${present ? "rgba(191,153,83,0.3)" : "rgba(26,24,21,0.08)"}`,
                    background: present ? "rgba(191,153,83,0.06)" : "rgba(26,24,21,0.02)",
                    color: present ? "#7a5e1a" : S.ash,
                  }}>
                    <span style={{ fontSize: 11 }}>{present ? "✓" : "✕"}</span>
                    {label}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* INVESTMENT STRIP */}
          {(budget !== "—" || secured || seeking) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${[budget !== "—", !!secured, !!seeking].filter(Boolean).length}, 1fr)`,
              borderBottom: `1px solid ${S.line}`,
            }}>
              {budget !== "—" && (
                <div style={{ padding: "18px 14px 16px", borderRight: `1px solid ${S.line}` }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 5 }}>Budget</p>
                  <p style={{ fontSize: 19, fontWeight: 700, color: S.ink, fontFamily: "'Playfair Display', serif" }}>{budget}</p>
                </div>
              )}
              {secured && (
                <div style={{ padding: "18px 14px 16px", borderRight: `1px solid ${S.line}` }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 5 }}>Secured</p>
                  <p style={{ fontSize: 19, fontWeight: 700, color: "#2E6B4E", fontFamily: "'Playfair Display', serif", marginBottom: 6 }}>
                    {formatBudgetDisplay(secured)}
                  </p>
                  {securedPct !== null && (
                    <>
                      <div style={{ height: 3, background: "rgba(191,153,83,0.15)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${securedPct}%`, background: S.gold, borderRadius: 2 }} />
                      </div>
                      <p style={{ fontSize: 9, color: S.ash, marginTop: 4 }}>{securedPct}% of budget</p>
                    </>
                  )}
                </div>
              )}
              {seeking && (
                <div style={{ padding: "18px 14px 16px", borderRight: `1px solid ${S.line}` }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 5 }}>Seeking</p>
                  <p style={{ fontSize: 19, fontWeight: 700, color: S.gold, fontFamily: "'Playfair Display', serif" }}>{seeking}</p>
                </div>
              )}

            </div>
          )}
          {/* Project ID below strip */}
          {projectId && (
            <p style={{ fontSize: 11, color: S.ash, padding: "8px 2px 0", letterSpacing: "0.04em" }}>
              Project ID: <span style={{ fontFamily: "monospace", fontSize: 11 }}>FYP-{projectId}</span>
            </p>
          )}

          {/* TOP MATCHES */}
          <div id="top-matches" style={{ position: "relative", marginTop: -1 }} />
          {isOwner && !simpleView && ranked.length > 0 && (
            <div style={{ paddingTop: 36, paddingBottom: 36, borderBottom: `1px solid ${S.line}` }}>
              <p style={SH}>Top Matches</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ranked.slice(0, 8).map(m => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 8,
                    border: `1px solid ${S.line}`, background: S.surface,
                  }}>
                    <span style={{
                      fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                      padding: "2px 7px", borderRadius: 4, flexShrink: 0,
                      background: "rgba(191,153,83,0.08)", color: S.gold, fontWeight: 600,
                    }}>
                      {OPP_LABELS[m.opp_type] ?? m.opp_type}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: S.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                        {m.title}
                      </p>
                      {(m.max_award_usd || m.deadline_note || m.deadline) && (
                        <p style={{ fontSize: 10, color: S.ash }}>
                          {m.max_award_usd ? usd(m.max_award_usd) : ""}
                          {m.max_award_usd && (m.deadline_note || m.deadline) ? " · " : ""}
                          {m.deadline_note ?? (m.deadline ? new Date(m.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "")}
                        </p>
                      )}
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: S.gold, flexShrink: 0, minWidth: 32, textAlign: "right" }}>
                      {m.score}
                    </div>
                    <BookmarkButton
                      opportunityId={m.id}
                      projectId={project.id}
                      initialSaved={savedIds.has(m.id)}
                    />
                    <Link
                      href={`/dashboard/opportunities/${m.id}?project=${project.id}`}
                      style={{
                        flexShrink:    0,
                        fontSize:      10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding:       "5px 12px",
                        borderRadius:  6,
                        border:        `1px solid rgba(191,153,83,0.35)`,
                        color:         S.gold,
                        textDecoration:"none",
                        whiteSpace:    "nowrap",
                        fontWeight:    600,
                        transition:    "background 0.15s",
                      }}
                      className="fyp-view-btn"
                    >
                      View →
                    </Link>
                  </div>
                ))}
              </div>
              {ranked.length > 8 && (
                <Link href="/dashboard/opportunities" style={{
                  display: "inline-block", marginTop: 12,
                  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: S.gold, textDecoration: "none", opacity: 0.75,
                }}>
                  View all {ranked.length} matches →
                </Link>
              )}
            </div>
          )}

          {/* PRODUCER MATCHES */}
          {isOwner && !simpleView && producerMatches.length > 0 && (
            <div style={{ paddingTop: 36, paddingBottom: 36, borderBottom: `1px solid ${S.line}` }}>
              <p style={SH}>Producers &amp; Investors</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {producerMatches.slice(0, 5).map(pm => {
                  const done = requestedProducerIds.has(pm.profile.id);
                  const initials = pm.profile.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <div key={pm.profile.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 8,
                      border: `1px solid ${S.line}`, background: S.surface,
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(26,24,21,0.06)", overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: S.ash, border: `1px solid ${S.line}`,
                      }}>
                        {pm.profile.avatar_url
                          ? <img src={pm.profile.avatar_url} alt={pm.profile.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: S.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                          <Link href={`/producers/${pm.profile.id}`} style={{ color: S.ink, textDecoration: "none" }}
                            className="hover:text-gold transition-colors">
                            {pm.profile.full_name}
                          </Link>
                          {pm.profile.company && <span style={{ color: S.ash }}> · {pm.profile.company}</span>}
                        </p>
                        <span style={{
                          fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                          padding: "2px 7px", borderRadius: 100, fontWeight: 600,
                          background: "rgba(191,153,83,0.08)", color: S.gold,
                        }}>
                          {pm.profile.role === "investor" ? "Investor" : pm.profile.role === "organization" ? "Org" : "Producer"}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: S.gold, flexShrink: 0, marginRight: 8 }}>
                        {pm.score}
                      </div>
                      {done
                        ? <span style={{ fontSize: 10, color: "#16a34a", whiteSpace: "nowrap", flexShrink: 0 }}>✓ Sent</span>
                        : (
                          <form action={requestProducerIntroduction} style={{ flexShrink: 0 }}>
                            <input type="hidden" name="producer_user_id" value={pm.profile.id} />
                            <input type="hidden" name="project_id" value={project.id} />
                            <button type="submit" style={{
                              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                              padding: "6px 12px", borderRadius: 6,
                              border: `1px solid rgba(26,24,21,0.2)`,
                              background: "transparent", color: S.ink,
                              cursor: "pointer", whiteSpace: "nowrap",
                              fontFamily: "Montserrat, sans-serif",
                            }}>Connect →</button>
                          </form>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI EP BRIEF */}
          <div id="ai-ep" style={{ position: "relative", marginTop: -1 }} />
          {isOwner && !simpleView && epBrief && (
            <div style={{ paddingTop: 36, paddingBottom: 36, borderBottom: `1px solid ${S.line}` }}>
              <p style={SH}>AI Executive Producer</p>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: S.ink, marginBottom: 8 }}>
                {epBrief.next_best_move?.title}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: S.ash, marginBottom: 18 }}>
                {epBrief.summary}
              </p>
              {epBrief.next_best_move && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13, marginBottom: 18 }}>
                  <span style={{ color: S.ash }}>Funding range — <span style={{ color: S.ink }}>{epBrief.next_best_move.funding_range}</span></span>
                  <span style={{ color: S.ash }}>Success — <span style={{ color: S.ink }}>{epBrief.next_best_move.success_chance}%</span></span>
                  {epBrief.next_best_move.deadline_days && (
                    <span style={{ color: S.ash }}>Deadline — <span style={{ color: S.gold }}>{epBrief.next_best_move.deadline_days}d</span></span>
                  )}
                </div>
              )}
              {epBrief.next_best_move?.opportunity_id && (
                <Link href={`/dashboard/opportunities/${epBrief.next_best_move.opportunity_id}?project=${project.id}`} className="btn-gold inline-flex">
                  {epBrief.next_best_move.action_label ?? "Apply now"} →
                </Link>
              )}
            </div>
          )}

          {/* PITCH DECK — only in My Projects view */}
          {simpleView && deckUrl && (
            <div style={{ paddingTop: 28, paddingBottom: 28, borderBottom: `1px solid ${S.line}`, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ ...SH, alignSelf: "flex-start", color: S.ash }}>Pitch Deck</p>
              <PitchDeckTile deckUrl={deckUrl} title={project.title} className="w-full max-w-[520px]" />
            </div>
          )}

          {/* SYNOPSIS — only in My Projects view */}
          {simpleView && project.synopsis && (
            <div style={{ paddingTop: 28, paddingBottom: 28, borderBottom: `1px solid ${S.line}` }}>
              <p style={SH}>Synopsis</p>
              <p style={{ fontSize: "clamp(15px, 1.3vw, 17px)", lineHeight: 1.8, color: S.ink, whiteSpace: "pre-line", wordBreak: "break-word", overflowWrap: "break-word" }}>
                {project.synopsis}
              </p>
            </div>
          )}



          {/* PRODUCERS */}
          {project.producer_info && (
            <div style={{ paddingTop: 28, paddingBottom: 28, borderBottom: `1px solid ${S.line}` }}>
              <p style={SH}>Producers</p>
              <p style={{ fontSize: "clamp(14px, 1.2vw, 16px)", lineHeight: 1.75, color: S.ink, whiteSpace: "pre-line", wordBreak: "break-word", overflowWrap: "break-word" }}>
                {project.producer_info}
              </p>
            </div>
          )}

          {/* FUNDING JOURNEY — back below AI EP */}
          <div id="funding-journey" style={{ position: "relative", marginTop: -1 }} />
          {isOwner && !simpleView && (
            <div style={{ paddingTop: 8 }}>
              <FundingJourney projectId={project.id} opportunities={journeyOpps} roadmap={roadmap} readiness={readiness} />
            </div>
          )}

          {/* OBSTACLES */}
          <div id="improve" style={{ position: "relative", marginTop: -1 }} />
          {isOwner && !simpleView && obstacles.length > 0 && (
            <div style={{ paddingTop: 28, paddingBottom: 28, borderTop: `1px solid ${S.line}` }}>
              <p style={SH}>Strengthen Before Applying</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {obstacles.map((ob: FundingObstacle) => (
                  <div key={ob.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, padding: "10px 14px", borderRadius: 8,
                    border: `1px solid ${S.line}`, background: S.surface,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid rgba(26,24,21,0.18)`,
                        background: "transparent", display: "inline-block",
                      }} />
                      <span style={{ fontSize: 13, color: S.ink, lineHeight: 1.4 }}>{ob.label}</span>
                    </div>
                    {ob.action_href && (
                      <Link href={ob.action_href} style={{
                        flexShrink: 0, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: S.ash, textDecoration: "none", whiteSpace: "nowrap",
                      }}>Fix →</Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OFFERS */}
          <div id="applications" style={{ position: "relative", marginTop: -1 }} />
          {isOwner && (offers?.length ?? 0) > 0 && (
            <div style={{ paddingTop: 44, borderTop: `1px solid ${S.line}` }}>
              <p style={SH}>Offers</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {offers!.map((o: any) => (
                  <div key={o.id} style={{ padding: "18px", borderRadius: 8, border: `1px solid ${S.line}`, background: S.surface }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: S.ink }}>
                        {o.profiles?.full_name}
                        {o.profiles?.company && <span style={{ color: S.ash }}> · {o.profiles.company}</span>}
                      </span>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: S.gold }}>{usd(o.amount_usd)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: S.ash, lineHeight: 1.6 }}>{o.message}</p>
                    {o.status === "pending" ? (
                      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        <form action={respondToOffer}><input type="hidden" name="offer_id" value={o.id} /><input type="hidden" name="decision" value="accepted" /><button className="btn-gold !px-5 !py-2.5">Accept</button></form>
                        <form action={respondToOffer}><input type="hidden" name="offer_id" value={o.id} /><input type="hidden" name="decision" value="declined" /><button className="btn-ghost !px-5 !py-2.5">Decline</button></form>
                        <MessageButton projectId={project.id} producerId={o.from_user_id} filmakerId={user!.id} label="Reply" className="btn-ghost !px-5 !py-2.5 gap-2" inboxPath="/dashboard/messages" />
                      </div>
                    ) : (
                      <p style={{ marginTop: 10, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: S.ash }}>{o.status}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DELETE — Danger Zone */}
          {isOwner && (
            <details style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${S.line}` }}>
              <summary style={{
                fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
                color: "rgba(138,133,124,0.4)", cursor: "pointer", userSelect: "none",
                listStyle: "none", display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>▸</span> Danger Zone
              </summary>
              <div style={{
                marginTop: 16, padding: "20px", borderRadius: 8,
                border: "1px solid rgba(220,38,38,0.2)",
                background: "rgba(220,38,38,0.03)",
              }}>
                <p style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600, marginBottom: 6 }}>Delete this project</p>
                <p style={{ fontSize: 12, color: S.ash, lineHeight: 1.6, marginBottom: 16 }}>
                  This action is permanent. All associated matches, intelligence data, and files will be removed and cannot be recovered.
                </p>
                <form action={deleteProject}>
                  <input type="hidden" name="project_id" value={project.id} />
                  <button style={{
                    fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "#b91c1c", background: "none",
                    border: "1px solid rgba(185,28,28,0.3)", borderRadius: 6,
                    padding: "7px 16px", cursor: "pointer", fontFamily: "Montserrat, sans-serif",
                  }}>Delete project permanently</button>
                </form>
              </div>
            </details>
          )}

          {/* END CTA */}
          {!simpleView && (
            <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${S.line}` }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: S.ink, marginBottom: 6, fontWeight: 400 }}>
                Ready to take the next step?
              </h3>
              <p style={{ fontSize: 13, color: S.ash, marginBottom: 22, lineHeight: 1.6 }}>
                Your project is live on PITCH.FYLYM. Start applying to your top matches or share your project to build momentum.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Link href="/dashboard/opportunities" style={{
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "9px 20px", borderRadius: 6, textDecoration: "none",
                  background: S.ink, color: "#F5F5F0", fontWeight: 600,
                }}>View All Matches →</Link>
                <Link href="/dashboard/applications" style={{
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "9px 20px", borderRadius: 6, textDecoration: "none",
                  border: `1px solid ${S.line}`, color: S.ink,
                }}>My Applications →</Link>
                <Link href={`/dashboard/projects/${project.id}/edit`} style={{
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "9px 20px", borderRadius: 6, textDecoration: "none",
                  border: `1px solid ${S.line}`, color: S.ash,
                }}>Edit Project</Link>
              </div>
              <div style={{ marginTop: 36 }}>
                <FilmmakerMotivation />
              </div>
            </div>
          )}
        </div>

        {/* ════ RIGHT SIDEBAR — 4 dark boxes incl. journey mini ═ */}
        {hasIntel && (
          <div style={{ position: "sticky", top: 52, alignSelf: "start", paddingTop: 32 }}>
            <ProjectIntelligenceSidebar
              discovery={discovery!}
              readiness={readiness}
              dream={dream}
              roadmap={roadmap}
            />
          </div>
        )}

        {/* ════ FILMMAKER WORKSPACE (simpleView) ═══════════════ */}
        {simpleView && isOwner && (
          <div style={{ position: "sticky", top: 52, alignSelf: "start", paddingTop: 32, paddingLeft: 24, borderLeft: `1px solid rgba(26,24,21,0.07)` }}>
            <FilmmakerWorkspace
              projectId={project.id}
              hasPitchDeck={!!project.pitch_deck_path}
              hasIntel={!!discovery}
              hasMatches={ranked.length > 0}
              introCount={workspaceIntroCount}
              meetingTotal={workspaceMeetingTotal}
              meetingAccepted={workspaceMeetingAccept}
              fundingSecured={(project as any).finance_secured_usd ?? null}
              loveCount={(project as any).love_count ?? 0}
              upcomingDeadlines={upcomingDeadlines}
            />
          </div>
        )}
      </div>

      <style>{`
        .fyp-match-row:hover  { border-color: rgba(191,153,83,0.4) !important; }
        .fyp-delete-btn:hover { color: #dc2626 !important; }
        .fyp-anchor-link:hover { color: #1A1815 !important; border-bottom-color: #BF9953 !important; }
        @media (max-width: 900px) {
          .filmmaker-detail-grid { grid-template-columns: 1fr !important; }
          .filmmaker-detail-grid > div:first-child { padding-right: 0 !important; }
          .filmmaker-detail-grid > div:last-child  { position: static !important; padding-top: 0 !important; }
        }
        @media (max-width: 640px) {
          .filmmaker-detail-grid { padding: 0 16px 60px !important; }
        }
      `}</style>
    </div>
  );
}
