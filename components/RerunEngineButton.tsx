"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { rerunEngine } from "@/lib/engine-actions";

export default function RerunEngineButton({
  projectId,
  hasData,
}: {
  projectId: string;
  hasData: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleRerun() {
    setError(null);
    startTransition(async () => {
      const result = await rerunEngine(projectId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Engine failed — please try again");
      }
    });
  }

  if (!hasData) {
    return (
      <div
        style={{
          border: "0.5px solid rgba(26,24,21,0.14)",
          borderRadius: "12px",
          background: "#F8F5F0",
          padding: "48px 32px",
          marginBottom: "40px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#8A857C",
            marginBottom: "12px",
          }}
        >
          FYLYMPITCH ENGINE
        </p>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "22px",
            fontWeight: 400,
            color: "#1A1815",
            marginBottom: "10px",
          }}
        >
          AI analysis not yet generated
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#8A857C",
            maxWidth: "420px",
            margin: "0 auto 24px",
            lineHeight: 1.7,
          }}
        >
          Run the engine to unlock funding intelligence, matched opportunities,
          your financing roadmap, and more.
        </p>
        {error && (
          <p
            style={{
              fontSize: "12px",
              color: "#a33030",
              marginBottom: "16px",
            }}
          >
            {error}
          </p>
        )}
        <button
          onClick={handleRerun}
          disabled={isPending}
          style={{
            background: isPending ? "#8A857C" : "#1A1815",
            color: "#F8F5F0",
            border: "none",
            padding: "12px 28px",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "12px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderRadius: "7px",
            cursor: isPending ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            transition: "background 0.2s",
          }}
        >
          {isPending && (
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                border: "2px solid rgba(248,245,240,0.3)",
                borderTopColor: "#F8F5F0",
                animation: "fylym-spin 0.7s linear infinite",
                flexShrink: 0,
              }}
            />
          )}
          {isPending ? "Running engine…" : "Generate AI analysis →"}
        </button>
        <style>{`@keyframes fylym-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Compact re-run button (data already exists)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <button
        onClick={handleRerun}
        disabled={isPending}
        style={{
          background: "transparent",
          color: isPending ? "#8A857C" : "#1A1815",
          border: "0.5px solid rgba(26,24,21,0.2)",
          padding: "7px 16px",
          fontFamily: "'Montserrat', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          borderRadius: "6px",
          cursor: isPending ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          transition: "border-color 0.2s",
        }}
      >
        {isPending && (
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              border: "1.5px solid rgba(26,24,21,0.2)",
              borderTopColor: "#1A1815",
              animation: "fylym-spin 0.7s linear infinite",
              flexShrink: 0,
            }}
          />
        )}
        {isPending ? "Running…" : "↻ Re-run engine"}
      </button>
      {error && (
        <span style={{ fontSize: "12px", color: "#a33030" }}>{error}</span>
      )}
      <style>{`@keyframes fylym-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
