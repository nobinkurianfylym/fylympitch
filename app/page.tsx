import { cache } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { Footer } from "@/components/Footer";
import ShareLinkButton from "@/components/ShareLinkButton";
import HomepageDemo from "@/components/HomepageDemo";
import HeroToggle from "@/components/HeroToggle";
import FeaturedCard from "@/components/FeaturedCard";

export const dynamic = "force-dynamic";
import IntelligenceTicker from "@/components/IntelligenceTicker";
import PlatformMetrics from "@/components/PlatformMetrics";
import { RoleProvider, type Role } from "@/components/RoleProvider";
import HeaderRoleToggle from "@/components/HeaderRoleToggle";
import HeaderCTA from "@/components/HeaderCTA";
import { createClient } from "@/lib/supabase/server";
import ProducerProjectTicker from "@/components/ProducerProjectTicker";
import { Icon } from "@/components/Icon";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTrendingProjects, getOpportunityCount } from "@/lib/cached-queries";

/**
 * The date on the sample certificate in the Proof of Existence section.
 *
 * Deliberately a constant rather than `new Date()`: rendering today's date
 * would make an illustration look like a live event that never happened.
 * It is a mockup of what a filmmaker receives, in the same spirit as the
 * "Sample Feature" poster in the engine section.
 *
 * It does age. The stronger version of this card points at a REAL proof —
 * any public one — so the date is true and the chip can link to /verify.
 */
const PROOF_SAMPLE_STAMP = "Sample · 25 May 2026 · 10:48 IST";

// ── SEO ──────────────────────────────────────────────────────────────────────
// The homepage had no metadata of its own and fell back to the root layout's,
// which is written to be a sane default for every page rather than to rank for
// anything. It is the page most likely to be searched for by name and the one
// every other page links to, so it states plainly what the site does and for
// whom, and carries its own canonical.
//
// The fund count is read live: a description that says "180+" while the
// catalogue holds 593 undersells the site by three times and goes stale the
// moment anything is added.
export async function generateMetadata(): Promise<Metadata> {
  const n = await getOpportunityCount();
  const scale = n > 0 ? `${n.toLocaleString("en-US")} ` : "";

  return pageMetadata({
    title: "Film Funding for Independent Filmmakers",
    description:
      `Match your film against ${scale}funds, grants, labs and markets worldwide, see what you qualify for, and reach producers and investors.`,
    path: "/",
  });
}

// Exact live opportunity count for on-page copy.
//
// This replaced a floor-and-round helper that turned 536 into "500+". The exact
// figure is both more persuasive and just as honest: it is read straight from
// the catalogue, so it can never overstate it. It also moves on its own as
// discovery adds funds, instead of sitting on a round number for months.
//
// Returns "" when the count is unknown so copy can degrade gracefully — every
// caller drops the number rather than printing a stale one.
function exactCount(n: number): string {
  if (!n || n < 1) return "";
  return n.toLocaleString("en-US");
}

const STEPS = [
  {
    num: "01",
    icon: "file-pencil",
    title: "Add your film",
    body: "Title, logline, budget and your pitch deck. Takes about ten minutes.",
  },
  {
    num: "02",
    icon: "target",
    title: "See which funds fit",
    body: "We check your film against %OPPS% grants, funds and labs worldwide, then show you the ones you qualify for and why.",
  },
  {
    num: "03",
    icon: "eye",
    title: "Get seen by producers",
    body: "Producers looking for their next film can find your project and contact you directly.",
  },
  {
    num: "04",
    icon: "check",
    title: "Apply and keep track",
    body: "Deadlines, materials and submissions in one place, instead of a spreadsheet.",
  },
];

const FAQS = [
  ["Who can see my script and pitch deck?", "It depends how you submit your project. Public projects are visible to everyone browsing PITCH.FYLYM. Private projects are visible only to you, PITCH.FYLYM administrators, and industry accounts that have been individually verified and approved. Files live in private storage with row-level access control — there are no public links to private materials."],
  ["How is the match score calculated?", "Eight weighted criteria totalling 100 points: genre (20), stage (20), territory (15), budget (15), format (10), funding gap (10), language (5) and historical success (5). Anything under 60 is hidden so you only see real prospects."],
  ["Is PITCH.FYLYM free for filmmakers?", "Yes. The platform is in public beta and every feature is free for filmmakers and producers during this period."],
  ["How do producers and investors join?", "Sign up with a single Google account or email — you automatically get access to the Producer Studio. Once an admin verifies your account, you'll also see private projects submitted by filmmakers."],
];

export default async function Home() {
  const cookieStore = await cookies();
  const rawRole = cookieStore.get("fyp_role")?.value;
  const supabase = await createClient();

  // ── One round trip instead of four ────────────────────────────────────────
  // These three used to run one after another: auth, then the ticker query,
  // then the metrics snapshot. None of them needs the result of any other, so
  // the page spent three round-trips to Supabase doing nothing but waiting.
  // The queries themselves take single-digit milliseconds; the latency is the
  // hop, and the hop is what this removes.
  const [userRes, trendingProjects, oppCount] = await Promise.all([
    supabase.auth.getUser(),
    getTrendingProjects(),
    getOpportunityCount(),
  ]);

  const user = userRes.data.user;

  // The one query that genuinely depends on another: it needs the user id.
  // Logged-out visitors — every search engine, and most first-time arrivals —
  // never pay for it at all.
  let accountRole = "FILMMAKER";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const dbRole = (profile as any)?.role ?? "filmmaker";
    if (dbRole === "admin")         accountRole = "ADMIN";
    else if (dbRole === "producer") accountRole = "PRODUCER";
    else                            accountRole = "FILMMAKER";
  }

  // Role for RoleProvider:
  // - logged out or admin → use cookie (they can toggle)
  // - logged-in filmmaker/producer → lock to their actual DB role
  const isAdmin = accountRole === "ADMIN";
  let initialRole: Role;
  if (!user || isAdmin) {
    initialRole = rawRole === "producer" ? "producer" : "filmmaker";
  } else {
    initialRole = accountRole === "PRODUCER" ? "producer" : "filmmaker";
  }

  const oppLabel = exactCount(oppCount);

  return (
    <RoleProvider initialRole={initialRole}>
    <main>
      {/* HERO VIEWPORT — fills full screen */}
      <div className="flex flex-col w-full" style={{ minHeight: "100svh" }}>
        {/* NAV */}
        <header className="max-w-6xl mx-auto w-full px-6 py-7 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-10 text-[12px] tracking-[0.18em] uppercase text-ash">
            <a href="#features" className="hover:text-ink transition-colors">Platform</a>
            <Link href="/filmprojects" className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/opportunities"    className="hover:text-ink transition-colors">Opportunities</Link>
          </nav>
          <div className="flex items-center gap-3">
            <HeaderRoleToggle isAdmin={isAdmin} />
            <HeaderCTA
              isLoggedIn={!!user}
              userName={user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ""}
              avatarUrl={user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? ""}
              accountRole={accountRole}
            />
          </div>
        </header>

        {/* MOBILE NAV — the desktop header nav (Platform / Film Projects /
            Opportunities) is hidden below md; surface the two primary
            destinations here so mobile visitors aren't sent to the footer. */}
        <nav className="md:hidden max-w-6xl mx-auto w-full px-6 -mt-2 pb-1 flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase text-ash">
          <Link href="/filmprojects" className="py-3 hover:text-ink transition-colors">Film Projects</Link>
          <Link href="/opportunities" className="py-3 hover:text-ink transition-colors">Opportunities</Link>
        </nav>

        {/* HERO — grows to fill remaining viewport */}
        <HeroToggle
          isLoggedIn={!!user}
          accountRole={accountRole}
          oppLabel={oppLabel}
          aside={<FeaturedCard />}
        />
      </div>

      {/* PLATFORM METRICS — live counts above the ticker */}
      <PlatformMetrics />

      {/* INTELLIGENCE TICKER */}
      <IntelligenceTicker />

      {/* PLATFORM */}
      <section id="features" className="bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">

          {/* Opening */}
          <div className="max-w-3xl mb-20">
            <p className="eyebrow mb-5">Platform</p>
            <h2 className="font-display text-[36px] md:text-[52px] leading-[1.08] font-normal">
              You add the film pitch.<br className="hidden md:block" />{" "}
              <span className="italic text-gold">We find the funds.</span>
            </h2>
            <p className="mt-6 text-[18px] leading-[1.7] text-ash max-w-xl">
              Add it once, and we keep checking — new grants, closing dates, and
              which ones you actually qualify for.
            </p>
          </div>

          {/* 4 Steps */}
          <div className="grid md:grid-cols-2 gap-x-20 gap-y-0">
            {STEPS.map((s) => (
              <div key={s.num} className="hairline pt-8 pb-8">
                <div className="flex items-start gap-5">
                  {/* Icon circle */}
                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
                    style={{ border: "1px solid rgba(191,153,83,0.35)", background: "rgba(191,153,83,0.06)" }}
                  >
                    <Icon name={s.icon} className="text-gold" style={{ fontSize: 16 }} />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-ash/50 mb-2">{s.num}</p>
                    <h3 className="font-display text-[22px] font-normal mb-3">{s.title}</h3>
                    <p className="text-[16px] leading-[1.7] text-ash">{s.body.replace("%OPPS% ", oppLabel ? oppLabel + " " : "")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Closing — the two needs, shown meeting rather than described.
              The layout carries the argument: two halves, a join, a resolution. */}
          <div className="mt-24 border-t border-line pt-16">
            <p className="eyebrow text-center mb-12">The idea</p>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-y-8 gap-x-10 max-w-4xl mx-auto">
              <p className="font-display text-[26px] md:text-[32px] leading-[1.25] font-normal text-center md:text-right">
                Filmmakers need <span className="text-gold">funding</span>.
              </p>

              {/* Join — a hairline through a gold lozenge. Horizontal on mobile,
                  vertical on desktop, so the two halves always read as meeting. */}
              <div className="flex md:flex-col items-center justify-center gap-3" aria-hidden="true">
                <span className="block h-px w-14 md:h-12 md:w-px bg-line" />
                <span className="block h-[7px] w-[7px] rotate-45 bg-gold shrink-0" />
                <span className="block h-px w-14 md:h-12 md:w-px bg-line" />
              </div>

              <p className="font-display text-[26px] md:text-[32px] leading-[1.25] font-normal text-center md:text-left">
                Producers need <span className="text-gold">stories</span>.
              </p>
            </div>

            <p className="font-display text-[24px] md:text-[34px] leading-[1.3] font-normal text-center mt-14 max-w-3xl mx-auto text-balance">
              PITCH.FYLYM is where they <span className="italic text-gold">find each other</span>.
            </p>

            <div className="text-center">
              <Link href="/signup" className="btn-gold mt-12 inline-block">
                Create your free account
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <HomepageDemo />
      </section>

      {/* PROOF OF EXISTENCE */}
      {/*
          Light ground, not the dark band it used to be. The previous version
          ran hero + hash strip + how-it-works + a full certificate card +
          a trust row + a closing line, which is six ideas where the page only
          needs two: what this is, and what you get. The certificate detail
          (transaction id, block height) now lives where it belongs — on the
          real certificate at /verify — rather than being mocked up here.
      */}
      <section className="bg-ivory">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">

          <div className="grid md:grid-cols-2 gap-16 md:gap-20 items-center">

            {/* ── Left: the claim ─────────────────────────── */}
            <div>
              <p className="eyebrow mb-5">Proof of existence</p>

              <h2 className="font-display text-[34px] md:text-[52px] leading-[1.06] font-normal">
                Submit your film pitch
                <span className="italic text-gold"> with confidence.</span>
              </h2>

              <p className="mt-6 text-[17px] leading-[1.75] text-ash max-w-md">
                We create a permanent timestamp of your pitch deck on the
                Bitcoin blockchain.
              </p>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-7">
                {[
                  { icon: "lock",         label: "Private",
                    sub: "Your deck stays yours. We store only a fingerprint." },
                  { icon: "infinity",     label: "Permanent",
                    sub: "Recorded on Bitcoin. Cannot be changed." },
                  { icon: "shield-check", label: "Verifiable",
                    sub: "Independent proof of when your version existed." },
                ].map((f) => (
                  <div key={f.label}>
                    <Icon name={f.icon} className="text-ink"
                          style={{ fontSize: 26, display: "block", marginBottom: 12 }} />
                    <p className="text-[14px] font-semibold text-ink mb-1.5">{f.label}</p>
                    <p className="text-[13px] leading-[1.6] text-ash">{f.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link href="/signup" className="btn-primary">
                  Timestamp your deck →
                </Link>
              </div>

              {/* A timestamp is evidence of date, not ownership. Said plainly,
                  and kept in step with the Terms page. */}
              <p className="mt-5 text-[13px] leading-[1.7] text-ash/80">
                Date evidence, not a substitute for copyright registration.
              </p>
            </div>

            {/* ── Right: what you get ─────────────────────── */}
            {/* Built in CSS and SVG rather than photographed. There is no deck
                mockup in /public, and a photograph of a real-looking film
                would imply a title that does not exist. */}
            <div className="relative mx-auto w-full max-w-[420px] aspect-[4/3.4]" aria-hidden>

              {/* The slab the deck leans on */}
              <div className="absolute rounded-[3px]"
                   style={{ right: "4%", top: "16%", width: "34%", height: "62%",
                            background: "linear-gradient(150deg,#3a3631,#1b1815)",
                            boxShadow: "0 30px 50px -28px rgba(26,24,21,0.7)" }} />

              {/* The deck cover */}
              <div className="absolute overflow-hidden"
                   style={{ left: "6%", top: "4%", width: "62%", height: "88%",
                            borderRadius: "3px 6px 6px 3px",
                            transform: "rotate(-4deg)",
                            background: "#F7F5F0",
                            boxShadow: "0 40px 70px -34px rgba(26,24,21,0.65), 0 2px 0 rgba(26,24,21,0.06)" }}>

                {/* Spine shadow, so it reads as a bound document */}
                <div className="absolute inset-y-0 left-0" style={{ width: 9,
                     background: "linear-gradient(90deg,rgba(26,24,21,0.16),transparent)" }} />

                <div className="px-7 pt-12 text-center">
                  <p className="text-[9px] tracking-[0.3em] uppercase text-ash">The</p>
                  <p className="font-display text-[22px] leading-[1.15] tracking-[0.06em] text-ink mt-1">
                    NEXT CHAPTER
                  </p>
                  <span className="block mx-auto my-4" style={{ width: 34, height: 1, background: "#C9C2B2" }} />
                  <p className="text-[8px] tracking-[0.26em] uppercase text-ash">A feature film</p>
                </div>

                {/* Landscape plate: drawn, not a photograph */}
                <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 200 128" preserveAspectRatio="none"
                     style={{ height: "52%" }}>
                  <defs>
                    <linearGradient id="pxSky" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8D9BE" />
                      <stop offset="55%" stopColor="#C9B492" />
                      <stop offset="100%" stopColor="#8E8370" />
                    </linearGradient>
                  </defs>
                  <rect width="200" height="128" fill="url(#pxSky)" />
                  <circle cx="141" cy="40" r="11" fill="#F3E7D0" opacity="0.85" />
                  <path d="M0 96 L34 62 L60 88 L84 58 L112 96 Z" fill="#6E6656" opacity="0.72" />
                  <path d="M76 128 L118 54 L160 128 Z" fill="#4A463C" opacity="0.86" />
                  <path d="M140 128 L176 74 L200 108 L200 128 Z" fill="#37342D" opacity="0.9" />
                  <rect y="112" width="200" height="16" fill="#2B2823" opacity="0.55" />
                </svg>
              </div>

              {/* The certificate chip */}
              <div className="absolute bg-white rounded-card"
                   style={{ right: "-2%", bottom: "2%", width: "62%", padding: "15px 17px",
                            border: "1px solid rgba(26,24,21,0.10)",
                            boxShadow: "0 26px 54px -26px rgba(26,24,21,0.55)" }}>
                <p className="text-[8.5px] tracking-[0.2em] uppercase text-ash mb-2.5">Proof of existence</p>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center rounded-full shrink-0"
                        style={{ width: 22, height: 22, background: "#2E6B4E" }}>
                    <Icon name="check" className="text-white" style={{ fontSize: 12 }} />
                  </span>
                  <p className="text-[14px] font-semibold text-ink">Timestamped</p>
                </div>
                <p className="mt-2.5 text-[11px] text-ash">{PROOF_SAMPLE_STAMP}</p>
                <p className="text-[11px] text-ash">Bitcoin (via OpenTimestamps)</p>
              </div>
            </div>
          </div>

          {/* ── How it works ──────────────────────────────── */}
          <div className="mt-24 pt-14" style={{ borderTop: "1px solid #E5E0D5" }}>
            <p className="eyebrow mb-12">How it works</p>

            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-4">
              {[
                { icon: "file-text",        label: "Upload your deck",      sub: "A PDF. It stays in private storage." },
                { icon: "fingerprint",      label: "We take a fingerprint", sub: "A unique code (SHA-256) for your file." },
                { icon: "currency-bitcoin", label: "We record it on Bitcoin", sub: "Where nobody can change or delete it." },
                { icon: "certificate",      label: "You get a certificate", sub: "Instantly, with a link anyone can verify." },
              ].map((s, i, all) => (
                <li key={s.label} className="relative">
                  <div className="flex items-center gap-3.5 mb-4">
                    <span className="flex items-center justify-center rounded-full text-[11px] text-ash shrink-0"
                          style={{ width: 26, height: 26, background: "#F1EDE4" }}>
                      {i + 1}
                    </span>
                    <Icon name={s.icon} className="text-ink" style={{ fontSize: 26 }} />

                    {/* Connector, on wide screens only: on a narrow column the
                        steps stack, and an arrow pointing right would be a lie. */}
                    {i < all.length - 1 && (
                      <Icon name="arrow-right"
                            className="hidden lg:block text-ash/35 absolute"
                            style={{ fontSize: 18, right: 12, top: 4 }} />
                    )}
                  </div>
                  <p className="text-[14px] font-semibold text-ink mb-1.5 pr-6">{s.label}</p>
                  <p className="text-[13px] leading-[1.6] text-ash pr-6">{s.sub}</p>
                </li>
              ))}
            </ol>
          </div>

        </div>
      </section>

      {/* FOR FILMMAKERS */}
      <section className="bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="grid md:grid-cols-2 gap-16 md:gap-28 items-start">

            {/* Left — copy */}
            <div>
              <p className="eyebrow text-gold mb-4">For filmmakers</p>
              <h2 className="font-display text-[32px] md:text-[44px] leading-tight mb-6">
                Find the funding your film deserves.
              </h2>
              <p className="text-[17px] leading-relaxed text-ash mb-10">
                Submit your project once. The engine scores every live grant, fund, lab,
                co-production and market worldwide against it — and tells you exactly
                why each one fits and what to strengthen when it doesn't.
              </p>
              <div className="mb-10">
                {[
                  oppLabel ? `Match scores across ${oppLabel} verified opportunities` : "Match scores across every verified opportunity",
                  "Filter by budget, stage, territory and deadline",
                  "Apply in two clicks and track every submission",
                  "Field direct offers from approved producers and investors",
                ].map((item) => (
                  <div key={item} className="hairline pt-4 pb-1 text-[14px] text-ash">{item}</div>
                ))}
              </div>
              <Link href="/signup" className="btn-gold">Submit your project</Link>
            </div>

            {/* Right — opportunity preview */}
            <div>
              <p className="eyebrow mb-8">Matched opportunities</p>
              {[
                { title: "3 MEDIA / Creative Europe",  meta: "Development Lab · Deadline 30 Jun",  score: 85 },
                { title: "Torino FilmLab",              meta: "Production Grant · Deadline 1 Dec",  score: 79 },
                { title: "Hubert Bals Fund",            meta: "Film Fund · Deadline TBA 2026",      score: 78 },
              ].map((opp) => (
                <div key={opp.title} className="hairline py-5 flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <p className="text-[15px] mb-1.5">{opp.title}</p>
                    <p className="text-[12px] tracking-[0.13em] uppercase text-ash">{opp.meta}</p>
                  </div>
                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[13px] text-gold"
                    style={{ border: "1px solid rgba(191,153,83,0.35)" }}
                  >
                    {opp.score}
                  </div>
                </div>
              ))}
              <p className="mt-6 text-[11px] tracking-[0.18em] uppercase text-ash/50">
                Free for filmmakers — no verification needed
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* FOR PRODUCERS */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="grid md:grid-cols-2 gap-16 md:gap-28 items-start">

            {/* Left — copy */}
            <div>
              <p className="eyebrow text-gold mb-4">For producers</p>
              <h2 className="font-display text-[32px] md:text-[44px] leading-tight mb-6">
                Discover projects that fit your slate.
              </h2>
              <p className="text-[17px] leading-relaxed text-ash mb-10">
                Browse verified filmmaker projects by genre, stage, language and
                territory. Approval-only access means every filmmaker you contact
                is serious, working, and ready to pitch.
              </p>
              <div className="mb-10">
                {[
                  "Filter the project showcase by genre, format and territory",
                  "Request scripts and pitch decks through access control",
                  "Send structured co-production, investment or acquisition offers",
                  "Every project submitted through the PITCH.FYLYM engine",
                ].map((item) => (
                  <div key={item} className="hairline pt-4 pb-1 text-[14px] text-ash">{item}</div>
                ))}
              </div>
              <Link href="/signup?role=producer" className="btn-ghost">Join as producer</Link>
            </div>

            {/* Right — project showcase preview */}
            <div>
              <p className="eyebrow mb-8">Project showcase</p>
              {[
                { title: "The Monsoon Letters", meta: "Drama · Hindi · Development",           score: 94 },
                { title: "Neon Shadows",         meta: "Thriller · Japanese · Post-production", score: 87 },
                { title: "Soil & Sky",           meta: "Documentary · Swahili · Production",    score: 82 },
              ].map((proj) => (
                <div key={proj.title} className="hairline py-5 flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <p className="font-display text-[18px] mb-1.5">{proj.title}</p>
                    <p className="text-[12px] tracking-[0.13em] uppercase text-ash">{proj.meta}</p>
                  </div>
                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[13px] text-gold"
                    style={{ border: "1px solid rgba(191,153,83,0.35)" }}
                  >
                    {proj.score}
                  </div>
                </div>
              ))}
              <p className="mt-6 text-[11px] tracking-[0.18em] uppercase text-ash/50">
                Private projects unlock after verification
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* TRENDING PROJECTS TICKER */}
      <ProducerProjectTicker projects={trendingProjects} />

      {/* TESTIMONIALS */}
      <section className="bg-deep text-ivory">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="eyebrow mb-12">From the community</p>
          <div className="grid md:grid-cols-2 gap-16">
            <blockquote>
              <p className="font-display italic text-[22px] md:text-[26px] leading-snug">
                "For the first time I could see, in one ranked list, every fund my
                Wayanad-set feature was actually eligible for — with the deadlines."
              </p>
              <footer className="mt-6 text-[12px] tracking-[0.2em] uppercase text-gold">Independent director — Kerala, India</footer>
            </blockquote>
            <blockquote>
              <p className="font-display italic text-[22px] md:text-[26px] leading-snug">
                "As a producer I only see projects that fit my slate. No noise,
                verified filmmakers, scripts behind access control. That's rare."
              </p>
              <footer className="mt-6 text-[12px] tracking-[0.2em] uppercase text-gold">Co-production executive — Europe</footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* BETA */}
      <section id="beta" className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <div className="hairline-gold pt-10 max-w-2xl">
          <p className="eyebrow mb-4">Public beta</p>
          <h2 className="font-display text-[32px] md:text-[44px] leading-tight">Free while we build in the open.</h2>
          <p className="mt-6 text-[17px] leading-[1.7] text-ash">
            PITCH.FYLYM is in public beta. Matching, applications, producer discovery and
            proof of existence — every feature is free for filmmakers and producers during
            this period. Your feedback shapes what comes next.
          </p>
          <div className="mt-10 flex items-center gap-6">
            <Link href="/signup" className="btn-gold">Join the beta</Link>
            <a href="mailto:hello@fylym.com" className="text-[14px] text-ash underline underline-offset-4 decoration-ash/40 hover:text-ink">Share feedback</a>
          </div>
          <p className="mt-8 text-[13px] text-ash">Producer and investor accounts require verification.</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-24 md:py-32">
          <p className="eyebrow mb-4">FAQ</p>
          <h2 className="font-display text-[32px] md:text-[40px]">Questions, answered.</h2>
          <div className="mt-12">
            {FAQS.map(([q, a]) => (
              <details key={q} className="hairline py-5 group">
                <summary className="cursor-pointer list-none flex justify-between items-center font-normal text-[16px]">
                  {q}
                  <span className="text-gold ml-6 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-4 text-[21px] leading-[1.7] text-ash">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT — closing invitation to the supply side.
          A parchment panel so it separates from the ivory FAQ above without
          adding a third dark band to the page. The gold top rule is the same
          device used on the transactional emails. */}
      <section id="contact" className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        <div
          className="rounded-card overflow-hidden"
          style={{ background: "#F1EDE4", border: "1px solid #E5E0D5" }}
        >
          <div style={{ height: 3, background: "#BF9953" }} />

          <div className="px-8 py-14 md:px-16 md:py-20 text-center">
            <p className="eyebrow mb-6">For funders and producers</p>

            <h2 className="font-display text-[30px] md:text-[42px] leading-[1.15] font-normal max-w-2xl mx-auto text-balance">
              If you fund or produce films, filmmakers should be able to{" "}
              <span className="italic text-gold">find you.</span>
            </h2>

            {/* Makes "an opportunity" concrete without a paragraph explaining it */}
            <p className="mt-8 text-[11px] tracking-[0.18em] uppercase text-ash">
              Grants <span className="text-gold">·</span> Funds <span className="text-gold">·</span> Labs{" "}
              <span className="text-gold">·</span> Markets <span className="text-gold">·</span> Co-productions{" "}
              <span className="text-gold">·</span> Producer calls
            </p>

            {/* Two paths, because the code has two. submitPublicOpportunity takes
                anyone and queues the listing as pending/inactive.
                createProducerOpportunity requires an approved producer and writes
                it live, attributed, and notifies filmmakers — so routing producers
                to the public form would hand them the worse of the two. */}
            <div className="grid md:grid-cols-2 gap-px mt-12 text-left rounded-card overflow-hidden"
                 style={{ background: "#E5E0D5", border: "1px solid #E5E0D5" }}>

              <div className="bg-ivory px-7 py-8 flex flex-col">
                <p className="eyebrow mb-3">Festivals, funds &amp; institutions</p>
                <p className="text-[15px] leading-[1.65] text-ink mb-6 grow">
                  Submit a grant, lab or fund. We check it and add it to the database.
                </p>
                <Link href="/opportunities/submit" className="btn-gold self-start">
                  List an opportunity
                </Link>
                <p className="mt-4 text-[12px] text-ash">No account needed.</p>
              </div>

              <div className="bg-ivory px-7 py-8 flex flex-col">
                <p className="eyebrow mb-3">Producers &amp; production companies</p>
                <p className="text-[15px] leading-[1.65] text-ink mb-6 grow">
                  Post from your producer profile. Once you&rsquo;re verified, your call
                  goes live straight away — and filmmakers are notified.
                </p>
                <Link href="/signup?role=producer" className="btn-ghost self-start">
                  Create a producer account
                </Link>
                <p className="mt-4 text-[12px] text-ash">Verification is free.</p>
              </div>

            </div>

            {/* Pass it on. Shares /list, the standalone version of this block,
                so the recipient lands on the invitation rather than the
                bottom of the homepage. */}
            <div className="mt-10 flex flex-col items-center gap-4">
              <p className="text-[13px] text-ash">
                Know a fund, festival or producer who should be listed?
              </p>
              <ShareLinkButton
                path="/list"
                title="List your fund or producer call on PITCH.FYLYM"
                text="If you fund or produce films, filmmakers should be able to find you. Listing on PITCH.FYLYM is free."
              />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </main>
    </RoleProvider>
  );
}
