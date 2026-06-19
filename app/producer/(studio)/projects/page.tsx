import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usd } from "@/lib/format";
import { upsertProducerProject } from "@/lib/actions";
import ProjectThumbnail from "@/components/ProjectThumbnail";
import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

const FORMATS = ["Feature", "Documentary", "Series", "Animation", "Short"];
const GENRES  = ["Drama", "Thriller", "Comedy", "Documentary", "Horror", "Romance", "Action", "Animation", "Sci-Fi"];

export default async function ProducerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; format?: string; q?: string; country?: string; language?: string; filter?: string }>;
}) {
  const { genre, format, q, country, language, filter } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  let query = supabase
    .from("projects")
    .select("id, title, genre, format, stage, country, language, logline, budget_usd, funding_needed_usd, poster_path, is_public, created_at, owner_id, love_count, filmmaker:profiles!projects_owner_id_fkey(full_name, avatar_url, career_stage)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (genre)    query = query.eq("genre", genre);
  if (format)   query = query.eq("format", format.toLowerCase());
  if (q)        query = (query as any).or(`title.ilike.%${q}%,logline.ilike.%${q}%`);
  if (country)  query = query.ilike("country", `%${country}%`);
  if (language) query = query.ilike("language", `%${language}%`);

  const { data: projects } = await query;

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: crmRows } = projectIds.length
    ? await supabase.from("producer_projects").select("project_id, status, rating")
        .eq("producer_id", user.id).in("project_id", projectIds)
    : { data: [] };

  const crmByProject = new Map((crmRows ?? []).map((r) => [r.project_id, r]));

  const display = filter === "passed"
    ? (projects ?? []).filter((p) => crmByProject.get(p.id)?.status === "passed")
    : (projects ?? []).filter((p) => crmByProject.get(p.id)?.status !== "passed");

  const hasFilters = !!(genre || format || q || country || language);
  const clearHref = `/producer/projects${filter ? `?filter=${filter}` : ""}`;

  const CAREER: Record<string, string> = {
    debut: "Debut", second_film: "2nd Film", established: "Established", veteran: "Veteran",
  };

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">Producer Studio</p>
          <h1 className="font-display text-[32px]">
            {filter === "passed" ? "Passed projects" : "All projects"}
          </h1>
          <p className="mt-2 text-[14px] text-ash">
            {filter === "passed"
              ? "Projects you've passed on."
              : `${display.length} project${display.length !== 1 ? "s" : ""} — including private submissions not visible to the public.`}
          </p>
        </div>
        <Link href="/producer" className="btn-ghost">← Pipeline</Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-8">
        {filter && <input type="hidden" name="filter" value={filter} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title or logline"
          className="field w-52"
        />
        <select name="genre" defaultValue={genre ?? ""} className="field w-36">
          <option value="">All genres</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select name="format" defaultValue={format ?? ""} className="field w-36">
          <option value="">All formats</option>
          {FORMATS.map((f) => <option key={f} value={f.toLowerCase()}>{f}</option>)}
        </select>
        <input
          name="country"
          defaultValue={country ?? ""}
          placeholder="Country"
          className="field w-36"
        />
        <input
          name="language"
          defaultValue={language ?? ""}
          placeholder="Language"
          className="field w-36"
        />
        <button className="btn-ghost">Filter</button>
        {hasFilters && <a href={clearHref} className="btn-ghost text-ash">Clear</a>}
      </form>

      {/* Project grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {display.map((p) => {
          const crm = crmByProject.get(p.id);
          const fm = Array.isArray((p as any).filmmaker) ? (p as any).filmmaker[0] : (p as any).filmmaker;

          return (
            <div
              key={p.id}
              className="group flex flex-col bg-white/70 border border-line rounded-card overflow-hidden hover:border-gold hover:shadow-sm transition-all"
            >
              {/* Thumbnail */}
              <Link href={`/producer/projects/${p.id}`} className="block">
                <div className="aspect-[3/2] overflow-hidden">
                  <ProjectThumbnail
                    posterPath={p.poster_path}
                    title={p.title}
                    genre={p.genre}
                    supabaseUrl={supabaseUrl}
                    className="w-full h-full rounded-t-card"
                  />
                </div>
              </Link>

              {/* Card body */}
              <div className="p-5 flex flex-col flex-1">
                <p className="text-[11px] tracking-[0.24em] uppercase text-ash mb-2">
                  {p.genre}{p.format ? ` · ${p.format.charAt(0).toUpperCase()}${p.format.slice(1)}` : ""}
                </p>
                <Link href={`/producer/projects/${p.id}`}>
                  <h2 className="font-display text-[20px] font-[400] mb-2 group-hover:text-gold transition-colors leading-snug">
                    {p.title}
                  </h2>
                </Link>
                {p.logline && (
                  <p className="font-display italic text-[13px] leading-[1.55] text-ash line-clamp-2 flex-1">
                    &ldquo;{p.logline}&rdquo;
                  </p>
                )}

                {/* Filmmaker + meta */}
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[12px] text-ash min-w-0">
                    {fm?.avatar_url ? (
                      <img src={fm.avatar_url} alt={fm.full_name ?? ""} className="w-5 h-5 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-parchment border border-line shrink-0 flex items-center justify-center">
                        <span className="text-[7px] text-ash">
                          {(fm?.full_name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="truncate">{fm?.full_name ?? "—"}</span>
                    {fm?.career_stage && (
                      <span className="text-[9px] tracking-[0.1em] uppercase bg-parchment border border-line px-1.5 py-0.5 rounded-full shrink-0">
                        {CAREER[fm.career_stage] ?? fm.career_stage}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <LoveButton projectId={p.id} initialCount={(p as any).love_count ?? 0} initialLiked={false} isLoggedIn={true} size="sm" />
                    <ShareButton projectId={p.id} title={p.title} genre={p.genre} country={p.country} size="sm" />
                  </div>
                </div>

                {/* Country · Language · visibility */}
                {(p.country || p.language) && (
                  <p className="mt-2 text-[11px] text-ash/70 tracking-[0.06em]">
                    {[p.country, p.language].filter(Boolean).join(" · ")}
                    {!p.is_public && <span className="ml-2 text-amber-600">· Private</span>}
                  </p>
                )}

                {/* CRM quick actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-line">
                  {(!crm || crm.status === "passed") && (
                    <form action={upsertProducerProject} className="flex gap-2 w-full">
                      <input type="hidden" name="project_id" value={p.id} />
                      <input type="hidden" name="status" value="saved" />
                      <button className="btn-ghost !py-1.5 flex-1 text-[12px]">Save to pipeline</button>
                    </form>
                  )}
                  {crm && crm.status !== "passed" && (
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[11px] tracking-[0.12em] uppercase text-ash bg-parchment px-3 py-1 rounded-full">
                        {crm.status.replace("_", " ")}
                      </span>
                      <Link href={`/producer/projects/${p.id}`} className="ml-auto text-[12px] text-gold hover:underline">
                        Open →
                      </Link>
                    </div>
                  )}
                  {!crm && (
                    <form action={upsertProducerProject}>
                      <input type="hidden" name="project_id" value={p.id} />
                      <input type="hidden" name="status" value="passed" />
                      <button className="text-[12px] text-ash hover:text-red-600 transition-colors">Pass</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {display.length === 0 && (
        <div className="py-20 text-center">
          <p className="font-display text-[22px] mb-2">No projects match your filters.</p>
          <p className="text-[14px] text-ash">Try adjusting genre, format, country or language.</p>
        </div>
      )}
    </div>
  );
}
