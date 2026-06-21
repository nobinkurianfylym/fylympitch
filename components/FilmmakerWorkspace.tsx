// components/FilmmakerWorkspace.tsx
// Server component — right sidebar shown when filmmaker views their own project
// from My Projects (simpleView). All data passed in from parent page.

import Link from "next/link";
import { usd } from "@/lib/format";

export interface WorkspaceDeadline {
  id:             string;
  title:          string;
  opp_type:       string;
  deadline:       string | null;
  deadline_note:  string | null;
  max_award_usd:  number | null;
  score:          number;
}

export interface FilmmakerWorkspaceProps {
  projectId:          string;
  hasPitchDeck:       boolean;
  hasIntel:           boolean;   // AI evaluation done
  hasMatches:         boolean;   // matched to opportunities
  introCount:         number;    // producers who clicked Connect
  meetingTotal:       number;    // total meeting requests
  meetingAccepted:    number;    // accepted meetings
  fundingSecured:     number | null;
  loveCount:          number;
  upcomingDeadlines:  WorkspaceDeadline[];
}

// ── Design tokens ─────────────────────────────────────────────────────────
const S = {
  ink:     "#1A1815",
  ash:     "#8A857C",
  gold:    "#BF9953",
  line:    "rgba(26,24,21,0.08)",
  surface: "#FFFFFF",
  mist:    "rgba(26,24,21,0.03)",
  green:   "#2E6B4E",
};

const OPP_LABELS: Record<string, string> = {
  grant: "Grant", fund: "Fund", lab: "Lab",
  co_production: "Co-Pro", market: "Market",
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ label, sub, children }: {
  label: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ paddingBottom: 20, marginBottom: 20, borderBottom: `1px solid ${S.line}` }}>
      <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: sub ? 3 : 14 }}>
        {label}
      </p>
      {sub && <p style={{ fontSize: 10, color: "rgba(26,24,21,0.4)", marginBottom: 14, letterSpacing: "0.04em" }}>{sub}</p>}
      {children}
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────
function Stat({ value, label, color, large }: {
  value: string | number; label: string; color?: string; large?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${S.line}` }}>
      <span style={{ fontSize: 12, color: S.ash, letterSpacing: "0.04em" }}>{label}</span>
      <span style={{
        fontFamily:    large ? "'Playfair Display', Georgia, serif" : undefined,
        fontSize:      large ? 20 : 14,
        fontWeight:    700,
        color:         color ?? S.ink,
        letterSpacing: large ? "-0.01em" : undefined,
      }}>{value}</span>
    </div>
  );
}

// ── Progress step ─────────────────────────────────────────────────────────
function ProgressStep({ label, done, active }: {
  label: string; done: boolean; active?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", position: "relative" }}>
      {/* Dot */}
      <div style={{
        width:       16,
        height:      16,
        borderRadius:"50%",
        flexShrink:  0,
        border:      done ? "none" : `1.5px solid ${active ? S.gold : "rgba(26,24,21,0.2)"}`,
        background:  done ? S.gold : active ? "rgba(191,153,83,0.1)" : "transparent",
        display:     "flex",
        alignItems:  "center",
        justifyContent: "center",
      }}>
        {done && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      {/* Label */}
      <span style={{
        fontSize:      12,
        color:         done ? S.ink : active ? S.gold : "rgba(26,24,21,0.35)",
        fontWeight:    done || active ? 500 : 400,
        letterSpacing: "0.02em",
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export default function FilmmakerWorkspace({
  projectId,
  hasPitchDeck,
  hasIntel,
  hasMatches,
  introCount,
  meetingTotal,
  meetingAccepted,
  fundingSecured,
  loveCount,
  upcomingDeadlines,
}: FilmmakerWorkspaceProps) {

  // Determine progress steps
  const steps = [
    { label: "Project Created",        done: true },
    { label: "Pitch Deck Added",       done: hasPitchDeck },
    { label: "Engine Analysis",        done: hasIntel },
    { label: "Matched to Opportunities", done: hasMatches },
    { label: "Producer Interest",      done: introCount > 0 },
    { label: "Meeting Scheduled",      done: meetingTotal > 0 },
    { label: "Funding Secured",        done: !!fundingSecured && fundingSecured > 0 },
  ];

  // Find the first incomplete step (that's the "active" one)
  const activeIdx = steps.findIndex(s => !s.done);

  // Filter deadlines: future, with a real date, sorted by soonest
  const futureDeadlines = upcomingDeadlines
    .filter(d => d.deadline && daysUntil(d.deadline) > 0)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 4);

  return (
    <div style={{ fontFamily: "Montserrat, sans-serif" }}>

      {/* Label */}
      <p style={{
        fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase",
        color: S.ash, fontWeight: 600, marginBottom: 20,
      }}>
        Filmmaker Workspace
      </p>

      {/* ── PROJECT PROGRESS ─────────────────────────────────── */}
      <Section label="Project Progress" sub="A visual journey.">
        <div style={{ position: "relative" }}>
          {/* Vertical connector line */}
          <div style={{
            position:   "absolute",
            left:       7,
            top:        8,
            bottom:     8,
            width:      1.5,
            background: `linear-gradient(to bottom, ${S.gold}, rgba(191,153,83,0.1))`,
            zIndex:     0,
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            {steps.map((step, i) => (
              <ProgressStep
                key={step.label}
                label={step.label}
                done={step.done}
                active={i === activeIdx}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ── UPCOMING DEADLINES ───────────────────────────────── */}
      <Section label="Deadlines" sub="Based on your matches.">
        {futureDeadlines.length === 0 ? (
          <p style={{ fontSize: 11, color: "rgba(26,24,21,0.35)", fontStyle: "italic" }}>
            No upcoming deadlines in your matches.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {futureDeadlines.map(d => {
              const days = daysUntil(d.deadline!);
              const urgent = days <= 14;
              const soon   = days <= 45;
              return (
                <Link
                  key={d.id}
                  href={`/dashboard/opportunities/${d.id}?project=${projectId}`}
                  style={{
                    display:        "flex",
                    alignItems:     "flex-start",
                    justifyContent: "space-between",
                    gap:            10,
                    padding:        "10px 12px",
                    borderRadius:   8,
                    border:         `1px solid ${urgent ? "rgba(220,38,38,0.2)" : S.line}`,
                    background:     urgent ? "rgba(220,38,38,0.04)" : S.surface,
                    textDecoration: "none",
                    transition:     "border-color 0.15s",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: S.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                      {d.title}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 7.5, letterSpacing: "0.12em", textTransform: "uppercase",
                        padding: "1.5px 5px", borderRadius: 4,
                        background: "rgba(191,153,83,0.08)", color: S.gold, fontWeight: 600,
                      }}>
                        {OPP_LABELS[d.opp_type] ?? d.opp_type}
                      </span>
                      {d.max_award_usd && (
                        <span style={{ fontSize: 10, color: S.ash }}>{usd(d.max_award_usd)}</span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    flexShrink:    0,
                    fontSize:      11,
                    fontWeight:    700,
                    padding:       "3px 8px",
                    borderRadius:  100,
                    background:    urgent ? "rgba(220,38,38,0.1)" : soon ? "rgba(234,179,8,0.1)" : "rgba(26,24,21,0.05)",
                    color:         urgent ? "#b91c1c"             : soon ? "#854d0e"             : S.ash,
                    whiteSpace:    "nowrap",
                  }}>
                    {days}d
                  </span>
                </Link>
              );
            })}
            <Link href="/dashboard/opportunities" style={{
              display: "inline-block", marginTop: 4,
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "rgba(191,153,83,0.7)", textDecoration: "none",
            }}>
              All matches →
            </Link>
          </div>
        )}
      </Section>

      {/* ── PRODUCER INTEREST ────────────────────────────────── */}
      <Section label="Producer Interest" sub="Since producers save projects.">
        <Stat value={introCount}        label="Interested Producers"  color={S.gold}  large />
        <Stat value={meetingTotal}      label="Meeting Requests"      color={S.ink} />
        <Stat value={meetingAccepted}   label="Meetings Accepted"     color={S.green} />
        <Stat value={loveCount || 0}    label="Community Loves ♥"     color={S.ash} />
      </Section>

      {/* ── PERFORMANCE ANALYTICS ────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: S.ash, fontWeight: 600, marginBottom: 3 }}>
          Performance Analytics
        </p>
        <p style={{ fontSize: 9, color: "rgba(26,24,21,0.32)", marginBottom: 14, letterSpacing: "0.04em" }}>
          Full tracking coming soon.
        </p>
        <Stat value="—" label="Profile Views" />
        <Stat value="—" label="Pitch Downloads" />
        <Stat value="—" label="Deck Opens" />
        <Stat value="—" label="Avg. Read Time" />
        <Stat value="—" label="Response Rate" />
        <p style={{ marginTop: 10, fontSize: 9, color: "rgba(26,24,21,0.28)", letterSpacing: "0.06em", lineHeight: 1.5 }}>
          Analytics tracking will be enabled in a future update.
        </p>
      </div>

    </div>
  );
}
