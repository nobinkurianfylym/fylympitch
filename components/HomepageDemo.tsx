"use client";

import { useState } from "react";

const PROJECTS = [
  {
    title: "SAMPLE FEATURE — COMEDY",
    genre: "Comedy", format: "Feature", country: "—", budget: "—", seeking: "—",
    fundable: "—", sources: 0, readiness: 0,
    breakdown: [{ l: "Grants", a: "—" }, { l: "Labs", a: "—" }, { l: "Co-Pro", a: "—" }, { l: "Funds", a: "—" }],
    matches: [
      { name: "Illustrative lab", country: "—", type: "Development Lab", award: "—", deadline: "—", score: 0 },
      { name: "Illustrative lab", country: "—", type: "Script Lab", award: "—", deadline: "—", score: 0 },
      { name: "Illustrative fund", country: "—", type: "Grant", award: "—", deadline: "—", score: 0 },
    ],
    ep: "Example only — submit your project to see your own funding readiness score and matched opportunities.",
    stages: [
      { l: "Script", s: "completed" }, { l: "Script Labs", s: "current" }, { l: "Dev Labs", s: "ready" },
      { l: "Dev Grants", s: "upcoming" }, { l: "Co-Pro", s: "locked" }, { l: "Production", s: "locked" },
    ],
  },
  {
    title: "SAMPLE FEATURE — DRAMA",
    genre: "Drama", format: "Feature", country: "—", budget: "—", seeking: "—",
    fundable: "—", sources: 0, readiness: 0,
    breakdown: [{ l: "Grants", a: "—" }, { l: "Labs", a: "—" }, { l: "Co-Pro", a: "—" }, { l: "Funds", a: "—" }],
    matches: [
      { name: "Illustrative fund", country: "—", type: "Development Grant", award: "—", deadline: "—", score: 0 },
      { name: "Illustrative fund", country: "—", type: "Co-Development", award: "—", deadline: "—", score: 0 },
      { name: "Illustrative fund", country: "—", type: "Grant", award: "—", deadline: "—", score: 0 },
    ],
    ep: "Example only — submit your project to see your own funding readiness score and matched opportunities.",
    stages: [
      { l: "Script", s: "completed" }, { l: "Script Labs", s: "completed" }, { l: "Dev Labs", s: "current" },
      { l: "Dev Grants", s: "ready" }, { l: "Co-Pro", s: "upcoming" }, { l: "Production", s: "locked" },
    ],
  },
  {
    title: "SAMPLE FEATURE — DOCUMENTARY",
    genre: "Documentary", format: "Documentary", country: "—", budget: "—", seeking: "—",
    fundable: "—", sources: 0, readiness: 0,
    breakdown: [{ l: "Grants", a: "—" }, { l: "Labs", a: "—" }, { l: "Streamers", a: "—" }, { l: "Funds", a: "—" }],
    matches: [
      { name: "Illustrative fund", country: "—", type: "Documentary Grant", award: "—", deadline: "—", score: 0 },
      { name: "Illustrative fund", country: "—", type: "Development Fund", award: "—", deadline: "—", score: 0 },
      { name: "Illustrative fund", country: "—", type: "Development Grant", award: "—", deadline: "—", score: 0 },
    ],
    ep: "Example only — submit your project to see your own funding readiness score and matched opportunities.",
    stages: [
      { l: "Script", s: "completed" }, { l: "Script Labs", s: "current" }, { l: "Dev Labs", s: "ready" },
      { l: "Dev Grants", s: "upcoming" }, { l: "Co-Pro", s: "locked" }, { l: "Production", s: "locked" },
    ],
  },
];

const STAGE_STYLE: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  completed: { dot: "#BF9953", text: "#7a5e1a", bg: "rgba(191,153,83,0.14)", label: "Done" },
  current:   { dot: "#BF9953", text: "#7a5e1a", bg: "rgba(191,153,83,0.18)", label: "Current" },
  ready:     { dot: "#2a6b2a", text: "#2a6b2a", bg: "rgba(42,107,42,0.12)",  label: "Ready" },
  upcoming:  { dot: "rgba(26,24,21,0.2)", text: "#8A857C", bg: "rgba(26,24,21,0.07)", label: "Soon" },
  locked:    { dot: "rgba(26,24,21,0.12)", text: "#b0aba4", bg: "rgba(26,24,21,0.04)", label: "—" },
};

function scoreBadge(score: number) {
  if (score >= 90) return { bg: "rgba(191,153,83,0.14)", color: "#7a5e1a" };
  if (score >= 80) return { bg: "rgba(42,107,42,0.12)", color: "#2a6b2a" };
  return { bg: "rgba(26,24,21,0.08)", color: "#8A857C" };
}

export default function HomepageDemo() {
  const [idx, setIdx] = useState(0);
  const p = PROJECTS[idx];

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", color: "#1A1815" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px", marginBottom: "32px" }}>
        <div>
          <p style={{ fontSize: "10px", letterSpacing: "0.26em", textTransform: "uppercase", color: "#8A857C", marginBottom: "10px" }}>Illustrative example</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "30px", fontWeight: 400, color: "#1A1815", marginBottom: "8px", lineHeight: 1.2 }}>
            See the engine in action
          </h2>
          <p style={{ fontSize: "14px", color: "#8A857C", maxWidth: "420px", lineHeight: 1.65 }}>
            Submit any project. The engine scores it against every active opportunity and produces your complete funding intelligence.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "4px" }}>
          {PROJECTS.map((proj, i) => (
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
              {proj.title}
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
          <em>{p.title}</em> can raise{" "}
          <span style={{ color: "#BF9953" }}>{p.fundable}</span>
        </h3>
        <p style={{ fontSize: "12px", color: "rgba(248,245,240,0.45)", marginBottom: "20px" }}>
          from {p.sources} matched sources across grants, labs, co-production and funds
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
          {p.breakdown.map((b) => (
            <div key={b.l} style={{ background: "rgba(255,255,255,0.08)", borderRadius: "9px", padding: "10px 14px", textAlign: "center", minWidth: "80px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", color: "#BF9953" }}>{b.a}</div>
              <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(248,245,240,0.38)", marginTop: "3px" }}>{b.l}</div>
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
            <span style={{ fontSize: "11px", color: "#8A857C" }}>{p.sources} total</span>
          </div>
          {p.matches.map((m) => {
            const bs = scoreBadge(m.score);
            return (
              <div key={m.name} style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(26,24,21,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#1A1815", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  <div style={{ fontSize: "11px", color: "#8A857C", marginTop: "2px" }}>{m.country} · {m.award} · {m.deadline}</div>
                </div>
                <span style={{ background: bs.bg, color: bs.color, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: "20px", whiteSpace: "nowrap" }}>
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
              {p.stages.map((st) => {
                const ss = STAGE_STYLE[st.s];
                return (
                  <div key={st.l} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: st.s === "current" ? "#1A1815" : "#8A857C", flex: 1, fontWeight: st.s === "current" ? 500 : 400 }}>{st.l}</span>
                    <span style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", background: ss.bg, color: ss.text, padding: "2px 7px", borderRadius: "20px" }}>{ss.label}</span>
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
            `${p.genre} · ${p.format}`,
            `Budget — ${p.budget}`,
            `Seeking — ${p.seeking}`,
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
