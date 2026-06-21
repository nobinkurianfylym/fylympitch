import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usd, timeAgo } from "@/lib/format";
import { deleteProject, respondToOffer } from "@/lib/project-actions";
import type { Opportunity, Project } from "@/types";
import type {
  FundingDiscovery, FundingObstacle, Roadmap,
  ExecutiveProducerBrief, DreamScenario, FundingReadiness, ProducerMatch,
} from "@/services/fylympitchEngine";
import type { MatchRow } from "@/components/MatchList";
import RerunEngineButton from "@/components/RerunEngineButton";
import ProjectAnalysisLoader from "@/components/ProjectAnalysisLoader";
import FundingJourney, { type JourneyOpp } from "@/components/FundingJourney";
import MessageButton from "@/components/MessageButton";
import PitchDeckTile from "@/components/PitchDeckTile";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import ProjectIntelligenceSidebar from "@/components/ProjectIntelligenceSidebar";
import {
  formatBudgetDisplay, formatShortId, formatStage,
  formatCountry, STAGE_BADGE,
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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects")
    .select("*, profiles!projects_owner_id_fkey(full_name)")
    .eq("id", id)
    .single<Project>();
  if (!project) notFound();
  const isOwner = project.owner_id === user!.id;

  // ── Engine intelligence ───────────────────────────────────────
  const { data: intel } = await supabase
    .from("project_intelligence").select("*").eq("project_id", id).single();

  const discovery: FundingDiscovery | null       = intel?.funding_discovery ?? null;
  const readiness: FundingReadiness | null       = intel?.funding_readiness ?? null;
  const obstacles: FundingObstacle[]             = intel?.obstacles ?? [];
  const roadmap:   Roadmap | null                = intel?.roadmap ?? null;
  const epBrief:   ExecutiveProducerBrief | null = intel?.executive_producer ?? null;
  const dream:     DreamScenario | null          = intel?.dream_scenario ?? null;
  const producerMatches: ProducerMatch[]         = intel?.producer_matches ?? [];

  // ── Introduction requests ─────────────────────────────────────
  const { data: introRequests } = await supabase
    .from("introduction_requests").select("producer_user_id")
    .eq("filmmaker_id", user!.id).eq("project_id", id);
  const requestedProducerIds = (introRequests ?? []).map(
    (r: { producer_user_id: string }) => r.producer_user_id
  );

  // ── Match scores ──────────────────────────────────────────────
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
      .filter((m) => m.tier !== "hidden" && m.opportunity)
      .filter((m) => !isCompleted || COMPLETED_TYPES.has(m.opportunity!.opp_type))
      .slice(0, 10)
      .map((m) => ({
        id: m.opportunity!.id, title: m.opportunity!.title,
        opp_type: m.opportunity!.opp_type, max_award_usd: m.opportunity!.max_award_usd,
        deadline_note: m.opportunity!.deadline_note, deadline: m.opportunity!.deadline,
        score: m.score, tier: m.tier, warnings: [],
      }));
    journeyOpps = matchRows
      .filter((m) => m.score > 0 && m.opportunity)
      .filter((m) => !isCompleted || COMPLETED_TYPES.has(m.opportunity!.opp_type))
      .map((m) => ({
        id: m.opportunity!.id, title: m.opportunity!.title,
        country: m.opportunity!.country, opp_type: m.opportunity!.opp_type,
        max_award_usd: m.opportunity!.max_award_usd, deadline: m.opportunity!.deadline,
        deadline_note: m.opportunity!.deadline_note, score: m.score,
        url: m.opportunity!.url, app_link: m.opportunity!.app_link,
      }));
  } else {
    let fallbackQuery = supabase
      .from("opportunities").select("*").eq("is_active", true)
      .not("match_weight", "is", null)
      .order("match_weight", { ascending: false }).limit(80);
    if (isCompleted) fallbackQuery = (fallbackQuery as any).in("opp_type", [...COMPLETED_TYPES]);
    const { data: opps } = await fallbackQuery;
    const { calculateMatchScore } = await import("@/services/matching");
    const scoredOpps = (opps ?? []).map((o: Opportunity) => ({ o, m: calculateMatchScore(project, o) }));
    ranked = scoredOpps
      .filter((r) => r.m.tier !== "hidden").sort((a, b) => b.m.score - a.m.score).slice(0, 10)
      .map(({ o, m }) => ({
        id: o.id, title: o.title, opp_type: o.opp_type,
        max_award_usd: o.max_award_usd, deadline_note: (o as any).deadline_note,
        deadline: o.deadline, score: m.score, tier: m.tier, warnings: m.warnings,
      }));
    journeyOpps = scoredOpps
      .filter(({ m }) => m.score > 0).sort((a, b) => b.m.score - a.m.score)
      .map(({ o, m }) => ({
        id: o.id, title: o.title, country: o.country ?? null, opp_type: o.opp_type,
        max_award_usd: o.max_award_usd ?? null, deadline: o.deadline ?? null,
        deadline_note: (o as any).deadline_note ?? null, score: m.score,
        url: o.url ?? null, app_link: (o as any).app_link ?? null,
      }));
  }

  // ── Offers ────────────────────────────────────────────────────
  const { data: offers } = isOwner
    ? await supabase.from("offers")
        .select("*, profiles!offers_from_user_id_fkey(full_name, company, role)")
        .eq("project_id", id).order("created_at", { ascending: false })
    : { data: [] as any[] };

  // ── Signed URLs ───────────────────────────────────────────────
  async function signedUrl(bucket: string, path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }
  const deckUrl   = await signedUrl("pitch-decks", project.pitch_deck_path);
  const scriptUrl = await signedUrl("scripts",     project.script_path);

  // ── Display values ────────────────────────────────────────────
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
    canvas:  "#FAFAF8",
    ink:     "#1A1815",
    ash:     "#8A857C",
    gold:    "#BF9953",
    line:    "rgba(26,24,21,0.07)",
    surface: "#FFFFFF",
    mist:    "rgba(26,24,21,0.03)",
  } as const;

  const hasIntelligence = isOwner && !!discovery;

  return (
    <div style={{ background: S.canvas, minHeight: "100vh", overflowX: "hidden" }}>

      {isOwner && !discovery && <ProjectAnalysisLoader projectId={project.id} />}

      {/* ══ STICKY ACTION BAR ══════════════════════════════════ */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: S.canvas, borderBottom: `1px solid ${S.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 52, gap: 12,
      }}>
        <Link href="/dashboard" style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
          color: S.ash, textDecoration: "none", flexShrink: 0,
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
        }}>
          {project.title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {scriptUrl && (
            <a href={scriptUrl} target="_blank" rel="noreferrer" style={{
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: S.ash, textDecoration: "none",
              padding: "6px 14px", border: `1px solid ${S.line}`, borderRadius: 6,
            }}>Script</a>
          )}
          {isOwner && (
            <Link href={`/dashboard/projects/${project.id}/edit`} style={{
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: S.ink, textDecoration: "none",
              padding: "6px 14px", border: `1px solid rgba(26,24,21,0.2)`, borderRadius: 6,
            }}>Edit</Link>
          )}
          {isOwner && !!discovery && (
            <RerunEngineButton projectId={project.id} hasData={true} />
          )}
        </div>
      </div>

      {/* ══ 2-COLUMN LAYOUT ════════════════════════════════════ */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: hasIntelligence ? "1fr 292px" : "1fr",
          maxWidth:            1200,
          margin:              "0 auto",
          padding:             "0 32px 80px",
          gap:                 0,
          alignItems:          "start",
          minWidth:            0,
          overflow:            "hidden",
        }}
        className="filmmaker-detail-grid"
      >

        {/* ══ LEFT: Main content ══════════════════════════════ */}
        <div style={{ paddingRight: hasIntelligence ? 40 : 0, paddingTop: 40, minWidth: 0, overflow: "hidden" }}>

          {/* ── HERO ─────────────────────────────────────────── */}
          <div style={{
            display: "flex", gap: 28, alignItems: "flex-start",
            paddingBottom: 36, borderBottom: `1px solid ${S.line}`,
          }}>
            <div style={{
              width: 180, flexShrink: 0, borderRadius: 8,
              overflow: "hidden", boxShadow: "0 4px 24px rgba(26,24,21,0.12)",
              aspectRatio: "2/3", background: S.mist,
            }}>
              <ProjectThumbnail
                posterPath={project.poster_path}
                title={project.title}
                genre={project.genre}
                supabaseUrl={supabaseUrl}
                className="w-full h-full object-cover"
              />
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <h1 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(24px, 2.8vw, 42px)", fontWeight: 700,
                color: S.ink, lineHeight: 1.06, letterSpacing: "-0.02em",
                textTransform: "uppercase", margin: 0, marginBottom: 14,
              }}>
                {project.title}
              </h1>
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
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: "italic", fontSize: "clamp(14px, 1.3vw, 17px)",
                  lineHeight: 1.65, color: S.ink, opacity: 0.82, marginBottom: 18,
                  wordBreak: "break-word", overflowWrap: "break-word",
                }}>
                  "{project.logline}"
                </p>
              )}
              {stageDisplay && stageBadge && (
                <span style={{
                  display: "inline-block", fontSize: 9.5, letterSpacing: "0.18em",
                  textTransform: "uppercase", fontWeight: 600,
                  padding: "4px 10px", borderRadius: 4,
                  background: stageBadge.bg, color: stageBadge.color,
                }}>
                  {stageDisplay}
                </span>
              )}
            </div>
          </div>

          {/* ── INVESTMENT STRIP ─────────────────────────────── */}
          {(budget !== "—" || secured || seeking) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${[budget !== "—", !!secured, !!seeking, true].filter(Boolean).length}, 1fr)`,
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
              <div style={{ padding: "18px 14px 16px" }}>
                <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 5 }}>Project ID</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: S.ash, fontFamily: "monospace" }}>FYP-{projectId}</p>
              </div>
            </div>
          )}

          {/* ── SYNOPSIS ─────────────────────────────────────── */}
          {project.synopsis && (
            <div style={{ paddingTop: 40, paddingBottom: 40, borderBottom: `1px solid ${S.line}` }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 18 }}>Synopsis</p>
              <p style={{ fontSize: "clamp(15px, 1.3vw, 17px)", lineHeight: 1.8, color: S.ink, whiteSpace: "pre-line", wordBreak: "break-word", overflowWrap: "break-word" }}>
                {project.synopsis}
              </p>
            </div>
          )}

          {/* ── DIRECTOR'S STATEMENT ─────────────────────────── */}
          {project.director_statement && (
            <div style={{ paddingTop: 40, paddingBottom: 40, borderBottom: `1px solid ${S.line}` }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 18 }}>Director's Statement</p>
              <p style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic",
                fontSize: "clamp(15px, 1.3vw, 18px)", lineHeight: 1.8, color: S.ink, whiteSpace: "pre-line", opacity: 0.9, wordBreak: "break-word", overflowWrap: "break-word",
              }}>
                {project.director_statement}
              </p>
            </div>
          )}

          {/* ── PRODUCERS ────────────────────────────────────── */}
          {project.producer_info && (
            <div style={{ paddingTop: 40, paddingBottom: 40, borderBottom: `1px solid ${S.line}` }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 18 }}>Producers</p>
              <p style={{ fontSize: "clamp(14px, 1.2vw, 16px)", lineHeight: 1.75, color: S.ink, whiteSpace: "pre-line", wordBreak: "break-word", overflowWrap: "break-word" }}>
                {project.producer_info}
              </p>
            </div>
          )}

          {/* ── PITCH DECK — centered, 520px ─────────────────── */}
          {deckUrl && (
            <div style={{ paddingTop: 40, paddingBottom: 40, borderBottom: `1px solid ${S.line}`, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 18, alignSelf: "flex-start" }}>
                Pitch Deck
              </p>
              <PitchDeckTile deckUrl={deckUrl} title={project.title} className="w-full max-w-[520px]" />
            </div>
          )}

          {/* ── EP BRIEF ─────────────────────────────────────── */}
          {isOwner && epBrief && (
            <div style={{ paddingTop: 36, paddingBottom: 36, borderBottom: `1px solid ${S.line}` }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 18 }}>
                AI Executive Producer
              </p>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: S.ink, marginBottom: 8 }}>
                {epBrief.next_best_move?.title}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: S.ash, marginBottom: 18, maxWidth: 560 }}>
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

          {/* ── FUNDING JOURNEY ──────────────────────────────── */}
          {isOwner && (
            <div style={{ paddingTop: 8 }}>
              <FundingJourney projectId={project.id} opportunities={journeyOpps} roadmap={roadmap} readiness={readiness} />
            </div>
          )}

          {/* ── OBSTACLES ────────────────────────────────────── */}
          {isOwner && obstacles.length > 0 && (
            <div style={{ paddingTop: 40, paddingBottom: 40, borderTop: `1px solid ${S.line}` }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 6 }}>
                Strengthen Before Applying
              </p>
              <p style={{ fontSize: 12, color: S.ash, marginBottom: 18 }}>
                Address these to improve match scores and application success rates.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {obstacles.map((ob: FundingObstacle) => (
                  <div key={ob.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    padding: "12px 14px", borderRadius: 8,
                    border: `1px solid ${S.line}`, background: S.surface,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
                        padding: "2px 7px", borderRadius: 100, fontWeight: 600,
                        background: ob.severity === "high" ? "rgba(220,38,38,0.08)" : ob.severity === "medium" ? "rgba(234,179,8,0.08)" : S.mist,
                        color:      ob.severity === "high" ? "#b91c1c" : ob.severity === "medium" ? "#854d0e" : S.ash,
                      }}>{ob.severity}</span>
                      <span style={{ fontSize: 13, color: S.ink }}>{ob.label}</span>
                    </div>
                    {ob.action_href && (
                      <Link href={ob.action_href} style={{
                        fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: S.ink, textDecoration: "none",
                        padding: "4px 10px", border: `1px solid ${S.line}`, borderRadius: 5, flexShrink: 0,
                      }}>Fix →</Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── OFFERS ───────────────────────────────────────── */}
          {isOwner && (offers?.length ?? 0) > 0 && (
            <div style={{ paddingTop: 44, borderTop: `1px solid ${S.line}` }}>
              <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 22 }}>Offers</p>
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
                        <MessageButton
                          projectId={project.id} producerId={o.from_user_id} filmakerId={user!.id}
                          label="Reply" className="btn-ghost !px-5 !py-2.5 gap-2" inboxPath="/dashboard/messages"
                        />
                      </div>
                    ) : (
                      <p style={{ marginTop: 10, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: S.ash }}>{o.status}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DELETE ───────────────────────────────────────── */}
          {isOwner && (
            <form action={deleteProject} style={{ marginTop: 60, paddingTop: 20, borderTop: `1px solid ${S.line}` }}>
              <input type="hidden" name="project_id" value={project.id} />
              <button style={{
                fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "rgba(138,133,124,0.45)", background: "none", border: "none",
                cursor: "pointer", fontFamily: "Montserrat, sans-serif",
              }} className="fyp-delete-btn">
                Delete this project
              </button>
            </form>
          )}
        </div>

        {/* ══ RIGHT: Intelligence sidebar (sticky) ════════════ */}
        {hasIntelligence && (
          <div style={{
            position:   "sticky",
            top:        52,
            alignSelf:  "start",
            paddingTop: 32,
            paddingLeft: 0,
          }}>
            <ProjectIntelligenceSidebar
              discovery={discovery!}
              readiness={readiness}
              ranked={ranked}
              producerMatches={producerMatches}
              dream={dream}
              projectId={project.id}
              requestedProducerIds={requestedProducerIds}
            />
          </div>
        )}
      </div>

      <style>{`
        .fyp-delete-btn:hover { color: #dc2626 !important; }
        @media (max-width: 900px) {
          .filmmaker-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .filmmaker-detail-grid > div:first-child {
            padding-right: 0 !important;
          }
          .filmmaker-detail-grid > div:last-child {
            position: static !important;
            padding-top: 0 !important;
          }
        }
        @media (max-width: 640px) {
          .filmmaker-detail-grid { padding: 0 16px 60px !important; }
        }
      `}</style>
    </div>
  );
}
