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
  const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null);
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

  async function downloadPdfCertificate(proof: ProofEntry) {
    if (!proof.anchored_at || !proof.bitcoin_block_height) return;
    setPdfGeneratingId(proof.id);
    try {
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const H = 297;

      // ── Background ──────────────────────────────────────────
      doc.setFillColor(245, 245, 240); // Ivory
      doc.rect(0, 0, W, H, "F");

      // Gold top stripe
      doc.setFillColor(191, 153, 83);
      doc.rect(0, 0, W, 6, "F");

      // Ink bottom stripe
      doc.setFillColor(26, 24, 21);
      doc.rect(0, H - 6, W, 6, "F");

      // Outer border
      doc.setDrawColor(26, 24, 21);
      doc.setLineWidth(0.4);
      doc.rect(14, 14, W - 28, H - 28);

      // Inner gold border
      doc.setDrawColor(191, 153, 83);
      doc.setLineWidth(0.15);
      doc.rect(17, 17, W - 34, H - 34);

      // ── Wordmark ────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(26, 24, 21);
      doc.setCharSpace(4);
      doc.text("PITCH.FYLYM", W / 2, 36, { align: "center" });
      doc.setCharSpace(0);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(138, 133, 124);
      doc.setCharSpace(2.5);
      doc.text("PROOF OF EXISTENCE", W / 2, 43, { align: "center" });
      doc.setCharSpace(0);

      // Gold rule
      doc.setDrawColor(191, 153, 83);
      doc.setLineWidth(0.6);
      doc.line(W / 2 - 24, 48, W / 2 + 24, 48);

      // ── Certificate heading ─────────────────────────────────
      doc.setFont("times", "italic");
      doc.setFontSize(13);
      doc.setTextColor(138, 133, 124);
      doc.text("Certificate of", W / 2, 63, { align: "center" });

      doc.setFont("times", "normal");
      doc.setFontSize(30);
      doc.setTextColor(26, 24, 21);
      doc.text("Existence", W / 2, 76, { align: "center" });

      // ── Project title box ───────────────────────────────────
      doc.setFillColor(26, 24, 21);
      doc.roundedRect(30, 86, W - 60, 22, 3, 3, "F");

      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.setTextColor(245, 245, 240);
      const shortTitle = projectTitle.length > 50
        ? projectTitle.slice(0, 48) + "…"
        : projectTitle;
      doc.text(shortTitle.toUpperCase(), W / 2, 100, { align: "center", maxWidth: W - 70 });

      // ── Body text ───────────────────────────────────────────
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(138, 133, 124);
      const bodyText = [
        "This certifies that the digital creation above was verifiably in existence",
        "at the time of submission. Its cryptographic fingerprint (SHA-256) is",
        "permanently recorded on the Bitcoin blockchain — immutable and independently",
        "verifiable by anyone, anywhere, forever.",
      ];
      let lineY = 124;
      for (const line of bodyText) {
        doc.text(line, W / 2, lineY, { align: "center" });
        lineY += 6;
      }

      // ── Data rows ───────────────────────────────────────────
      const rowLeft = 30;
      const rowRight = W - 30;
      const rowW = rowRight - rowLeft;
      let rowY = 158;
      const rowH = 20;
      const rowGap = 4;

      function dataRow(label: string, value: string, valueColor: [number, number, number]) {
        // Row background
        doc.setFillColor(250, 249, 246);
        doc.setDrawColor(229, 224, 213);
        doc.setLineWidth(0.15);
        doc.roundedRect(rowLeft, rowY, rowW, rowH, 2, 2, "FD");

        // Label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(138, 133, 124);
        doc.setCharSpace(1.5);
        doc.text(label, rowLeft + 6, rowY + 7);
        doc.setCharSpace(0);

        // Value
        doc.setFont(label === "SHA-256 FINGERPRINT" ? "courier" : "helvetica", "normal");
        doc.setFontSize(label === "SHA-256 FINGERPRINT" ? 6.5 : 9);
        doc.setTextColor(...valueColor);
        doc.text(value, rowLeft + 6, rowY + 14, { maxWidth: rowW - 12 });

        rowY += rowH + rowGap;
      }

      dataRow("SHA-256 FINGERPRINT", proof.sha256_hash, [26, 24, 21]);
      dataRow("BITCOIN BLOCK HEIGHT", `#${proof.bitcoin_block_height.toLocaleString()}`, [191, 153, 83]);
      dataRow(
        "ANCHORED",
        new Date(proof.anchored_at).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", timeZone: "UTC",
        }) + " UTC",
        [26, 24, 21]
      );
      dataRow("VERIFY AT", `pitch.fylym.com/verify/${proof.sha256_hash.slice(0, 16)}…`, [191, 153, 83]);

      // ── Version badge ───────────────────────────────────────
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(138, 133, 124);
      const vLabel = proof.proof_type === "file" ? "Pitch Deck" : "Project Data";
      doc.text(`${vLabel} · Version ${proof.version}`, W / 2, rowY + 8, { align: "center" });

      // ── Footer ──────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(26, 24, 21);
      doc.setCharSpace(2);
      doc.text("PITCH.FYLYM", W / 2, H - 22, { align: "center" });
      doc.setCharSpace(0);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(138, 133, 124);
      doc.text("pitch.fylym.com · Intelligent film financing", W / 2, H - 16, { align: "center" });

      // ── Save ────────────────────────────────────────────────
      const safeName = projectTitle.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").slice(0, 32);
      doc.save(`FYLYM-Proof-${safeName}-v${proof.version}.pdf`);
    } catch (err) {
      console.error("[ProofPanel] PDF generation failed:", err);
    } finally {
      setPdfGeneratingId(null);
    }
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

                        {/* Verify link row */}
                        <div style={{ display: "flex", gap: 6 }}>
                          <a
                            href={`/verify/${proof.sha256_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              flex: 1, padding: "7px 0", textAlign: "center",
                              background: "rgba(191,153,83,0.1)",
                              border: "1px solid rgba(191,153,83,0.25)",
                              borderRadius: 6, cursor: "pointer",
                              fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                              color: "#BF9953", textDecoration: "none",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            ↗ View Proof
                          </a>
                          <button
                            onClick={() => copyVerifyLink(proof.sha256_hash, proof.id)}
                            style={{
                              flex: 1, padding: "7px 0",
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 6, cursor: "pointer",
                              fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                              color: copiedId === proof.id ? "#BF9953" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {copiedId === proof.id ? "✓ Copied" : "⎘ Copy Link"}
                          </button>
                        </div>

                        {/* PDF Certificate — anchored only */}
                        {isAnchored && (
                          <button
                            onClick={() => downloadPdfCertificate(proof)}
                            disabled={!!pdfGeneratingId}
                            style={{
                              width: "100%", padding: "8px 0",
                              background: "rgba(191,153,83,0.18)",
                              border: "1px solid rgba(191,153,83,0.4)",
                              borderRadius: 6, cursor: pdfGeneratingId ? "not-allowed" : "pointer",
                              fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                              color: "#BF9953",
                              opacity: pdfGeneratingId === proof.id ? 0.5 : 1,
                            }}
                          >
                            {pdfGeneratingId === proof.id ? "Generating Certificate…" : "↓ Download PDF Certificate"}
                          </button>
                        )}

                        {/* Download .ots */}
                        <button
                          onClick={() => downloadCertificate(proof.id)}
                          disabled={!!downloadingId}
                          style={{
                            width: "100%", padding: "7px 0",
                            background: isAnchored ? "rgba(191,153,83,0.08)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isAnchored ? "rgba(191,153,83,0.2)" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: 6, cursor: "pointer",
                            fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                            color: isAnchored ? "rgba(191,153,83,0.7)" : "rgba(255,255,255,0.35)",
                            opacity: downloadingId === proof.id ? 0.5 : 1,
                          }}
                        >
                          {downloadingId === proof.id ? "Downloading…" : `↓ Raw .ots File${proof.ots_status === "pending" ? " (pending)" : ""}`}
                        </button>

                        {/* Download snapshot JSON */}
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
