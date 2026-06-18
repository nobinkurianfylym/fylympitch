import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProducerNotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("approval_status").eq("id", user.id).single();
  if (profile?.approval_status !== "approved") redirect("/producer/pending");

  const { data: rows } = await supabase
    .from("producer_projects")
    .select(`notes, rating, status, updated_at, projects:project_id (id, title, genre, format, country)`)
    .eq("producer_id", user.id)
    .not("notes", "is", null)
    .neq("notes", "")
    .order("updated_at", { ascending: false });

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <p className="eyebrow mb-2">Producer Studio</p>
      <h1 className="font-display text-[32px] mb-2">Notes</h1>
      <p className="text-[14px] text-ash mb-10">Your private notes on projects. Only visible to you.</p>

      {(!rows || rows.length === 0) ? (
        <div className="card py-16 text-center">
          <p className="font-display text-[20px] mb-3">No notes yet</p>
          <p className="text-ash text-[14px] mb-6">Open a project and add your private notes and ratings.</p>
          <Link href="/producer/projects" className="btn-gold">Browse projects</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row: any) => {
            const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
            return (
              <div key={project?.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <Link href={`/producer/projects/${project?.id}`} className="font-display text-[17px] hover:text-gold transition-colors">
                      {project?.title}
                    </Link>
                    <p className="text-[12px] text-ash mt-0.5">
                      {[project?.genre, project?.format, project?.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {row.rating && <span className="text-gold text-[13px]">{"★".repeat(row.rating)}</span>}
                    <span className="text-[10px] tracking-[0.12em] uppercase text-ash bg-parchment px-2 py-0.5 rounded-full">
                      {row.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <p className="text-[14px] leading-[1.6] text-ink whitespace-pre-line">{row.notes}</p>
                <p className="text-[12px] text-ash mt-3">{timeAgo(row.updated_at)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
