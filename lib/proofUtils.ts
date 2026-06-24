// lib/proofUtils.ts
// Client-side SHA-256 hashing via WebCrypto API (zero server cost)
// Called before/during project save to generate hashes for OTS

/**
 * Compute SHA-256 hash of a File object.
 * Returns lowercase hex string.
 * Called client-side — file never leaves the browser for hashing.
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Compute SHA-256 hash of a UTF-8 string.
 * Used for project data snapshots.
 */
export async function hashString(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Build a canonical JSON snapshot of project fields for hashing.
 * Deterministic: keys sorted alphabetically, no timestamps.
 * This proves the CONTENT of the project existed at submission time.
 */
export function buildProjectSnapshot(project: {
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
  [key: string]: unknown;
}): string {
  // Only hash content fields — not IDs, timestamps, or computed scores
  const snapshot = {
    title: project.title ?? "",
    logline: project.logline ?? "",
    synopsis: project.synopsis ?? "",
    genre: project.genre ?? "",
    format: project.format ?? "",
    budget_amount: project.budget_amount ?? null,
    budget_currency: project.budget_currency ?? "",
    production_stage: project.production_stage ?? "",
    director: project.director ?? "",
    writer: project.writer ?? "",
    producer: project.producer ?? "",
    country_of_origin: project.country_of_origin ?? "",
    language: project.language ?? "",
  };

  // Sort keys for deterministic output
  return JSON.stringify(snapshot, Object.keys(snapshot).sort());
}

/**
 * Get the next version number for a project's proofs.
 * Pass the current proof count.
 */
export function nextProofVersion(existingCount: number): number {
  return existingCount + 1;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Trigger proof creation via the Edge Function.
 * Called after a successful project save.
 * Does NOT block the save — fire and forget with error logging.
 */
export async function triggerProofCreation({
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
    const res = await fetch("/api/proofs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      console.error("[Proof] Creation failed:", res.status, body);
    } else {
      const data = await res.json();
      console.log("[Proof] Submitted:", data.proof_id);
    }
  } catch (err) {
    // Non-blocking — proof failure must never break project save
    console.error("[Proof] Edge Function unreachable:", err);
  }
}
