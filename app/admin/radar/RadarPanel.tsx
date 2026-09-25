"use client";
// app/admin/radar/RadarPanel.tsx
//
// Preview and Send share one form and one state. Preview is the safe
// default and is what the Enter key triggers, because the destructive
// button here is the one that writes to several hundred inboxes.

import { useActionState } from "react";
import { runRadar, type RadarResult } from "./actions";

const WINDOWS = [14, 30, 60, 90];
const SCORES  = [60, 70, 80, 90];

export default function RadarPanel() {
  const [result, formAction, pending] = useActionState<RadarResult | null, FormData>(
    runRadar,
    null,
  );

  return (
    <div>
      <form action={formAction} className="border border-line rounded-card p-6 bg-white">
        <div className="grid sm:grid-cols-2 gap-6">
          <label className="block">
            <span className="eyebrow block mb-2">Closing within</span>
            <select name="window_days" defaultValue={60} className="field w-full">
              {WINDOWS.map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow block mb-2">Minimum match score</span>
            <select name="min_score" defaultValue={70} className="field w-full">
              {SCORES.map(v => <option key={v} value={v}>{v} and above</option>)}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-3 mt-6 cursor-pointer">
          <input type="checkbox" name="also_email" className="mt-1" />
          <span className="text-[14px] leading-[1.6] text-ash">
            Also send the email. Without this, filmmakers get the notification only.
          </span>
        </label>

        <div className="flex flex-wrap gap-3 mt-7">
          <button
            type="submit" name="mode" value="preview"
            disabled={pending}
            className="btn-ghost disabled:opacity-50"
          >
            {pending ? "Working…" : "Preview"}
          </button>
          <button
            type="submit" name="mode" value="send"
            disabled={pending}
            className="btn-gold disabled:opacity-50"
          >
            {pending ? "Working…" : "Send now"}
          </button>
        </div>

        <p className="text-[13px] leading-[1.7] text-ash mt-5">
          Each fund is alerted once per project per deadline, so running this
          twice will not notify anyone twice. Preview writes nothing.
        </p>
      </form>

      {result?.error && (
        <p className="mt-6 text-[14px] text-red-600 border border-red-200 bg-red-50 rounded-card px-5 py-4">
          {result.error}
        </p>
      )}

      {result && !result.error && (
        <div className="mt-8">
          <div className="flex flex-wrap items-baseline gap-6 border-b border-line pb-5 mb-6">
            <Stat n={result.filmmakers} label="Filmmakers" />
            <Stat n={result.projects}   label="Projects" />
            <Stat n={result.alerts}     label="Deadlines" />
            {typeof result.emailed === "number" && (
              <Stat n={result.emailed} label="Emails sent" />
            )}
            <span className={`text-[11px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full ${
              result.dry_run ? "bg-parchment text-ash" : "bg-red-50 text-red-600"
            }`}>
              {result.dry_run ? "Preview only" : "Sent"}
            </span>
          </div>

          {result.alerts === 0 && (
            <p className="text-[15px] text-ash">
              Nothing due in this window that has not already been alerted.
              Widen the window or lower the score.
            </p>
          )}

          {(result.recipients ?? []).map(r => (
            <div key={r.user_id} className="hairline py-5">
              <p className="font-display text-[19px] font-normal">{r.name}</p>
              {(r.projects ?? []).map(p => (
                <div key={p.project_id} className="mt-3">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-ash/60 mb-1.5">
                    {p.title}
                  </p>
                  <ul className="space-y-1">
                    {(p.items ?? []).map(i => (
                      <li key={i.opportunity_id} className="text-[14px] leading-[1.6]">
                        <span className="text-ink">{i.organization || i.title}</span>
                        <span className={i.days_left <= 7 ? "text-red-600" : "text-ash"}>
                          {" · "}{i.days_left <= 0 ? "today"
                                 : i.days_left === 1 ? "tomorrow"
                                 : `${i.days_left} days`}
                        </span>
                        <span className="text-ash">{" · match "}{i.score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}

          {!!result.emailErrors?.length && (
            <div className="mt-6 border border-line rounded-card px-5 py-4">
              <p className="eyebrow mb-2">Email problems</p>
              <ul className="text-[13px] text-ash space-y-1">
                {result.emailErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="font-display text-[30px] leading-none font-normal">{n}</p>
      <p className="text-[10px] tracking-[0.2em] uppercase text-ash/60 mt-1.5">{label}</p>
    </div>
  );
}
