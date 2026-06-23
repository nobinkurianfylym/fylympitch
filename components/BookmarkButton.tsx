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
  const [saved, setSaved]     = useState(initialSaved);
  const [pending, startT]     = useTransition();
  const [burst, setBurst]     = useState(false);
  const [label, setLabel]     = useState<"saved" | "removed" | "error" | null>(null);

  useEffect(() => {
    if (!label) return;
    const t = setTimeout(() => setLabel(null), 1800);
    return () => clearTimeout(t);
  }, [label]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const next = !saved;
    // Optimistic
    setSaved(next);
    setBurst(true);
    setTimeout(() => setBurst(false), 300);

    startT(async () => {
      const result = await toggleSavedOpportunity(opportunityId, projectId);
      if (result.error !== undefined) {
        // Roll back
        setSaved(!next);
        setLabel("error");
        console.error("[BookmarkButton] save failed:", result.error);
      } else {
        setLabel(result.saved ? "saved" : "removed");
      }
    });
  }

  const labelColor =
    label === "saved"   ? "#BF9953" :
    label === "removed" ? "#8A857C" :
    label === "error"   ? "#b91c1c" : "#8A857C";

  const labelText =
    label === "saved"   ? "Saved" :
    label === "removed" ? "Removed" :
    label === "error"   ? "Error" : "";

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
          cursor:     pending ? "wait" : "pointer",
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

      {label && (
        <span style={{
          position:      "absolute",
          bottom:        "calc(100% + 4px)",
          left:          "50%",
          transform:     "translateX(-50%)",
          whiteSpace:    "nowrap",
          fontSize:      9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         labelColor,
          pointerEvents: "none",
          animation:     "bm-fade 1.8s ease forwards",
        }}>
          {labelText}
        </span>
      )}

      <style>{`
        @keyframes bm-fade {
          0%   { opacity: 0; transform: translateX(-50%) translateY(4px); }
          12%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
        }
      `}</style>
    </span>
  );
}
