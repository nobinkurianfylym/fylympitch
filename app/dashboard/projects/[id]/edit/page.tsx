import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { updateProject } from "@/lib/project-actions";
import { STAGE_LABEL } from "@/lib/format";
import type { Project } from "@/types";

export const dynamic = "force-dynamic";

const GENRES  = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];
const FORMATS = ["feature","documentary","series","animation"];
const STAGES  = Object.entries(STAGE_LABEL);

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects").select("*, admin_hidden").eq("id", id).eq("owner_id", user.id).single<Project & { admin_hidden: boolean }>();

  if (!project) notFound();

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3">Edit project</p>
      <h1 className="font-display text-[34px] mb-2">{project.title}</h1>
      <p className="text-[14px] text-ash mb-8">
        Update your project details. After saving, re-run the engine to refresh your match scores.
      </p>

      {/* Admin hidden warning */}
      {project.admin_hidden && (
        <div className="mb-8 px-4 py-3 rounded-card bg-red-50 border border-red-200">
          <p className="text-[13px] text-red-700 font-normal">
            <strong>This project has been hidden by an administrator.</strong> It is not visible to the public or producers, regardless of your visibility setting below. Contact support if you believe this is an error.
          </p>
        </div>
      )}

      <form action={updateProject} className="space-y-6">
        <input type="hidden" name="project_id" value={project.id} />

        <div>
          <label className="field-label mb-1 block">Title *</label>
          <input name="title" required defaultValue={project.title} className="field w-full" />
        </div>

        <div>
          <label className="field-label mb-1 block">Logline *</label>
          <textarea name="logline" required rows={2} defaultValue={project.logline ?? ""} className="field w-full" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label mb-1 block">Genre</label>
            <select name="genre" defaultValue={project.genre ?? ""} className="field w-full">
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label mb-1 block">Format</label>
            <select name="format" defaultValue={project.format ?? ""} className="field w-full">
              {FORMATS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label mb-1 block">Stage</label>
            <select name="stage" defaultValue={project.stage ?? ""} className="field w-full">
              {STAGES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label mb-1 block">Country</label>
            <input name="country" defaultValue={project.country ?? ""} className="field w-full" />
          </div>
          <div>
            <label className="field-label mb-1 block">Language</label>
            <input name="language" defaultValue={project.language ?? ""} className="field w-full" />
          </div>
          <div>
            <label className="field-label mb-1 block">Budget (USD)</label>
            <input name="budget_usd" type="number" min="0" defaultValue={project.budget_usd ?? ""} className="field w-full" />
          </div>
          <div>
            <label className="field-label mb-1 block">Funding needed (USD)</label>
            <input name="funding_needed_usd" type="number" min="0" defaultValue={project.funding_needed_usd ?? ""} className="field w-full" />
          </div>
        </div>

        <div>
          <label className="field-label mb-1 block">Synopsis</label>
          <textarea name="synopsis" rows={5} defaultValue={project.synopsis ?? ""} className="field w-full" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label mb-1 block">Director name</label>
            <input name="director_name" defaultValue={(project as any).director_name ?? ""} className="field w-full" placeholder="e.g. Jane Smith" />
          </div>
          <div>
            <label className="field-label mb-1 block">Writer name</label>
            <input name="writer_name" defaultValue={(project as any).writer_name ?? ""} className="field w-full" placeholder="e.g. Jane Smith" />
          </div>
        </div>

        <div>
          <label className="field-label mb-1 block">Director's statement</label>
          <textarea name="director_statement" rows={4} defaultValue={project.director_statement ?? ""} className="field w-full" />
        </div>

        <div>
          <label className="field-label mb-1 block">Producer info</label>
          <textarea name="producer_info" rows={3} defaultValue={project.producer_info ?? ""} className="field w-full" />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-ash cursor-pointer">
            <input
              type="checkbox"
              name="is_public"
              value="true"
              defaultChecked={project.is_public}
              className="w-4 h-4 accent-[#BF9953]"
            />
            Make this project publicly visible
          </label>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" className="btn-gold px-8">Save changes</button>
          <Link href={`/dashboard/projects/${project.id}`} className="text-[13px] text-ash hover:text-ink transition-colors">
            Cancel
          </Link>
        </div>
      </form>

      <div className="mt-10 pt-8 border-t border-line">
        <p className="text-[13px] text-ash">
          After saving, visit your{" "}
          <Link href={`/dashboard/projects/${project.id}`} className="text-gold hover:text-gold/80 transition-colors">
            intelligence report
          </Link>{" "}
          and click "Re-run engine" to refresh your match scores with the updated details.
        </p>
      </div>
    </div>
  );
}
