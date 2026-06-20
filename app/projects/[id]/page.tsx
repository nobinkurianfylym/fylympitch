import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";
import { usd, STAGE_LABEL } from "@/lib/format";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const CAREER_LABEL: Record<string, string> = {
  debut: "Debut film", second_film: "2nd film", established: "Established filmmaker", veteran: "Veteran filmmaker",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: p } = await supabase
    .from("projects").select("title, genre, logline, poster_path, country")
    .eq(isUuid ? "id" : "slug", id).eq("is_public", true).single();
  if (!p) return { title: "Project — FYLYMPITCH" };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const image = p.poster_path ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}` : null;
  const desc = p.logline ?? `A ${p.genre} from ${p.country} — now pitching on FYLYMPITCH`;
  return {
    title: `${p.title} — FYLYMPITCH`,
    description: desc,
    openGraph: { title: p.title, description: desc, images: image ? [image] : [], type: "article" },
    twitter: { card: "summary_large_image", title: p.title, description: desc, images: image ? [image] : [] },
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // UUID → redirect to slug-based URL (preserve old shared links)
  if (isUuid) {
    const { data: slugRow } = await supabase
      .from("projects").select("slug").eq("id", id).eq("is_public", true).single();
    if (slugRow?.slug) redirect(`/projects/${slugRow.slug}`);
  }

  const { data: p } = await supabase.from("projects")
    .select("id, title, genre, format, stage, language, country, logline, synopsis, director_statement, producer_info, budget_usd, funding_needed_usd, is_public, poster_path, pitch_deck_path, love_count, owner_id, filmmaker:profiles!projects_owner_id_fkey(full_name, avatar_url, career_stage, username)")
    .eq(isUuid ? "id" : "slug", id).eq("is_public", true).single();

  if (!p) notFound();

  const [{ data: filmmakerCredits }, lovedResult, producerResult, meResult] = await Promise.all([
    supabase.from("filmmaker_credits").select("*").eq("user_id", p.owner_id).order("year", { ascending: false }),
    user ? supabase.from("project_loves").select("user_id").eq("user_id", user.id).eq("project_id", p.id).single() : Promise.resolve({ data: null }),
    user ? supabase.from("producer_profiles").select("user_id").eq("user_id", user.id).single() : Promise.resolve({ data: null }),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const loved           = lovedResult.data;
  const producerProfile = producerResult.data;
  const isProducer      = !!producerProfile;
  const isOwnProject    = !!user && user.id === p.owner_id;
  const dashboardHref   = (meResult.data as any)?.role === "producer" ? "/producer" : "/dashboard";

  const filmmaker = Array.isArray(p.filmmaker) ? p.filmmaker[0] : p.filmmaker;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/projects" className="text-ink">Projects</Link>
            <Link href="/funds" className="hover:text-ink transition-colors">Funds</Link>
          </nav>
          <Link href={dashboardHref} className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-24">
        <p className="text-[11px] tracking-[0.16em] uppercase text-ash mb-8">
          <Link href="/projects" className="hover:text-ink transition-colors">Projects</Link>
          <span className="mx-2">›</span>
          <span className="text-ink">{p.title}</span>
        </p>

        <ProjectThumbnail posterPath={p.poster_path} title={p.title} genre={p.genre}
          supabaseUrl={supabaseUrl} className="rounded-card mb-8 w-full max-h-[420px]" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="eyebrow mb-3">{p.genre} · {p.format.charAt(0).toUpperCase() + p.format.slice(1)} · {STAGE_LABEL[p.stage] ?? p.stage}</p>
            <h1 className="font-display text-[38px] font-[400]">{p.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-3">
            <LoveButton projectId={p.id} initialCount={p.love_count ?? 0} initialLiked={!!loved} isLoggedIn={true} />
            <ShareButton projectId={p.id} title={p.title} genre={p.genre} country={p.country} />
          </div>
        </div>

        {p.logline && (
          <p className="font-display italic text-[18px] leading-[1.6] mt-5 text-ink">"{p.logline}"</p>
        )}

        <div className="mt-7 flex flex-wrap gap-6 text-[13px] text-ash">
          {p.country && <span>Country — <span className="text-ink">{p.country}</span></span>}
          {p.language && <span>Language — <span className="text-ink">{p.language}</span></span>}
          {p.budget_usd && <span>Budget — <span className="text-ink">{usd(p.budget_usd)}</span></span>}
          {p.funding_needed_usd && <span>Seeking — <span className="text-gold font-[400]">{usd(p.funding_needed_usd)}</span></span>}
        </div>

        {/* Filmmaker card */}
        {filmmaker && (
          <div className="mt-8 p-5 border border-line rounded-card bg-white/60 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-parchment border border-line flex items-center justify-center shrink-0">
              {filmmaker.avatar_url ? (
                <img src={filmmaker.avatar_url} alt={filmmaker.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-[14px] text-ash">
                  {filmmaker.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-ink">{filmmaker.full_name}</p>
              {filmmaker.career_stage && (
                <p className="text-[12px] tracking-[0.12em] uppercase text-ash mt-0.5">
                  {CAREER_LABEL[filmmaker.career_stage] ?? filmmaker.career_stage}
                </p>
              )}
              {/* Top credits */}
              {(filmmakerCredits ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(filmmakerCredits ?? []).slice(0, 3).map((c: any) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] text-ink">{c.title}</span>
                      {c.year && <span className="text-[12px] text-ash">{c.year}</span>}
                      {c.festivals?.slice(0, 2).map((f: string) => (
                        <span key={f} className="text-[10px] tracking-[0.1em] uppercase bg-parchment text-ash px-2 py-0.5 rounded-full border border-line">{f}</span>
                      ))}
                      {c.awards?.length > 0 && (
                        <span className="text-[11px] text-gold">🏆 {c.awards[0]}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="hairline-gold mt-10 mb-10" />

        {p.synopsis && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Synopsis</p>
            <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{p.synopsis}</p>
          </section>
        )}
        {p.director_statement && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Director's statement</p>
            <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{p.director_statement}</p>
          </section>
        )}
        {p.producer_info && (
          <section className="mb-10">
            <p className="eyebrow mb-4">Producers</p>
            <p className="text-[21px] leading-[1.7] text-ink whitespace-pre-line">{p.producer_info}</p>
          </section>
        )}

        {/* CTA block */}
        {!isOwnProject && (
          <div className="mt-14 border border-line rounded-card bg-white/70 p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            {!user ? (
              <>
                <p className="font-display text-[18px] font-normal italic">Every great film starts with the right discovery.</p>
                <Link href="/signup" className="btn-gold shrink-0 whitespace-nowrap">Get started</Link>
              </>
            ) : isProducer ? (
              <>
                <div>
                  <p className="text-[16px]">Interested in this project?</p>
                  <p className="mt-1 text-[13px] text-ash">Message the filmmaker or add it to your pipeline.</p>
                </div>
                <div className="flex gap-3 flex-wrap shrink-0">
                  <Link href="/producer/messages" className="btn-ghost whitespace-nowrap">
                    Message filmmaker
                  </Link>
                  <form action={async (fd: FormData) => {
                    "use server";
                    const { upsertProducerProject } = await import("@/lib/actions");
                    await upsertProducerProject(fd);
                  }}>
                    <input type="hidden" name="project_id" value={p.id} />
                    <input type="hidden" name="status" value="saved" />
                    <button className="btn-gold whitespace-nowrap">Add to pipeline</button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        )}

        <Link href="/projects" className="mt-10 inline-block text-[12px] tracking-[0.16em] uppercase text-ash hover:text-ink transition-colors">
          ← Back to Projects
        </Link>
      </main>
    </div>
  );
}
