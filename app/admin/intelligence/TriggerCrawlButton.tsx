"use client";
// app/admin/intelligence/TriggerCrawlButton.tsx
// Triggers a manual crawl run by calling the Supabase Edge Function.

import { useState } from "react";
import { triggerCrawlRun } from "./actions-trigger";

export function TriggerCrawlButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleTrigger() {
    setState("running");
    setErr(null);
    setSummary(null);
    const res = await triggerCrawlRun();
    if (res.error) {
      setErr(res.error);
      setState("error");
    } else {
      setSummary(res.data ?? null);
      setState("done");
    }
  }

  return (
    <div>
      <button
        onClick={handleTrigger}
        disabled={state === "running"}
        className="text-[11px] uppercase tracking-[0.14em] font-normal px-4 py-2 bg-ink text-ivory rounded hover:bg-gold transition-colors disabled:opacity-50"
      >
        {state === "running" ? "Running crawl…" : "Run crawl now"}
      </button>

      {state === "done" && summary && (
        <div className="mt-3 text-[12px] text-emerald-700 font-normal bg-emerald-50 border border-emerald-200 px-4 py-2 rounded">
          ✓ Crawl complete · {String(summary.new_opportunities ?? 0)} new · {String(summary.updated ?? 0)} updated · {String(summary.avg_confidence ?? "—")}% avg confidence
        </div>
      )}

      {state === "error" && err && (
        <div className="mt-3 text-[12px] text-red-600 font-normal bg-red-50 border border-red-200 px-4 py-2 rounded">
          Error: {err}
        </div>
      )}
    </div>
  );
}
