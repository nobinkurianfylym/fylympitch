import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import EditProjectForm from "@/components/EditProjectForm";
import type { Project } from "@/types";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*, admin_hidden")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single<Project & { admin_hidden: boolean }>();

  if (!project) notFound();

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3">Edit project</p>
      <h1 className="font-display text-[34px] mb-2">{project.title}</h1>
      <p className="text-[14px] text-ash mb-8">
        Update your project details. After saving, re-run the engine to refresh your match scores.
      </p>

      {project.admin_hidden && (
        <div className="mb-8 px-4 py-3 rounded-card bg-red-50 border border-red-200">
          <p className="text-[13px] text-red-700 font-normal">
            <strong>This project has been hidden by an administrator.</strong> It is not visible to
            the public or producers, regardless of your visibility setting below. Contact support if
            you believe this is an error.
          </p>
        </div>
      )}

      <EditProjectForm project={project} />

      <div className="mt-10 pt-8 border-t border-line">
        <p className="text-[13px] text-ash">
          After saving, visit your{" "}
          <Link href={`/dashboard/projects/${project.id}`} className="text-gold hover:text-gold/80 transition-colors">
            intelligence report
          </Link>{" "}
          and click &ldquo;Re-run engine&rdquo; to refresh your match scores with the updated details.
        </p>
      </div>
    </div>
  );
}
