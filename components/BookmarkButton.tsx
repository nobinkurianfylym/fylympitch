"use client";

import { useState, useTransition, useEffect } from "react";
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
  const [saved, setSaved]       = useState(initialSaved);
  const [pending, startT]       = useTransition();
  const [burst, setBurst]       = useState(false);   // pop animation trigger
  const [label, setLabel]       = useState<"saved" | "removed" | null>(null);

  // Clear label after 1.6s
  useEffect(() => {
    if (!label) return;
    const t = setTimeout(() => setLabel(null), 1600);
    return () => clearTimeout(t);
  }, [label]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic — instant feedback before server round-trip
    const next = !saved;
    setSaved(next);
    setBurst(true);
    setTimeout(() => setBurst(false), 300);
    setLabel(next ? "saved" : "removed");

    startT(async () => {
      const result = await toggleSavedOpportunity(opportunityId, projectId);
      // Roll back if server disagrees
      if (result.error !== undefined) setSaved(!next);
    });
  }

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      <button
        onClick={handleClick}
        disabled={pending}
        title={saved ? "Remove from saved" : "Save for later"}
        aria-label={saved ? "Unsave" : "Save for later"}
        style={{
          background: "transparent",
          border:     "none",
          cursor:     "pointer",
          padding:    4,
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.12s cubic-bezier(.34,1.56,.64,1)",
          transform:  burst ? "scale(1.35)" : "scale(1)",
        }}
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
          style={{ transition: "fill 0.15s, stroke 0.15s" }}
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Floating confirm label */}
      {label && (
        <span style={{
          position:   "absolute",
          bottom:     "calc(100% + 4px)",
          left:       "50%",
          transform:  "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize:   9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:      label === "saved" ? "#BF9953" : "#8A857C",
          pointerEvents: "none",
          animation:  "bm-fade 1.6s ease forwards",
        }}>
          {label === "saved" ? "Saved" : "Removed"}
        </span>
      )}

      <style>{`
        @keyframes bm-fade {
          0%   { opacity: 0; transform: translateX(-50%) translateY(4px); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
        }
      `}</style>
    </span>
  );
}
