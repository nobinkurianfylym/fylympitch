"use client";
// app/admin/outcomes/AskPanel.tsx
// Preview is the safe default. The destructive button here writes to
// inboxes, and a filmmaker can only be asked once, so there is no undo.

import { useActionState } from "react";
import { runOutcomeAsk, type OutcomeRunResult } from "./actions";

const WEEKS = [2, 3, 4, 6, 8];

export default function AskPanel() {
  const [result, formAction, pending] = useActionState<OutcomeRunResult | null, FormData>(
    runOutcomeAsk, null,
  );

  return (
    <div>
      <form action={formAction} className="border border-line rounded-card p-6 bg-white">
        <label className="block max-w-xs">
          <span className="eyebrow block mb-2">Ask this long after the deadline</span>
          <select name="weeks_after" defaultValue={3} className="field w-full">
            {WEEKS.map(w => <option key={w} value={w}>{w} weeks</option>)}
          </select>
        </label>

        <div className="flex flex-wrap gap-3 mt-6">
          <button type="submit" name="mode" value="preview" disabled={pending}
            className="btn-ghost disabled:opacity-50">
            {pending ? "Working…" : "Preview"}
          </button>
          <button type="submit" name="mode" value="send" disabled={pending}
            className="btn-gold disabled:opacity-50">
            {pending ? "Working…" : "Send the question"}
          </button>
        </div>

        <p className="text-[13px] leading-[1.7] text-ash mt-5">
          Each application is asked about once and never again, whatever the
          answer. Rolling funds with no deadline are asked four weeks later than
          the setting above, since there was no date to count from.
        </p>
      </form>

      {result?.error && (
        <p className="mt-6 text-[14px] text-red-600 border border-red-200 bg-red-50 rounded-card px-5 py-4">
          {result.error}
        </p>
      )}

      {result && !result.error && (
        <div className="mt-8">
          <div className="flex flex-wrap items-baseline gap-6 border-b border-line pb-5 mb-5">
            <Stat n={result.filmmakers} label="Filmmakers" />
            <Stat n={result.asks}       label="Applications" />
            <span className={`text-[11px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full ${
              result.dry_run ? "bg-parchment text-ash" : "bg-violet-50 text-violet-600"
            }`}>
              {result.dry_run ? "Preview only" : "Asked"}
            </span>
          </div>

          {result.asks === 0 ? (
            <p className="text-[15px] text-ash">
              Nothing due. Either no deadlines have passed that long ago, or
              everyone eligible has already been asked.
            </p>
          ) : (
            <ul className="space-y-2">
              {result.items.map(i => (
                <li key={i.application_id} className="text-[14px] leading-[1.6]">
                  <span className="text-ink">{i.name}</span>
                  <span className="text-ash">{" · "}{i.project}{" · "}{i.fund}</span>
                  <span className="text-ash/60">{" · applied "}{i.applied_on}</span>
                </li>
              ))}
            </ul>
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
