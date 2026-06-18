import { cookies } from "next/headers";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import HomepageDemo from "@/components/HomepageDemo";
import HeroToggle from "@/components/HeroToggle";
import IntelligenceTicker from "@/components/IntelligenceTicker";
import { RoleProvider, type Role } from "@/components/RoleProvider";
import HeaderRoleToggle from "@/components/HeaderRoleToggle";

const FEATURES = [
  ["Intelligent matching", "Every project is scored against 1,000+ grants, funds, labs, markets and investors on eight weighted criteria — genre, stage, territory, budget, format, funding gap, language and track record."],
  ["Dual-role access", "One account gives you both sides of the table — submit your own projects as a filmmaker, and discover projects as a producer or investor. No separate approval needed."],
  ["Direct offers", "Approved producers and investors can send offers straight to your project — investment, co-production, distribution or acquisition."],
  ["One pitch, many doors", "Submit your project once. FYLYMPITCH keeps it matched against new opportunities as deadlines open worldwide."],
];

const FAQS = [
  ["Who can see my script and pitch deck?", "Only you, FYLYMPITCH administrators, and industry accounts that have been individually verified and approved. Files live in private storage with row-level access control — there are no public links."],
  ["How is the match score calculated?", "Eight weighted criteria totalling 100 points: genre (20), stage (20), territory (15), budget (15), format (10), funding gap (10), language (5) and historical success (5). Anything under 60 is hidden so you only see real prospects."],
  ["Is FYLYMPITCH free for filmmakers?", "Creating a profile, submitting one project and viewing your matches is free. Unlimited projects and priority matching are part of the Pro plan."],
  ["How do producers and investors join?", "Sign up with a single Google account — you automatically get access to both the filmmaker dashboard and the producer studio. One login, both sides of the table."],
];

export default async function Home() {
  const cookieStore = await cookies();
  const rawRole = cookieStore.get("fyp_role")?.value;
  const initialRole: Role = rawRole === "producer" ? "producer" : "filmmaker";
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
            <Link href="/projects" className="hover:text-ink transition-colors">Projects</Link>
            <Link href="/funds"    className="hover:text-ink transition-colors">Funds</Link>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
              <HeaderRoleToggle />
              <Link href="/login" className="text-[12px] tracking-[0.18em] uppercase text-ink hover:text-gold transition-colors px-3 py-2">Sign in</Link>
              <Link href="/login" className="btn-gold !px-5 !py-2.5">Join</Link>
            </div>
        </header>

        {/* HERO — grows to fill remaining viewport */}
        <HeroToggle />
      </div>

      {/* INTELLIGENCE TICKER */}
      <IntelligenceTicker />

      {/* FEATURES */}
      <section id="features" className="bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="eyebrow mb-4">Platform</p>
          <h2 className="font-display text-[32px] md:text-[44px] max-w-2xl leading-tight">
            Built for the way films actually get financed.
          </h2>
          <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-14">
            {FEATURES.map(([title, body]) => (
              <div key={title} className="hairline pt-6">
                <h3 className="font-display text-[21px] mb-3">{title}</h3>
                <p className="text-[21px] leading-[1.7] text-ash">{body}</p>
              </div>
            ))}
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
              <Link href="/login" className="btn-gold">Submit your project</Link>
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
                  "Every project submitted through the FYLYMPITCH engine",
                ].map((item) => (
                  <div key={item} className="hairline pt-4 pb-1 text-[14px] text-ash">{item}</div>
                ))}
              </div>
              <Link href="/login" className="btn-ghost">Join as producer</Link>
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
              Festivals, funds and institutions — list your programme on FYLYMPITCH.
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
                  <li><Link href="/login" className="hover:text-gold">Join</Link></li>
                </ul>
              </div>
              <div>
                <p className="eyebrow !text-ivory/40 mb-4">For industry</p>
                <ul className="space-y-3 text-ivory/70">
                  <li><Link href="/login" className="hover:text-gold">Producers</Link></li>
                  <li><Link href="/login" className="hover:text-gold">Investors</Link></li>
                  <li><a href="#contact" className="hover:text-gold">List a fund</a></li>
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
            © {new Date().getFullYear()} FYLYMPITCH · A FYLYM Company · Ernakulam, Kerala
          </div>
        </div>
      </footer>
    </main>
    </RoleProvider>
  );
}
