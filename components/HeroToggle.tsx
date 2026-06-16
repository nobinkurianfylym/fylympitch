"use client";

import { useState } from "react";
import Link from "next/link";

const CONTENT = {
  filmmaker: {
    eyebrow: "For filmmakers",
    headline: (
      <>
        Where films find{" "}
        <span className="italic text-gold">their financiers.</span>
      </>
    ),
    body: "FYLYMPITCH matches your project with the producers, funds, grants, labs, markets and investors most likely to say yes — and tells you exactly why.",
    primary: { label: "Get started", href: "/login" },
    secondary: { label: "See how it works", href: "#how" },
  },
  producer: {
    eyebrow: "For producers & investors",
    headline: (
      <>
        Where producers find{" "}
        <span className="italic text-gold">their next project.</span>
      </>
    ),
    body: "One account, two roles. Browse filmmaker projects by genre, stage and territory. Read scripts, send offers, co-produce — no approval needed.",
    primary: { label: "Get started", href: "/login?next=/producer" },
    secondary: { label: "Browse projects", href: "/projects" },
  },
};

type Role = "filmmaker" | "producer";

export default function HeroToggle() {
  const [role, setRole] = useState<Role>("filmmaker");
  const c = CONTENT[role];

  return (
    <section className="max-w-6xl mx-auto px-6 pt-8 pb-3 md:pt-10 md:pb-4">

      {/* ── Toggle ── */}
      <div className="inline-flex items-center gap-0 mb-6 relative">
        {(["filmmaker", "producer"] as Role[]).map((r, i) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className="relative px-5 py-2 text-[11px] tracking-[0.18em] uppercase transition-colors duration-200"
            style={{ color: role === r ? "var(--color-ink)" : "var(--color-ash)" }}
          >
            {r === "filmmaker" ? "Filmmaker" : "Producer"}
            {/* active underline */}
            <span
              className="absolute bottom-0 left-5 right-5 h-[1.5px] bg-gold transition-opacity duration-300"
              style={{ opacity: role === r ? 1 : 0 }}
            />
          </button>
        ))}
        {/* divider */}
        <span className="absolute left-1/2 -translate-x-1/2 h-3 w-[1px] bg-line" />
      </div>

      {/* ── Content — fades on role change ── */}
      <div
        key={role}
        style={{ animation: "heroFadeIn 0.35s ease both" }}
      >
        <p className="eyebrow mb-5">{c.eyebrow}</p>
        <h1 className="font-display font-normal text-[36px] leading-[1.08] md:text-[52px] max-w-4xl">
          {c.headline}
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ash">
          {c.body}
        </p>
        <div className="mt-7 flex flex-wrap gap-4">
          <Link href={c.primary.href} className="btn-gold">
            {c.primary.label}
          </Link>
          {c.secondary.href.startsWith("#") ? (
            <a href={c.secondary.href} className="btn-ghost">
              {c.secondary.label}
            </a>
          ) : (
            <Link href={c.secondary.href} className="btn-ghost">
              {c.secondary.label}
            </Link>
          )}
        </div>
      </div>

      {/* ── Category bar ── */}
      <div className="mt-10 hairline-gold pt-5 flex flex-nowrap gap-x-6 overflow-x-auto text-[9px] tracking-[0.14em] uppercase text-ash" style={{ scrollbarWidth:"none" }}>
        <span className="shrink-0">Grants</span>
        <span className="shrink-0">Film Funds</span>
        <span className="shrink-0">Labs</span>
        <span className="shrink-0">Co-productions</span>
        <span className="shrink-0">Markets</span>
        <span className="shrink-0">Producers</span>
        <span className="shrink-0">Production Companies</span>
        <span className="shrink-0">Distribution</span>
        <span className="shrink-0">Investors</span>
        <span className="shrink-0">Streamers</span>
      </div>

      <style>{`
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
