import { createClient } from "@/lib/supabase/server";
import { adminToggleProjectVisibility, adminDeleteProject } from "@/lib/actions";
import { usd, STAGE_LABEL } from "@/lib/format";
import { formatFormat, formatCountry, formatStage } from "@/lib/film-identity";

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
    .select("id, owner_id, title, genre, format, stage, country, funding_needed_usd, is_public, admin_hidden, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "hidden")  query = query.eq("admin_hidden", true);
  if (filter === "private") query = query.eq("is_public", false);

  const { data: projects } = await query;

  const ownerIds = [...new Set((projects ?? []).map((p) => p.owner_id))];
  const { data: owners } = ownerIds.length
    ? await supabase.from("profiles").select("id, full_name, company").in("id", ownerIds)
    : { data: [] };
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o]));

  const { count: hiddenCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("admin_hidden", true);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Project management</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Projects</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/admin/projects" className={`btn-ghost ${!filter ? "border-gold text-ink" : ""}`}>All</a>
          <a href="/admin/projects?filter=hidden" className={`btn-ghost ${filter === "hidden" ? "border-gold text-ink" : ""}`}>
            Admin hidden {(hiddenCount ?? 0) > 0 && `(${hiddenCount})`}
          </a>
          <a href="/admin/projects?filter=private" className={`btn-ghost ${filter === "private" ? "border-gold text-ink" : ""}`}>
            Filmmaker private
          </a>
        </div>
      </div>

      <div className="card mt-8 divide-y divide-line">
        {(projects ?? []).map((p) => {
          const owner = ownerById.get(p.owner_id);
          return (
            <div key={p.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className="font-semibold text-ink uppercase text-[13px]"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {p.title}
                  </p>
                  {p.admin_hidden && (
                    <span className="text-[10px] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                      Admin hidden
                    </span>
                  )}
                  {!p.is_public && !p.admin_hidden && (
                    <span className="text-[10px] tracking-[0.12em] uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Private
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-ash font-normal mt-0.5">
                  {[
                    owner?.full_name ?? "Unknown",
                    owner?.company,
                    formatFormat(p.format),
                    p.genre,
                    (() => { const c = formatCountry(p.country); return c?.flag ? `${c.flag} ${c.name}` : c?.name ?? null; })(),
                    formatStage(p.stage),
                  ].filter(Boolean).join(" · ")}
                  {p.funding_needed_usd ? ` · seeking ${usd(p.funding_needed_usd)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Admin hide toggle */}
                <form action={adminToggleProjectVisibility}>
                  <input type="hidden" name="project_id" value={p.id} />
                  <input type="hidden" name="admin_hidden" value={p.admin_hidden ? "false" : "true"} />
                  <button className={`btn-ghost !py-1.5 !px-4 text-[13px] ${p.admin_hidden ? "border-red-200 text-red-600" : ""}`}>
                    {p.admin_hidden ? "Unhide" : "Admin hide"}
                  </button>
                </form>
                {/* Delete */}
                <form action={adminDeleteProject}>
                  <input type="hidden" name="project_id" value={p.id} />
                  <button className="btn-ghost !py-1.5 !px-4 text-[13px]">Remove</button>
                </form>
              </div>
            </div>
          );
        })}
        {(!projects || projects.length === 0) && (
          <p className="px-5 py-6 text-[14px] text-ash font-normal">No projects found.</p>
        )}
      </div>
    </div>
  );
}
