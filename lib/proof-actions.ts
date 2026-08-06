"use server";
import { supabaseUrl as getSupabaseUrl, supabaseAnonKey as getSupabaseAnonKey, supabaseServiceRoleKey as getSupabaseServiceRoleKey } from "@/lib/supabase/env";

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

async function getServiceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    { auth: { persistSession: false } }
  );
}

async function getNextVersion(projectId: string): Promise<number> {
  const supabase = await getServiceClient();
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

// ── triggerProjectProof ────────────────────────────────────────────────────────
// Called from after() — must complete fast (no external network calls).
// Inserts project_proofs rows with ots_status = 'queued'.
// The process-queued-proofs Edge Function (pg_cron, every 5 min) picks
// them up and submits to OTS calendars outside the Worker lifecycle.
export async function triggerProjectProof({
  projectId, projectData, pitchDeckHash, pitchDeckFileName,
}: TriggerProjectProofArgs): Promise<void> {
  try {
    const supabase = await getServiceClient();
    const version  = await getNextVersion(projectId);

    // ── 1. Snapshot proof — hash of project metadata ──
    const snapshotJson = buildProjectSnapshot(projectData);
    const snapshotHash = await hashString(snapshotJson);

    await supabase.from("project_proofs").insert({
      project_id:   projectId,
      version,
      file_name:    `project_snapshot_v${version}.json`,
      proof_type:   "snapshot",
      sha256_hash:  snapshotHash,
      ots_status:   "queued",
      snapshot_json: snapshotJson,
    });

    // ── 2. Pitch deck file proof (if uploaded) ──
    if (pitchDeckHash && pitchDeckFileName) {
      await supabase.from("project_proofs").insert({
        project_id:  projectId,
        version,
        file_name:   pitchDeckFileName,
        proof_type:  "file",
        sha256_hash: pitchDeckHash,
        ots_status:  "queued",
      });
    }
  } catch (err) {
    console.error("[Proof] triggerProjectProof error:", err);
  }
}
