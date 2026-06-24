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
  pitchDeckHash?: string | null;
  pitchDeckFileName?: string | null;
}

async function getNextVersion(projectId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("project_proofs")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  return (count ?? 0) + 1;
}

async function hashString(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildProjectSnapshot(data: TriggerProjectProofArgs["projectData"]): string {
  const fields = {
    title:            data.title ?? "",
    logline:          data.logline ?? "",
    synopsis:         data.synopsis ?? "",
    genre:            data.genre ?? "",
    format:           data.format ?? "",
    budget_amount:    data.budget_amount ?? null,
    budget_currency:  data.budget_currency ?? "",
    production_stage: data.production_stage ?? "",
    director:         data.director ?? "",
    writer:           data.writer ?? "",
    producer:         data.producer ?? "",
    country_of_origin: data.country_of_origin ?? "",
    language:         data.language ?? "",
  };
  return JSON.stringify(fields, Object.keys(fields).sort());
}

// Submit hash to Edge Function — returns proof_id on success
async function submitProof({
  projectId, sha256Hash, fileName, proofType, version,
}: {
  projectId: string; sha256Hash: string; fileName: string;
  proofType: "file" | "snapshot"; version: number;
}): Promise<string | null> {
  try {
    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-proof`;
    const res = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ project_id: projectId, sha256_hash: sha256Hash, file_name: fileName, proof_type: proofType, version }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.proof_id ?? null;
  } catch {
    return null;
  }
}

// Store snapshot JSON in Storage so filmmaker can download for independent verification
async function storeSnapshotJson(projectId: string, proofId: string, json: string): Promise<void> {
  try {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const path = `${projectId}/${proofId}/snapshot.json`;
    await supabase.storage.from("proofs").upload(path, json, {
      contentType: "application/json",
      upsert: false,
    });
  } catch (err) {
    console.error("[Proof] storeSnapshotJson failed:", err);
  }
}

export async function triggerProjectProof({
  projectId, projectData, pitchDeckHash, pitchDeckFileName,
}: TriggerProjectProofArgs): Promise<void> {
  try {
    const version = await getNextVersion(projectId);

    // ── 1. Project data snapshot ──
    const snapshotJson = buildProjectSnapshot(projectData);
    const snapshotHash = await hashString(snapshotJson);

    const snapshotProofId = await submitProof({
      projectId, sha256Hash: snapshotHash,
      fileName: `project_snapshot_v${version}.json`,
      proofType: "snapshot", version,
    });

    // Store the JSON so filmmaker can download for independent verification
    if (snapshotProofId) {
      await storeSnapshotJson(projectId, snapshotProofId, snapshotJson);
    }

    // ── 2. Pitch deck file (if uploaded) ──
    if (pitchDeckHash && pitchDeckFileName) {
      await submitProof({
        projectId, sha256Hash: pitchDeckHash,
        fileName: pitchDeckFileName,
        proofType: "file", version,
      });
    }
  } catch (err) {
    console.error("[Proof] triggerProjectProof error:", err);
  }
}
