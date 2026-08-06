// app/verify/[hash]/page.tsx
// Public proof verification page — no auth required
// Filmmaker shares this URL as proof of prior existence
// Shows Bitcoin block, submission date, status, independent verification steps

import { createClient } from "@supabase/supabase-js";
import { supabaseUrl as getSupabaseUrl, supabaseAnonKey as getSupabaseAnonKey, supabaseServiceRoleKey as getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}): Promise<Metadata> {
  const { hash } = await params;
  return {
    title: "Proof of Existence — Pitch.Fylym",
    description: `Cryptographic proof anchored to Bitcoin. Hash: ${hash.slice(0, 16)}…`,
  };
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  // Validate hash format
  if (!/^[0-9a-f]{64}$/i.test(hash)) notFound();

  const supabase = createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey()
  );

  // Look up proof by hash — service role bypasses RLS
  const { data: proof } = await supabase
    .from("project_proofs")
    .select(`
      id,
      version,
      proof_type,
      file_name,
      sha256_hash,
      ots_status,
      bitcoin_block_height,
      bitcoin_block_hash,
      anchored_at,
      created_at,
      ots_anchored_path,
      ots_pending_path,
      projects!inner (
        title,
        owner_id
      )
    `)
    .eq("sha256_hash", hash.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!proof) notFound();

  const project = Array.isArray(proof.projects) ? proof.projects[0] : proof.projects;
  const isAnchored = proof.ots_status === "anchored";
  const isPending  = proof.ots_status === "pending";
  const isFailed   = proof.ots_status === "failed";

  // Generate signed certificate URL (valid 5 minutes)
  let certUrl: string | null = null;
  const certPath = proof.ots_anchored_path || proof.ots_pending_path;
  if (certPath) {
    const { data } = await supabase.storage
      .from("proofs")
      .createSignedUrl(certPath, 300);
    certUrl = data?.signedUrl ?? null;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    });
  }

  const typeLabel = proof.proof_type === "file" ? "Pitch Deck" : "Project Data";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F5F5F0",
      fontFamily: "Montserrat, sans-serif",
    }}>

      {/* ── Nav ── */}
      <div style={{
        borderBottom: "1px solid rgba(26,24,21,0.08)",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#F5F5F0",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 16, color: "#1A1815", letterSpacing: "0.02em",
          }}>
            PITCH.FYLYM
          </span>
        </Link>
        <span style={{
          fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "#8A857C",
        }}>
          Proof Verification
        </span>
      </div>

      {/* ── Main ── */}
      <div style={{
        maxWidth: 600, margin: "0 auto", padding: "48px 24px 80px",
      }}>

        {/* Status banner */}
        <div style={{
          background: isAnchored ? "#1A1815" : "rgba(26,24,21,0.05)",
          borderRadius: 14,
          padding: "24px 28px",
          marginBottom: 24,
          border: isAnchored ? "none" : "1px solid rgba(26,24,21,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: isAnchored ? "#BF9953" : isFailed ? "#8A857C" : "rgba(255,255,255,0.3)",
            }} />
            <span style={{
              fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
              color: isAnchored ? "#BF9953" : "#8A857C",
            }}>
              {isAnchored ? "Bitcoin Verified" : isFailed ? "Anchoring Failed" : "Anchoring in Progress"}
            </span>
          </div>

          <h1 style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 22, fontWeight: 400, marginBottom: 4,
            color: isAnchored ? "#F5F5F0" : "#1A1815",
          }}>
            {isAnchored ? "Proof of Existence Verified" : isFailed ? "Anchoring Failed" : "Cryptographic Record"}
          </h1>

          <p style={{
            fontSize: 13, color: isAnchored ? "rgba(245,245,240,0.55)" : "#8A857C",
          }}>
            {project.title} · {typeLabel} v{proof.version}
          </p>
        </div>

        {/* Proof details */}
        <div style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(26,24,21,0.08)",
          overflow: "hidden",
          marginBottom: 24,
        }}>
          {[
            {
              label: "Submitted",
              value: `${formatDate(proof.created_at)} UTC`,
              highlight: false,
            },
            isAnchored && proof.bitcoin_block_height ? {
              label: "Bitcoin Block",
              value: `#${proof.bitcoin_block_height.toLocaleString()}`,
              highlight: true,
            } : null,
            isAnchored && proof.anchored_at ? {
              label: "Anchored",
              value: `${formatDate(proof.anchored_at)} UTC`,
              highlight: false,
            } : null,
            {
              label: "Status",
              value: isAnchored ? "Anchored to Bitcoin" : isPending ? "Pending — typically 2–6 hours" : "Failed",
              highlight: isAnchored,
            },
          ]
            .filter(Boolean)
            .map((row: any, i, arr) => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: i < arr.length - 1 ? "1px solid rgba(26,24,21,0.06)" : "none",
              }}>
                <span style={{
                  fontSize: 11, color: "#8A857C",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: 12,
                  color: row.highlight ? "#BF9953" : "#1A1815",
                  fontWeight: row.highlight ? 500 : 400,
                }}>
                  {row.value}
                </span>
              </div>
            ))}

          {/* SHA-256 */}
          <div style={{
            padding: "14px 20px",
            borderTop: "1px solid rgba(26,24,21,0.06)",
            background: "rgba(26,24,21,0.02)",
          }}>
            <p style={{
              fontSize: 10, color: "#8A857C",
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6,
            }}>
              SHA-256 Fingerprint
            </p>
            <p style={{
              fontSize: 10, fontFamily: "monospace",
              color: "#1A1815", wordBreak: "break-all", lineHeight: 1.7,
            }}>
              {proof.sha256_hash}
            </p>
          </div>
        </div>

        {/* Certificate download */}
        {certUrl && !isFailed && (
          <a
            href={certUrl}
            download={`fylym-proof-${proof.id.slice(0, 8)}.ots`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "14px 20px",
              background: isAnchored ? "#1A1815" : "rgba(26,24,21,0.05)",
              color: isAnchored ? "#BF9953" : "#8A857C",
              borderRadius: 10,
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              textDecoration: "none",
              marginBottom: 24,
              border: isAnchored ? "none" : "1px solid rgba(26,24,21,0.1)",
            }}
          >
            ↓ Download .ots Certificate{isPending ? " (pending)" : ""}
          </a>
        )}

        {/* Independent verification steps */}
        {!isFailed && (
        <div style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(26,24,21,0.08)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(26,24,21,0.06)" }}>
            <p style={{
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#8A857C",
            }}>
              Independent Verification
            </p>
            <p style={{ fontSize: 13, color: "#1A1815", marginTop: 4 }}>
              Verify without relying on Pitch.Fylym
            </p>
          </div>

          {[
            {
              step: "1",
              title: "Get the original file",
              body: "Ask the filmmaker for the original pitch deck or project snapshot JSON that was submitted.",
            },
            {
              step: "2",
              title: "Download the .ots certificate",
              body: "Download it using the button above. This certificate contains the cryptographic proof.",
            },
            {
              step: "3",
              title: "Verify at OpenTimestamps",
              body: "Go to opentimestamps.org/tools/verify — upload both the original file and the .ots certificate. No account needed.",
            },
            {
              step: "4",
              title: "Confirm the Bitcoin block",
              body: `The tool will confirm the file existed before Bitcoin block #${proof.bitcoin_block_height?.toLocaleString() ?? "—"}. This is permanent and cannot be altered.`,
            },
          ].map((item, i, arr) => (
            <div key={item.step} style={{
              display: "flex", gap: 14,
              padding: "14px 20px",
              borderBottom: i < arr.length - 1 ? "1px solid rgba(26,24,21,0.05)" : "none",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "#1A1815", color: "#BF9953",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 600, flexShrink: 0, marginTop: 1,
              }}>
                {item.step}
              </div>
              <div>
                <p style={{ fontSize: 12, color: "#1A1815", marginBottom: 3 }}>{item.title}</p>
                <p style={{ fontSize: 11, color: "#8A857C", lineHeight: 1.6 }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        )}

        {isFailed && (
          <div style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid rgba(26,24,21,0.08)",
            padding: "20px",
          }}>
            <p style={{ fontSize: 12, color: "#1A1815", marginBottom: 6 }}>
              This anchoring attempt did not complete
            </p>
            <p style={{ fontSize: 11, color: "#8A857C", lineHeight: 1.6 }}>
              The submission could not be timestamped to the Bitcoin blockchain. No certificate
              exists for this record. Contact hello@fylym.com if this project needs to be resubmitted.
            </p>
          </div>
        )}

        {/* Footer note */}
        <p style={{
          fontSize: 10, color: "#8A857C", textAlign: "center",
          marginTop: 24, lineHeight: 1.7,
        }}>
          {isFailed
            ? "This record was not anchored to Bitcoin. No proof of existence has been established."
            : "Your submission date is now part of Bitcoin's permanent record — independently verifiable by anyone, anywhere, forever."}
        </p>
      </div>
    </div>
  );
}
