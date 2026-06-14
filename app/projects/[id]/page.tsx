import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import { usd, STAGE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: p } = await supabase
    .from("projects")
    .select("id, title, genre, format, stage, language, country, logline, synopsis, director_statement, producer_info, budget_usd, funding_needed_usd, is_public, poster_path, pitch_deck_path")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!p) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/projects" className="text-ink">Projects</Link>
            <Link href="/#how" className="hover:text-ink transition-colors">How it works</Link>
            <Link href="/#pricing" className="hover:text-ink transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">Sign in</Link>
                <Link href="/signup" className="btn-gold !px-5 !py-2.5 text-[12px]">Join</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-24">
        <p className="text-[11px] tracking-[0.16em] uppercase text-ash mb-8">
          <Link href="/projects" className="hover:text-ink transition-colors">Projects</Link>
          <span className="mx-2">›</span>
          <span className="text-ink">{p.title}</span>
        </p>

        {/* Poster / thumbnail — prominent at top */}
        <ProjectThumbnail
          posterPath={p.poster_path}
          deckPath={p.pitch_deck_path}
          title={p.title}
          genre={p.genre}
          supabaseUrl={supabaseUrl}
          className="rounded-card mb-8 w-full max-h-[420px]"
        />

        <p className="eyebrow mb-3">
          {p.genre} · {p.format.charAt(0).toUpperCase() + p.format.slice(1)} · {STAGE_LABEL[p.stage] ?? p.stage}
        </p>
        <h1 className="font-display text-[38px] font-[400]">{p.title}</h1>

        {p.logline && (
          <p className="font-display italic text-[18px] leading-[1.6] mt-5 text-ink/80">"{p.logline}"</p>
        )}

        <div className="mt-7 flex flex-wrap gap-6 text-[13px] text-ash">
          {p.country && <span>Country — <span className="text-ink">{p.country}</span></span>}
          {p.language && <span>Language — <span className="text-ink">{p.language}</span></span>}
          {p.budget_usd && <span>Budget — <span className="text-ink">{usd(p.budget_usd)}</span></span>}
          {p.funding_needed_usd && <span>Seeking — <span className="text-gold font-[400]">{usd(p.funding_needed_usd)}</span></span>}
        </div>

        <div className="hairline-gold mt-10 mb-10" />

        {p.synopsis && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Synopsis</p>
            <p className="text-[21px] leading-[1.7] text-ink/85 whitespace-pre-line">{p.synopsis}</p>
          </section>
        )}
        {p.director_statement && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Director's statement</p>
            <p className="text-[21px] leading-[1.7] text-ink/85 whitespace-pre-line">{p.director_statement}</p>
          </section>
        )}
        {p.producer_info && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Producers</p>
            <p className="text-[21px] leading-[1.7] text-ink/85 whitespace-pre-line">{p.producer_info}</p>
          </section>
        )}

        <div className="mt-14 border border-line rounded-card bg-white/70 p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <p className="text-[16px]">Interested in this project?</p>
            <p className="mt-1 text-[13px] text-ash">
              {user ? "Go to your dashboard to send a financing offer or message." : "Join FYLYMPITCH to connect with this filmmaker, send an offer, or co-produce."}
            </p>
          </div>
          {user ? (
            <Link href="/dashboard" className="btn-gold shrink-0 whitespace-nowrap">Go to dashboard</Link>
          ) : (
            <div className="flex gap-3 shrink-0">
              <Link href={`/login?next=/projects/${p.id}`} className="btn-ghost whitespace-nowrap">Sign in</Link>
              <Link href="/signup" className="btn-gold whitespace-nowrap">Join free</Link>
            </div>
          )}
        </div>

        <Link href="/projects" className="mt-10 inline-block text-[12px] tracking-[0.16em] uppercase text-ash hover:text-ink transition-colors">
          ← Back to Projects
        </Link>
      </main>
    </div>
  );
}
