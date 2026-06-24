// supabase/functions/create-proof/index.ts
// Called on every project save/update
// Receives: { project_id, sha256_hash, file_name, proof_type, version }
// Posts hash to 3 OTS calendar servers, stores pending .ots, creates DB row

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CALENDARS = [
  "https://alice.btc.calendar.opentimestamps.org",
  "https://bob.btc.calendar.opentimestamps.org",
  "https://finney.calendar.eternitywall.com",
];

// ── OTS calendar: POST 32-byte binary hash → pending .ots bytes ──
async function submitToCalendar(
  calendarUrl: string,
  hashHex: string
): Promise<{ url: string; bytes: Uint8Array } | null> {
  try {
    // Convert hex hash to 32-byte binary
    const hashBytes = hexToBytes(hashHex);

    const response = await fetch(`${calendarUrl}/digest`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: hashBytes,
    });

    if (!response.ok) {
      console.error(`Calendar ${calendarUrl} returned ${response.status}`);
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return { url: calendarUrl, bytes };
  } catch (err) {
    console.error(`Calendar ${calendarUrl} error:`, err);
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

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const {
      project_id,
      sha256_hash,
      file_name,
      proof_type = "file",
      version = 1,
    } = await req.json();

    if (!project_id || !sha256_hash) {
      return Response.json(
        { error: "project_id and sha256_hash required" },
        { status: 400 }
      );
    }

    // Validate hash format
    if (!/^[0-9a-f]{64}$/i.test(sha256_hash)) {
      return Response.json({ error: "Invalid SHA-256 hash format" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Submit to all 3 calendars in parallel ──
    const results = await Promise.allSettled(
      CALENDARS.map((url) => submitToCalendar(url, sha256_hash))
    );

    const successful = results
      .filter(
        (r): r is PromiseFulfilledResult<{ url: string; bytes: Uint8Array }> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    if (successful.length === 0) {
      return Response.json(
        { error: "All OTS calendars unreachable" },
        { status: 503 }
      );
    }

    // ── Create DB row first to get the proof ID ──
    const { data: proof, error: insertError } = await supabase
      .from("project_proofs")
      .insert({
        project_id,
        version,
        file_name,
        proof_type,
        sha256_hash: sha256_hash.toLowerCase(),
        ots_status: "pending",
        calendar_responses: successful.map((s) => ({
          url: s.url,
          received_at: new Date().toISOString(),
          byte_count: s.bytes.length,
        })),
      })
      .select("id")
      .single();

    if (insertError || !proof) {
      console.error("DB insert error:", insertError);
      return Response.json({ error: "Failed to create proof record" }, { status: 500 });
    }

    // ── Store best .ots certificate to Storage ──
    // Use the first successful response (alice preferred)
    const best = successful[0];
    const storagePath = `${project_id}/${proof.id}/pending.ots`;

    const { error: storageError } = await supabase.storage
      .from("proofs")
      .upload(storagePath, best.bytes, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      // Don't fail — proof row exists, path just won't be set
    } else {
      // Update proof row with storage path
      await supabase
        .from("project_proofs")
        .update({ ots_pending_path: storagePath })
        .eq("id", proof.id);
    }

    return Response.json({
      proof_id: proof.id,
      status: "pending",
      calendars_responded: successful.length,
      message: "OTS proof submitted. Bitcoin anchoring typically completes within 2–6 hours.",
    });
  } catch (err) {
    console.error("create-proof error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
});
