"use client";

import Link from "next/link";
import { useRole } from "./RoleProvider";

const CONTENT = {
  filmmaker: {
    eyebrow: "For filmmakers",
    headline: (
      <>
        Where films find{" "}
        <span className="italic text-gold">their financiers.</span>
      </>
    ),
    body: "PITCH.FYLYM matches your project with the producers, funds, grants, labs, markets and investors most likely to say yes — and tells you exactly why.",
    primary: { label: "Get started", href: "/signup" },
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
    primary: { label: "Get started", href: "/signup?role=producer" },
    secondary: { label: "Browse projects", href: "/projects" },
  },
};

const FILMMAKER_TAGS = [
  "Grants", "Film Funds", "Labs", "Co-productions", "Markets",
  "Producers", "Production Companies", "Distribution", "Investors", "Streamers",
];

const PRODUCER_TAGS = [
  "Scripts", "Feature Films", "Series", "Documentaries",
  "Lab-Selected", "Grant-Winning", "Packaged", "Attached Talent",
  "Co-Production Ready", "Financing Ready",
];

export default function HeroToggle({
  isLoggedIn  = false,
  accountRole = "FILMMAKER",
}: {
  isLoggedIn?:  boolean
  accountRole?: string
}) {
  const { role } = useRole();
  const c = CONTENT[role];

  // Logged-in CTAs
  const loggedInPrimary =
    accountRole === "PRODUCER" || (accountRole === "ADMIN" && role === "producer")
      ? { label: "Go to Producer Studio", href: "/producer" }
      : { label: "Go to Dashboard",       href: "/dashboard" };

  const primary   = isLoggedIn ? loggedInPrimary : c.primary;
  const secondary = c.secondary;

  return (
    <section className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full px-6 pb-16">

      {/* ── Content — fades on role change ── */}
      <div key={role} style={{ animation: "heroFadeIn 0.35s ease both" }}>
        <p className="eyebrow mb-5">{c.eyebrow}</p>
        <h1 className="font-display font-normal text-[36px] leading-[1.08] md:text-[52px] max-w-4xl">
          {c.headline}
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ash">
          {c.body}
        </p>
        <div className="mt-7 flex flex-wrap gap-4">
          <Link href={primary.href} className="btn-gold">
            {primary.label}
          </Link>
          {secondary.href.startsWith("#") ? (
            <a href={secondary.href} className="btn-ghost">
              {secondary.label}
            </a>
          ) : (
            <Link href={secondary.href} className="btn-ghost">
              {secondary.label}
            </Link>
          )}
        </div>
      </div>

      {/* ── Category bar ── */}
      <div
        className="mt-10 hairline-gold pt-5 flex flex-nowrap gap-x-6 overflow-x-auto text-[9px] tracking-[0.14em] uppercase text-ash"
        style={{ scrollbarWidth: "none" }}
      >
        {(role === "producer" ? PRODUCER_TAGS : FILMMAKER_TAGS).map((tag) => (
          <span key={tag} className="shrink-0">{tag}</span>
        ))}
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
