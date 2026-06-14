import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateMeetingStatus } from "@/lib/actions";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  accepted:  "bg-emerald-50 text-emerald-700",
  declined:  "bg-red-50 text-red-700",
  completed: "bg-parchment text-ash",
};

export default async function ProducerMeetingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("approval_status").eq("id", user.id).single();
  if (profile?.approval_status !== "approved") redirect("/producer/pending");

  const { data: meetings } = await supabase
    .from("meeting_requests")
    .select(`
      *,
      projects:project_id (id, title, genre, format, country),
      filmmakers:filmmaker_id (full_name, company)
    `)
    .eq("producer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <p className="eyebrow mb-2">Producer Studio</p>
      <h1 className="font-display text-[32px] mb-2">Meetings</h1>
      <p className="text-[14px] text-ash mb-10">Meeting requests you've sent to filmmakers.</p>

      {(!meetings || meetings.length === 0) ? (
        <div className="card py-16 text-center">
          <p className="font-display text-[20px] mb-3">No meeting requests yet</p>
          <p className="text-ash text-[14px] mb-6">Find a project you love and send the filmmaker a meeting request.</p>
          <Link href="/producer/projects" className="btn-gold">Browse projects</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((m: any) => {
            const filmmaker = Array.isArray(m.filmmakers) ? m.filmmakers[0] : m.filmmakers;
            const project = Array.isArray(m.projects) ? m.projects[0] : m.projects;
            return (
              <div key={m.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <Link href={`/producer/projects/${project?.id}`} className="font-display text-[18px] hover:text-gold transition-colors">
                      {project?.title ?? "Unknown project"}
                    </Link>
                    <p className="text-[13px] text-ash mt-0.5">
                      {[project?.genre, project?.format, project?.country].filter(Boolean).join(" · ")}
                    </p>
                    {filmmaker && (
                      <p className="text-[13px] text-ash mt-0.5">
                        Filmmaker: <span className="text-ink">{filmmaker.full_name}</span>
                        {filmmaker.company ? ` · ${filmmaker.company}` : ""}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] tracking-[0.12em] uppercase px-3 py-1 rounded-full shrink-0 ${STATUS_STYLE[m.status] ?? "bg-parchment text-ash"}`}>
                    {m.status}
                  </span>
                </div>

                {m.message && (
                  <p className="text-[13px] text-ink italic border-l-2 border-line pl-3 mb-3">
                    "{m.message}"
                  </p>
                )}

                <p className="text-[12px] text-ash mb-4">{timeAgo(m.created_at)}</p>

                {/* Add meeting notes when completed */}
                {(m.status === "accepted" || m.status === "completed") && (
                  <form action={updateMeetingStatus} className="space-y-3">
                    <input type="hidden" name="meeting_id" value={m.id} />
                    <input type="hidden" name="status" value="completed" />
                    <div>
                      <label className="field-label text-[12px]">Meeting notes (private)</label>
                      <textarea name="meeting_notes" rows={3} defaultValue={m.meeting_notes ?? ""}
                        placeholder="What did you discuss? What are the next steps?"
                        className="field text-[13px] w-full mt-1" />
                    </div>
                    <button type="submit" className="btn-ghost !py-2 text-[13px]">
                      {m.status === "completed" ? "Update notes" : "Mark completed + save notes"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
