"use client";

import { useState } from "react";
import Link from "next/link";
import type { DemoProject } from "./homepage-demo-data";

// ============================================================
// HomepageDemoClient — "See the engine in action", the view half.
//
// Renders REAL FYLYMPITCH ENGINE output (services/fylympitchEngine.ts)
// for representative sample projects. Every score, readiness value,
// match count and award is genuine engine output baked at authoring
// time from the live MASTER_DATA catalog — see homepage-demo-data.ts
// and scripts/gen-homepage-demo.ts. The only written copy is each
// sample's logline, which is illustrative and labelled as a sample.
//
// Regenerate after ANY engine or catalogue change:
//   npx tsx scripts/gen-homepage-demo.ts
// The v2 scoring change moved every number here, which is exactly the
// situation the generator exists to catch.
//
// Poster plates are typographic rather than artwork: these are sample
// projects, and inventing a film poster would suggest a real title.
// ============================================================

const GOLD = "#BF9953";
const INK = "#1A1815";
const ASH = "#8A857C";
const LINE = "#E5E0D5";
const PARCHMENT = "#F1EDE4";

/** Per-genre plate, so the three tabs are visually distinct without artwork. */
const PLATE: Record<string, string> = {
  Comedy:      "linear-gradient(155deg,#6B4A32,#241610)",
  Drama:       "linear-gradient(155deg,#3C4A52,#171C20)",
  Documentary: "linear-gradient(155deg,#4A4232,#1C1813)",
};

function Ring({ value }: { value: number }) {
  const R = 46, C = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", width: 112, height: 112, flex: "0 0 112px" }}>
      <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
        <circle cx="56" cy="56" r={R} fill="none" stroke={LINE} strokeWidth="7" />
        <circle
          cx="56" cy="56" r={R} fill="none" stroke={GOLD} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${(value / 100) * C} ${C}`}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 30,
                    lineHeight: 1, color: INK }}>
          {value}<span style={{ fontSize: 13, color: ASH }}>/100</span>
        </p>
        <p style={{ fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: ASH, marginTop: 5, maxWidth: 74, lineHeight: 1.3 }}>
          Funding readiness
        </p>
      </div>
    </div>
  );
}

/** Done / Current / Next / Upcoming, derived from the engine's roadmap. */
function stageLabel(status: DemoProject["roadmap"][number]["status"], isFirstUpcoming: boolean) {
  if (status === "done") return "Done";
  if (status === "current") return "Current";
  return isFirstUpcoming ? "Next" : "Upcoming";
}

export default function HomepageDemoClient({
  projects,
  live,
}: {
  projects: DemoProject[];
  /** True when these are real public pitches rather than the baked samples. */
  live: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const p = projects[Math.min(idx, projects.length - 1)];
  if (!p) return null;
  const firstUpcoming = p.roadmap.findIndex(s => s.status === "upcoming");

  return (
    <div style={{ color: INK }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 34px" }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>PITCH.FYLYM Engine</p>
        <h2 className="font-display"
            style={{ fontSize: "clamp(30px,5vw,46px)", fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.01em" }}>
          See the engine <span style={{ fontStyle: "italic", color: GOLD }}>in action.</span>
        </h2>
        <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.7, color: ASH }}>
          {live
            ? "Real engine results for pitches filmmakers have published here, scored live against every active opportunity in the catalogue. Submit your own to see your funding readiness and matched sources."
            : "Real engine results for sample projects, scored against every active opportunity in the catalogue. Submit your own to see your funding readiness and matched sources."}
        </p>
      </div>

      {/* ── Genre tabs ─────────────────────────────────────── */}
      <div role="tablist" aria-label="Sample projects"
           style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 26, flexWrap: "wrap" }}>
        {projects.map((d, i) => {
          const on = i === idx;
          return (
            <button
              key={d.title} role="tab" aria-selected={on} type="button"
              onClick={() => setIdx(i)}
              style={{
                fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "9px 18px", borderRadius: 999, cursor: "pointer",
                fontFamily: "inherit",
                border: `1px solid ${on ? GOLD : LINE}`,
                background: on ? "rgba(191,153,83,0.10)" : "transparent",
                color: on ? INK : ASH,
                transition: "border-color .15s, color .15s, background .15s",
              }}
            >
              {live ? d.title : d.genre}
            </button>
          );
        })}
      </div>

      {/* ── Two cards ──────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>

        {/* Left: the project */}
        <article style={{ border: `1px solid ${LINE}`, borderRadius: 14, background: "#fff", padding: 20 }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {/* A real pitch shows its own poster; the sample fallback keeps
                the typographic plate, because inventing artwork for a project
                called "Sample Feature" would imply a film that does not exist. */}
            <div style={{ flex: "0 0 150px", width: 150, aspectRatio: "2 / 3", borderRadius: 8,
                          overflow: "hidden", background: PLATE[p.genre ?? ""] ?? PLATE.Drama,
                          display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: p.posterUrl ? 0 : 14 }}>
              {p.posterUrl ? (
                <img
                  src={p.posterUrl}
                  alt={`Poster for ${p.title}`}
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <>
                  <p className="font-display"
                     style={{ color: "#F3EFE6", fontSize: 19, lineHeight: 1.15, fontStyle: "italic" }}>
                    Sample<br />Feature
                  </p>
                  <p style={{ color: "rgba(243,239,230,0.6)", fontSize: 7.5, letterSpacing: "0.18em",
                              textTransform: "uppercase", marginTop: 8 }}>
                    A {p.genre} {p.format}
                  </p>
                </>
              )}
            </div>

            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                {live ? "Published pitch" : "Sample project"}
              </p>
              <h3 className="font-display" style={{ fontSize: 25, fontWeight: 400, lineHeight: 1.15 }}>
                {live ? (
                  p.href
                    ? <Link href={p.href} style={{ color: "inherit" }}>{p.title}</Link>
                    : p.title
                ) : (
                  <>Sample Feature<span style={{ color: ASH }}> · {p.genre}</span></>
                )}
              </h3>
              <p style={{ marginTop: 9, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD }}>
                {[p.genre, p.format, p.country].filter(Boolean).join(" · ")}
              </p>
              {p.logline && (
                <p style={{ marginTop: 13, fontSize: 14.5, lineHeight: 1.65, color: ASH }}>
                  {p.logline}
                </p>
              )}
            </div>
          </div>

          <dl style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12,
                       marginTop: 20, borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
            {[["Budget", p.budgetLabel], ["Seeking", p.seekingLabel], ["Country", p.country]].map(([k, v]) => (
              <div key={k}>
                <dt style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: ASH }}>{k}</dt>
                <dd className="font-display" style={{ fontSize: 21, marginTop: 3 }}>{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        {/* Right: what the engine returned */}
        <article style={{ border: `1px solid ${LINE}`, borderRadius: 14, background: "#fff", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <Ring value={p.readiness} />
            <div style={{ flex: "1 1 170px", minWidth: 0 }}>
              <p style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="font-display" style={{ fontSize: 42, lineHeight: 1 }}>{p.matchedSources}</span>
                <span style={{ fontSize: 15, color: ASH }}>
                  {p.matchedSources === 1 ? "match" : "matches"}
                </span>
              </p>
              <p style={{ marginTop: 9, fontSize: 12.5, lineHeight: 1.65, color: ASH }}>
                {p.categories.map(c => `${c.count} ${c.label.toLowerCase()}`).join(" · ")}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20, borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <p className="font-display" style={{ fontSize: 17 }}>Top matches</p>
              <Link href="/signup"
                    style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: ASH }}>
                View all {p.matchedSources} ↗
              </Link>
            </div>

            <ul style={{ marginTop: 10 }}>
              {p.topMatches.map((m, i) => (
                <li key={m.name}
                    style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 0",
                             borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
                  <span className="font-display"
                        style={{ flex: "0 0 52px", fontSize: 22, color: GOLD, lineHeight: 1.1 }}>
                    {m.score}<span style={{ fontSize: 12 }}>%</span>
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14.5, lineHeight: 1.35 }}>{m.name}</span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 12, color: ASH }}>
                      {m.typeLabel} · {m.country} · {m.award}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      {/* ── Funding journey + CTA ──────────────────────────── */}
      <div style={{ marginTop: 22, border: `1px solid ${LINE}`, borderRadius: 14,
                    background: PARCHMENT, padding: "20px 22px", display: "flex",
                    alignItems: "center", justifyContent: "space-between", gap: 26, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Funding journey</p>
          <ol style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {p.roadmap.map((s, i) => {
              const done = s.status === "done";
              const current = s.status === "current";
              return (
                <li key={s.label} style={{ flex: "1 1 88px", minWidth: 80 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span aria-hidden style={{
                      width: 13, height: 13, borderRadius: "50%", flex: "0 0 13px",
                      background: done ? GOLD : "transparent",
                      border: `1.5px solid ${done || current ? GOLD : "rgba(26,24,21,0.18)"}`,
                    }} />
                    {i < p.roadmap.length - 1 && (
                      <span aria-hidden style={{ flex: 1, height: 1,
                        background: done ? GOLD : "rgba(26,24,21,0.12)" }} />
                    )}
                  </div>
                  <p style={{ marginTop: 7, fontSize: 12, color: current ? INK : ASH }}>{s.label}</p>
                  <p style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                              color: current ? GOLD : "rgba(138,133,124,0.75)" }}>
                    {stageLabel(s.status, i === firstUpcoming)}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        <Link href="/signup" className="btn-primary" style={{ flex: "0 0 auto" }}>
          Check your matches →
        </Link>
      </div>
    </div>
  );
}
