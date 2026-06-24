"use client";
// app/components/filmmaker/ProofBadge.tsx
// Compact proof-of-existence status badge
// Used in project cards and detail page headers

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProofStatus = "none" | "pending" | "anchored";

interface ProofBadgeProps {
  projectId: string;
  // If you already fetched proof status, pass it directly
  initialStatus?: ProofStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ProofBadge({
  projectId,
  initialStatus,
  showLabel = true,
  size = "sm",
}: ProofBadgeProps) {
  const [status, setStatus] = useState<ProofStatus>(initialStatus ?? "none");
  const [loading, setLoading] = useState(!initialStatus);

  useEffect(() => {
    if (initialStatus) return;

    const supabase = createClient();
    supabase
      .from("project_proofs")
      .select("ots_status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.ots_status === "anchored") setStatus("anchored");
        else if (data?.ots_status === "pending") setStatus("pending");
        setLoading(false);
      });
  }, [projectId, initialStatus]);

  if (loading) return null;
  if (status === "none") return null;

  const config = {
    anchored: {
      dot: "bg-[#BF9953]",
      text: "text-[#BF9953]",
      border: "border-[#BF9953]/30",
      bg: "bg-[#BF9953]/8",
      label: "Bitcoin Verified",
      icon: "₿",
    },
    pending: {
      dot: "bg-[#8A857C]",
      text: "text-[#8A857C]",
      border: "border-[#8A857C]/30",
      bg: "bg-[#8A857C]/8",
      label: "Anchoring",
      icon: "◌",
    },
    none: {
      dot: "",
      text: "",
      border: "",
      bg: "",
      label: "",
      icon: "",
    },
  }[status];

  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  const paddingClass = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border ${config.border} ${config.bg} ${paddingClass}`}
    >
      <span className={`text-[8px] ${config.text}`}>{config.icon}</span>
      {showLabel && (
        <span
          className={`font-mono uppercase tracking-wider ${textSize} ${config.text}`}
          style={{ fontFamily: "Montserrat, sans-serif" }}
        >
          {config.label}
        </span>
      )}
    </span>
  );
}
