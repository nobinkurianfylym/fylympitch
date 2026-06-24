"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertProducerProject } from "@/lib/actions";

interface Props {
  projectId: string;
  currentStatus?: string | null;
  currentRating?: string | null;
  currentNotes?: string | null;
  nextProjectId?: string | null;
}

export default function PassAndAdvanceButton({
  projectId,
  currentStatus,
  currentRating,
  currentNotes,
  nextProjectId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [passed, setPassed] = useState(currentStatus === "passed");

  if (passed) {
    return (
      <div style={{
        textAlign: "center", padding: "9px 0", marginBottom: 24,
        fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(138,133,124,0.35)", fontFamily: "Montserrat, sans-serif",
      }}>
        Passed
      </div>
    );
  }

  function handlePass() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("project_id", projectId);
      fd.set("status",     "passed");
      fd.set("rating",     currentRating ?? "");
      fd.set("notes",      currentNotes  ?? "");
      await upsertProducerProject(fd);
      setPassed(true);
      // Navigate to next project after brief moment, or back to all projects
      setTimeout(() => {
        if (nextProjectId) {
          router.push(`/producerstudio/projects/${nextProjectId}`);
        } else {
          router.push("/producerstudio/projects");
        }
      }, 600);
    });
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        type="button"
        onClick={handlePass}
        disabled={pending}
        className="fyp-pass-btn"
        style={{
          width: "100%", padding: "9px 0",
          background: "transparent",
          border: "1px solid rgba(26,24,21,0.09)",
          borderRadius: 6, fontSize: 10,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: pending ? "rgba(138,133,124,0.3)" : "rgba(138,133,124,0.45)",
          cursor: pending ? "not-allowed" : "pointer",
          fontFamily: "Montserrat, sans-serif",
          textAlign: "center", transition: "all 0.15s",
        }}
      >
        {pending ? "Passing…" : "Pass on this project"}
      </button>
    </div>
  );
}
