"use client";
// components/ProofVerificationPanel.tsx

import { useState } from "react";

interface ProofEntry {
  id: string;
  version: number;
  file_name: string | null;
  proof_type: "file" | "snapshot";
  sha256_hash: string;
  ots_status: "pending" | "anchored" | "failed";
  bitcoin_block_height: number | null;
  bitcoin_block_hash: string | null;
  anchored_at: string | null;
  created_at: string;
}

interface ProofVerificationPanelProps {
  proofs: ProofEntry[];
  projectTitle: string;
  viewerRole?: "filmmaker" | "producer";
}

export function ProofVerificationPanel({
  proofs, projectTitle, viewerRole = "filmmaker",
}: ProofVerificationPanelProps) {
  const [downloadingId, setDownloadingId]     = useState<string | null>(null);
  const [snapshotDlId, setSnapshotDlId]       = useState<string | null>(null);
  const [copiedId, setCopiedId]               = useState<string | null>(null);
  const [expandedId, setExpandedId]           = useState<string | null>(proofs[0]?.id ?? null);

  const latestAnchored = proofs.find((p) => p.ots_status === "anchored");
  const hasAnyAnchored = !!latestAnchored;

  async function downloadCertificate(proofId: string) {
    setDownloadingId(proofId);
    try {
      const res  = await fetch(`/api/proofs/${proofId}/certificate`);
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.filename || `proof-${proofId.slice(0, 8)}.ots`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } finally { setDownloadingId(null); }
  }

  async function downloadSnapshot(proofId: string) {
    setSnapshotDlId(proofId);
    try {
      const res = await fetch(`/api/proofs/${proofId}/snapshot`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `fylym-snapshot-${proofId.slice(0, 8)}.json`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } finally { setSnapshotDlId(null); }
  }

  function copyVerifyLink(hash: string, proofId: string) {
    const url = `${window.location.origin}/verify/${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(proofId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    });
  }

  return (
    <div style={{
      background: "#1A1815", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.08)",
      overflow: "hidden", fontFamily: "Montserrat, sans-serif",
    }}>

      {/* Header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>
              Proof of Existence
            </p>
            <p style={{ fontSize: 13, color: "#F5F5F0", fontFamily: "Playfair Display, serif", fontWeight: 400 }}>
              {hasAnyAnchored ? "Bitcoin Anchored" : "Cryptographic Record"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            {hasAnyAnchored ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#BF9953" }} />
                  <span style={{ fontSize: 9, color: "#BF9953", letterSpacing: "0.12em", textTransform: "uppercase" }}>Bitcoin Verified</span>
                </div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Block #{latestAnchored?.bitcoin_block_height?.toLocaleString()}</p>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginBottom: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Anchoring in Progress</span>
                </div>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Typically 2–6 hours</p>
              </>
            )}
          </div>
        </div>
        <p style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
          Every version of this project is cryptographically fingerprinted and anchored to the Bitcoin blockchain.
          The original files are never disclosed — only their unique hash is recorded.
        </p>
      </div>

      {/* Proof entries */}
      <div>
        {proofs.map((proof, i) => {
          const isExpanded  = expandedId === proof.id;
          const typeLabel   = proof.proof_type === "file" ? "Pitch Deck" : "Project Data";
          const isAnchored  = proof.ots_status === "anchored";

          return (
            <div key={proof.id} style={{ borderBottom: i < proofs.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : proof.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                    padding: "2px 6px", borderRadius: 4,
                    background: isAnchored ? "rgba(191,153,83,0.15)" : "rgba(255,255,255,0.06)",
                    color: isAnchored ? "#BF9953" : "rgba(255,255,255,0.35)",
                  }}>
                    {isAnchored ? "₿ Anchored" : "Pending"}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{typeLabel} · v{proof.version}</span>
                </div>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div style={{ padding: "0 16px 14px", background: "rgba(0,0,0,0.2)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>

                    {/* SHA-256 */}
                    <div>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>SHA-256</p>
                      <p style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.5)", wordBreak: "break-all", lineHeight: 1.6 }}>{proof.sha256_hash}</p>
                    </div>

                    {/* Submitted */}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Submitted</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{formatDate(proof.created_at)} UTC</span>
                    </div>

                    {/* Bitcoin block */}
                    {isAnchored && proof.bitcoin_block_height && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Bitcoin Block</span>
                        <span style={{ fontSize: 10, color: "#BF9953" }}>#{proof.bitcoin_block_height.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Anchored at */}
                    {proof.anchored_at && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Anchored</span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{formatDate(proof.anchored_at)} UTC</span>
                      </div>
                    )}

                    {/* Action buttons — filmmaker only */}
                    {viewerRole === "filmmaker" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>

                        {/* Copy verify link */}
                        <button
                          onClick={() => copyVerifyLink(proof.sha256_hash, proof.id)}
                          style={{
                            width: "100%", padding: "7px 0",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 6, cursor: "pointer",
                            fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                            color: copiedId === proof.id ? "#BF9953" : "rgba(255,255,255,0.5)",
                          }}
                        >
                          {copiedId === proof.id ? "✓ Link Copied" : "⎘ Copy Verification Link"}
                        </button>

                        {/* Download .ots */}
                        <button
                          onClick={() => downloadCertificate(proof.id)}
                          disabled={!!downloadingId}
                          style={{
                            width: "100%", padding: "7px 0",
                            background: isAnchored ? "rgba(191,153,83,0.15)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isAnchored ? "rgba(191,153,83,0.3)" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: 6, cursor: "pointer",
                            fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                            color: isAnchored ? "#BF9953" : "rgba(255,255,255,0.35)",
                            opacity: downloadingId === proof.id ? 0.5 : 1,
                          }}
                        >
                          {downloadingId === proof.id ? "Generating…" : `↓ Download .ots${proof.ots_status === "pending" ? " (pending)" : ""}`}
                        </button>

                        {/* Download snapshot JSON — snapshot proofs only */}
                        {proof.proof_type === "snapshot" && (
                          <button
                            onClick={() => downloadSnapshot(proof.id)}
                            disabled={!!snapshotDlId}
                            style={{
                              width: "100%", padding: "7px 0",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 6, cursor: "pointer",
                              fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                              color: "rgba(255,255,255,0.3)",
                              opacity: snapshotDlId === proof.id ? 0.5 : 1,
                            }}
                          >
                            {snapshotDlId === proof.id ? "Downloading…" : "↓ Download Snapshot JSON"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", lineHeight: 1.6 }}>
          Your submission date is now part of Bitcoin's permanent record —
          independently verifiable by anyone, anywhere, forever.
        </p>
      </div>
    </div>
  );
}
