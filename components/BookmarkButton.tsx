"use client";

import { useState, useTransition } from "react";
import { toggleSavedOpportunity } from "@/lib/saved-actions";

export default function BookmarkButton({
  opportunityId,
  projectId,
  initialSaved = false,
  size = 16,
}: {
  opportunityId: string;
  projectId?: string;
  initialSaved?: boolean;
  size?: number;
}) {
  const [saved, setSaved]   = useState(initialSaved);
  const [pending, startT]   = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startT(async () => {
      const result = await toggleSavedOpportunity(opportunityId, projectId);
      if (result.error === undefined) setSaved(result.saved);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title={saved ? "Remove from saved" : "Save for later"}
      style={{
        background:  "transparent",
        border:      "none",
        cursor:      pending ? "wait" : "pointer",
        padding:     4,
        display:     "flex",
        alignItems:  "center",
        justifyContent: "center",
        flexShrink:  0,
        opacity:     pending ? 0.5 : 1,
        transition:  "opacity 0.15s, transform 0.15s",
        transform:   pending ? "scale(0.9)" : "scale(1)",
      }}
      aria-label={saved ? "Unsave" : "Save for later"}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={saved ? "#BF9953" : "none"}
        stroke={saved ? "#BF9953" : "#8A857C"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
