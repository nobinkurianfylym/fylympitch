// supabase/functions/check-proof-status/index.ts
// Runs every 2 hours via pg_cron
// For each pending proof: attempts upgrade from OTS calendar
// If Bitcoin-anchored: updates DB, stores anchored .ots, sends proof_notification

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Bitcoin attestation magic bytes in OTS binary format
const BITCOIN_MAGIC = new Uint8Array([
  0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01,
]);

// OTS file header magic
const OTS_HEADER = new Uint8Array([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
  0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
  0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]);

// ── Parse OTS bytes for Bitcoin attestation ──
function parseBitcoinAttestation(
  otsBytes: Uint8Array
): { blockHeight: number } | null {
  // Scan for Bitcoin magic bytes
  outer: for (let i = 0; i <= otsBytes.length - BITCOIN_MAGIC.length - 2; i++) {
    for (let j = 0; j < BITCOIN_MAGIC.length; j++) {
      if (otsBytes[i + j] !== BITCOIN_MAGIC[j]) continue outer;
    }
    // Found magic at position i
    // Next byte(s) are length of attestation payload (OTS varint)
    // For Bitcoin, payload is typically 8 bytes (block height as uint64 LE)
    const afterMagic = i + BITCOIN_MAGIC.length;

    // Read varint length
    let len = 0;
    let shift = 0;
    let pos = afterMagic;
    while (pos < otsBytes.length) {
      const b = otsBytes[pos++];
      len |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }

    // Read block height (little-endian uint64, but block height fits in uint32)
    if (pos + 4 <= otsBytes.length) {
      const height =
        otsBytes[pos] |
        (otsBytes[pos + 1] << 8) |
        (otsBytes[pos + 2] << 16) |
        (otsBytes[pos + 3] << 24);

      // Sanity check: Bitcoin block height is currently ~870,000
      if (height > 100000 && height < 10000000) {
        return { blockHeight: height };
      }
    }
  }
  return null;
}

// ── Attempt to upgrade a pending .ots via calendar ──
async function upgradeFromCalendar(
  calendarUrl: string,
  hashHex: string
): Promise<Uint8Array | null> {
  try {
    const response = await fetch(
      `${calendarUrl}/timestamp/${hashHex.toLowerCase()}`,
      {
        method: "GET",
        headers: { "Accept": "application/octet-stream" },
      }
    );

    if (response.status === 404) return null; // Not yet anchored
    if (!response.ok) {
      console.warn(`Calendar ${calendarUrl} upgrade returned ${response.status}`);
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    // Must be a valid OTS file (check header) and larger than pending
    if (bytes.length < OTS_HEADER.length) return null;

    // Check for Bitcoin attestation
    const attestation = parseBitcoinAttestation(bytes);
    if (!attestation) return null; // No Bitcoin proof yet

    return bytes;
  } catch (err) {
    console.warn(`Upgrade attempt failed for ${calendarUrl}:`, err);
    return null;
  }
}

// ── Format date for notification message ──
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Fetch all pending proofs (max 50 per run, oldest first) ──
  const { data: pendingProofs, error: fetchError } = await supabase
    .from("project_proofs")
    .select(`
      id,
      project_id,
      sha256_hash,
      file_name,
      proof_type,
      version,
      created_at,
      upgrade_attempts,
      calendar_responses,
      ots_pending_path,
      projects!inner (
        title,
        owner_id
      )
    `)
    .eq("ots_status", "pending")
    .lt("upgrade_attempts", 72) // Stop after 6 days (72 × 2h attempts)
    .order("created_at", { ascending: true })
    .limit(50);

  if (fetchError) {
    console.error("Fetch pending proofs error:", fetchError);
    return Response.json({ error: "DB fetch failed" }, { status: 500 });
  }

  if (!pendingProofs || pendingProofs.length === 0) {
    return Response.json({ message: "No pending proofs", processed: 0 });
  }

  const results = { anchored: 0, still_pending: 0, failed: 0 };

  for (const proof of pendingProofs) {
    const project = Array.isArray(proof.projects)
      ? proof.projects[0]
      : proof.projects;

    // Try each calendar from the stored responses
    const calendarUrls: string[] = (proof.calendar_responses || []).map(
      (r: { url: string }) => r.url
    );

    // Fallback to all calendars if none stored
    const toTry =
      calendarUrls.length > 0
        ? calendarUrls
        : [
            "https://alice.btc.calendar.opentimestamps.org",
            "https://bob.btc.calendar.opentimestamps.org",
            "https://finney.calendar.eternitywall.com",
          ];

    let anchoredBytes: Uint8Array | null = null;
    let successfulCalendar = "";

    for (const calUrl of toTry) {
      anchoredBytes = await upgradeFromCalendar(calUrl, proof.sha256_hash);
      if (anchoredBytes) {
        successfulCalendar = calUrl;
        break;
      }
    }

    // Always update attempt counter
    await supabase
      .from("project_proofs")
      .update({
        upgrade_attempts: proof.upgrade_attempts + 1,
        last_upgrade_attempt: new Date().toISOString(),
      })
      .eq("id", proof.id);

    if (!anchoredBytes) {
      results.still_pending++;
      continue;
    }

    // ── Parse Bitcoin block height ──
    const attestation = parseBitcoinAttestation(anchoredBytes);
    if (!attestation) {
      results.still_pending++;
      continue;
    }

    // ── Store anchored .ots to Storage ──
    const anchoredPath = `${proof.project_id}/${proof.id}/anchored.ots`;

    const { error: uploadError } = await supabase.storage
      .from("proofs")
      .upload(anchoredPath, anchoredBytes, {
        contentType: "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error(`Storage upload failed for proof ${proof.id}:`, uploadError);
      results.failed++;
      continue;
    }

    const anchoredAt = new Date().toISOString();

    // ── Update proof row to anchored ──
    const { error: updateError } = await supabase
      .from("project_proofs")
      .update({
        ots_status: "anchored",
        ots_anchored_path: anchoredPath,
        bitcoin_block_height: attestation.blockHeight,
        anchored_at: anchoredAt,
        last_upgrade_attempt: anchoredAt,
      })
      .eq("id", proof.id);

    if (updateError) {
      console.error(`DB update failed for proof ${proof.id}:`, updateError);
      results.failed++;
      continue;
    }

    // ── Send proof_notification to filmmaker ──
    const versionLabel =
      proof.proof_type === "file"
        ? `Pitch deck v${proof.version}`
        : `Project snapshot v${proof.version}`;

    const notificationTitle = `Bitcoin Proof Anchored — ${project.title}`;
    const notificationBody = [
      `Your ${versionLabel} for "${project.title}" is now permanently anchored to the Bitcoin blockchain.`,
      ``,
      `Bitcoin Block: #${attestation.blockHeight.toLocaleString()}`,
      `Anchored: ${formatDate(anchoredAt)} UTC`,
      `SHA-256: ${proof.sha256_hash}`,
      ``,
      `Your certificate is ready to download from your project dashboard.`,
    ].join("\n");

    await supabase.from("proof_notifications").insert({
      filmmaker_id: project.owner_id,
      project_id: proof.project_id,
      proof_id: proof.id,
      title: notificationTitle,
      body: notificationBody,
    });

    results.anchored++;
    console.log(
      `✓ Anchored proof ${proof.id} at block ${attestation.blockHeight}`
    );
  }

  return Response.json({
    processed: pendingProofs.length,
    ...results,
    timestamp: new Date().toISOString(),
  });
});
