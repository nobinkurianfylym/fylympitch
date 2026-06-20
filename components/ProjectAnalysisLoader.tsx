"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rerunEngine } from "@/lib/engine-actions";

const STEPS = [
  "Scoring 116 opportunities against your project",
  "Analysing your narrative and funding landscape",
  "Building your financing roadmap",
  "Finalising your AI funding intelligence",
];

export default function ProjectAnalysisLoader({
  projectId,
}: {
  projectId: string;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const router = useRouter();

  // Auto-trigger engine on mount (and on retry)
  useEffect(() => {
    let cancelled = false;
    rerunEngine(projectId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Engine failed — please try again");
      }
    });
    return () => { cancelled = true; };
  }, [projectId, retryKey]);

  // Cycle through steps visually every 7s
  useEffect(() => {
    if (error) return;
    const interval = setInterval(() => {
      setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, 7000);
    return () => clearInterval(interval);
  }, [error, retryKey]);

  if (error) {
    return (
      <div style={{
        border: "0.5px solid rgba(26,24,21,0.14)",
        borderRadius: "12px",
        background: "#F8F5F0",
        padding: "48px 32px",
        marginBottom: "40px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#8A857C", marginBottom: "12px" }}>
          PITCH.FYLYM ENGINE
        </p>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 400, color: "#1A1815", marginBottom: "10px" }}>
          Analysis incomplete
        </h2>
        <p style={{ fontSize: "13px", color: "#a33030", maxWidth: "420px", margin: "0 auto 24px", lineHeight: 1.6 }}>
          {error}
        </p>
        <button
          onClick={() => { setError(null); setStepIndex(0); setRetryKey((k) => k + 1); }}
          style={{
            background: "#1A1815", color: "#F8F5F0", border: "none",
            padding: "11px 24px", fontFamily: "'Montserrat', sans-serif",
            fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase",
            borderRadius: "7px", cursor: "pointer",
          }}
        >
          Try again →
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fylym-spin { to { transform: rotate(360deg); } }
        @keyframes fylym-fade { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
      <div style={{
        background: "#1A1815",
        borderRadius: "14px",
        padding: "44px 32px 40px",
        marginBottom: "40px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(248,245,240,0.4)", marginBottom: "20px" }}>
          PITCH.FYLYM ENGINE
        </p>

        {/* Spinner */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <span style={{
            display: "inline-block", width: "28px", height: "28px",
            borderRadius: "50%",
            border: "2.5px solid rgba(191,153,83,0.25)",
            borderTopColor: "#BF9953",
            animation: "fylym-spin 0.9s linear infinite",
          }} />
        </div>

        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "24px", fontWeight: 400,
          color: "#F8F5F0", marginBottom: "8px",
        }}>
          Analysing your project…
        </h2>

        {/* Cycling step */}
        <p style={{
          fontSize: "13px", color: "rgba(248,245,240,0.5)",
          marginBottom: "28px", minHeight: "20px",
          transition: "opacity 0.4s",
        }}>
          {STEPS[stepIndex]}
        </p>

        <p style={{ fontSize: "11px", color: "rgba(248,245,240,0.3)", marginTop: "4px" }}>
          This takes about 20–30 seconds
        </p>
      </div>
    </>
  );
}
