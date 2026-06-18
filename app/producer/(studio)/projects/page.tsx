import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usd, STAGE_LABEL } from "@/lib/format";
import { upsertProducerProject } from "@/lib/actions";

import LoveButton from "@/components/LoveButton";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

const FORMATS = ["Feature", "Documentary", "Series", "Animation", "Short"];
const GENRES = ["Drama", "Thriller", "Comedy", "Documentary", "Horror", "Romance", "Action", "Animation", "Sci-Fi"];

export default async function ProducerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; format?: string; q?: string; filter?: string }>;
}) {
  const { genre, format, q, filter } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all projects — approved producers see everything (RLS updated in 009)
  let query = supabase
    .from("projects")
    .select("id, title, genre, format, stage, country, language, logline, synopsis, budget_usd, funding_needed_usd, poster_path, pitch_deck_path, is_public, created_at, owner_id, love_count, filmmaker:profiles!projects_owner_id_fkey(full_name, avatar_url, career_stage)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (genre) query = query.eq("genre", genre);
  if (format) query = query.eq("format", format.toLowerCase());
  if (q) query = query.or(`title.ilike.%${q}%,logline.ilike.%${q}%`);

  const { data: projects } = await query;

  // Fetch this producer's CRM rows for all these projects
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: crmRows } = projectIds.length
    ? await supabase.from("producer_projects").select("project_id, status, rating")
        .eq("producer_id", user.id).in("project_id", projectIds)
    : { data: [] };

  const crmByProject = new Map((crmRows ?? []).map((r) => [r.project_id, r]));

  // Filter by passed
  const display = filter === "passed"
    ? (projects ?? []).filter((p) => crmByProject.get(p.id)?.status === "passed")
    : (projects ?? []).filter((p) => crmByProject.get(p.id)?.status !== "passed");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

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
              : `${display.length} projects — including private submissions not visible to the public.`}
          </p>
        </div>
        <Link href="/producer" className="btn-ghost">← Pipeline</Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-8">
        <input name="q" defaultValue={q ?? ""} placeholder="Search title or logline" className="field w-52" />
        <select name="genre" defaultValue={genre ?? ""} className="field w-36">
          <option value="">All genres</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select name="format" defaultValue={format ?? ""} className="field w-36">
          <option value="">All formats</option>
          {FORMATS.map((f) => <option key={f} value={f.toLowerCase()}>{f}</option>)}
        </select>
        <button className="btn-ghost">Filter</button>
        {(genre || format || q) && <a href="/producer/projects" className="btn-ghost text-ash">Clear</a>}
      </form>

      {/* Project grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {display.map((p) => {
          const crm = crmByProject.get(p.id);
          const thumb = p.poster_path
            ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}`
            : null;

          return (
            <div key={p.id} className="card overflow-hidden flex flex-col">
              {/* Thumbnail */}
              <Link href={`/producer/projects/${p.id}`}>
                {thumb ? (
                  <img src={thumb} alt={p.title} className="w-full object-cover" style={{ aspectRatio: "16/9" }} />
                ) : (
                  <div className="w-full flex items-center justify-center bg-parchment" style={{ aspectRatio: "16/9" }}>
                    <span className="font-display text-[13px] text-ash italic px-4 text-center">{p.title}</span>
                  </div>
                )}
              </Link>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] tracking-[0.16em] uppercase text-ash">
                    {p.genre} · {p.format}
                  </span>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${p.is_public ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {p.is_public ? "Public" : "Private"}
                  </span>
                </div>

                <Link href={`/producer/projects/${p.id}`}>
                  <h2 className="font-display text-[18px] leading-snug mb-2 hover:text-gold transition-colors">
                    {p.title}
                  </h2>
                </Link>

                {p.logline && (
                  <p className="text-[13px] text-ash italic line-clamp-2 mb-3 flex-1">
                    "{p.logline}"
                  </p>
                )}

                <div className="flex items-center justify-between text-[12px] text-ash border-t border-line pt-3 mt-2">
                  <div className="flex items-center gap-2">
                    {/* Filmmaker avatar */}
                    {(() => {
                      const fm = Array.isArray((p as any).filmmaker) ? (p as any).filmmaker[0] : (p as any).filmmaker;
                      const initials = (fm?.full_name ?? "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                      return (
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-parchment border border-line shrink-0 flex items-center justify-center">
                          {fm?.avatar_url ? (
                            <img src={fm.avatar_url} alt={fm.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-display text-[8px] text-ash">{initials}</span>
                          )}
                        </div>
                      );
                    })()}
                    <span>{p.country}{p.language ? ` · ${p.language}` : ""}</span>
                    {(() => {
                      const fm = Array.isArray((p as any).filmmaker) ? (p as any).filmmaker[0] : (p as any).filmmaker;
                      const CAREER: Record<string,string> = { debut:"Debut", second_film:"2nd Film", established:"Established", veteran:"Veteran" };
                      return fm?.career_stage ? (
                        <span className="text-[9px] tracking-[0.1em] uppercase bg-parchment text-ash px-1.5 py-0.5 rounded-full border border-line">
                          {CAREER[fm.career_stage] ?? fm.career_stage}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <LoveButton projectId={p.id} initialCount={(p as any).love_count ?? 0} initialLiked={false} isLoggedIn={true} size="sm" />
                    <ShareButton projectId={p.id} title={p.title} genre={p.genre} country={p.country} size="sm" />
                  </div>
                </div>

                {/* CRM quick actions */}
                <div className="flex gap-2 mt-3">
                  {!crm || crm.status === "passed" ? (
                    <form action={upsertProducerProject} className="flex gap-2 w-full">
                      <input type="hidden" name="project_id" value={p.id} />
                      <input type="hidden" name="status" value="saved" />
                      <button className="btn-ghost !py-1.5 flex-1 text-[12px]">Save</button>
                      <input type="hidden" name="_shortlist" value="1" />
                    </form>
                  ) : null}
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
        <div className="card py-16 text-center">
          <p className="text-ash text-[15px]">No projects match your filters.</p>
        </div>
      )}
    </div>
  );
}
