"use client";

import { useState } from "react";
import { DEMO_PROJECTS, type DemoProject } from "./homepage-demo-data";

// ============================================================
// HomepageDemo — "See the engine in action"
//
// Renders REAL FYLYMPITCH ENGINE output (services/fylympitchEngine.ts)
// for representative sample projects. Every score, readiness value,
// match count and award is genuine engine output baked at authoring
// time from the live MASTER_DATA catalog — see components/homepage-demo-data.ts
// and scripts/gen-homepage-demo.ts. No fabricated or hand-tuned numbers.
// ============================================================

const STAGE_STYLE: Record<DemoProject["roadmap"][number]["status"], { dot: string; text: string; bg: string; label: string }> = {
  done:     { dot: "#BF9953", text: "#7a5e1a", bg: "rgba(191,153,83,0.16)", label: "Done" },
  current:  { dot: "#BF9953", text: "#7a5e1a", bg: "rgba(191,153,83,0.20)", label: "Current" },
  upcoming: { dot: "rgba(26,24,21,0.2)", text: "#8A857C", bg: "rgba(26,24,21,0.06)", label: "Upcoming" },
};

function scoreBadge(score: number) {
  if (score >= 90) return { bg: "rgba(191,153,83,0.16)", color: "#7a5e1a" };
  if (score >= 75) return { bg: "rgba(42,107,42,0.12)", color: "#2a6b2a" };
  return { bg: "rgba(26,24,21,0.08)", color: "#8A857C" };
}

export default function HomepageDemo() {
  const [idx, setIdx] = useState(0);
  const p = DEMO_PROJECTS[idx];

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", color: "#1A1815" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px", marginBottom: "32px" }}>
        <div>
          <p style={{ fontSize: "10px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#8A857C", marginBottom: "10px" }}>Illustrative example</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "30px", fontWeight: 400, color: "#1A1815", marginBottom: "8px", lineHeight: 1.2 }}>
            See the engine in action
          </h2>
          <p style={{ fontSize: "14px", color: "#8A857C", maxWidth: "440px", lineHeight: 1.65 }}>
            These are real engine results for sample projects, scored against every active opportunity in the platform. Submit your own to see your funding readiness and matched sources.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "4px" }}>
          {DEMO_PROJECTS.map((proj, i) => (
            <button
              key={proj.title}
              onClick={() => setIdx(i)}
              style={{
                background: i === idx ? "#1A1815" : "transparent",
                color: i === idx ? "#F8F5F0" : "#8A857C",
                border: `0.5px solid ${i === idx ? "#1A1815" : "rgba(26,24,21,0.18)"}`,
                borderRadius: "7px", padding: "7px 14px",
                fontFamily: "'Montserrat', sans-serif", fontSize: "11px",
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {proj.genre}
            </button>
          ))}
        </div>
      </div>

      {/* Engine hero card */}
      <div style={{ background: "#1A1815", borderRadius: "14px", padding: "28px 28px 24px", marginBottom: "20px" }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(248,245,240,0.4)", marginBottom: "10px" }}>
          PITCH.FYLYM ENGINE
        </p>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", fontWeight: 400, color: "#F8F5F0", lineHeight: 1.25, marginBottom: "6px" }}>
          <em>{p.title}</em> matches{" "}
          <span style={{ color: "#BF9953" }}>{p.matchedSources} active funding sources</span>
        </h3>
        <p style={{ fontSize: "12px", color: "rgba(248,245,240,0.45)", marginBottom: "20px" }}>
          scored against every live opportunity — grants, labs, markets and platforms
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
          {p.categories.map((c) => (
            <div key={c.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: "9px", padding: "10px 14px", textAlign: "center", minWidth: "96px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", color: "#BF9953" }}>{c.count}</div>
              <div style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(248,245,240,0.42)", marginTop: "3px" }}>{c.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1, height: "4px", borderRadius: "3px", background: "rgba(255,255,255,0.12)" }}>
            <div style={{ width: `${p.readiness}%`, height: "4px", borderRadius: "3px", background: "#BF9953", transition: "width 0.8s ease" }} />
          </div>
          <span style={{ fontSize: "11px", color: "rgba(248,245,240,0.45)", whiteSpace: "nowrap" }}>{p.readiness}/100 funding readiness</span>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>

        {/* Top matches */}
        <div style={{ border: "0.5px solid rgba(26,24,21,0.12)", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(26,24,21,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A857C" }}>Top matches</p>
            <span style={{ fontSize: "11px", color: "#8A857C" }}>{p.matchedSources} total</span>
          </div>
          {p.topMatches.map((m) => {
            const bs = scoreBadge(m.score);
            return (
              <div key={m.name} style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(26,24,21,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#1A1815", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  <div style={{ fontSize: "11px", color: "#8A857C", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.typeLabel} · {m.country} · {m.award}</div>
                </div>
                <span style={{ background: bs.bg, color: bs.color, fontSize: "10px", letterSpacing: "0.06em", padding: "3px 9px", borderRadius: "20px", whiteSpace: "nowrap", fontWeight: 600 }}>
                  {m.score}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Journey + EP brief */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ border: "0.5px solid rgba(26,24,21,0.12)", borderRadius: "12px", padding: "14px 16px", flex: 1 }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A857C", marginBottom: "12px" }}>Funding Journey</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {p.roadmap.map((st) => {
                const ss = STAGE_STYLE[st.status];
                const rightLabel = st.status === "upcoming" && st.live > 0 ? `${st.live} live` : ss.label;
                return (
                  <div key={st.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: st.status === "current" ? "#1A1815" : "#8A857C", flex: 1, fontWeight: st.status === "current" ? 500 : 400 }}>{st.label}</span>
                    <span style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", background: ss.bg, color: ss.text, padding: "2px 7px", borderRadius: "20px" }}>{rightLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ border: "0.5px solid rgba(191,153,83,0.35)", borderRadius: "12px", padding: "14px 16px", background: "rgba(191,153,83,0.04)" }}>
            <p style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#BF9953", marginBottom: "7px" }}>AI Executive Producer</p>
            <p style={{ fontSize: "12px", color: "#1A1815", lineHeight: 1.65 }}>{p.ep}</p>
          </div>
        </div>
      </div>

      {/* Project meta footer */}
      <div style={{ background: "#F8F5F0", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {[
            `${p.genre} · ${p.format[0].toUpperCase()}${p.format.slice(1)}`,
            `Budget — ${p.budgetLabel}`,
            `Seeking — ${p.seekingLabel}`,
            `Country — ${p.country}`,
          ].map((item) => (
            <span key={item} style={{ fontSize: "12px", color: "#8A857C" }}>{item}</span>
          ))}
        </div>
        <a href="/login" style={{ background: "#1A1815", color: "#F8F5F0", border: "none", padding: "9px 20px", fontFamily: "'Montserrat', sans-serif", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: "6px", cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}>
          Submit your project →
        </a>
      </div>
    </div>
  );
}
