import { cookies } from "next/headers";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { Footer } from "@/components/Footer";
import ListShareButton from "@/components/ListShareButton";
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
import { Icon } from "@/components/Icon";

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

  // Live opportunity count for on-page copy — same source PlatformMetrics uses
  // (latest daily snapshot, with a live count fallback). Floored so the copy
  // never claims more opportunities than actually exist.
  let oppCount = 0;
  try {
    const { data: snap } = await supabase
      .from("platform_metrics")
      .select("active_opportunities")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    oppCount = (snap as any)?.active_opportunities ?? 0;
    if (!oppCount) {
      const { count } = await supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      oppCount = count ?? 0;
    }
  } catch { oppCount = 0; }
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
        <HeroToggle isLoggedIn={!!user} accountRole={accountRole} oppLabel={oppLabel} />
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

      {/* — Hero: dark — */}
      <section className="bg-deep text-ivory">
        <div className="max-w-3xl mx-auto px-6 pt-24 md:pt-32 pb-16 text-center">

          <p className="text-[10px] tracking-[0.28em] uppercase text-ivory/40 mb-5">
            The safest place to submit your film
          </p>
          <p className="eyebrow text-gold mb-8">Proof of existence</p>

          <h2 className="font-display text-[30px] md:text-[46px] leading-[1.12] font-normal mb-8">
            Time-stamped{" "}
            <span className="italic text-gold">the moment you submit.</span>
          </h2>

          <p className="text-[16px] leading-[1.8] text-ivory/50 mb-5 max-w-xl mx-auto">
            We record a fingerprint of your deck on Bitcoin &mdash; a permanent,
            independent record of the date your version existed. Your file never
            leaves your account.
          </p>

          <p className="text-[16px] leading-[1.8] text-ivory/50 mb-6 max-w-xl mx-auto">
            If authorship is ever disputed, that&rsquo;s dated evidence you can
            produce: exactly what you had, and when. Not our word for it &mdash;
            a record neither we nor anyone else can alter.
          </p>

          {/* Says the limit out loud. A timestamp is evidence of date, not
              ownership, and copyright registration is a separate thing — the
              Terms page says so, and this line keeps the two in step. */}
          <p className="text-[13px] leading-[1.7] text-ivory/35 mb-10 max-w-xl mx-auto">
            Supports a copyright claim by establishing when your version existed.
            It is evidence of date, not a substitute for registration.
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
            Timestamp your deck →
          </Link>

        </div>

        {/* How it works, the certificate and the trust row — same ground, so the
            whole proof story reads as one chapter rather than three bands. */}
        <div className="max-w-5xl mx-auto px-6 pb-20 md:pb-24">

          {/* Steps */}
          <p className="eyebrow text-center mb-14" style={{ color: "rgba(245,245,247,0.45)" }}>How it works</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {[
              { icon: "file-text",       label: "Upload your deck",    sub: "A PDF. It stays in private storage.",          gold: false },
              { icon: "fingerprint",     label: "We take a fingerprint", sub: "A short code unique to your file.",           gold: false },
              { icon: "currency-bitcoin",label: "We record it on Bitcoin", sub: "Where nobody can change or delete it.",     gold: true  },
              { icon: "certificate",     label: "You get a certificate", sub: "Instantly, with a link anyone can check.",     gold: false },
            ].map((step) => (
              <div key={step.label} className="flex flex-col items-center text-center">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center mb-4 shrink-0"
                  style={{
                    background: step.gold ? "#BF9953" : "rgba(245,245,247,0.07)",
                    border: step.gold ? "none" : "1px solid rgba(245,245,247,0.14)",
                  }}
                >
                  <Icon name={step.icon} className={step.gold ? "text-deep" : "text-ivory"} style={{ fontSize: 18 }} />
                </div>
                <p className="text-[12px] font-semibold text-ivory leading-snug mb-2">{step.label}</p>
                <p className="text-[11px] text-ivory/45 leading-relaxed">{step.sub}</p>
              </div>
            ))}
          </div>

          {/* Proof certificate card */}
          <div
            className="bg-white rounded-card mx-auto mb-14 max-w-md"
            style={{
              border: "1px solid rgba(26,24,21,0.1)",
              padding: "24px 28px",
              boxShadow: "0 24px 60px -30px rgba(0,0,0,0.75)",
            }}
          >
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[9px] tracking-[0.2em] uppercase text-ash mb-2">Proof of existence</p>
                <p className="text-[12px] text-ash leading-snug">
                  Your deck&rsquo;s fingerprint is now<br />recorded on Bitcoin.
                </p>
              </div>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ml-4"
                style={{ background: "#22c55e" }}
              >
                <Icon name="check" className="text-white" style={{ fontSize: 13 }} />
              </div>
            </div>

            <div className="space-y-3" style={{ borderTop: "1px solid rgba(26,24,21,0.08)", paddingTop: 16 }}>
              {[
                { icon: "clock",            iconCls: "text-ash",  label: "Timestamp",      value: "May 25, 2025 · 10:48 AM IST",  mono: false, green: false },
                { icon: "currency-bitcoin", iconCls: "text-gold", label: "Blockchain",     value: "Bitcoin (via OpenTimestamps)", mono: false, green: false },
                { icon: "hash",             iconCls: "text-ash",  label: "Transaction ID", value: "b4f7c2...8e9a1d7",             mono: true,  green: false },
                { icon: "shield-check",     iconCls: "text-ash",  label: "Status",         value: "Confirmed",                   mono: false, green: true  },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <Icon name={row.icon} className={`${row.iconCls} shrink-0`} style={{ fontSize: 14 }} />
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
                <Icon name="shield" className="text-gold" style={{ fontSize: 12 }} />
                <span className="text-[9px] tracking-[0.14em] uppercase font-semibold text-ink">PITCH.FYLYM</span>
              </div>
            </div>
          </div>

          {/* Trust signals */}
          <div
            className="grid grid-cols-3"
            style={{ border: "1px solid rgba(245,245,247,0.12)", borderRadius: 8, overflow: "hidden" }}
          >
            {[
              { icon: "lock",         label: "Private",   sub: "We store the fingerprint, never your file."   },
              { icon: "shield-check", label: "Permanent", sub: "Nobody can change the record. Not even us."    },
              { icon: "world",        label: "Checkable", sub: "Anyone can verify it, from anywhere, anytime." },
            ].map((item, i) => (
              <div
                key={item.label}
                className="p-5"
                style={{ borderLeft: i > 0 ? "1px solid rgba(245,245,247,0.12)" : undefined }}
              >
                <Icon name={item.icon} className="text-gold" style={{ fontSize: 20, display: "block", marginBottom: 10 }} />
                <p className="text-[12px] font-semibold text-ivory mb-1.5">{item.label}</p>
                <p className="text-[11px] text-ivory/45 leading-relaxed">{item.sub}</p>
              </div>
            ))}
          </div>

        </div>

        {/* Closing line — inside the same ground, separated by a hairline
            rather than by a change of background. */}
        <div className="max-w-5xl mx-auto px-6 pb-24">
          <div className="pt-10 text-center" style={{ borderTop: "1px solid rgba(245,245,247,0.10)" }}>
            <p className="font-display text-[18px] md:text-[22px] text-ivory/90">
              Your idea. Your creation. Your proof.{" "}
              <span className="italic text-gold">Forever.</span>
            </p>
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
              <ListShareButton />
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
