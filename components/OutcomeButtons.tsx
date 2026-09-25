"use client";
// components/OutcomeButtons.tsx
//
// Three buttons inside a notification. This is the only place the
// platform ever learns whether an application worked, so the whole
// design goal is that answering costs one tap and nothing else.
//
// Once answered the row collapses to a short acknowledgement rather
// than vanishing, so the filmmaker can see their answer registered.
// A rejection gets no commiserating copy: it says what it recorded
// and stops talking.

import { useState, useTransition } from "react";
import { recordOutcome } from "@/lib/outcome-actions";

type Outcome = "accepted" | "rejected" | "waiting" | "dismiss";

const DONE: Record<Exclude<Outcome, "dismiss">, string> = {
  accepted: "Recorded. Congratulations.",
  rejected: "Recorded. Thank you for telling us.",
  waiting:  "Recorded as still waiting.",
};

export default function OutcomeButtons({ applicationId }: { applicationId: string }) {
  const [done, setDone]   = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start]  = useTransition();

  if (done === "dismiss") return null;
  if (done) {
    return (
      <p className="pl-[84px] pb-4 -mt-2 text-[12px] text-ash">
        {DONE[done]}
      </p>
    );
  }

  function answer(outcome: Outcome) {
    setError(null);
    start(async () => {
      const res = await recordOutcome(applicationId, outcome);
      if (res?.error) setError(res.error);
      else setDone(outcome);
    });
  }

  const base =
    "inline-flex items-center text-[11px] tracking-[0.14em] uppercase px-3.5 py-1.5 " +
    "rounded-full border transition-colors disabled:opacity-40";

  return (
    <div className="pl-[84px] pb-4 -mt-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => answer("accepted")} disabled={pending}
          className={`${base} border-emerald-500/50 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-500`}
        >
          I got it
        </button>
        <button
          onClick={() => answer("rejected")} disabled={pending}
          className={`${base} border-line text-ash hover:border-ash`}
        >
          Didn&rsquo;t get it
        </button>
        <button
          onClick={() => answer("waiting")} disabled={pending}
          className={`${base} border-line text-ash hover:border-ash`}
        >
          Still waiting
        </button>
        <button
          onClick={() => answer("dismiss")} disabled={pending}
          className="text-[11px] tracking-[0.14em] uppercase px-2 py-1.5 text-ash/50 hover:text-ash transition-colors disabled:opacity-40"
        >
          Don&rsquo;t ask
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
