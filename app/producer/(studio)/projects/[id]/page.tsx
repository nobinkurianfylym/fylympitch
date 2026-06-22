import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { upsertProducerProject } from "@/lib/actions";
import MessageButton from "@/components/MessageButton";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import PitchDeckTile from "@/components/PitchDeckTile";
import PipelineStageForm from "@/components/PipelineStageForm";
import StarRatingForm from "@/components/StarRatingForm";
import PrivateNotesForm from "@/components/PrivateNotesForm";
import {
  formatBudgetDisplay,
  formatShortId,
  formatCountry,
  STAGE_BADGE,
} from "@/lib/film-identity";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = [
  { key: "saved",       label: "Saved"       },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "in_review",   label: "In Review"   },
  { key: "meeting_set", label: "Meeting Set" },
  { key: "deal_active", label: "Deal Active" },
];

const FORMAT_LABEL: Record<string, string> = {
  feature: "Feature", short: "Short", documentary: "Documentary",
  series: "Series", animation: "Animation",
};
const STAGE_LABEL: Record<string, string> = {
  development: "Development", pre_production: "Pre-Production",
  production: "Production", post_production: "Post-Production", completed: "Completed",
};

// Pipeline status → visual token
const PIPELINE_STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  saved:        { bg: "rgba(138,133,124,0.10)", color: "#8A857C", dot: "#8A857C"  },
  shortlisted:  { bg: "rgba(191,153,83,0.13)",  color: "#9E7C3A", dot: "#BF9953"  },
  in_review:    { bg: "rgba(59,130,246,0.10)",  color: "#3B82F6", dot: "#3B82F6"  },
  meeting_set:  { bg: "rgba(168,85,247,0.10)",  color: "#A855F7", dot: "#A855F7"  },
  deal_active:  { bg: "rgba(46,107,78,0.10)",   color: "#2E6B4E", dot: "#2E6B4E"  },
};

export default async function ProducerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("approval_status").eq("id", user.id).single();
  if (profile?.approval_status !== "approved") redirect("/producer/pending");

  const { data: project } = await supabase
    .from("projects")
    .select("*, has_script_doc, has_budget_doc, has_lookbook, profiles!projects_owner_id_fkey(id, full_name, company)")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: crm } = await supabase
    .from("producer_projects").select("*")
    .eq("producer_id", user.id).eq("project_id", id).single();

  const { data: meeting } = await supabase
    .from("meeting_requests").select("*")
    .eq("producer_id", user.id).eq("project_id", id).maybeSingle();

  // Related projects — same genre, different project
  let relatedProjects: any[] = [];
  if (project.genre) {
    const { data: relData } = await supabase
      .from("projects")
      .select("id, title, genre, budget_usd, director_name, poster_path, profiles!projects_owner_id_fkey(id, full_name)")
      .eq("genre", project.genre)
      .neq("id", project.id)
      .limit(3);
    relatedProjects = relData ?? [];
  }

  const deckUrl = project.pitch_deck_path
    ? (await supabase.storage.from("pitch-decks").createSignedUrl(project.pitch_deck_path, 3600)).data?.signedUrl
    : null;
  const scriptUrl = project.script_path
    ? (await supabase.storage.from("scripts").createSignedUrl(project.script_path, 3600)).data?.signedUrl
    : null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const filmmaker = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  // ── Computed display values ────────────────────────────────
  const budget        = formatBudgetDisplay(project.budget_usd);
  const secured       = project.finance_secured_usd;
  const securedDisplay = secured ? formatBudgetDisplay(secured) : null;
  const securedPct    = project.budget_usd && secured
    ? Math.min(100, Math.round((secured / project.budget_usd) * 100)) : null;
  const seeking       = project.funding_needed_usd ? formatBudgetDisplay(project.funding_needed_usd) : null;
  const stageDisplay  = project.stage ? (STAGE_LABEL[project.stage] ?? project.stage) : null;
  const stageBadge    = project.stage ? (STAGE_BADGE[project.stage] ?? STAGE_BADGE["development"]) : null;
  const projectId     = formatShortId(project.id);
  const director      = project.director_name ?? filmmaker?.full_name ?? null;
  const country       = project.country ? formatCountry(project.country) : null;

  // Pipeline status
  const pipelineStatus = crm?.status ?? null;
  const pipelineLabel  = pipelineStatus
    ? (PIPELINE_STAGES.find(s => s.key === pipelineStatus)?.label ?? pipelineStatus) : null;
  const pipelineStyle  = pipelineStatus ? (PIPELINE_STATUS_STYLE[pipelineStatus] ?? PIPELINE_STATUS_STYLE["saved"]) : null;

  // Metadata dot-chain
  const metaItems = [
    project.format ? (FORMAT_LABEL[project.format] ?? project.format) : null,
    project.genre,
    country ? (country.flag ? `${country.flag} ${country.name}` : country.name) : null,
    project.language,
    stageDisplay,
  ].filter(Boolean) as string[];

  // ── Metrics strip column count ────────────────────────────────
  const metricCols = [budget !== "—", securedDisplay, seeking, stageDisplay, true].filter(Boolean).length;
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

      {/* ══ 1. STICKY TOP BAR ═══════════════════════════════════ */}
      <div style={{
        position:       "sticky",
        top:            0,
        zIndex:         30,
        background:     S.canvas,
        borderBottom:   `1px solid ${S.line}`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "0 32px",
        height:         52,
        gap:            12,
      }}>

        {/* Breadcrumb — Projects > Title */}
        <nav aria-label="Breadcrumb" style={{
          display:    "flex",
          alignItems: "center",
          gap:        6,
          flex:       1,
          minWidth:   0,
          overflow:   "hidden",
        }}>
          <Link href="/producer/projects" style={{
            fontSize:      11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         S.ash,
            textDecoration:"none",
            whiteSpace:    "nowrap",
            flexShrink:    0,
            transition:    "color 0.15s",
          }}>
            Projects
          </Link>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ flexShrink: 0, opacity: 0.3 }}>
            <path d="M3.5 2L6.5 5l-3 3" stroke={S.ink}
              strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{
            fontSize:      11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color:         S.ink,
            fontWeight:    600,
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
          }}>
            {project.title}
          </span>
        </nav>

        {/* Top-bar actions — Script + Save only; no duplicate message */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {scriptUrl && (
            <a href={scriptUrl} target="_blank" rel="noreferrer" style={{
              fontSize:      11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         S.ash,
              textDecoration:"none",
              padding:       "6px 14px",
              border:        `1px solid ${S.line}`,
              borderRadius:  6,
              transition:    "color 0.15s",
            }}>
              Script
            </a>
          )}
          <form action={upsertProducerProject} style={{ display: "inline" }}>
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="status"     value={crm?.status ?? "saved"} />
            <input type="hidden" name="rating"     value={crm?.rating ?? ""} />
            <input type="hidden" name="notes"      value={crm?.notes ?? ""} />
            <button type="submit" style={{
              fontSize:      11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         crm ? S.gold : S.ash,
              background:    crm ? "rgba(191,153,83,0.08)" : "transparent",
              border:        `1px solid ${crm ? "rgba(191,153,83,0.3)" : S.line}`,
              borderRadius:  6,
              padding:       "6px 14px",
              cursor:        "pointer",
              fontFamily:    "Montserrat, sans-serif",
            }}>
              {crm ? "Saved ✓" : "Save"}
            </button>
          </form>
        </div>
      </div>

      {/* ══ 2. MAIN LAYOUT ══════════════════════════════════════ */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "1fr 288px",
        maxWidth:            1240,
        margin:              "0 auto",
        padding:             "0 32px 80px",
        gap:                 0,
        alignItems:          "start",
      }} className="producer-detail-grid">

        {/* ── LEFT: Main content ─────────────────────────────── */}
        <div style={{ paddingRight: 48, paddingTop: 40 }}>

          {/* ── HERO — poster + title block ──────────────────── */}
          <div style={{
            display:       "flex",
            gap:           28,
            alignItems:    "flex-start",
            paddingBottom: 40,
            borderBottom:  `1px solid ${S.line}`,
          }}>
            {/* Poster */}
            <div style={{
              width:       176,
              flexShrink:  0,
              borderRadius: 8,
              overflow:    "hidden",
              boxShadow:   "0 4px 24px rgba(26,24,21,0.12)",
              aspectRatio: "2/3",
              background:  S.mist,
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

              {/* Pipeline status badge */}
              {crm?.status && (
                <div style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           5,
                  marginBottom:  14,
                  fontSize:      9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight:    700,
                  padding:       "4px 10px",
                  borderRadius:  4,
                  background:    pipelineStyle?.bg,
                  color:         pipelineStyle?.color,
                }}>
                  <span style={{
                    width: 4, height: 4, borderRadius: "50%",
                    background: pipelineStyle?.dot, display: "inline-block",
                  }} />
                  {pipelineLabel}
                </div>
              )}

              {/* Title */}
              <h1 style={{
                fontFamily:    "'Playfair Display', Georgia, serif",
                fontSize:      "clamp(26px, 3.2vw, 44px)",
                fontWeight:    700,
                color:         S.ink,
                lineHeight:    1.06,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                margin:        0,
                marginBottom:  14,
              }}>
                {project.title}
              </h1>

              {/* Metadata dot-chain */}
              {metaItems.length > 0 && (
                <p style={{
                  fontSize:      12,
                  letterSpacing: "0.1em",
                  color:         S.ash,
                  lineHeight:    1.6,
                  marginBottom:  director ? 10 : 0,
                }}>
                  {metaItems.join("  ·  ")}
                </p>
              )}

              {/* Director */}
              {director && (
                <p style={{ fontSize: 13, color: S.ash, marginBottom: 18 }}>
                  <span style={{
                    letterSpacing: "0.06em", fontSize: 10,
                    textTransform: "uppercase", marginRight: 6,
                  }}>Dir.</span>
                  <span style={{ color: S.ink, fontWeight: 500 }}>{director}</span>
                </p>
              )}

              {/* Logline */}
              {project.logline && (
                <p style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle:  "italic",
                  fontSize:   "clamp(15px, 1.4vw, 18px)",
                  lineHeight: 1.65,
                  color:      S.ink,
                  opacity:    0.82,
                  marginTop:  director ? 0 : 18,
                  maxWidth:   540,
                }}>
                  &ldquo;{project.logline}&rdquo;
                </p>
              )}

              {/* Production stage badge */}
              {stageDisplay && stageBadge && (
                <div style={{ marginTop: 20 }}>
                  <span style={{
                    display:       "inline-block",
                    fontSize:      9.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight:    600,
                    padding:       "4px 10px",
                    borderRadius:  4,
                    background:    stageBadge.bg,
                    color:         stageBadge.color,
                  }}>
                    {stageDisplay}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── PACKAGE ──────────────────────────────────────── */}
          {(() => {
            const pkg = [
              { label: "Pitch Deck", present: !!project.pitch_deck_path },
              { label: "Script",     present: !!(project as any).has_script_doc || !!project.script_path },
              { label: "Budget",     present: !!(project as any).has_budget_doc  || !!project.budget_usd },
              { label: "Lookbook",   present: !!(project as any).has_lookbook },
            ];
            return (
              <div style={{
                display:       "flex",
                flexWrap:      "wrap",
                gap:           8,
                paddingTop:    14,
                paddingBottom: 16,
                borderBottom:  `1px solid ${S.line}`,
              }}>
                <p style={{
                  width:         "100%",
                  fontSize:      9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color:         S.ash,
                  fontWeight:    600,
                  marginBottom:  4,
                }}>
                  Package
                </p>
                {pkg.map(({ label, present }) => (
                  <span key={label} style={{
                    display:       "inline-flex",
                    alignItems:    "center",
                    gap:           5,
                    fontSize:      10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding:       "4px 10px",
                    borderRadius:  20,
                    border:        `1px solid ${present ? "rgba(191,153,83,0.3)" : "rgba(26,24,21,0.08)"}`,
                    background:    present ? "rgba(191,153,83,0.06)" : "rgba(26,24,21,0.02)",
                    color:         present ? "#7a5e1a" : S.ash,
                    fontFamily:    "Montserrat, sans-serif",
                  }}>
                    <span style={{ fontSize: 11 }}>{present ? "✓" : "✕"}</span>
                    {label}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* ── INVESTMENT METRICS STRIP ─────────────────────── */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: `repeat(${metricCols}, 1fr)`,
            borderBottom:        `1px solid ${S.line}`,
            margin:              "0 -4px",
          }}>
                {budget !== "—" && (
                  <div style={{ padding: "22px 16px 20px", borderRight: `1px solid ${S.line}` }}>
                    <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 8 }}>Budget</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: S.ink, fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}>
                      {budget}
                    </p>
                  </div>
                )}

                {securedDisplay && (
                  <div style={{ padding: "22px 16px 20px", borderRight: `1px solid ${S.line}` }}>
                    <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 8 }}>Secured</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#2E6B4E", fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em", marginBottom: 8 }}>
                      {securedDisplay}
                    </p>
                    {securedPct !== null && (
                      <div>
                        <div style={{ height: 3, background: "rgba(191,153,83,0.15)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${securedPct}%`, background: S.gold, borderRadius: 2 }} />
                        </div>
                        <p style={{ fontSize: 9.5, color: S.ash, marginTop: 4, letterSpacing: "0.06em" }}>{securedPct}% of budget</p>
                      </div>
                    )}
                  </div>
                )}

                {seeking && (
                  <div style={{ padding: "22px 16px 20px", borderRight: `1px solid ${S.line}` }}>
                    <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 8 }}>Seeking</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: S.gold, fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}>
                      {seeking}
                    </p>
                  </div>
                )}

                {stageDisplay && (
                  <div style={{ padding: "22px 16px 20px", borderRight: `1px solid ${S.line}` }}>
                    <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 8 }}>Stage</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: S.ink, letterSpacing: "0.02em" }}>{stageDisplay}</p>
                  </div>
                )}

                <div style={{ padding: "22px 16px 20px" }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 8 }}>Project ID</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: S.ash, fontFamily: "monospace", letterSpacing: "0.06em" }}>FYP-{projectId}</p>
                </div>
              </div>

          {/* ── PITCH DECK ───────────────────────────────────── */}
          {deckUrl && (
            <div style={{
              paddingTop: 40, paddingBottom: 40,
              borderBottom: `1px solid ${S.line}`,
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <p style={{
                fontSize:      9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         S.ash,
                fontWeight:    600,
                marginBottom:  20,
                alignSelf:     "flex-start",
              }}>
                Pitch Deck
              </p>
              <PitchDeckTile
                deckUrl={deckUrl}
                title={project.title}
                className="w-full max-w-[520px]"
              />
            </div>
          )}

          {/* ── CONTENT SECTIONS ─────────────────────────────── */}
          {(project.synopsis || project.director_statement || project.producer_info) && (
            <div>
              {project.synopsis && (
                <div style={{ paddingTop: 52, paddingBottom: 52, borderBottom: `1px solid ${S.line}` }}>
                  <p style={{
                    fontSize:      9,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color:         S.gold,
                    fontWeight:    700,
                    marginBottom:  22,
                  }}>
                    Synopsis
                  </p>
                  <p style={{
                    fontSize:   "clamp(16px, 1.4vw, 18px)",
                    lineHeight: 1.85,
                    color:      S.ink,
                    whiteSpace: "pre-line",
                  }}>
                    {project.synopsis}
                  </p>
                </div>
              )}

              {project.director_statement && (
                <div style={{ paddingTop: 52, paddingBottom: 52, borderBottom: `1px solid ${S.line}` }}>
                  <p style={{
                    fontSize:      9,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color:         S.gold,
                    fontWeight:    700,
                    marginBottom:  22,
                  }}>
                    Director&rsquo;s Statement
                  </p>
                  <p style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontStyle:  "italic",
                    fontSize:   "clamp(16px, 1.4vw, 19px)",
                    lineHeight: 1.85,
                    color:      S.ink,
                    whiteSpace: "pre-line",
                    opacity:    0.9,
                  }}>
                    {project.director_statement}
                  </p>
                </div>
              )}

              {project.producer_info && (
                <div style={{ paddingTop: 52, paddingBottom: 52, borderBottom: `1px solid ${S.line}` }}>
                  <p style={{
                    fontSize:      9,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color:         S.gold,
                    fontWeight:    700,
                    marginBottom:  22,
                  }}>
                    Producers
                  </p>
                  <p style={{
                    fontSize:   "clamp(15px, 1.3vw, 17px)",
                    lineHeight: 1.8,
                    color:      S.ink,
                    whiteSpace: "pre-line",
                  }}>
                    {project.producer_info}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── RELATED PROJECTS ─────────────────────────────── */}
          {relatedProjects.length > 0 && (
            <div style={{ paddingTop: 56, paddingBottom: 48 }}>
              <p style={{
                fontSize:      9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         S.ash,
                fontWeight:    600,
                marginBottom:  6,
              }}>
                Similar Projects
              </p>
              <p style={{
                fontSize:      11,
                color:         S.ash,
                opacity:       0.6,
                marginBottom:  24,
                letterSpacing: "0.04em",
              }}>
                {project.genre}
              </p>
              <div>
                {relatedProjects.map((rel: any, i: number) => {
                  const relFilmmaker = Array.isArray(rel.profiles) ? rel.profiles[0] : rel.profiles;
                  const relDir = rel.director_name ?? relFilmmaker?.full_name ?? null;
                  const relBudget = formatBudgetDisplay(rel.budget_usd);
                  return (
                    <Link
                      key={rel.id}
                      href={`/producer/projects/${rel.id}`}
                      style={{
                        display:       "flex",
                        alignItems:    "center",
                        gap:           16,
                        padding:       "16px 0",
                        borderBottom:  `1px solid ${S.line}`,
                        textDecoration:"none",
                      }}
                      className="fyp-related-row"
                    >
                      {/* Mini poster */}
                      <div style={{
                        width:        44,
                        height:       66,
                        flexShrink:   0,
                        borderRadius: 4,
                        overflow:     "hidden",
                        background:   S.mist,
                      }}>
                        <ProjectThumbnail
                          posterPath={rel.poster_path}
                          title={rel.title}
                          genre={rel.genre}
                          supabaseUrl={supabaseUrl}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontFamily:    "'Playfair Display', Georgia, serif",
                          fontSize:      15,
                          fontWeight:    700,
                          color:         S.ink,
                          letterSpacing: "-0.01em",
                          marginBottom:  4,
                          overflow:      "hidden",
                          textOverflow:  "ellipsis",
                          whiteSpace:    "nowrap",
                        }}>
                          {rel.title}
                        </p>
                        {relDir && (
                          <p style={{ fontSize: 11, color: S.ash, marginBottom: 3 }}>
                            <span style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", marginRight: 4 }}>Dir.</span>
                            {relDir}
                          </p>
                        )}
                        <p style={{ fontSize: 11, color: S.ash, opacity: 0.75, letterSpacing: "0.03em" }}>
                          {[rel.genre, relBudget !== "—" ? relBudget : null].filter(Boolean).join("  ·  ")}
                        </p>
                      </div>
                      {/* Chevron */}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ flexShrink: 0, opacity: 0.22 }}>
                        <path d="M5 3l4 4-4 4" stroke={S.ink}
                          strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Producer Workspace (sticky) ─────────────────── */}
        <div
          className="producer-sidebar"
          style={{
            position:      "sticky",
            top:           52,
            alignSelf:     "start",
            maxHeight:     "calc(100vh - 72px)",
            overflowY:     "auto",
            paddingTop:    32,
            paddingLeft:   28,
            paddingRight:  6,
            paddingBottom: 32,
            borderLeft:    `1px solid ${S.line}`,
          }}
        >
          {/* Section header */}
          <p style={{
            fontSize:      9,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color:         S.ash,
            fontWeight:    700,
            marginBottom:  22,
          }}>
            Producer Workspace
          </p>

          {/* ── 1. SAVED STATUS ─────────────────────────────── */}
          <div style={{
            marginBottom: 24,
            padding:      "12px 14px",
            background:   pipelineStyle ? pipelineStyle.bg : "rgba(138,133,124,0.06)",
            borderRadius: 6,
            border:       `1px solid ${pipelineStyle ? pipelineStyle.bg : "rgba(138,133,124,0.12)"}`,
          }}>
            <p style={{
              fontSize:      9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         S.ash,
              fontWeight:    600,
              marginBottom:  7,
            }}>
              Status
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{
                width:      6,
                height:     6,
                borderRadius:"50%",
                background: pipelineStyle ? pipelineStyle.dot : S.ash,
                display:    "inline-block",
                flexShrink: 0,
              }} />
              <span style={{
                fontSize:      13,
                fontWeight:    600,
                color:         pipelineStyle ? pipelineStyle.color : S.ash,
                letterSpacing: "0.01em",
              }}>
                {pipelineLabel ?? "Not Saved"}
              </span>
            </div>
          </div>

          <div style={{ height: 1, background: S.line, margin: "0 0 24px" }} />

          {/* ── 2. PIPELINE STAGE ───────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <p style={{
              fontSize:      9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         S.ink,
              fontWeight:    700,
              opacity:       0.6,
              marginBottom:  14,
            }}>
              Pipeline Stage
            </p>
            <PipelineStageForm
              projectId={project.id}
              currentStatus={crm?.status}
              rating={crm?.rating}
              notes={crm?.notes}
            />
          </div>

          <div style={{ height: 1, background: S.line, margin: "0 0 24px" }} />

          {/* ── 3. RATING ───────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <p style={{
              fontSize:      9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         S.ink,
              fontWeight:    700,
              opacity:       0.6,
              marginBottom:  14,
            }}>
              Your Rating
            </p>
            <StarRatingForm
              projectId={project.id}
              currentStatus={crm?.status}
              currentRating={crm?.rating}
              notes={crm?.notes}
            />
          </div>

          <div style={{ height: 1, background: S.line, margin: "0 0 24px" }} />

          {/* ── 4. PRIVATE NOTES ────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{
              fontSize:      9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         S.ink,
              fontWeight:    700,
              opacity:       0.6,
              marginBottom:  14,
            }}>
              Private Notes
            </p>
            <PrivateNotesForm
              projectId={project.id}
              initialNotes={crm?.notes}
            />
          </div>

          <div style={{ height: 1, background: S.line, margin: "0 0 24px" }} />

          {/* ── 5. CONTACT FILMMAKER — primary CTA ─────────── */}
          {filmmaker && (
            <div style={{ marginBottom: 10 }}>
              <MessageButton
                projectId={project.id}
                producerId={user.id}
                filmakerId={filmmaker.id ?? project.owner_id}
                label="Contact Filmmaker"
                className="w-full text-[11px] tracking-[0.16em] uppercase font-bold text-white bg-[#1A1815] border-0 rounded-[6px] py-[13px] px-4 cursor-pointer block text-center hover:bg-[#2c2a26] transition-colors disabled:opacity-50"
              />
            </div>
          )}

          {/* ── 6. PASS ON PROJECT ──────────────────────────── */}
          {crm?.status !== "passed" ? (
            <form action={upsertProducerProject}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="status"     value="passed" />
              <input type="hidden" name="rating"     value={crm?.rating ?? ""} />
              <input type="hidden" name="notes"      value={crm?.notes ?? ""} />
              <button type="submit" className="fyp-pass-btn" style={{
                width:         "100%",
                padding:       "9px 0",
                background:    "transparent",
                border:        `1px solid rgba(26,24,21,0.09)`,
                borderRadius:  6,
                fontSize:      10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color:         "rgba(138,133,124,0.45)",
                cursor:        "pointer",
                fontFamily:    "Montserrat, sans-serif",
                textAlign:     "center",
                transition:    "all 0.15s",
              }}>
                Pass on this project
              </button>
            </form>
          ) : (
            <div style={{
              textAlign:     "center",
              padding:       "9px 0",
              fontSize:      10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color:         "rgba(138,133,124,0.35)",
            }}>
              Passed
            </div>
          )}
        </div>
      </div>

      {/* ══ Mobile bottom action bar (Contact CTA only) ════════ */}
      {filmmaker && (
        <div className="fyp-mobile-cta">
          <MessageButton
            projectId={project.id}
            producerId={user.id}
            filmakerId={filmmaker.id ?? project.owner_id}
            label="Contact Filmmaker"
            className="w-full text-[11px] tracking-[0.16em] uppercase font-bold text-white bg-[#1A1815] border-0 rounded-[8px] py-[14px] px-4 cursor-pointer block text-center hover:bg-[#2c2a26] transition-colors"
          />
        </div>
      )}

      <style>{`
        /* Pass button red on hover */
        .fyp-pass-btn:hover {
          color: #dc2626 !important;
          border-color: rgba(220,38,38,0.20) !important;
        }

        /* Related row — subtle hover lift */
        .fyp-related-row:hover { opacity: 0.72; }

        /* Sidebar minimal scrollbar */
        .producer-sidebar::-webkit-scrollbar       { width: 3px; }
        .producer-sidebar::-webkit-scrollbar-track { background: transparent; }
        .producer-sidebar::-webkit-scrollbar-thumb { background: rgba(26,24,21,0.10); border-radius: 2px; }

        /* Mobile CTA bar — hidden on desktop */
        .fyp-mobile-cta { display: none; }

        /* Tablet: tighten sidebar */
        @media (max-width: 1100px) {
          .producer-detail-grid {
            grid-template-columns: 1fr 256px !important;
          }
        }

        /* Mobile: single column + fixed bottom bar */
        @media (max-width: 900px) {
          .producer-detail-grid {
            grid-template-columns: 1fr !important;
            padding: 0 20px 120px !important;
          }
          .producer-detail-grid > div:first-child {
            padding-right: 0 !important;
            max-width: 100% !important;
          }
          /* Sidebar becomes flat section */
          .producer-sidebar {
            position: static !important;
            max-height: none !important;
            overflow-y: visible !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            border-left: none !important;
            border-top: 1px solid rgba(26,24,21,0.07) !important;
            padding-top: 36px !important;
          }
          /* Show fixed bottom CTA */
          .fyp-mobile-cta {
            display: block !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 12px 20px 24px !important;
            background: rgba(250,250,248,0.96) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            border-top: 1px solid rgba(26,24,21,0.08) !important;
            z-index: 40 !important;
          }
        }

        @media (max-width: 640px) {
          .producer-detail-grid { padding: 0 16px 120px !important; }
          .fyp-mobile-cta       { padding: 10px 16px 22px !important; }
        }
      `}</style>
    </div>
  );
}
