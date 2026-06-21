import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usd, timeAgo, formatBudget } from "@/lib/format";
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
import ProjectIntelligenceColumns from "@/components/ProjectIntelligenceColumns";
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

  const discovery: FundingDiscovery | null      = intel?.funding_discovery ?? null;
  const readiness: FundingReadiness | null      = intel?.funding_readiness ?? null;
  const obstacles: FundingObstacle[]            = intel?.obstacles ?? [];
  const roadmap:   Roadmap | null               = intel?.roadmap ?? null;
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
  const budget       = formatBudgetDisplay(project.budget_usd);
  const secured      = project.finance_secured_usd;
  const securedPct   = project.budget_usd && secured ? Math.min(100, Math.round((secured / project.budget_usd) * 100)) : null;
  const seeking      = project.funding_needed_usd ? formatBudgetDisplay(project.funding_needed_usd) : null;
  const stageDisplay = project.stage ? (STAGE_LABEL[project.stage] ?? project.stage) : null;
  const stageBadge   = project.stage ? (STAGE_BADGE[project.stage] ?? STAGE_BADGE["development"]) : null;
  const projectId    = formatShortId(project.id);
  const country      = project.country ? formatCountry(project.country) : null;

  const metaItems = [
    project.format ? (FORMAT_LABEL[project.format] ?? project.format) : null,
    project.genre,
    country ? (country.flag ? `${country.flag} ${country.name}` : country.name) : null,
    project.language,
    stageDisplay,
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

  return (
    <div style={{ background: S.canvas, minHeight: "100vh" }}>

      {/* ── AUTO-TRIGGER ENGINE ── */}
      {isOwner && !discovery && <ProjectAnalysisLoader projectId={project.id} />}

      {/* ══ 1. STICKY ACTION BAR ═══════════════════════════════ */}
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

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 80px" }}>

        {/* ══ 2. HERO ════════════════════════════════════════════ */}
        <div style={{
          display: "flex", gap: 28, alignItems: "flex-start",
          padding: "40px 0 36px", borderBottom: `1px solid ${S.line}`,
        }}>
          {/* Poster */}
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

          {/* Title block */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(26px, 3.2vw, 44px)", fontWeight: 700,
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
                fontStyle: "italic", fontSize: "clamp(15px, 1.4vw, 18px)",
                lineHeight: 1.65, color: S.ink, opacity: 0.82, maxWidth: 560, marginBottom: 18,
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

        {/* ══ 3. INVESTMENT STRIP ════════════════════════════════ */}
        {(budget !== "—" || secured || seeking) && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${[budget !== "—", secured, seeking, true].filter(Boolean).length}, 1fr)`,
            borderBottom: `1px solid ${S.line}`,
          }}>
            {budget !== "—" && (
              <div style={{ padding: "18px 16px 16px", borderRight: `1px solid ${S.line}` }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Budget</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: S.ink, fontFamily: "'Playfair Display', serif", letterSpacing: "-0.01em" }}>{budget}</p>
              </div>
            )}
            {secured && (
              <div style={{ padding: "18px 16px 16px", borderRight: `1px solid ${S.line}` }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Secured</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#2E6B4E", fontFamily: "'Playfair Display', serif", letterSpacing: "-0.01em", marginBottom: 6 }}>
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
              <div style={{ padding: "18px 16px 16px", borderRight: `1px solid ${S.line}` }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Seeking</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: S.gold, fontFamily: "'Playfair Display', serif", letterSpacing: "-0.01em" }}>{seeking}</p>
              </div>
            )}
            <div style={{ padding: "18px 16px 16px" }}>
              <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Project ID</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: S.ash, fontFamily: "monospace", letterSpacing: "0.06em" }}>FYP-{projectId}</p>
            </div>
          </div>
        )}

        {/* ══ 4. ENGINE INTELLIGENCE — 3 columns ═════════════════ */}
        {isOwner && discovery && (
          <div style={{ paddingTop: 32, paddingBottom: 8 }}>
            <ProjectIntelligenceColumns
              discovery={discovery}
              readiness={readiness}
              ranked={ranked}
              producerMatches={producerMatches}
              dream={dream}
              projectId={project.id}
              requestedProducerIds={requestedProducerIds}
            />
          </div>
        )}

        {/* ══ 5. CONTENT SECTIONS ════════════════════════════════ */}
        {project.synopsis && (
          <div style={{ paddingTop: 44, paddingBottom: 44, borderBottom: `1px solid ${S.line}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 20 }}>Synopsis</p>
            <p style={{ fontSize: "clamp(16px,1.4vw,18px)", lineHeight: 1.78, color: S.ink, whiteSpace: "pre-line" }}>
              {project.synopsis}
            </p>
          </div>
        )}
        {project.director_statement && (
          <div style={{ paddingTop: 44, paddingBottom: 44, borderBottom: `1px solid ${S.line}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 20 }}>Director's Statement</p>
            <p style={{
              fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic",
              fontSize: "clamp(16px,1.4vw,19px)", lineHeight: 1.78, color: S.ink, whiteSpace: "pre-line", opacity: 0.9,
            }}>
              {project.director_statement}
            </p>
          </div>
        )}
        {project.producer_info && (
          <div style={{ paddingTop: 44, paddingBottom: 44, borderBottom: `1px solid ${S.line}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 20 }}>Producers</p>
            <p style={{ fontSize: "clamp(15px,1.3vw,17px)", lineHeight: 1.75, color: S.ink, whiteSpace: "pre-line" }}>
              {project.producer_info}
            </p>
          </div>
        )}

        {/* ══ 6. PITCH DECK — centered, 520px ════════════════════ */}
        {deckUrl && (
          <div style={{ paddingTop: 40, paddingBottom: 40, borderBottom: `1px solid ${S.line}`, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 20, alignSelf: "flex-start" }}>
              Pitch Deck
            </p>
            <PitchDeckTile deckUrl={deckUrl} title={project.title} className="w-full max-w-[520px]" />
          </div>
        )}

        {/* ══ 7. EP BRIEF ════════════════════════════════════════ */}
        {isOwner && epBrief && (
          <div style={{ padding: "36px 0", borderBottom: `1px solid ${S.line}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 20 }}>
              AI Executive Producer
            </p>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: S.ink, marginBottom: 8 }}>
              {epBrief.next_best_move?.title}
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: S.ash, marginBottom: 20, maxWidth: 620 }}>
              {epBrief.summary}
            </p>
            {epBrief.next_best_move && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 13, marginBottom: 20 }}>
                <span style={{ color: S.ash }}>Funding range — <span style={{ color: S.ink }}>{epBrief.next_best_move.funding_range}</span></span>
                <span style={{ color: S.ash }}>Success chance — <span style={{ color: S.ink }}>{epBrief.next_best_move.success_chance}%</span></span>
                {epBrief.next_best_move.deadline_days && (
                  <span style={{ color: S.ash }}>Deadline — <span style={{ color: S.gold }}>{epBrief.next_best_move.deadline_days} days</span></span>
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

        {/* ══ 8. FUNDING JOURNEY ═════════════════════════════════ */}
        {isOwner && (
          <div style={{ paddingTop: 8 }}>
            <FundingJourney projectId={project.id} opportunities={journeyOpps} roadmap={roadmap} readiness={readiness} />
          </div>
        )}

        {/* ══ 9. OBSTACLES ═══════════════════════════════════════ */}
        {isOwner && obstacles.length > 0 && (
          <div style={{ paddingTop: 40, paddingBottom: 40, borderTop: `1px solid ${S.line}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 6 }}>Strengthen Before Applying</p>
            <p style={{ fontSize: 13, color: S.ash, marginBottom: 20 }}>
              Address these to improve your match scores and application success rates.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {obstacles.map((ob: FundingObstacle) => (
                <div key={ob.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                  padding: "14px 16px", borderRadius: 8,
                  border: `1px solid ${S.line}`, background: S.surface,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
                      padding: "3px 8px", borderRadius: 100, fontWeight: 600,
                      background: ob.severity === "high" ? "rgba(220,38,38,0.08)" : ob.severity === "medium" ? "rgba(234,179,8,0.1)" : "rgba(26,24,21,0.05)",
                      color:      ob.severity === "high" ? "#b91c1c" : ob.severity === "medium" ? "#854d0e" : S.ash,
                    }}>
                      {ob.severity}
                    </span>
                    <span style={{ fontSize: 14, color: S.ink }}>{ob.label}</span>
                  </div>
                  {ob.action_href && (
                    <Link href={ob.action_href} style={{
                      fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                      color: S.ink, textDecoration: "none",
                      padding: "5px 12px", border: `1px solid ${S.line}`, borderRadius: 6, flexShrink: 0,
                    }}>
                      Fix this →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ 10. OFFERS ═════════════════════════════════════════ */}
        {isOwner && (offers?.length ?? 0) > 0 && (
          <div style={{ paddingTop: 44, borderTop: `1px solid ${S.line}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 24 }}>Offers</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {offers!.map((o: any) => (
                <div key={o.id} style={{ padding: "20px 20px", borderRadius: 10, border: `1px solid ${S.line}`, background: S.surface }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 15, color: S.ink }}>
                      {o.profiles?.full_name}
                      {o.profiles?.company && <span style={{ color: S.ash }}> · {o.profiles.company}</span>}
                      <span style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: S.ash, marginLeft: 10 }}>
                        {o.offer_type.replace("_", "-")} · {timeAgo(o.created_at)}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: S.gold }}>{usd(o.amount_usd)}</div>
                  </div>
                  <p style={{ fontSize: 14, color: S.ash, lineHeight: 1.6 }}>{o.message}</p>
                  {o.status === "pending" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
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
                    <p style={{ marginTop: 12, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: S.ash }}>{o.status}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ 11. DELETE ═════════════════════════════════════════ */}
        {isOwner && (
          <form action={deleteProject} style={{ marginTop: 60, paddingTop: 24, borderTop: `1px solid ${S.line}` }}>
            <input type="hidden" name="project_id" value={project.id} />
            <button style={{
              fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(138,133,124,0.5)", background: "none", border: "none",
              cursor: "pointer", fontFamily: "Montserrat, sans-serif",
            }} className="fyp-delete-btn">
              Delete this project
            </button>
          </form>
        )}
      </div>

      <style>{`
        .fyp-delete-btn:hover { color: #dc2626 !important; }
      `}</style>
    </div>
  );
}
