import { createClient } from "@/lib/supabase/server";
import { adminToggleProjectVisibility, adminDeleteProject } from "@/lib/actions";
import { usd, STAGE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProjects({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("id, owner_id, title, genre, format, stage, country, funding_needed_usd, is_public, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "hidden") query = query.eq("is_public", false);

  const { data: projects } = await query;

  const ownerIds = [...new Set((projects ?? []).map((p) => p.owner_id))];
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, full_name, company").in("id", ownerIds)
    : { data: [] };
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Project management</p>
          <h1 className="font-display text-3xl font-light mt-1">Projects</h1>
        </div>
        <div className="flex gap-2">
          <a href="/admin/projects" className={`btn-ghost ${!filter ? "border-gold text-ink" : ""}`}>All</a>
          <a href="/admin/projects?filter=hidden" className={`btn-ghost ${filter === "hidden" ? "border-gold text-ink" : ""}`}>
            Hidden
          </a>
        </div>
      </div>

      <div className="card mt-8 divide-y divide-line">
        {(projects ?? []).map((p) => {
          const owner = ownerById.get(p.owner_id);
          return (
            <div key={p.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-light text-ink">{p.title}</p>
                <p className="text-xs text-ash font-light mt-0.5">
                  {[owner?.full_name ?? "Unknown", owner?.company, p.genre, STAGE_LABEL[p.stage] ?? p.stage, p.country]
                    .filter(Boolean)
                    .join(" · ")}
                  {p.funding_needed_usd ? ` · seeking ${usd(p.funding_needed_usd)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs uppercase tracking-[0.14em] font-light ${p.is_public ? "text-emerald-700" : "text-gold"}`}>
                  {p.is_public ? "Public" : "Hidden"}
                </span>
                <form action={adminToggleProjectVisibility}>
                  <input type="hidden" name="project_id" value={p.id} />
                  <input type="hidden" name="is_public" value={p.is_public ? "false" : "true"} />
                  <button className="btn-ghost !py-1.5 !px-4 text-sm">{p.is_public ? "Hide" : "Unhide"}</button>
                </form>
                <form action={adminDeleteProject}>
                  <input type="hidden" name="project_id" value={p.id} />
                  <button className="btn-ghost !py-1.5 !px-4 text-sm">Remove</button>
                </form>
              </div>
            </div>
          );
        })}
        {(!projects || projects.length === 0) && (
          <p className="px-5 py-6 text-sm text-ash font-light">No projects found.</p>
        )}
      </div>
    </div>
  );
}
