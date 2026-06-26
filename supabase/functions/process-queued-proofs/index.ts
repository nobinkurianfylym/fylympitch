// supabase/functions/process-queued-proofs/index.ts
// Runs every 5 minutes via pg_cron.
// Picks up project_proofs rows with ots_status = 'queued',
// submits each hash to OTS calendars, stores .ots bytes,
// and promotes the row to ots_status = 'pending'.
//
// This is the slow network work that was previously inside after() / waitUntil()
// and was being killed by Cloudflare's post-invocation time budget.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CALENDARS = [
  "https://alice.btc.calendar.opentimestamps.org",
  "https://bob.btc.calendar.opentimestamps.org",
  "https://finney.calendar.eternitywall.com",
];

// ── OTS calendar submission ───────────────────────────────────────────────────
async function submitToCalendar(
  calendarUrl: string,
  hashHex: string
): Promise<{ url: string; bytes: Uint8Array } | null> {
  try {
    const hashBytes = hexToBytes(hashHex);
    const res = await fetch(`${calendarUrl}/digest`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: hashBytes,
    });
    if (!res.ok) {
      console.warn(`[process-queued] Calendar ${calendarUrl} → ${res.status}`);
      return null;
    }
    return { url: calendarUrl, bytes: new Uint8Array(await res.arrayBuffer()) };
  } catch (err) {
    console.warn(`[process-queued] Calendar ${calendarUrl} error:`, err);
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ── Error logger ──────────────────────────────────────────────────────────────
async function logError(
  supabase: ReturnType<typeof createClient>,
  message: string,
  context?: Record<string, unknown>,
  severity: "warn" | "error" | "critical" = "error"
) {
  try {
    await supabase.from("platform_errors").insert({
      source: "process-queued-proofs",
      severity,
      message,
      context: context ?? null,
    });
  } catch (_) { /* never let logging break main flow */ }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── Fetch queued proofs (max 20 per run to stay within Edge Function limits)
  const { data: queued, error: fetchError } = await supabase
    .from("project_proofs")
    .select("id, project_id, sha256_hash, file_name, proof_type, version")
    .eq("ots_status", "queued")
    .order("created_at", { ascending: true })
    .limit(20);

  if (fetchError) {
    await logError(supabase, "DB fetch failed for queued proofs", { error: fetchError.message }, "critical");
    return Response.json({ error: "DB fetch failed" }, { status: 500 });
  }

  if (!queued || queued.length === 0) {
    return Response.json({ message: "No queued proofs", processed: 0 });
  }

  const results = { submitted: 0, failed: 0 };

  for (const proof of queued) {
    try {
      // ── Validate hash format ──
      if (!/^[0-9a-f]{64}$/i.test(proof.sha256_hash)) {
        console.error(`[process-queued] Invalid hash for proof ${proof.id}`);
        await supabase
          .from("project_proofs")
          .update({ ots_status: "failed" })
          .eq("id", proof.id);
        results.failed++;
        continue;
      }

      // ── Submit to all 3 calendars in parallel ──
      const calendarResults = await Promise.allSettled(
        CALENDARS.map((url) => submitToCalendar(url, proof.sha256_hash))
      );

      const successful = calendarResults
        .filter(
          (r): r is PromiseFulfilledResult<{ url: string; bytes: Uint8Array }> =>
            r.status === "fulfilled" && r.value !== null
        )
        .map((r) => r.value);

      if (successful.length === 0) {
        // All calendars unreachable — leave as queued, will retry next cron run
        console.warn(`[process-queued] All calendars unreachable for proof ${proof.id} — will retry`);
        await logError(supabase, "All OTS calendars unreachable", { proof_id: proof.id }, "warn");
        continue;
      }

      // ── Upload best .ots to Storage ──
      const best        = successful[0];
      const storagePath = `${proof.project_id}/${proof.id}/pending.ots`;
      let   pendingPath: string | null = null;

      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(storagePath, best.bytes, {
          contentType: "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.warn(`[process-queued] Storage upload failed for ${proof.id}:`, uploadError.message);
        // Non-fatal — promote to pending anyway; check-proof-status can still poll
      } else {
        pendingPath = storagePath;
      }

      // ── Promote to pending ──
      const { error: updateError } = await supabase
        .from("project_proofs")
        .update({
          ots_status:       "pending",
          ots_pending_path: pendingPath,
          upgrade_attempts: 0,
          last_upgrade_attempt: new Date().toISOString(),
          calendar_responses: successful.map((s) => ({
            url:         s.url,
            received_at: new Date().toISOString(),
            byte_count:  s.bytes.length,
          })),
        })
        .eq("id", proof.id);

      if (updateError) {
        console.error(`[process-queued] DB update failed for ${proof.id}:`, updateError.message);
        await logError(supabase, "DB update failed after OTS submission", { proof_id: proof.id, error: updateError.message });
        results.failed++;
        continue;
      }

      console.log(`✓ Queued → Pending: proof ${proof.id} (${successful.length} calendars)`);
      results.submitted++;

    } catch (err) {
      console.error(`[process-queued] Unexpected error for proof ${proof.id}:`, err);
      await logError(supabase, `Unexpected error processing queued proof`, { proof_id: proof.id, error: String(err) });
      results.failed++;
    }
  }

  return Response.json({
    processed: queued.length,
    ...results,
    timestamp: new Date().toISOString(),
  });
});
