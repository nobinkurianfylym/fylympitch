import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles")
    .select("full_name, bio, company, country").eq("username", username).single();
  if (!p) return { title: "Profile — FYLYMPITCH" };
  return {
    title: `${p.full_name} (@${username}) — FYLYMPITCH`,
    description: p.bio ?? `${p.full_name}${p.company ? ` · ${p.company}` : ""}${p.country ? ` · ${p.country}` : ""} on FYLYMPITCH`,
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/u/${username}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, company, country, bio, website, imdb_url, avatar_url, role, career_stage")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const [{ data: projects }, { data: credits }, { data: producerProfile }] = await Promise.all([
    supabase.from("projects").select("id, title, genre, format, logline, poster_path, slug, love_count, funding_needed_usd")
      .eq("owner_id", profile.id).eq("is_public", true).order("created_at", { ascending: false }),
    supabase.from("filmmaker_credits").select("*").eq("user_id", profile.id)
      .eq("is_featured", true).order("year", { ascending: false }).limit(6),
    supabase.from("producer_profiles").select("role_type, genres, formats, territories, is_public")
      .eq("user_id", profile.id).eq("is_public", true).maybeSingle(),
  ]);

  const CAREER: Record<string, string> = {
    debut: "Debut filmmaker", second_film: "2nd film", established: "Established filmmaker", veteran: "Veteran filmmaker",
  };
  const ROLE_LABEL: Record<string, string> = {
    independent_producer: "Independent Producer", studio_exec: "Studio Executive",
    sales_agent: "Sales Agent", distributor: "Distributor",
    ep: "Executive Producer", coproduction_partner: "Co-Production Partner",
  };

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/"><Wordmark /></Link>
          <nav className="flex items-center gap-6 text-[12px] tracking-[0.14em] uppercase text-ash">
            <Link href="/projects" className="hover:text-ink transition-colors">Projects</Link>
            <Link href="/funds" className="hover:text-ink transition-colors">Funds</Link>
            {user && <Link href="/dashboard" className="hover:text-ink transition-colors">Dashboard</Link>}
          </nav>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-6 py-14">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row items-start gap-8 mb-14">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name}
                className="w-24 h-24 rounded-full object-cover border border-line" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-parchment border border-line flex items-center justify-center">
                <span className="font-display text-[28px] text-ash">
                  {profile.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-2">
              {producerProfile ? ROLE_LABEL[producerProfile.role_type ?? ""] ?? "Producer" : (CAREER[(profile as any).career_stage] ?? "Filmmaker")}
            </p>
            <h1 className="font-display text-[38px] font-[400] leading-tight mb-1">{profile.full_name}</h1>
            <p className="text-[13px] text-ash tracking-[0.06em]">
              @{profile.username}
              {profile.company ? ` · ${profile.company}` : ""}
              {profile.country  ? ` · ${profile.country}`  : ""}
            </p>
            {profile.bio && (
              <p className="mt-4 text-[15px] leading-relaxed max-w-xl text-ink/80">{profile.bio}</p>
            )}
            <div className="flex items-center gap-4 mt-4">
              {profile.website  && <a href={profile.website}  target="_blank" rel="noopener noreferrer" className="text-[12px] tracking-[0.12em] uppercase text-ash hover:text-gold transition-colors">Website ↗</a>}
              {profile.imdb_url && <a href={profile.imdb_url} target="_blank" rel="noopener noreferrer" className="text-[12px] tracking-[0.12em] uppercase text-ash hover:text-gold transition-colors">IMDb ↗</a>}
            </div>
          </div>
        </div>

        {/* Producer preferences (if public producer) */}
        {producerProfile && (
          <section className="mb-14 p-6 card">
            <p className="eyebrow mb-4">Looking for</p>
            <div className="flex flex-wrap gap-2">
              {[...(producerProfile.genres ?? []), ...(producerProfile.formats ?? []), ...(producerProfile.territories ?? [])].map((tag: string) => (
                <span key={tag} className="text-[11px] tracking-[0.14em] uppercase px-3 py-1 rounded-full border border-line bg-parchment text-ash">{tag}</span>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {(projects ?? []).length > 0 && (
          <section className="mb-14">
            <p className="eyebrow mb-6">Projects</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(projects ?? []).map((p: any) => (
                <Link key={p.id} href={`/projects/${p.slug ?? p.id}`}
                  className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all">
                  <div className="aspect-[3/2] overflow-hidden">
                    <ProjectThumbnail posterPath={p.poster_path} title={p.title} genre={p.genre}
                      supabaseUrl={supabaseUrl} className="w-full h-full rounded-t-card" />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <p className="text-[11px] tracking-[0.24em] uppercase text-ash mb-2">
                      {p.genre}{p.format ? ` · ${p.format.charAt(0).toUpperCase()}${p.format.slice(1)}` : ""}
                    </p>
                    <h3 className="font-display text-[20px] font-[400] group-hover:text-gold transition-colors leading-snug mb-2">{p.title}</h3>
                    {p.logline && <p className="font-display italic text-[13px] leading-[1.55] text-ash line-clamp-2 flex-1">&ldquo;{p.logline}&rdquo;</p>}
                    <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-[12px]">
                      <span className="text-ash">♥ {p.love_count ?? 0}</span>
                      {p.funding_needed_usd && <span className="text-gold">Seeking ${(p.funding_needed_usd / 1000).toFixed(0)}K</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Credits */}
        {(credits ?? []).length > 0 && (
          <section>
            <p className="eyebrow mb-6">Credits</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(credits ?? []).map((c: any) => (
                <div key={c.id} className="card p-4">
                  <p className="font-display text-[16px] font-[400] mb-1">{c.title}</p>
                  <p className="text-[12px] text-ash">{c.year}{c.format ? ` · ${c.format}` : ""}</p>
                  {(c.festivals ?? []).length > 0 && (
                    <p className="text-[11px] text-ash/70 mt-1">{c.festivals.slice(0, 3).join(" · ")}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
