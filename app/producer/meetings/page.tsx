import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateMeetingStatus } from "@/lib/actions";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border border-amber-200",
  accepted:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  declined:  "bg-red-50 text-red-700 border border-red-200",
  completed: "bg-parchment text-ash border border-line",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "Awaiting response",
  accepted:  "Accepted",
  declined:  "Declined",
  completed: "Completed",
};

export default async function ProducerMeetingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meetings } = await supabase
    .from("meeting_requests")
    .select(`
      *,
      project:projects!meeting_requests_project_id_fkey(id, title, genre, format, country),
      filmmaker:profiles!meeting_requests_filmmaker_id_fkey(full_name, company)
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
            const filmmaker = Array.isArray(m.filmmaker) ? m.filmmaker[0] : m.filmmaker;
            const project = Array.isArray(m.project) ? m.project[0] : m.project;
            return (
              <div key={m.id} className="card p-6">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <Link
                      href={`/producer/projects/${project?.id}`}
                      className="font-display text-[18px] hover:text-gold transition-colors"
                    >
                      {project?.title ?? "Unknown project"}
                    </Link>
                    <p className="text-[13px] text-ash mt-0.5">
                      {[project?.genre, project?.format, project?.country].filter(Boolean).join(" · ")}
                    </p>
                    {filmmaker?.full_name && (
                      <p className="text-[13px] text-ash mt-0.5">
                        Director: <span className="text-ink">{filmmaker.full_name}</span>
                        {filmmaker.company ? ` · ${filmmaker.company}` : ""}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] tracking-[0.12em] uppercase px-3 py-1 rounded-full shrink-0 ${STATUS_STYLE[m.status] ?? "bg-parchment text-ash"}`}>
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                </div>

                {/* Original message */}
                {m.message && (
                  <p className="text-[13px] text-ink italic border-l-2 border-gold/40 pl-3 mb-4 leading-relaxed">
                    "{m.message}"
                  </p>
                )}

                <p className="text-[12px] text-ash mb-4">{timeAgo(m.created_at)}</p>

                {/* Declined state */}
                {m.status === "declined" && (
                  <p className="text-[13px] text-ash italic">
                    The filmmaker has declined this meeting request.
                  </p>
                )}

                {/* Notes + mark-complete form for accepted / completed */}
                {(m.status === "accepted" || m.status === "completed") && (
                  <form action={updateMeetingStatus} className="space-y-3 pt-3 border-t border-line">
                    <input type="hidden" name="meeting_id" value={m.id} />
                    <input type="hidden" name="status" value="completed" />
                    <div>
                      <label className="field-label text-[12px] mb-1 block">
                        Meeting notes <span className="text-ash font-normal">(private)</span>
                      </label>
                      <textarea
                        name="meeting_notes"
                        rows={3}
                        defaultValue={m.meeting_notes ?? ""}
                        placeholder="What did you discuss? What are the next steps?"
                        className="field text-[13px] w-full mt-1"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <button type="submit" className="btn-ghost !py-2 text-[13px]">
                        {m.status === "completed" ? "Update notes" : "Mark completed + save notes"}
                      </button>
                      {m.status === "completed" && (
                        <span className="text-[12px] text-emerald-600 tracking-wide">✓ Completed</span>
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
  );
}
