"use client";

import { useState, useTransition } from "react";
import { upsertProducerProject } from "@/lib/actions";

interface Props {
  projectId: string;
  inPipeline: boolean;
  fullWidth?: boolean;
}

export default function AddToPipelineButton({ projectId, inPipeline, fullWidth = true }: Props) {
  const [added, setAdded]   = useState(inPipeline);
  const [pending, startTransition] = useTransition();

  if (added) {
    return (
      <div className={`flex items-center justify-center gap-1.5 py-2 rounded-card border border-emerald-200 bg-emerald-50 ${fullWidth ? "w-full" : ""}`}>
        <span className="text-[11px] tracking-[0.1em] text-emerald-600 font-medium">✓ In Pipeline</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          const fd = new FormData();
          fd.set("project_id", projectId);
          fd.set("status", "saved");
          await upsertProducerProject(fd);
          setAdded(true);
        });
      }}
      className={`py-2 rounded-card border border-line text-[11px] tracking-[0.1em] text-ash hover:border-gold hover:text-gold transition-all disabled:opacity-50 ${fullWidth ? "w-full" : "px-3"}`}
    >
      {pending ? "Adding…" : "+ Add to Pipeline"}
    </button>
  );
}
