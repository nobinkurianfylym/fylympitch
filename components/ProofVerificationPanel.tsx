"use client";
// app/components/filmmaker/ProofVerificationPanel.tsx
// Full verification details panel — shown in filmmaker project detail
// and producer project view (read-only)

import { useState } from "react";

interface ProofEntry {
  id: string;
  version: number;
  file_name: string | null;
  proof_type: "file" | "snapshot";
  sha256_hash: string;
  ots_status: "pending" | "anchored" | "failed";
  bitcoin_block_height: number | null;
  anchored_at: string | null;
  created_at: string;
}

interface ProofVerificationPanelProps {
  proofs: ProofEntry[];
  projectTitle: string;
  viewerRole?: "filmmaker" | "producer";
}

export function ProofVerificationPanel({
  proofs,
  projectTitle,
  viewerRole = "filmmaker",
}: ProofVerificationPanelProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    proofs[0]?.id ?? null
  );

  const latestAnchored = proofs.find((p) => p.ots_status === "anchored");
  const hasAnyAnchored = !!latestAnchored;

  async function downloadCertificate(proofId: string) {
    setDownloadingId(proofId);
    try {
      const res = await fetch(`/api/proofs/${proofId}/certificate`);
      const data = await res.json();
      if (data.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.filename || `proof-${proofId.slice(0, 8)}.ots`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Certificate download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  }

  function truncateHash(hash: string): string {
    return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
  }

  return (
    <div
      className="border border-[#BF9953]/20 bg-[#F5F5F0]"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      {/* Header */}
      <div className="border-b border-[#1A1815]/8 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.15em] text-[#8A857C] mb-1"
            >
              Proof of Existence
            </p>
            <h3
              className="text-[13px] font-medium text-[#1A1815]"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              {hasAnyAnchored
                ? "Bitcoin Anchored"
                : "Cryptographic Record"}
            </h3>
          </div>

          {hasAnyAnchored ? (
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#BF9953]" />
                <span className="text-[11px] text-[#BF9953] uppercase tracking-wider">
                  Bitcoin Verified
                </span>
              </div>
              <p className="text-[10px] text-[#8A857C]">
                Block #{latestAnchored?.bitcoin_block_height?.toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8A857C] animate-pulse" />
                <span className="text-[11px] text-[#8A857C] uppercase tracking-wider">
                  Anchoring in Progress
                </span>
              </div>
              <p className="text-[10px] text-[#8A857C]">
                Typically 2–6 hours
              </p>
            </div>
          )}
        </div>

        {/* Trust statement */}
        <p className="mt-3 text-[11px] text-[#8A857C] leading-relaxed">
          Every version of this project is cryptographically fingerprinted and
          anchored to the Bitcoin blockchain. The original files are never
          disclosed — only their unique hash is recorded.
        </p>
      </div>

      {/* Proof entries */}
      <div className="divide-y divide-[#1A1815]/6">
        {proofs.map((proof) => {
          const isExpanded = expandedId === proof.id;
          const typeLabel =
            proof.proof_type === "file" ? "Pitch Deck" : "Project Data";

          return (
            <div key={proof.id}>
              {/* Row header */}
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : proof.id)
                }
                className="w-full flex items-center justify-between px-6 py-3 hover:bg-[#1A1815]/3 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm ${
                      proof.ots_status === "anchored"
                        ? "bg-[#BF9953]/15 text-[#BF9953]"
                        : proof.ots_status === "failed"
                        ? "bg-red-50 text-red-400"
                        : "bg-[#8A857C]/10 text-[#8A857C]"
                    }`}
                  >
                    {proof.ots_status === "anchored"
                      ? "₿ Anchored"
                      : proof.ots_status === "failed"
                      ? "Failed"
                      : "Pending"}
                  </span>
                  <span className="text-[12px] text-[#1A1815]">
                    {typeLabel} · v{proof.version}
                  </span>
                  {proof.file_name && (
                    <span className="text-[11px] text-[#8A857C]">
                      {proof.file_name}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#8A857C]">
                  {formatDate(proof.created_at)}
                </span>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-6 pb-4 pt-0 bg-[#1A1815]/2">
                  <div className="space-y-2.5">
                    {/* SHA-256 */}
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] uppercase tracking-wider text-[#8A857C] w-28 mt-0.5 shrink-0">
                        SHA-256
                      </span>
                      <span className="font-mono text-[11px] text-[#1A1815] break-all">
                        {proof.sha256_hash}
                      </span>
                    </div>

                    {/* Submitted */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-wider text-[#8A857C] w-28 shrink-0">
                        Submitted
                      </span>
                      <span className="text-[12px] text-[#1A1815]">
                        {formatDate(proof.created_at)} UTC
                      </span>
                    </div>

                    {/* Bitcoin block */}
                    {proof.ots_status === "anchored" && (
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase tracking-wider text-[#8A857C] w-28 shrink-0">
                          Bitcoin Block
                        </span>
                        <span className="text-[12px] text-[#1A1815]">
                          #{proof.bitcoin_block_height?.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Anchored at */}
                    {proof.anchored_at && (
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase tracking-wider text-[#8A857C] w-28 shrink-0">
                          Anchored
                        </span>
                        <span className="text-[12px] text-[#1A1815]">
                          {formatDate(proof.anchored_at)} UTC
                        </span>
                      </div>
                    )}

                    {/* Download — filmmakers only */}
                    {viewerRole === "filmmaker" && (
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#8A857C] w-28 shrink-0">
                          Certificate
                        </span>
                        {proof.ots_status === "anchored" ||
                        proof.ots_status === "pending" ? (
                          <button
                            onClick={() => downloadCertificate(proof.id)}
                            disabled={downloadingId === proof.id}
                            className="flex items-center gap-1.5 text-[11px] text-[#BF9953] hover:text-[#1A1815] transition-colors disabled:opacity-50"
                          >
                            {downloadingId === proof.id
                              ? "Generating link…"
                              : `Download .ots${
                                  proof.ots_status === "pending"
                                    ? " (pending)"
                                    : ""
                                }`}
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#8A857C]">
                            Not available
                          </span>
                        )}
                      </div>
                    )}

                    {/* Verification note */}
                    {proof.ots_status === "anchored" && (
                      <p className="text-[10px] text-[#8A857C] pt-1 border-t border-[#1A1815]/6 mt-2">
                        This certificate can be independently verified at
                        opentimestamps.org — no account required, even if
                        Pitch.Fylym no longer exists.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* What this proves — bottom note */}
      <div className="px-6 py-3 border-t border-[#1A1815]/8">
        <p className="text-[10px] text-[#8A857C] leading-relaxed">
          Cryptographic proof of submission date, independently verifiable via
          Bitcoin. Not a substitute for copyright registration.
        </p>
      </div>
    </div>
  );
}
