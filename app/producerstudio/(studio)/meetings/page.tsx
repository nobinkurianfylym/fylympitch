import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateMeetingStatus } from "@/lib/actions";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-gold/8 text-[#8A6F3E] border border-gold/30",
  accepted:  "bg-[rgba(46,107,78,0.08)] text-[#2E6B4E] border border-[rgba(46,107,78,0.2)]",
  declined:  "bg-[rgba(26,24,21,0.05)] text-ash border border-line",
  completed: "bg-parchment text-ash border border-line",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting response", accepted: "Accepted",
  declined: "Declined", completed: "Completed",
};

export default async function MeetingsNotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Parallel fetch — independent queries
  const [{ data: meetings }, { data: noteRows }] = await Promise.all([
    supabase
      .from("meeting_requests")
      .select(`*, project:projects!meeting_requests_project_id_fkey(id,title,genre,format,country), filmmaker:profiles!meeting_requests_filmmaker_id_fkey(full_name,company)`)
      .eq("producer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("producer_projects")
      .select(`notes, rating, status, updated_at, projects:project_id(id,title,genre,format,country)`)
      .eq("producer_id", user.id)
      .not("notes", "is", null)
      .neq("notes", "")
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <div>
      <p className="eyebrow mb-2">Producer Studio</p>
      <h1 className="font-display text-[32px] mb-8">Meetings &amp; Notes</h1>

      <div className="grid md:grid-cols-2 gap-8 md:gap-0 items-start">

        {/* ── LEFT: MEETINGS ── */}
        <div className="md:pr-10">
          <div className="hairline pb-4 mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-[20px]">Meetings</h2>
            <span className="text-[12px] text-ash">{meetings?.length ?? 0} requests</span>
          </div>

          {(!meetings || meetings.length === 0) ? (
            <div className="card py-10 text-center">
              <p className="font-display text-[17px] mb-2">No meeting requests yet</p>
              <p className="text-ash text-[13px] mb-5">Find a project and send the filmmaker a meeting request.</p>
              <Link href="/producerstudio/projects" className="btn-ghost !py-2 text-[12px]">Browse projects</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((m: any) => {
                const filmmaker = Array.isArray(m.filmmaker) ? m.filmmaker[0] : m.filmmaker;
                const project   = Array.isArray(m.project)   ? m.project[0]   : m.project;
                return (
                  <div key={m.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <Link href={`/producerstudio/projects/${project?.id}`} className="font-display text-[16px] hover:text-gold transition-colors">
                          {project?.title ?? "Unknown project"}
                        </Link>
                        <p className="text-[12px] text-ash mt-0.5">
                          {[project?.genre, project?.format, project?.country].filter(Boolean).join(" · ")}
                        </p>
                        {filmmaker?.full_name && (
                          <p className="text-[12px] text-ash mt-0.5">
                            Director: <span className="text-ink">{filmmaker.full_name}</span>
                            {filmmaker.company ? ` · ${filmmaker.company}` : ""}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[m.status] ?? "bg-parchment text-ash"}`}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </div>

                    {m.message && (
                      <p className="text-[12px] text-ink italic border-l-2 border-gold/40 pl-3 mb-3 leading-relaxed">
                        &ldquo;{m.message}&rdquo;
                      </p>
                    )}
                    <p className="text-[11px] text-ash mb-3">{timeAgo(m.created_at)}</p>

                    {m.status === "declined" && (
                      <p className="text-[12px] text-ash italic">Filmmaker declined this request.</p>
                    )}

                    {(m.status === "accepted" || m.status === "completed") && (
                      <form action={updateMeetingStatus} className="space-y-2 pt-3 border-t border-line">
                        <input type="hidden" name="meeting_id" value={m.id} />
                        <input type="hidden" name="status" value="completed" />
                        <textarea name="meeting_notes" rows={2}
                          defaultValue={m.meeting_notes ?? ""}
                          placeholder="Notes from this meeting…"
                          className="field text-[12px] w-full mt-1" />
                        <div className="flex items-center justify-between">
                          <button type="submit" className="btn-ghost !py-1.5 text-[12px]">
                            {m.status === "completed" ? "Update notes" : "Mark complete"}
                          </button>
                          {m.status === "completed" && (
                            <span className="text-[11px] text-[#2E6B4E] font-medium">✓ Completed</span>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: NOTES ── */}
        <div className="md:pl-10 md:border-l md:border-line">
          <div className="hairline pb-4 mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-[20px]">Project Notes</h2>
            <span className="text-[12px] text-ash">{noteRows?.length ?? 0} notes</span>
          </div>

          {(!noteRows || noteRows.length === 0) ? (
            <div className="card py-10 text-center">
              <p className="font-display text-[17px] mb-2">No notes yet</p>
              <p className="text-ash text-[13px] mb-5">Open a project and add private notes and ratings.</p>
              <Link href="/producerstudio/projects" className="btn-ghost !py-2 text-[12px]">Browse projects</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {noteRows.map((row: any) => {
                const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
                return (
                  <div key={project?.id} className="card p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <Link href={`/producerstudio/projects/${project?.id}`} className="font-display text-[15px] hover:text-gold transition-colors">
                          {project?.title}
                        </Link>
                        <p className="text-[11px] text-ash mt-0.5">
                          {[project?.genre, project?.format, project?.country].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.rating && <span className="text-gold text-[12px]">{"★".repeat(row.rating)}</span>}
                        <span className="text-[9px] tracking-[0.12em] uppercase text-ash bg-parchment px-2 py-0.5 rounded-full">
                          {row.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <p className="text-[13px] leading-[1.6] text-ink whitespace-pre-line">{row.notes}</p>
                    <p className="text-[11px] text-ash mt-2">{timeAgo(row.updated_at)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
