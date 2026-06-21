import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { upsertProducerProject, requestMeeting } from "@/lib/actions";
import MessageButton from "@/components/MessageButton";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import PitchDeckTile from "@/components/PitchDeckTile";
import {
  formatBudgetDisplay,
  formatShortId,
  formatStage,
  formatCountry,
  STAGE_BADGE,
} from "@/lib/film-identity";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = [
  { key: "saved",       label: "Saved" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "in_review",   label: "In Review" },
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

export default async function ProducerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("approval_status").eq("id", user.id).single();
  if (profile?.approval_status !== "approved") redirect("/producer/pending");

  const { data: project } = await supabase
    .from("projects")
    .select("*, profiles!projects_owner_id_fkey(id, full_name, company)")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: crm } = await supabase
    .from("producer_projects").select("*")
    .eq("producer_id", user.id).eq("project_id", id).single();

  const { data: meeting } = await supabase
    .from("meeting_requests").select("*")
    .eq("producer_id", user.id).eq("project_id", id).maybeSingle();

  const deckUrl = project.pitch_deck_path
    ? (await supabase.storage.from("pitch-decks").createSignedUrl(project.pitch_deck_path, 3600)).data?.signedUrl
    : null;
  const scriptUrl = project.script_path
    ? (await supabase.storage.from("scripts").createSignedUrl(project.script_path, 3600)).data?.signedUrl
    : null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const filmmaker = Array.isArray(project.profiles) ? project.profiles[0] : project.profiles;

  // ── Computed display values ───────────────────────────────────
  const budget   = formatBudgetDisplay(project.budget_usd);
  const secured  = project.finance_secured_usd;
  const securedDisplay = secured ? formatBudgetDisplay(secured) : null;
  const securedPct = project.budget_usd && secured
    ? Math.min(100, Math.round((secured / project.budget_usd) * 100)) : null;
  const seeking  = project.funding_needed_usd ? formatBudgetDisplay(project.funding_needed_usd) : null;
  const stageDisplay = project.stage ? (STAGE_LABEL[project.stage] ?? project.stage) : null;
  const stageBadge = project.stage ? (STAGE_BADGE[project.stage] ?? STAGE_BADGE["development"]) : null;
  const projectId = formatShortId(project.id);
  const director = project.director_name ?? filmmaker?.full_name ?? null;
  const country = project.country ? formatCountry(project.country) : null;

  // Metadata dot-chain
  const metaItems = [
    project.format ? (FORMAT_LABEL[project.format] ?? project.format) : null,
    project.genre,
    country ? (country.flag ? `${country.flag} ${country.name}` : country.name) : null,
    project.language,
    stageDisplay,
  ].filter(Boolean) as string[];

  // ── CSS tokens ────────────────────────────────────────────────
  const S = {
    canvas:    "#FAFAF8",
    ink:       "#1A1815",
    ash:       "#8A857C",
    gold:      "#BF9953",
    line:      "rgba(26,24,21,0.07)",
    surface:   "#FFFFFF",
    mist:      "rgba(26,24,21,0.03)",
  } as const;

  return (
    <div style={{ background: S.canvas, minHeight: "100vh" }}>

      {/* ══ 1. STICKY ACTION BAR ════════════════════════════════ */}
      <div style={{
        position:     "sticky",
        top:          0,
        zIndex:       20,
        background:   S.canvas,
        borderBottom: `1px solid ${S.line}`,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "space-between",
        padding:      "0 32px",
        height:       52,
        gap:          12,
      }}>
        {/* Back */}
        <Link href="/producer/projects" style={{
          display:       "flex",
          alignItems:    "center",
          gap:           6,
          fontSize:      11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         S.ash,
          textDecoration:"none",
          flexShrink:    0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          All Projects
        </Link>

        {/* Title — truncated centre */}
        <span style={{
          fontFamily:    "'Playfair Display', Georgia, serif",
          fontSize:      13,
          fontWeight:    700,
          color:         S.ink,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
          flex:          1,
          textAlign:     "center",
        }}>
          {project.title}
        </span>

        {/* Actions */}
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
          {/* Save */}
          <form action={upsertProducerProject} style={{ display: "inline" }}>
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="status" value={crm?.status ?? "saved"} />
            <input type="hidden" name="rating" value={crm?.rating ?? ""} />
            <input type="hidden" name="notes" value={crm?.notes ?? ""} />
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
          {/* Message */}
          {filmmaker && (
            <MessageButton
              projectId={project.id}
              producerId={user.id}
              filmakerId={filmmaker.id ?? project.owner_id}
              label="Message"
              className="text-[11px] tracking-[0.12em] uppercase text-ivory bg-ink border border-ink rounded-[6px] px-[14px] py-[6px] hover:bg-ink/80 transition-colors cursor-pointer font-[Montserrat,sans-serif]"
            />
          )}
        </div>
      </div>

      {/* ══ 2. MAIN LAYOUT ══════════════════════════════════════ */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "1fr 304px",
        maxWidth:            1200,
        margin:              "0 auto",
        padding:             "0 32px 80px",
        gap:                 0,
        alignItems:          "start",
      }} className="producer-detail-grid">

        {/* ── LEFT: Main content ─────────────────────────────── */}
        <div style={{ paddingRight: 48, paddingTop: 40 }}>

          {/* ── 2a. HERO — poster + title block ──────────────── */}
          <div style={{
            display:       "flex",
            gap:           28,
            alignItems:    "flex-start",
            paddingBottom: 36,
            borderBottom:  `1px solid ${S.line}`,
          }}>
            {/* Poster */}
            <div style={{
              width:        180,
              flexShrink:   0,
              borderRadius: 8,
              overflow:     "hidden",
              boxShadow:    "0 4px 24px rgba(26,24,21,0.12)",
              aspectRatio:  "2/3",
              background:   S.mist,
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

              {/* Pipeline badge if active */}
              {crm?.status && crm.status !== "saved" && (
                <div style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           5,
                  marginBottom:  12,
                  fontSize:      9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color:         S.gold,
                  fontWeight:    600,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: S.gold, display: "inline-block" }} />
                  {PIPELINE_STAGES.find(s => s.key === crm.status)?.label ?? crm.status}
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

              {/* Metadata row */}
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
                <p style={{
                  fontSize:      13,
                  color:         S.ash,
                  marginBottom:  18,
                }}>
                  <span style={{ letterSpacing: "0.06em", fontSize: 10, textTransform: "uppercase", marginRight: 6 }}>Dir.</span>
                  <span style={{ color: S.ink, fontWeight: 500 }}>{director}</span>
                </p>
              )}

              {/* Logline */}
              {project.logline && (
                <p style={{
                  fontFamily:  "'Playfair Display', Georgia, serif",
                  fontStyle:   "italic",
                  fontSize:    "clamp(15px, 1.4vw, 18px)",
                  lineHeight:  1.65,
                  color:       S.ink,
                  opacity:     0.82,
                  marginTop:   director ? 0 : 18,
                  maxWidth:    540,
                }}>
                  "{project.logline}"
                </p>
              )}

              {/* Stage badge */}
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

          {/* ── 2b. INVESTMENT METRICS STRIP ─────────────────── */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: `repeat(${[budget !== "—", securedDisplay, seeking, stageDisplay, true].filter(Boolean).length}, 1fr)`,
            borderBottom:        `1px solid ${S.line}`,
            margin:              "0 -4px",
          }}>
            {/* Budget */}
            {budget !== "—" && (
              <div style={{ padding: "20px 16px 18px", borderRight: `1px solid ${S.line}` }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Budget</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: S.ink, fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}>
                  {budget}
                </p>
              </div>
            )}

            {/* Financing secured — with progress bar */}
            {securedDisplay && (
              <div style={{ padding: "20px 16px 18px", borderRight: `1px solid ${S.line}` }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Secured</p>
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

            {/* Seeking */}
            {seeking && (
              <div style={{ padding: "20px 16px 18px", borderRight: `1px solid ${S.line}` }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Seeking</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: S.gold, fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}>
                  {seeking}
                </p>
              </div>
            )}

            {/* Stage */}
            {stageDisplay && (
              <div style={{ padding: "20px 16px 18px", borderRight: `1px solid ${S.line}` }}>
                <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Stage</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: S.ink, letterSpacing: "0.02em" }}>{stageDisplay}</p>
              </div>
            )}

            {/* Project ID */}
            <div style={{ padding: "20px 16px 18px" }}>
              <p style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 6 }}>Project ID</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: S.ash, fontFamily: "monospace", letterSpacing: "0.06em" }}>FYP-{projectId}</p>
            </div>
          </div>

          {/* ── 2c. PITCH DECK ───────────────────────────────── */}
          {deckUrl && (
            <div style={{ paddingTop: 36, paddingBottom: 36, borderBottom: `1px solid ${S.line}` }}>
              <p style={{
                fontSize:      9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         S.ash,
                fontWeight:    600,
                marginBottom:  16,
              }}>
                Pitch Deck
              </p>
              <PitchDeckTile
                deckUrl={deckUrl}
                title={project.title}
                className="max-w-xs"
              />
            </div>
          )}

          {/* ── 2d. CONTENT SECTIONS ─────────────────────────── */}
          {(project.synopsis || project.director_statement || project.producer_info) && (
            <div>
              {project.synopsis && (
                <div style={{ paddingTop: 44, paddingBottom: 44, borderBottom: `1px solid ${S.line}` }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 20 }}>Synopsis</p>
                  <p style={{
                    fontSize:   "clamp(16px, 1.4vw, 18px)",
                    lineHeight: 1.78,
                    color:      S.ink,
                    whiteSpace: "pre-line",
                    maxWidth:   640,
                  }}>
                    {project.synopsis}
                  </p>
                </div>
              )}

              {project.director_statement && (
                <div style={{ paddingTop: 44, paddingBottom: 44, borderBottom: `1px solid ${S.line}` }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 20 }}>Director's Statement</p>
                  <p style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontStyle:  "italic",
                    fontSize:   "clamp(16px, 1.4vw, 19px)",
                    lineHeight: 1.78,
                    color:      S.ink,
                    whiteSpace: "pre-line",
                    maxWidth:   600,
                    opacity:    0.9,
                  }}>
                    {project.director_statement}
                  </p>
                </div>
              )}

              {project.producer_info && (
                <div style={{ paddingTop: 44, paddingBottom: 44 }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.gold, fontWeight: 600, marginBottom: 20 }}>Producers</p>
                  <p style={{
                    fontSize:   "clamp(15px, 1.3vw, 17px)",
                    lineHeight: 1.75,
                    color:      S.ink,
                    whiteSpace: "pre-line",
                    maxWidth:   600,
                  }}>
                    {project.producer_info}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Producer Workspace (sticky) ───────────────────── */}
        <div style={{
          position:    "sticky",
          top:         52,
          alignSelf:   "start",
          paddingTop:  32,
          paddingLeft: 24,
          borderLeft:  `1px solid ${S.line}`,
        }}>
          {/* Workspace header */}
          <p style={{
            fontSize:      9,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color:         S.ash,
            fontWeight:    600,
            marginBottom:  24,
          }}>
            Producer Workspace
          </p>

          {/* ── Pipeline Stage ─────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 12 }}>Pipeline Stage</p>
            <form action={upsertProducerProject} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="rating" value={crm?.rating ?? ""} />
              <input type="hidden" name="notes" value={crm?.notes ?? ""} />
              {PIPELINE_STAGES.map((s) => {
                const isActive = crm?.status === s.key;
                return (
                  <label key={s.key} style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          10,
                    padding:      "9px 12px",
                    borderRadius: 6,
                    border:       `1px solid ${isActive ? "rgba(191,153,83,0.35)" : S.line}`,
                    background:   isActive ? "rgba(191,153,83,0.06)" : "transparent",
                    cursor:       "pointer",
                    transition:   "background 0.15s, border-color 0.15s",
                  }}>
                    <input
                      type="radio"
                      name="status"
                      value={s.key}
                      defaultChecked={isActive}
                      style={{ accentColor: S.gold, width: 13, height: 13, flexShrink: 0 }}
                    />
                    <span style={{
                      fontSize:      12,
                      color:         isActive ? S.ink : S.ash,
                      fontWeight:    isActive ? 600 : 400,
                      letterSpacing: "0.04em",
                    }}>
                      {s.label}
                    </span>
                  </label>
                );
              })}
              <button type="submit" style={{
                marginTop:     8,
                padding:       "8px 0",
                background:    S.ink,
                color:         "#FAFAF8",
                border:        "none",
                borderRadius:  6,
                fontSize:      11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight:    600,
                cursor:        "pointer",
                fontFamily:    "Montserrat, sans-serif",
                transition:    "opacity 0.15s",
              }}>
                Update stage
              </button>
            </form>
          </div>

          <div style={{ height: 1, background: S.line, margin: "0 0 24px" }} />

          {/* ── Internal Rating ────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 12 }}>Your Rating</p>
            <form action={upsertProducerProject}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="status" value={crm?.status ?? "saved"} />
              <input type="hidden" name="notes" value={crm?.notes ?? ""} />
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} style={{ cursor: "pointer" }}>
                    <input type="radio" name="rating" value={n} defaultChecked={crm?.rating === n} className="sr-only" />
                    <span style={{
                      fontSize:   24,
                      color:      (crm?.rating ?? 0) >= n ? S.gold : "rgba(26,24,21,0.12)",
                      transition: "color 0.15s",
                      display:    "block",
                      lineHeight: 1,
                    }}>★</span>
                  </label>
                ))}
              </div>
              <button type="submit" style={{
                width:         "100%",
                padding:       "7px 0",
                background:    "transparent",
                border:        `1px solid ${S.line}`,
                borderRadius:  6,
                fontSize:      11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color:         S.ash,
                cursor:        "pointer",
                fontFamily:    "Montserrat, sans-serif",
              }}>
                Save rating
              </button>
            </form>
          </div>

          <div style={{ height: 1, background: S.line, margin: "0 0 24px" }} />

          {/* ── Private Notes ──────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 12 }}>Private Notes</p>
            <form action={upsertProducerProject} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="status" value={crm?.status ?? "saved"} />
              <input type="hidden" name="rating" value={crm?.rating ?? ""} />
              <textarea
                name="notes"
                rows={4}
                defaultValue={crm?.notes ?? ""}
                placeholder="Only you can see these notes…"
                style={{
                  width:        "100%",
                  padding:      "10px 12px",
                  borderRadius: 6,
                  border:       `1px solid ${S.line}`,
                  background:   S.surface,
                  fontSize:     13,
                  lineHeight:   1.6,
                  color:        S.ink,
                  resize:       "vertical",
                  fontFamily:   "Montserrat, sans-serif",
                  outline:      "none",
                  boxSizing:    "border-box",
                }}
              />
              <button type="submit" style={{
                padding:       "7px 0",
                background:    "transparent",
                border:        `1px solid ${S.line}`,
                borderRadius:  6,
                fontSize:      11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color:         S.ash,
                cursor:        "pointer",
                fontFamily:    "Montserrat, sans-serif",
              }}>
                Save notes
              </button>
            </form>
          </div>

          <div style={{ height: 1, background: S.line, margin: "0 0 24px" }} />

          {/* ── Meeting ────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 12 }}>Meeting</p>
            {meeting ? (
              <div>
                <p style={{ fontSize: 12, color: S.ash, marginBottom: 4 }}>
                  Request sent —{" "}
                  <span style={{ color: S.ink, fontWeight: 500, textTransform: "capitalize" }}>{meeting.status}</span>
                </p>
                {meeting.status === "accepted" && (
                  <p style={{ fontSize: 11, color: "#2E6B4E", lineHeight: 1.5 }}>
                    Filmmaker accepted. Check your email.
                  </p>
                )}
              </div>
            ) : (
              <form action={requestMeeting} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="filmmaker_id" value={filmmaker?.id ?? project.owner_id} />
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Introduce yourself and explain your interest…"
                  style={{
                    width:        "100%",
                    padding:      "10px 12px",
                    borderRadius: 6,
                    border:       `1px solid ${S.line}`,
                    background:   S.surface,
                    fontSize:     13,
                    lineHeight:   1.6,
                    color:        S.ink,
                    resize:       "vertical",
                    fontFamily:   "Montserrat, sans-serif",
                    outline:      "none",
                    boxSizing:    "border-box",
                  }}
                />
                <button type="submit" style={{
                  padding:       "8px 0",
                  background:    S.gold,
                  color:         "#fff",
                  border:        "none",
                  borderRadius:  6,
                  fontSize:      11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight:    600,
                  cursor:        "pointer",
                  fontFamily:    "Montserrat, sans-serif",
                }}>
                  Request meeting
                </button>
              </form>
            )}
          </div>

          {/* ── Pass on project ────────────────────── */}
          {crm?.status !== "passed" && (
            <form action={upsertProducerProject}>
              <input type="hidden" name="project_id" value={project.id} />
              <input type="hidden" name="status" value="passed" />
              <input type="hidden" name="rating" value={crm?.rating ?? ""} />
              <input type="hidden" name="notes" value={crm?.notes ?? ""} />
              <button type="submit" style={{
                width:         "100%",
                padding:       "8px 0",
                background:    "transparent",
                border:        "none",
                fontSize:      11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color:         "rgba(138,133,124,0.5)",
                cursor:        "pointer",
                fontFamily:    "Montserrat, sans-serif",
                textAlign:     "center",
                transition:    "color 0.15s",
              }}
              onMouseEnter={e => ((e.target as HTMLButtonElement).style.color = "#dc2626")}
              onMouseLeave={e => ((e.target as HTMLButtonElement).style.color = "rgba(138,133,124,0.5)")}
              >
                Pass on this project
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Responsive: collapse grid on mobile ──────────── */}
      <style>{`
        @media (max-width: 900px) {
          .producer-detail-grid {
            grid-template-columns: 1fr !important;
          }
          .producer-detail-grid > div:first-child {
            padding-right: 0 !important;
          }
          .producer-detail-grid > div:last-child {
            position: static !important;
            padding-left: 0 !important;
            border-left: none !important;
            border-top: 1px solid rgba(26,24,21,0.07) !important;
            padding-top: 32px !important;
          }
        }
        @media (max-width: 640px) {
          .producer-detail-grid {
            padding: 0 16px 60px !important;
          }
        }
      `}</style>
    </div>
  );
}
