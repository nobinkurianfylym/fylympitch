"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────
export type ProducerProject = {
  id:      string;
  title:   string;
  genre:   string;
  format:  string;
  stage:   string;
  country: string;
  budget:  string;
  seeking: string;
};

// ── Label maps ───────────────────────────────────────────────
export const FORMAT_LABELS: Record<string, string> = {
  feature:     "Feature Film",
  short:       "Short Film",
  documentary: "Documentary",
  series:      "Series",
  animation:   "Animation",
};

export const STAGE_LABELS: Record<string, string> = {
  development:     "Development",
  pre_production:  "Pre-Production",
  production:      "Production",
  post_production: "Post-Production",
  completed:       "Completed",
};

// ── Cinematic SVG thumbnails ─────────────────────────────────
const THUMB_BG: Record<string, string[]> = {
  feature:     ["#0D1C1C", "#1A1510", "#0D1419"],
  documentary: ["#1C130A", "#141810", "#1A1208"],
  short:       ["#0F0F18", "#0C0C14", "#14101C"],
  series:      ["#0A1020", "#0D0D1C", "#080E18"],
  animation:   ["#080812", "#100818", "#0A0A1A"],
};

function ProjectThumb({ format, seed }: { format: string; seed: string }) {
  const n = seed.charCodeAt(seed.length - 1) % 3;
  const bg = (THUMB_BG[format] ?? THUMB_BG.feature)[n];

  if (format === "documentary") {
    return (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <rect width="240" height="150" fill={bg} />
        <polygon
          points="0,150 48,80 88,108 126,58 170,94 216,64 240,72 240,150"
          fill="rgba(255,255,255,0.06)"
        />
        <line x1="0" y1="130" x2="240" y2="130" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      </svg>
    );
  }

  if (format === "short") {
    return (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <rect width="240" height="150" fill={bg} />
        <line x1="0" y1="37.5" x2="240" y2="37.5" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="75"   x2="240" y2="75"   stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="0" y1="112"  x2="240" y2="112"  stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="60"  y1="0" x2="60"  y2="150" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="120" y1="0" x2="120" y2="150" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="180" y1="0" x2="180" y2="150" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <rect x="80" y="45" width="80" height="60" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.75" />
      </svg>
    );
  }

  if (format === "animation") {
    return (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <rect width="240" height="150" fill={bg} />
        <circle cx="120" cy="72" r="32" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <ellipse cx="120" cy="82" rx="48" ry="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <circle cx="168" cy="34" r="3"   fill="rgba(255,255,255,0.20)" />
        <circle cx="52"  cy="30" r="2"   fill="rgba(255,255,255,0.15)" />
        <circle cx="208" cy="90" r="1.8" fill="rgba(255,255,255,0.12)" />
        <circle cx="28"  cy="90" r="1.5" fill="rgba(255,255,255,0.10)" />
      </svg>
    );
  }

  if (format === "series") {
    return (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <rect width="240" height="150" fill={bg} />
        <rect x="16" y="28" width="62" height="44" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <rect x="90" y="28" width="62" height="44" rx="2" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <rect x="164" y="28" width="62" height="44" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <rect x="16" y="82"  width="62" height="42" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        <rect x="90" y="82"  width="62" height="42" rx="2" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      </svg>
    );
  }

  // feature — three variants
  if (n === 1) {
    return (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <rect width="240" height="150" fill={bg} />
        <path d="M0 105 Q 60 90 120 105 T 240 105" stroke="rgba(255,255,255,0.09)" strokeWidth="1" fill="none" />
        <path d="M0 117 Q 60 102 120 117 T 240 117" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
        <path d="M0 129 Q 60 114 120 129 T 240 129" stroke="rgba(255,255,255,0.04)" strokeWidth="1" fill="none" />
        <rect x="112" y="28" width="16" height="44" rx="1" fill="rgba(255,255,255,0.08)" />
        <circle cx="120" cy="22" r="9" fill="rgba(255,255,255,0.08)" />
      </svg>
    );
  }
  if (n === 2) {
    return (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <rect width="240" height="150" fill={bg} />
        <circle cx="82"  cy="75" r="36" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <circle cx="132" cy="70" r="27" fill="rgba(255,255,255,0.05)" />
        <circle cx="132" cy="70" r="14" fill="rgba(255,255,255,0.08)" />
      </svg>
    );
  }
  // n === 0 — default feature: lone figure
  return (
    <svg viewBox="0 0 240 150" aria-hidden="true">
      <rect width="240" height="150" fill={bg} />
      <line x1="120" y1="18" x2="120" y2="112" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
      <line x1="0" y1="120" x2="240" y2="120" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      <rect x="112" y="94" width="16" height="20" rx="1" fill="rgba(255,255,255,0.10)" />
      <circle cx="120" cy="88" r="7.5" fill="rgba(255,255,255,0.09)" />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────
export default function ProducerProjectTicker({
  projects,
}: {
  projects: ProducerProject[];
}) {
  const [activeFormat, setActiveFormat] = useState<string>("all");
  const [activeStage, setActiveStage]   = useState<string>("all");

  const availableFormats = useMemo(() => {
    const seen = new Set(projects.map((p) => p.format));
    return ["all", ...Object.keys(FORMAT_LABELS).filter((f) => seen.has(f))];
  }, [projects]);

  const availableStages = useMemo(() => {
    const seen = new Set(projects.map((p) => p.stage));
    return Object.keys(STAGE_LABELS).filter((s) => seen.has(s));
  }, [projects]);

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (activeFormat === "all" || p.format === activeFormat) &&
          (activeStage  === "all" || p.stage  === activeStage)
      ),
    [projects, activeFormat, activeStage]
  );

  return (
    <section aria-label="Live project ticker">

      {/* ── FILTER STRIP ── */}
      <div className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 flex items-stretch no-scrollbar overflow-x-auto">

          {/* Format tabs */}
          {availableFormats.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFormat(f)}
              className={`shrink-0 text-[10px] tracking-[0.14em] uppercase px-5 py-4 border-b-2 transition-colors ${
                activeFormat === f
                  ? "border-ink text-ink"
                  : "border-transparent text-ash hover:text-ink"
              }`}
            >
              {f === "all" ? "All Formats" : FORMAT_LABELS[f]}
            </button>
          ))}

          {availableStages.length > 0 && (
            <div className="self-center w-px h-4 bg-line mx-2 shrink-0" />
          )}

          {/* Stage tabs (toggle — click again to clear) */}
          {availableStages.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStage((prev) => (prev === s ? "all" : s))}
              className={`shrink-0 text-[10px] tracking-[0.14em] uppercase px-5 py-4 border-b-2 transition-colors ${
                activeStage === s
                  ? "border-gold text-gold"
                  : "border-transparent text-ash hover:text-ink"
              }`}
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION HEADER ── */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-[24px]">Trending Projects</h2>
          <span
            className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.1em] uppercase font-medium px-2.5 py-1.5 rounded-sm"
            style={{ background: "#1D4309", color: "#C0DD97" }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C0DD97] animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[12px] text-ash">{filtered.length} projects</span>
          <Link
            href="/login"
            className="text-[11px] tracking-[0.14em] uppercase text-gold hover:text-ink transition-colors"
          >
            View all →
          </Link>
        </div>
      </div>
      <p className="max-w-6xl mx-auto px-6 pb-6 text-[12px] text-ash">
        Live ticker · projects seeking producers, co-producers and investors
      </p>

      {/* ── CARDS ── */}
      {filtered.length === 0 ? (
        <div className="max-w-6xl mx-auto px-6 pb-14">
          <div className="card py-16 text-center">
            <p className="font-display text-[19px] mb-2">No projects match this filter</p>
            <p className="text-ash text-[13px]">Try removing a filter or check back as new projects submit daily.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar pb-12">
          <div
            className="flex gap-4"
            style={{
              width:        "max-content",
              paddingLeft:  "max(1.5rem, calc((100vw - 72rem) / 2 + 1.5rem))",
              paddingRight: "max(1.5rem, calc((100vw - 72rem) / 2 + 1.5rem))",
            }}
          >
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/login?next=/producer/projects/${p.id}`}
                className="group block shrink-0 w-[208px] bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold/40 transition-colors"
              >
                {/* Thumbnail */}
                <div className="proj-card-thumb h-[132px] relative overflow-hidden">
                  <ProjectThumb format={p.format} seed={p.id} />
                  <span
                    className="absolute bottom-2 left-3 text-[8px] tracking-[0.1em] uppercase px-2 py-1 rounded-sm font-medium z-10"
                    style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.9)" }}
                  >
                    {FORMAT_LABELS[p.format] ?? p.format}
                  </span>
                </div>

                {/* Body */}
                <div className="px-3.5 pt-3 pb-4">
                  <p className="font-display text-[14px] leading-snug mb-1.5 group-hover:text-gold transition-colors line-clamp-2">
                    {p.title}
                  </p>
                  <p className="text-[10px] tracking-[0.08em] uppercase text-ash mb-3 truncate">
                    {p.genre}
                  </p>
                  <div className="text-[11px] text-ash leading-[1.85]">
                    <span className="text-ink/30">Budget: </span>
                    {p.budget}
                    <br />
                    <span className="text-ink/30">Seeking: </span>
                    {p.seeking}
                    <br />
                    <span className="text-ink/30">Stage: </span>
                    {STAGE_LABELS[p.stage] ?? p.stage}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-line text-[10px] text-ash truncate">
                    {p.country}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
