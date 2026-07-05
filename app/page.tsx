import { cookies } from "next/headers";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { Footer } from "@/components/Footer";
import HomepageDemo from "@/components/HomepageDemo";
import HeroToggle from "@/components/HeroToggle";

export const dynamic = "force-dynamic";
import IntelligenceTicker from "@/components/IntelligenceTicker";
import PlatformMetrics from "@/components/PlatformMetrics";
import { RoleProvider, type Role } from "@/components/RoleProvider";
import HeaderRoleToggle from "@/components/HeaderRoleToggle";
import HeaderCTA from "@/components/HeaderCTA";
import { createClient } from "@/lib/supabase/server";
import ProducerProjectTicker from "@/components/ProducerProjectTicker";

const STEPS = [
  {
    num: "01",
    icon: "ti-file-pencil",
    title: "Create Your Project",
    body: "Build a professional project profile — logline, synopsis, budget, pitch deck, cast and crew. Your film, presented at its best.",
  },
  {
    num: "02",
    icon: "ti-target",
    title: "Match With Global Opportunities",
    body: "The PITCH.FYLYM ENGINE™ scores your project against 1,000+ grants, funds, labs, investors, studios and co-productions worldwide — and tells you exactly why each one fits.",
  },
  {
    num: "03",
    icon: "ti-eye",
    title: "Get Discovered by Producers",
    body: "Make your project visible to producers actively searching for their next film — whether they're seeking financing, co-production partners, or creative attachment.",
  },
  {
    num: "04",
    icon: "ti-movie",
    title: "Turn Projects Into Productions",
    body: "Connect with the right people, unlock funding, build lasting partnerships. Move your film from development to the screen.",
  },
];

const FAQS = [
  ["Who can see my script and pitch deck?", "Only you, PITCH.FYLYM administrators, and industry accounts that have been individually verified and approved. Files live in private storage with row-level access control — there are no public links."],
  ["How is the match score calculated?", "Eight weighted criteria totalling 100 points: genre (20), stage (20), territory (15), budget (15), format (10), funding gap (10), language (5) and historical success (5). Anything under 60 is hidden so you only see real prospects."],
  ["Is PITCH.FYLYM free for filmmakers?", "Yes. The platform is in public beta and every feature is free for filmmakers and producers during this period."],
  ["How do producers and investors join?", "Sign up with a single Google account — you automatically get access to both the filmmaker dashboard and the producer studio. One login, both sides of the table."],
];

export default async function Home() {
  const cookieStore = await cookies();
  const rawRole = cookieStore.get("fyp_role")?.value;

  // Auth + projects in parallel
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch profile role + producer status (parallel, skip if not logged in)
  let accountRole = "FILMMAKER";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const dbRole = (profile as any)?.role ?? "filmmaker";
    if (dbRole === "admin")    accountRole = "ADMIN";
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
  let trendingProjects: {
    id: string; title: string; genre: string; format: string;
    stage: string; country: string; budget: string; seeking: string;
  }[] = [];
  try {
    const { data: raw } = await supabase
      .from("projects")
      .select("id, title, genre, format, stage, country, budget_usd")
      .eq("is_public", true)
    .is("target_producer_id", null)
      .order("created_at", { ascending: false })
      .limit(40);
    trendingProjects = (raw ?? []).map((p: any) => {
      const usd: number | null = p.budget_usd;
      const budget = !usd ? "TBC"
        : usd >= 1_000_000 ? `$${(usd / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
        : usd >= 1_000    ? `$${Math.round(usd / 1_000)}K`
        : `$${Math.round(usd)}`;
      const seeking: Record<string, string> = {
        development: "Co-Producer", pre_production: "Producer",
        production: "Line Producer", post_production: "Sales Agent", completed: "Distribution",
      };
      return {
        id: p.id, title: p.title, genre: p.genre, format: p.format,
        stage: p.stage, country: p.country ?? "International",
        budget, seeking: seeking[p.stage] ?? "Producer",
      };
    });
  } catch { /* ticker shows empty state gracefully */ }

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
            <HeaderRoleToggle isLoggedIn={!!user} isAdmin={isAdmin} />
            <HeaderCTA
              isLoggedIn={!!user}
              userName={user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ""}
              avatarUrl={user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? ""}
              accountRole={accountRole}
            />
          </div>
        </header>

        {/* HERO — grows to fill remaining viewport */}
        <HeroToggle isLoggedIn={!!user} accountRole={accountRole} />
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
              Every great film starts with<br className="hidden md:block" />{" "}
              <span className="italic text-gold">the right discovery.</span>
            </h2>
            <p className="mt-6 text-[18px] leading-[1.7] text-ash max-w-xl">
              Every year, exceptional films go unmade — not for lack of vision,
              but for lack of the right introduction.
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
                    <i className={`ti ${s.icon} text-gold`} style={{ fontSize: 16 }} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-ash/50 mb-2">{s.num}</p>
                    <h3 className="font-display text-[22px] font-normal mb-3">{s.title}</h3>
                    <p className="text-[16px] leading-[1.7] text-ash">{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Closing */}
          <div className="mt-24 border-t border-line pt-16 text-center">
            <p className="eyebrow mb-5">One Platform. Two Needs. One Mission.</p>
            <p className="font-display text-[28px] md:text-[38px] leading-tight font-normal italic max-w-2xl mx-auto">
              "Filmmakers need funding. Producers need stories.<br className="hidden md:block" />
              PITCH.FYLYM is where both discover each other."
            </p>
            <Link href="/signup" className="btn-gold mt-10 inline-block">
              Create your free account
            </Link>
          </div>

        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <HomepageDemo />
      </section>

      {/* PROOF OF EXISTENCE */}

      {/* — Hero: dark — */}
      <section className="bg-deep text-ivory">
        <div className="max-w-3xl mx-auto px-6 py-24 md:py-32 text-center">

          <p className="text-[10px] tracking-[0.28em] uppercase text-ivory/30 mb-5">
            The most trusted place to submit your film project
          </p>
          <p className="eyebrow text-gold mb-8">Proof of Existence</p>

          <h2 className="font-display text-[30px] md:text-[46px] leading-[1.12] font-normal mb-8">
            Before your project reaches a producer, it receives a permanent,{" "}
            <span className="italic text-gold">Bitcoin-verified proof of its existence.</span>
          </h2>

          <p className="text-[16px] leading-[1.8] text-ivory/50 mb-10 max-w-xl mx-auto">
            Your project is never exposed. Only its unique digital fingerprint is
            recorded — permanent, independent, and verifiable by anyone on earth.
          </p>

          <div
            className="inline-flex flex-wrap justify-center items-center gap-x-5 gap-y-2 mb-10 px-6 py-4"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-[10px] tracking-[0.22em] uppercase text-gold/60">SHA-256</span>
            <span className="font-mono text-[12px] text-ivory/40 tracking-wider">3a7f2c9b·1e48d6f2·a09c3b7e···</span>
            <span className="text-[10px] tracking-[0.15em] uppercase text-ivory/30">Block #893,441</span>
            <span className="text-[10px] tracking-[0.15em] uppercase text-ivory/30">14 Jun 2025 · 09:41 UTC</span>
          </div>

          <Link href="/signup" className="btn-gold">
            Timestamp Your Pitch Deck →
          </Link>

        </div>
      </section>

      {/* — How it works + Certificate + Trust signals: light — */}
      <section className="bg-ivory">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">

          {/* Steps */}
          <p className="eyebrow text-center mb-14">How it works</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {[
              { icon: "ti-file-text",       label: "Upload your pitch deck", sub: "PDF only. Your file never leaves our servers.", gold: false },
              { icon: "ti-fingerprint",     label: "Fingerprint created",    sub: "A unique SHA-256 hash of your document.",        gold: false },
              { icon: "ti-currency-bitcoin",label: "Anchored to Bitcoin",    sub: "Via OpenTimestamps. Permanent, immutable.",        gold: true  },
              { icon: "ti-certificate",     label: "Certificate issued",     sub: "Instant. Includes a public verification link.",  gold: false },
            ].map((step) => (
              <div key={step.label} className="flex flex-col items-center text-center">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center mb-4 shrink-0"
                  style={{ background: step.gold ? "#BF9953" : "#1A1815" }}
                >
                  <i className={`ti ${step.icon} text-ivory`} style={{ fontSize: 18 }} aria-hidden="true" />
                </div>
                <p className="text-[12px] font-semibold text-ink leading-snug mb-2">{step.label}</p>
                <p className="text-[11px] text-ash leading-relaxed">{step.sub}</p>
              </div>
            ))}
          </div>

          {/* Proof certificate card */}
          <div
            className="bg-white rounded-card mx-auto mb-14 max-w-md"
            style={{ border: "1px solid rgba(26,24,21,0.1)", padding: "24px 28px" }}
          >
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[9px] tracking-[0.2em] uppercase text-ash mb-2">Proof of Existence</p>
                <p className="text-[12px] text-ash leading-snug">
                  Your pitch deck fingerprint has been<br />anchored to the Bitcoin blockchain.
                </p>
              </div>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ml-4"
                style={{ background: "#22c55e" }}
              >
                <i className="ti ti-check text-white" style={{ fontSize: 13 }} aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-3" style={{ borderTop: "1px solid rgba(26,24,21,0.08)", paddingTop: 16 }}>
              {[
                { icon: "ti-clock",            iconCls: "text-ash",  label: "Timestamp",      value: "May 25, 2025 · 10:48 AM IST",  mono: false, green: false },
                { icon: "ti-currency-bitcoin", iconCls: "text-gold", label: "Blockchain",     value: "Bitcoin (via OpenTimestamps)", mono: false, green: false },
                { icon: "ti-hash",             iconCls: "text-ash",  label: "Transaction ID", value: "b4f7c2...8e9a1d7",             mono: true,  green: false },
                { icon: "ti-shield-check",     iconCls: "text-ash",  label: "Status",         value: "Confirmed",                   mono: false, green: true  },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <i className={`ti ${row.icon} ${row.iconCls} shrink-0`} style={{ fontSize: 14 }} aria-hidden="true" />
                  <div>
                    <p className="text-[9px] tracking-[0.12em] uppercase text-ash mb-0.5">{row.label}</p>
                    <p className={`text-[12px] font-medium ${row.green ? "text-green-600" : "text-ink"} ${row.mono ? "font-mono" : ""}`}>
                      {row.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="flex justify-between items-center mt-4 pt-3"
              style={{ borderTop: "1px solid rgba(26,24,21,0.08)" }}
            >
              <p className="font-display italic text-[11px] text-ash">Signed</p>
              <div className="flex items-center gap-1.5">
                <i className="ti ti-shield text-gold" style={{ fontSize: 12 }} aria-hidden="true" />
                <span className="text-[9px] tracking-[0.14em] uppercase font-semibold text-ink">PITCH.FYLYM</span>
              </div>
            </div>
          </div>

          {/* Trust signals */}
          <div
            className="grid grid-cols-3"
            style={{ border: "1px solid rgba(26,24,21,0.1)", borderRadius: 8, overflow: "hidden" }}
          >
            {[
              { icon: "ti-lock",         label: "Private",      sub: "Your content stays secure. Only the fingerprint is stored." },
              { icon: "ti-shield-check", label: "Tamper-proof", sub: "No one can alter the record. Not even us."                   },
              { icon: "ti-world",        label: "Verifiable",   sub: "Anyone can verify independently, anytime, anywhere."         },
            ].map((item, i) => (
              <div
                key={item.label}
                className="p-5"
                style={{ borderLeft: i > 0 ? "1px solid rgba(26,24,21,0.1)" : undefined }}
              >
                <i className={`ti ${item.icon} text-ink`} style={{ fontSize: 20, display: "block", marginBottom: 10 }} aria-hidden="true" />
                <p className="text-[12px] font-semibold text-ink mb-1.5">{item.label}</p>
                <p className="text-[11px] text-ash leading-relaxed">{item.sub}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* — Tagline: dark — */}
      <section className="bg-ink">
        <div className="max-w-3xl mx-auto px-6 py-10 text-center">
          <p className="font-display text-[18px] md:text-[22px] text-ivory/90">
            Your idea. Your creation. Your proof.{" "}
            <span className="italic text-gold">Forever.</span>
          </p>
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
                  "Match scores across 1,000+ verified opportunities",
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
                Full access requires filmmaker verification
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
                Full producer access — no approval needed
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

      {/* CONTACT */}
      <section id="contact" className="max-w-6xl mx-auto px-6 py-24">
        <div className="hairline-gold pt-10 md:flex items-end justify-between gap-12">
          <div>
            <p className="eyebrow mb-4">Contact</p>
            <h2 className="font-display text-[28px] md:text-[36px] max-w-lg leading-tight">
              Festivals, funds and institutions — list your programme on PITCH.FYLYM.
            </h2>
          </div>
          <a href="mailto:hello@fylym.com" className="btn-ghost mt-8 md:mt-0 shrink-0">Write to us</a>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </main>
    </RoleProvider>
  );
}
