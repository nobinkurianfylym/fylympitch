import { cache, Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { Footer } from "@/components/Footer";
import ShareLinkButton from "@/components/ShareLinkButton";
import HomepageDemo from "@/components/HomepageDemo";
import { FilmmakerMatchesLive } from "@/components/FilmmakerMatchesPreview";
import { ProducerShowcaseLive } from "@/components/ProducerShowcasePreview";
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
 * Holds the space of a streamed section while its data arrives, so nothing
 * below it jumps when it lands. On a warm cache the section is ready before
 * the page is sent and this is never seen.
 */
function SectionHold({ className }: { className: string }) {
  return <div aria-hidden="true" className={className} />;
}

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
  { num: "01", title: "Add your film",
    body: "Title, logline, budget, deck. About ten minutes." },
  { num: "02", title: "See which funds fit",
    body: "Scored against %OPPS%funds worldwide. You see which fit, and why." },
  { num: "03", title: "Get seen by producers",
    body: "Producers hunting their next film find you and make contact." },
  { num: "04", title: "Apply and keep track",
    body: "Deadlines, materials and submissions in one place." },
];

const FAQS = [
  ["Who can see my script and pitch deck?", "It depends how you submit your project. Public projects are visible to everyone browsing PITCH.FYLYM. Private projects are visible only to you, PITCH.FYLYM administrators, and industry accounts that have been individually verified and approved. Files live in private storage with row-level access control — there are no public links to private materials."],
  ["How is the match score calculated?", "Eight weighted criteria totalling 100 points: genre (20), stage (20), territory (15), budget (15), format (10), funding gap (10), language (5) and historical success (5). Anything under 50 is hidden, so you only see real prospects. A criterion the fund never published scores partial credit rather than full marks, and the page tells you which ones those were."],
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
  //
  // Only what the header and hero need is awaited here. The engine-driven
  // sections further down (the engine demo, "For filmmakers", "For
  // producers") load their own data inside <Suspense>, so the top of the page
  // is sent as soon as it is ready instead of waiting on the slowest section.
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
      {/* PLATFORM
          Was ~1,180px: an opening, four steps wearing icon circles, a separate
          "The idea" block with a decorative join, then the button. Four things
          competing to be read first, and the button sat after all of them, so
          anyone already convinced had to scroll past the explanation to act.

          Now one glance. The claim and the button hold the left column, the
          four steps stack on the right. "The idea" folded into the supporting
          line, because the headline was already making that argument. */}
      <section id="features" className="bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-12 md:gap-16 items-start">

            <div>
              <p className="eyebrow mb-5">Platform</p>
              <h2 className="font-display text-[34px] md:text-[44px] leading-[1.08] font-normal">
                You add the film pitch.<br className="hidden md:block" />{" "}
                <span className="italic text-gold">We find the funds.</span>
              </h2>
              <p className="mt-5 text-[16px] leading-[1.7] text-ash max-w-md">
                Filmmakers need funding. Producers need stories. This is where
                they meet.
              </p>
              <Link href="/signup" className="btn-gold mt-8 inline-block">
                Create your free account
              </Link>
            </div>

            <ol>
              {STEPS.map((s, i) => (
                <li key={s.num}
                    className={`flex gap-4 py-4 ${i === 0 ? "" : "border-t border-line"}`}>
                  <span className="font-display text-[15px] text-gold shrink-0 w-6 leading-[1.6]">
                    {s.num}
                  </span>
                  <div>
                    <p className="text-[14.5px] font-semibold leading-snug">{s.title}</p>
                    <p className="mt-1 text-[13.5px] leading-[1.6] text-ash">
                      {s.body.replace("%OPPS%", oppLabel ? oppLabel + " " : "")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <Suspense fallback={<SectionHold className="min-h-[760px]" />}>
          <HomepageDemo />
        </Suspense>
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
                  // NOT "we store only a fingerprint": the platform does store
                  // the PDF, in the private pitch-decks bucket, because a
                  // producer has to be able to read it. Only the PROOF is
                  // fingerprint-only — proofUtils hashes in the browser and
                  // posts the digest, so the file never reaches the timestamp.
                  // The old line contradicted step 1 below on the same screen.
                  { icon: "lock",         label: "Private",
                    sub: "Your file stays in private storage. Only its fingerprint is published." },
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
            <div className="relative mx-auto w-full max-w-[420px] aspect-[4/3.6]" aria-hidden>

              {/* The poster.
                  This replaced a cover drawn in CSS with a typographic title
                  and an SVG landscape, which existed only because there was no
                  artwork to use. There is now: a real film, so the section
                  shows a real one. Held at 2:3 by aspect-ratio rather than a
                  fixed height, so the artwork is never squeezed. */}
              <div className="absolute overflow-hidden"
                   style={{ left: "8%", top: "0%", width: "60%",
                            aspectRatio: "1448 / 2048",
                            borderRadius: "3px 6px 6px 3px",
                            transform: "rotate(-4deg)",
                            boxShadow: "0 40px 70px -34px rgba(26,24,21,0.65), 0 2px 0 rgba(26,24,21,0.06)" }}>
                <img
                  src="/proof/end-of-the-day.webp"
                  alt="Poster for End of the Day, a feature film by Green Pepper Productions"
                  width={560}
                  height={792}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {/* Spine shadow, so it still reads as a bound document rather
                    than a flat rectangle pasted on the page. */}
                <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: 9,
                     background: "linear-gradient(90deg,rgba(26,24,21,0.28),transparent)" }} />
              </div>

              {/* The certificate chip */}
              <div className="absolute bg-white rounded-card"
                   style={{ right: "0%", bottom: "4%", width: "54%", padding: "15px 17px",
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

            {/* Right — real matches for a real public pitch, with funder logos */}
            <Suspense fallback={<SectionHold className="min-h-[520px]" />}>
              <FilmmakerMatchesLive />
            </Suspense>

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
                Browse independent projects by genre, stage, language and
                territory. Every pitch arrives with its logline, budget, stage and
                materials in one place, scored by the PITCH.FYLYM engine.
              </p>
              <div className="mb-10">
                {[
                  "Filter the showcase by genre, format, language and territory",
                  "Open the pitch decks and scripts filmmakers share with you",
                  "Send structured co-production, investment, distribution or acquisition offers",
                  "Save projects to your pipeline and track every conversation",
                ].map((item) => (
                  <div key={item} className="hairline pt-4 pb-1 text-[14px] text-ash">{item}</div>
                ))}
              </div>
              <Link href="/signup?role=producer" className="btn-ghost">Join as producer</Link>
            </div>

            {/* Right — real public pitches with their posters */}
            <Suspense fallback={<SectionHold className="min-h-[440px]" />}>
              <ProducerShowcaseLive />
            </Suspense>

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
