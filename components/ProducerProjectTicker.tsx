"use client";

import { useState } from "react";
import Link from "next/link";
import ProjectThumbnail from "@/components/ProjectThumbnail";

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

const FORMAT_LABELS: Record<string, string> = {
  feature:     "Feature Film",
  documentary: "Documentary",
  series:      "Series",
  animation:   "Animation",
};

const STAGE_LABELS: Record<string, string> = {
  development:     "Development",
  pre_production:  "Pre-Production",
  production:      "Production",
  post_production: "Post-Production",
  completed:       "Completed",
};

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export default function ProducerProjectTicker({
  projects,
}: {
  projects: ProducerProject[];
}) {
  const [paused, setPaused] = useState(false);

  if (projects.length === 0) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="card py-16 text-center">
          <p className="font-display text-[19px] mb-2">Projects coming soon</p>
          <p className="text-ash text-[13px]">
            Filmmaker projects will appear here as they are submitted.
          </p>
        </div>
      </section>
    );
  }

  // Duplicate for seamless infinite loop (same pattern as IntelligenceTicker)
  const TRACK = [...projects, ...projects];
  const duration = `${Math.max(60, projects.length * 8)}s`;

  return (
    <section aria-label="Live project ticker">

      {/* ── Header ── */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-5 flex items-baseline justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-[22px]">Trending Projects</h2>
          <span
            className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.1em] uppercase font-medium px-2.5 py-1.5 rounded-sm"
            style={{ background: "#1D4309", color: "#C0DD97" }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C0DD97] animate-pulse" />
            Live
          </span>
        </div>
        <Link
          href="/login"
          className="text-[11px] tracking-[0.14em] uppercase text-gold hover:text-ink transition-colors"
        >
          Browse all →
        </Link>
      </div>

      {/* ── Marquee ── */}
      <div
        style={{ overflow: "hidden" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            padding: "4px 0 24px",
            width: "max-content",
            animation: `fylym-ticker ${duration} linear infinite`,
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
          }}
        >
          {TRACK.map((p, i) => (
            <Link
              key={`${p.id}-${i}`}
              href={`/login?next=/producer/projects/${p.id}`}
              className="group shrink-0 mx-2 bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold/40 transition-colors"
              style={{ width: 192 }}
            >
              {/* Thumbnail */}
              <ProjectThumbnail
                title={p.title}
                genre={p.genre}
                supabaseUrl={SUPA_URL}
                className="w-full"
                style={{ height: 128 }}
              />

              {/* Body */}
              <div className="px-3 pt-2.5 pb-3.5">
                <p
                  className="eyebrow mb-2"
                  style={{ fontSize: 8, letterSpacing: "0.1em" }}
                >
                  {FORMAT_LABELS[p.format] ?? p.format}
                </p>
                <p className="font-display text-[13px] leading-snug mb-1 group-hover:text-gold transition-colors line-clamp-2">
                  {p.title}
                </p>
                <p className="text-[10px] tracking-[0.06em] uppercase text-ash mb-2.5 truncate">
                  {p.genre}
                </p>
                <div className="text-[10px] text-ash leading-[1.8]">
                  <span className="text-ink/30">Seeking: </span>{p.seeking}
                  <br />
                  <span className="text-ink/30">Budget: </span>{p.budget}
                </div>
                <div className="mt-2.5 pt-2 border-t border-line text-[10px] text-ash truncate">
                  {STAGE_LABELS[p.stage] ?? p.stage} · {p.country}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
