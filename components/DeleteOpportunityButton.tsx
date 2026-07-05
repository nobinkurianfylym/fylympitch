"use client";

import { useState, useTransition } from "react";
import { deleteProducerOpportunity } from "@/lib/actions";

export default function DeleteOpportunityButton({
  opportunityId,
  title,
}: {
  opportunityId: string;
  title: string;
}) {
  const [error, setError]         = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("opportunity_id", opportunityId);
      const result = await deleteProducerOpportunity(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-[11px] tracking-[0.14em] uppercase text-ash hover:text-red-600 transition-colors disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
