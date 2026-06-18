"use client";

import { useState, useTransition } from "react";
import { upsertProducerProject } from "@/lib/actions";

interface Props {
  projectId: string;
  inPipeline: boolean;
}

export default function AddToPipelineButton({ projectId, inPipeline }: Props) {
  const [added, setAdded] = useState(inPipeline);
  const [pending, startTransition] = useTransition();

  if (added) {
    return (
      <span className="shrink-0 text-[11px] tracking-[0.1em] text-emerald-600 font-medium">
        ✓ In Pipeline
      </span>
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
      className="shrink-0 px-3 py-1.5 rounded-card border border-line text-[11px] tracking-[0.1em] text-ash hover:border-gold hover:text-gold transition-all disabled:opacity-50"
    >
      {pending ? "…" : "+ Pipeline"}
    </button>
  );
}
