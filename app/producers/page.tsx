import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import Link from "next/link";
import type { Metadata } from "next";
import ProducerProjectTicker from "@/components/ProducerProjectTicker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover Projects — FYLYMPITCH",
  description:
    "Browse verified filmmaker projects by genre, format and stage. Co-produce, invest or acquire.",
};

function formatBudget(usd: number | null): string {
  if (!usd) return "TBC";
  if (usd >= 1_000_000)
    return `$${(usd / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${Math.round(usd).toLocaleString()}`;
}

function seekingLabel(stage: string): string {
  const MAP: Record<string, string> = {
    development:     "Co-Producer",
    pre_production:  "Producer",
    production:      "Line Producer",
    post_production: "Sales Agent",
    completed:       "Distribution",
  };
  return MAP[stage] ?? "Producer";
}

export default async function ProducersDiscoveryPage() {
  const supabase = await createClient();

  let projects: {
    id: string; title: string; genre: string; format: string;
    stage: string; country: string; budget: string; seeking: string;
  }[] = [];

  try {
    const { data: raw } = await supabase
      .from("projects")
      .select("id, title, genre, format, stage, country, budget_usd, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50);

    projects = (raw ?? []).map((p: any) => ({
      id:      p.id as string,
      title:   p.title as string,
      genre:   p.genre as string,
      format:  p.format as string,
      stage:   p.stage as string,
      country: (p.country as string) ?? "International",
      budget:  formatBudget(p.budget_usd as number | null),
      seeking: seekingLabel(p.stage as string),
    }));
  } catch {
    // page renders with empty ticker if DB is unavailable
  }

  return (
    <div className="min-h-screen bg-ivory">

      {/* ── NAV ── */}
      <header className="border-b border-line bg-ivory/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.18em] uppercase text-ash">
            <span className="text-ink border-b border-ink pb-0.5 cursor-default">
              Browse Projects
            </span>
            <Link href="/funds"    className="hover:text-ink transition-colors">Funds</Link>
            <Link href="/#pricing" className="hover:text-ink transition-colors">Pricing</Link>
            <Link href="/"         className="hover:text-ink transition-colors">Platform</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[12px] tracking-[0.18em] uppercase text-ink hover:text-gold transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link href="/login" className="btn-gold !px-5 !py-2.5">Join</Link>
          </div>
        </div>
      </header>

      {/* ── HERO — matches HeroToggle layout exactly ── */}
      <section className="max-w-6xl mx-auto w-full px-6 pt-16 pb-12">
        <p className="eyebrow mb-5">For Producers &amp; Investors</p>
        <h1 className="font-display font-normal text-[36px] leading-[1.08] md:text-[52px] max-w-4xl">
          Where producers find{" "}
          <span className="italic text-gold">their next project.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ash">
          One account, two roles. Browse filmmaker projects by genre, stage and
          territory. Read scripts, send offers, co-produce — no approval needed.
        </p>
        <div className="mt-7 flex flex-wrap gap-4">
          <Link href="/login?next=/producer" className="btn-gold">
            Get started
          </Link>
          <Link href="/projects" className="btn-ghost">
            Browse projects
          </Link>
        </div>
      </section>

      {/* ── LIVE PROJECT MARQUEE ── */}
      <ProducerProjectTicker projects={projects} />

      {/* ── HOW IT WORKS ── */}
      <section className="bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <p className="eyebrow mb-10">For producers &amp; investors</p>
          <div className="grid md:grid-cols-3 gap-12">
            {(
              [
                [
                  "Browse",
                  "Filter verified filmmaker projects by genre, format, stage and territory. Every project has passed through the FYLYMPITCH intelligence engine.",
                ],
                [
                  "Request",
                  "Access scripts and pitch decks through our access-control system. Every filmmaker you contact is serious, working, and ready to pitch.",
                ],
                [
                  "Connect",
                  "Send structured co-production, investment or acquisition offers directly. No gatekeepers, no approval queue, no noise.",
                ],
              ] as [string, string][]
            ).map(([title, body]) => (
              <div key={title} className="hairline pt-6">
                <h3 className="font-display text-[21px] mb-3">{title}</h3>
                <p className="text-[15px] leading-relaxed text-ash">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="bg-deep text-ivory">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <blockquote>
            <p className="font-display italic text-[22px] md:text-[28px] leading-snug max-w-2xl">
              &ldquo;As a producer I only see projects that fit my slate. No noise,
              verified filmmakers, scripts behind access control. That&rsquo;s rare.&rdquo;
            </p>
            <footer className="mt-6 text-[12px] tracking-[0.2em] uppercase text-gold">
              Co-production executive — Europe
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="hairline-gold pt-10 md:flex items-center justify-between gap-12">
          <div>
            <p className="eyebrow mb-3">Join the network</p>
            <h2 className="font-display text-[28px] md:text-[38px] leading-tight max-w-lg">
              One account. Browse projects as a producer, or submit your own as a
              filmmaker.
            </h2>
          </div>
          <div className="flex gap-3 mt-8 md:mt-0 shrink-0">
            <Link href="/login" className="btn-gold">Join free</Link>
            <Link href="/"      className="btn-ghost">Learn more</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-deep text-ivory">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="md:flex justify-between gap-12">
            <div className="max-w-xs">
              <Wordmark light />
              <p className="mt-5 text-[13px] leading-relaxed text-ivory/50">
                Intelligent matchmaking between film projects and the people who
                finance them. A FYLYM company.
              </p>
            </div>
            <div className="mt-10 md:mt-0 grid grid-cols-2 gap-12 text-[13px]">
              <div>
                <p className="eyebrow !text-ivory/40 mb-4">Discover</p>
                <ul className="space-y-3 text-ivory/70">
                  <li><Link href="/producers" className="hover:text-gold">Browse Projects</Link></li>
                  <li><Link href="/funds"     className="hover:text-gold">Browse Funds</Link></li>
                  <li><Link href="/login"     className="hover:text-gold">Join</Link></li>
                </ul>
              </div>
              <div>
                <p className="eyebrow !text-ivory/40 mb-4">Company</p>
                <ul className="space-y-3 text-ivory/70">
                  <li><Link href="/"                   className="hover:text-gold">Platform</Link></li>
                  <li><a href="mailto:hello@fylym.com" className="hover:text-gold">Contact</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="hairline-gold mt-12 pt-6 text-[11px] tracking-[0.2em] uppercase text-ivory/40">
            © {new Date().getFullYear()} FYLYMPITCH · A FYLYM Company · Ernakulam, Kerala
          </div>
        </div>
      </footer>

    </div>
  );
}
