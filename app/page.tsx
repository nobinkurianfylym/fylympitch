import { cookies } from "next/headers";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import HomepageDemo from "@/components/HomepageDemo";
import HeroToggle from "@/components/HeroToggle";

export const dynamic = "force-dynamic";
import IntelligenceTicker from "@/components/IntelligenceTicker";
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
  ["Is PITCH.FYLYM free for filmmakers?", "Creating a profile, submitting one project and viewing your matches is free. Unlimited projects and priority matching are part of the Pro plan."],
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
            <Link href="/projects" className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/funds"    className="hover:text-ink transition-colors">Opportunities</Link>
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

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <p className="eyebrow mb-4">Pricing</p>
        <h2 className="font-display text-[32px] md:text-[44px] leading-tight">Start free. Upgrade when you're pitching.</h2>
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          {[
            ["Free", "$0", ["1 active project", "Match scores & reasons", "Save opportunities", "Apply to 3 opportunities / month"], "Start free", "/signup"],
            ["Single Pitch", "$19", ["Everything in Free", "1 project, unlimited applications", "Priority in producer discovery", "Deadline alerts"], "Choose Single Pitch", "/signup"],
            ["Pro", "$49", ["Unlimited projects", "Unlimited applications", "Early access to new funds", "Pitch materials review queue"], "Go Pro", "/signup"],
          ].map(([name, price, items, cta, href], i) => (
            <div key={name as string} className={`card p-8 ${i === 2 ? "border-gold" : ""}`}>
              <h3 className="eyebrow">{name as string}</h3>
              <div className="mt-4 font-display text-[40px]">{price as string}<span className="text-[14px] text-ash font-sans"> /month</span></div>
              <ul className="mt-6 space-y-3 text-[14px] text-ash">
                {(items as string[]).map((it) => (
                  <li key={it} className="hairline pt-3">{it}</li>
                ))}
              </ul>
              <Link href={href as string} className={`mt-8 w-full ${i === 2 ? "btn-gold" : "btn-ghost"}`}>{cta as string}</Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[13px] text-ash">Producer and investor accounts are free — verification required.</p>
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
          <a href="mailto:nobinkurian@yahoo.com" className="btn-ghost mt-8 md:mt-0 shrink-0">Write to us</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-deep text-ivory">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="md:flex justify-between gap-12">
            <div className="max-w-xs">
              <Wordmark light />
              <p className="mt-5 text-[13px] leading-relaxed text-ivory/50">
                Intelligent matchmaking between film projects and the people who finance them. A FYLYM company.
              </p>
            </div>
            <div className="mt-10 md:mt-0 grid grid-cols-2 sm:grid-cols-3 gap-12 text-[13px]">
              <div>
                <p className="eyebrow !text-ivory/40 mb-4">Platform</p>
                <ul className="space-y-3 text-ivory/70">
                  <li><a href="#features" className="hover:text-gold">Features</a></li>
                  <li><a href="#pricing" className="hover:text-gold">Pricing</a></li>
                  <li><Link href="/signup" className="hover:text-gold">Join</Link></li>
                </ul>
              </div>
              <div>
                <p className="eyebrow !text-ivory/40 mb-4">For industry</p>
                <ul className="space-y-3 text-ivory/70">
                  <li><Link href="/signup?role=producer" className="hover:text-gold">Producers</Link></li>
                  <li><Link href="/signup?role=producer" className="hover:text-gold">Investors</Link></li>
                  <li><Link href="/funds/submit" className="hover:text-gold">Submit an opportunity</Link></li>
                </ul>
              </div>
              <div>
                <p className="eyebrow !text-ivory/40 mb-4">Company</p>
                <ul className="space-y-3 text-ivory/70">
                  <li><a href="https://www.nobinkurian.com" className="hover:text-gold">About</a></li>
                  <li><a href="mailto:nobinkurian@yahoo.com" className="hover:text-gold">Contact</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="hairline-gold mt-14 pt-6 text-[11px] tracking-[0.2em] uppercase text-ivory/40">
            © {new Date().getFullYear()} PITCH.FYLYM · A FYLYM Company · Ernakulam, Kerala
          </div>
        </div>
      </footer>
    </main>
    </RoleProvider>
  );
}
