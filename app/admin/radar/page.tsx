// app/admin/radar/page.tsx
// Deadline Radar: admin-triggered alerts for funds a filmmaker already
// matches that are about to close. Nothing here is scheduled.

import { createClient } from "@/lib/supabase/server";
import RadarPanel from "./RadarPanel";

export const dynamic = "force-dynamic";

export default async function RadarAdminPage() {
  const supabase = await createClient();

  const { data: runs } = await supabase
    .from("deadline_radar_runs")
    .select("id, triggered_at, window_days, min_score, dry_run, filmmakers, projects, alerts, emailed")
    .order("triggered_at", { ascending: false })
    .limit(12);

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-3">Deadline Radar</p>
      <h1 className="font-display text-[32px] md:text-[40px] font-normal leading-[1.1] mb-4">
        The funds they already match,{" "}
        <span className="italic text-gold">about to close.</span>
      </h1>
      <p className="text-[16px] leading-[1.7] text-ash max-w-2xl mb-10">
        Builds one alert per project, listing up to five funds closing inside the
        window that the project already scores above the threshold for. It lands
        in the filmmaker&rsquo;s notification tab in red. The email is optional
        and off unless you tick it.
      </p>

      <RadarPanel />

      {!!runs?.length && (
        <div className="mt-14">
          <p className="eyebrow mb-4">Recent runs</p>
          <div className="border-t border-line">
            {runs.map((r: any) => (
              <div key={r.id} className="hairline py-3.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
                <span className="text-ash w-44">
                  {new Date(r.triggered_at).toLocaleString()}
                </span>
                <span className={`text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full ${
                  r.dry_run ? "bg-parchment text-ash" : "bg-red-50 text-red-600"
                }`}>
                  {r.dry_run ? "Preview" : "Sent"}
                </span>
                <span className="text-ash">{r.window_days}d · score {r.min_score}+</span>
                <span className="text-ink">
                  {r.filmmakers} filmmakers · {r.projects} projects · {r.alerts} deadlines
                </span>
                {r.emailed > 0 && <span className="text-gold">{r.emailed} emailed</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
