// actions/proof-actions.ts
// Server-side proof trigger — call after every project save/update
// Works from both initial submission and subsequent edits
// IMPORTANT: Call after the DB write succeeds — never block saves on proof failure

"use server";

import { createClient } from "@/lib/supabase/server";

interface TriggerProjectProofArgs {
  projectId: string;
  projectData: {
    title: string;
    logline?: string | null;
    synopsis?: string | null;
    genre?: string | null;
    format?: string | null;
    budget_amount?: number | null;
    budget_currency?: string | null;
    production_stage?: string | null;
    director?: string | null;
    writer?: string | null;
    producer?: string | null;
    country_of_origin?: string | null;
    language?: string | null;
  };
  // If a pitch deck file was updated, pass its hash here
  pitchDeckHash?: string | null;
  pitchDeckFileName?: string | null;
}

/**
 * Get the next version number for proofs on this project.
 */
async function getNextVersion(projectId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("project_proofs")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  return (count ?? 0) + 1;
}

/**
 * Hash a string server-side using Web Crypto (available in edge/Node 18+).
 */
async function hashString(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build a deterministic canonical snapshot of project content fields.
 */
function buildProjectSnapshot(data: TriggerProjectProofArgs["projectData"]): string {
  const fields = {
    title: data.title ?? "",
    logline: data.logline ?? "",
    synopsis: data.synopsis ?? "",
    genre: data.genre ?? "",
    format: data.format ?? "",
    budget_amount: data.budget_amount ?? null,
    budget_currency: data.budget_currency ?? "",
    production_stage: data.production_stage ?? "",
    director: data.director ?? "",
    writer: data.writer ?? "",
    producer: data.producer ?? "",
    country_of_origin: data.country_of_origin ?? "",
    language: data.language ?? "",
  };
  // Sort keys for deterministic output
  return JSON.stringify(fields, Object.keys(fields).sort());
}

/**
 * POST hash to Edge Function → OTS calendars → DB row.
 * Non-blocking: errors are logged but never thrown.
 */
async function submitProof({
  projectId,
  sha256Hash,
  fileName,
  proofType,
  version,
}: {
  projectId: string;
  sha256Hash: string;
  fileName: string;
  proofType: "file" | "snapshot";
  version: number;
}): Promise<void> {
  try {
    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-proof`;
    const res = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        sha256_hash: sha256Hash,
        file_name: fileName,
        proof_type: proofType,
        version,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Proof] Edge function returned ${res.status}:`, body);
    } else {
      const data = await res.json();
      console.log(`[Proof] Submitted proof ${data.proof_id} for project ${projectId}`);
    }
  } catch (err) {
    // Proof failure must never break project save
    console.error("[Proof] submitProof error:", err);
  }
}

/**
 * MAIN EXPORT: Trigger proof creation after every project save.
 * Call this at the end of any project create/update server action.
 *
 * Usage in your existing actions:
 *
 *   // After successful project upsert:
 *   await triggerProjectProof({
 *     projectId: savedProject.id,
 *     projectData: formData,        // all project fields
 *     pitchDeckHash: deckHash,      // from client-side WebCrypto (optional)
 *     pitchDeckFileName: deckName,  // original filename (optional)
 *   });
 */
export async function triggerProjectProof({
  projectId,
  projectData,
  pitchDeckHash,
  pitchDeckFileName,
}: TriggerProjectProofArgs): Promise<void> {
  try {
    const version = await getNextVersion(projectId);

    // ── 1. Hash the project data snapshot ──
    const snapshotJson = buildProjectSnapshot(projectData);
    const snapshotHash = await hashString(snapshotJson);

    await submitProof({
      projectId,
      sha256Hash: snapshotHash,
      fileName: `project_snapshot_v${version}.json`,
      proofType: "snapshot",
      version,
    });

    // ── 2. Hash the pitch deck file (if a new one was uploaded) ──
    if (pitchDeckHash && pitchDeckFileName) {
      await submitProof({
        projectId,
        sha256Hash: pitchDeckHash,
        fileName: pitchDeckFileName,
        proofType: "file",
        version,
      });
    }
  } catch (err) {
    // Non-blocking — never let proof logic break project saves
    console.error("[Proof] triggerProjectProof error:", err);
  }
}
