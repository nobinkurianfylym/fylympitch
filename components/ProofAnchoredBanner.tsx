"use client";
// Dismissible gold banner shown on project detail page
// when a Bitcoin anchoring proof_notification is unread

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  notificationId: string;
  projectTitle: string;
  bitcoinBlock?: number | null;
  body: string;
}

export function ProofAnchoredBanner({
  notificationId,
  projectTitle,
  bitcoinBlock,
  body,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  async function dismiss() {
    setDismissed(true);
    const supabase = createClient();
    await supabase
      .from("proof_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
  }

  if (dismissed) return null;

  return (
    <div
      style={{
        background: "rgba(191,153,83,0.07)",
        borderBottom: "1px solid rgba(191,153,83,0.25)",
        padding: "10px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Bitcoin dot */}
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#BF9953", flexShrink: 0,
        }} />

        <span style={{
          fontSize: 11,
          fontFamily: "Montserrat, sans-serif",
          letterSpacing: "0.06em",
          color: "#BF9953",
        }}>
          ₿ BITCOIN ANCHORED
          {bitcoinBlock && (
            <span style={{ color: "rgba(191,153,83,0.65)", marginLeft: 8 }}>
              Block #{bitcoinBlock.toLocaleString()}
            </span>
          )}
        </span>

        <span style={{
          fontSize: 12,
          color: "#8A857C",
          fontFamily: "Montserrat, sans-serif",
        }}>
          — {body}
        </span>
      </div>

      <button
        onClick={dismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#8A857C",
          fontSize: 16,
          lineHeight: 1,
          padding: "2px 4px",
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
