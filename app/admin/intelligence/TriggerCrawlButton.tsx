"use client";
// app/admin/intelligence/TriggerCrawlButton.tsx
// Fires crawl and polls via page refresh every 15s until run completes.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { triggerCrawlRun } from "./actions-trigger";

export function TriggerCrawlButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "started" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Auto-refresh every 15s while crawl is running
  useEffect(() => {
    if (state !== "started") return;
    const interval = setInterval(() => {
      router.refresh();
      setPollCount((c) => c + 1);
    }, 15000);
    // Stop polling after 5 minutes
    const stop = setTimeout(() => {
      clearInterval(interval);
      setState("idle");
    }, 300000);
    return () => { clearInterval(interval); clearTimeout(stop); };
  }, [state, router]);

  async function handleTrigger() {
    setState("started");
    setErr(null);
    setPollCount(0);
    const res = await triggerCrawlRun();
    if (res.error) {
      setErr(res.error);
      setState("error");
    }
    // On success: stay in "started", polling takes over
  }

  return (
    <div>
      <button
        onClick={handleTrigger}
        disabled={state === "started"}
        className="text-[11px] uppercase tracking-[0.14em] font-normal px-4 py-2 bg-ink text-ivory rounded hover:bg-gold transition-colors disabled:opacity-50"
      >
        {state === "started" ? "Crawl running…" : "Run crawl now"}
      </button>

      {state === "started" && (
        <p className="mt-2 text-[12px] text-ash font-normal">
          Crawling 49 sources in background — refreshing every 15s
          {pollCount > 0 ? ` (${pollCount} refresh${pollCount > 1 ? "es" : ""})` : ""}
        </p>
      )}

      {state === "error" && err && (
        <div className="mt-3 text-[12px] text-red-600 font-normal bg-red-50 border border-red-200 px-4 py-2 rounded">
          {err}
        </div>
      )}
    </div>
  );
}
