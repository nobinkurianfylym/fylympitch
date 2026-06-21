"use client";
// app/admin/intelligence/ReviewQueueActions.tsx
// Client component for approve/reject buttons on the review queue.

import { useState } from "react";
import { approveReviewItem, rejectReviewItem } from "./actions";

interface Props {
  itemId: string;
  extractedData: Record<string, unknown>;
  sourceUrl: string;
}

export function ReviewQueueActions({ itemId, extractedData, sourceUrl }: Props) {
  const [state, setState] = useState<"idle" | "approving" | "rejecting" | "done_approve" | "done_reject" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function handleApprove() {
    setState("approving");
    setErr(null);
    const res = await approveReviewItem(itemId, extractedData, sourceUrl);
    if (res.error) {
      setErr(res.error);
      setState("error");
    } else {
      setState("done_approve");
    }
  }

  async function handleReject() {
    setState("rejecting");
    setErr(null);
    const res = await rejectReviewItem(itemId);
    if (res.error) {
      setErr(res.error);
      setState("error");
    } else {
      setState("done_reject");
    }
  }

  if (state === "done_approve") {
    return (
      <div className="text-[12px] text-emerald-700 font-normal whitespace-nowrap">
        ✓ Approved
      </div>
    );
  }

  if (state === "done_reject") {
    return (
      <div className="text-[12px] text-ash font-normal whitespace-nowrap">
        Rejected
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-end shrink-0">
      <button
        onClick={handleApprove}
        disabled={state !== "idle"}
        className="text-[11px] uppercase tracking-[0.12em] font-normal px-3 py-1.5 bg-ink text-ivory rounded hover:bg-gold transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {state === "approving" ? "Publishing…" : "Approve"}
      </button>
      <button
        onClick={handleReject}
        disabled={state !== "idle"}
        className="text-[11px] uppercase tracking-[0.12em] font-normal px-3 py-1.5 border border-line text-ash rounded hover:text-ink transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {state === "rejecting" ? "Rejecting…" : "Reject"}
      </button>
      {err && (
        <p className="text-[10px] text-red-600 font-normal text-right max-w-[120px]">{err}</p>
      )}
    </div>
  );
}
