"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { upsertProducerProject } from "@/lib/actions";

type Stage = "idle" | "saving" | "confirmed" | "done";

export default function SaveToPipelineButton({ projectId }: { projectId: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [, startTransition] = useTransition();

  function handleSave() {
    setStage("saving");
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("status", "saved");
    startTransition(async () => {
      await upsertProducerProject(fd);
      setStage("confirmed");
      setTimeout(() => setStage("done"), 1400);
    });
  }

  if (stage === "confirmed") {
    return (
      <p className="text-[12px] text-emerald-600 font-medium text-center py-1.5 tracking-[0.04em]">
        ✓ Saved to pipeline
      </p>
    );
  }

  if (stage === "done") {
    return (
      <Link
        href="/producerstudio/pipeline"
        className="block text-center text-[12px] text-gold hover:underline py-1.5"
      >
        Open in Pipeline →
      </Link>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={stage === "saving"}
      className="btn-ghost !py-1.5 w-full text-[12px] disabled:opacity-40"
    >
      {stage === "saving" ? "Saving…" : "+ Add to Pipeline"}
    </button>
  );
}
