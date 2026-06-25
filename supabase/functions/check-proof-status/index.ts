// supabase/functions/check-proof-status/index.ts
// Runs every 2 hours via pg_cron
// For each pending proof: downloads stored pending.ots, derives commitment
// via OTS ops, calls calendar /timestamp/{commitment}, checks for Bitcoin attestation

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── OTS constants ────────────────────────────────────────────────────────────
const PENDING_ATTESTATION_TAG = new Uint8Array([
  0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e,
]);
const BITCOIN_ATTESTATION_TAG = new Uint8Array([
  0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01,
]);
// ── Helpers ──────────────────────────────────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function readVarint(bytes: Uint8Array, pos: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  while (pos + bytesRead < bytes.length) {
    const b = bytes[pos + bytesRead++];
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value, bytesRead };
}

// ── Parse pending OTS: apply ops to original hash → commitment ───────────────
// The calendar stores the commitment (hash after Merkle ops), NOT the original hash.
// /timestamp/{commitment} is the correct upgrade URL.
//
// Format detection:
//   Full .ots file: starts with magic header (31 bytes) + version (1) + file_hash_op (1) = skip 33
//   Raw calendar /digest response: no header, start at pos 0
const OTS_FILE_MAGIC = new Uint8Array([0x00, 0x4f, 0x70, 0x65]); // "\x00Ope"

function detectStartPos(otsBytes: Uint8Array): number {
  if (otsBytes.length >= 4 && OTS_FILE_MAGIC.every((b, i) => otsBytes[i] === b)) {
    // Full .ots file: skip header(31) + version(1) + file_hash_op(1)
    return 33;
  }
  // Raw calendar timestamp bytes — start from 0
  return 0;
}

async function extractCommitment(
  otsBytes: Uint8Array,
  originalHashHex: string
): Promise<{ commitmentHex: string; calendarUrl: string } | null> {
  if (otsBytes.length < 8) return null;

  const startPos = detectStartPos(otsBytes);
  console.log(`[ots] format: ${startPos === 0 ? "raw calendar" : "full .ots file"}, starting at pos ${startPos}`);

  let pos = startPos;
  let current = hexToBytes(originalHashHex);

  while (pos < otsBytes.length) {
    const tag = otsBytes[pos++];

    if (tag === 0x00) {
      // Attestation marker — read 8-byte type
      if (pos + 8 > otsBytes.length) break;
      const attType = otsBytes.slice(pos, pos + 8);
      pos += 8;

      const isPending = attType.every((b, i) => b === PENDING_ATTESTATION_TAG[i]);
      if (isPending) {
        const { value: urlLen, bytesRead } = readVarint(otsBytes, pos);
        pos += bytesRead;
        if (pos + urlLen <= otsBytes.length) {
          const url = new TextDecoder().decode(otsBytes.slice(pos, pos + urlLen));
          return { commitmentHex: bytesToHex(current), calendarUrl: url };
        }
      }
      break;
    } else if (tag === 0xf0) {
      // Prepend data before current hash
      const { value: len, bytesRead } = readVarint(otsBytes, pos);
      pos += bytesRead;
      if (pos + len > otsBytes.length) break;
      const data = otsBytes.slice(pos, pos + len);
      pos += len;
      const combined = new Uint8Array(data.length + current.length);
      combined.set(data, 0);
      combined.set(current, data.length);
      current = combined;
    } else if (tag === 0xf1) {
      // Append data after current hash
      const { value: len, bytesRead } = readVarint(otsBytes, pos);
      pos += bytesRead;
      if (pos + len > otsBytes.length) break;
      const data = otsBytes.slice(pos, pos + len);
      pos += len;
      const combined = new Uint8Array(current.length + data.length);
      combined.set(current, 0);
      combined.set(data, current.length);
      current = combined;
    } else if (tag === 0x08) {
      // SHA256
      current = await sha256(current);
    } else if (tag === 0xff) {
      // Fork — multiple branches, not supported, bail
      break;
    } else {
      console.warn(`[ots] Unknown tag 0x${tag.toString(16)} at pos ${pos}`);
      break;
    }
  }
  return null;
}

// ── Parse response bytes for Bitcoin attestation ─────────────────────────────
function parseBitcoinAttestation(bytes: Uint8Array): { blockHeight: number } | null {
  outer: for (let i = 0; i <= bytes.length - BITCOIN_ATTESTATION_TAG.length - 2; i++) {
    for (let j = 0; j < BITCOIN_ATTESTATION_TAG.length; j++) {
      if (bytes[i + j] !== BITCOIN_ATTESTATION_TAG[j]) continue outer;
    }
    const pos = i + BITCOIN_ATTESTATION_TAG.length;
    let varintPos = pos;
    // skip varint
    while (varintPos < bytes.length && (bytes[varintPos] & 0x80)) varintPos++;
    varintPos++;
    if (varintPos + 4 <= bytes.length) {
      const height =
        bytes[varintPos] |
        (bytes[varintPos + 1] << 8) |
        (bytes[varintPos + 2] << 16) |
        (bytes[varintPos + 3] << 24);
      if (height > 100000 && height < 10000000) return { blockHeight: height };
    }
  }
  return null;
}

// ── Format date ───────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: pendingProofs, error: fetchError } = await supabase
    .from("project_proofs")
    .select(`
      id, project_id, sha256_hash, file_name, proof_type, version,
      created_at, upgrade_attempts, calendar_responses, ots_pending_path,
      projects!inner ( title, owner_id )
    `)
    .eq("ots_status", "pending")
    .lt("upgrade_attempts", 72)
    .order("created_at", { ascending: true })
    .limit(50);

  if (fetchError) {
    console.error("DB fetch error:", fetchError);
    return Response.json({ error: "DB fetch failed" }, { status: 500 });
  }

  if (!pendingProofs || pendingProofs.length === 0) {
    return Response.json({ message: "No pending proofs", processed: 0 });
  }

  const results = { anchored: 0, still_pending: 0, failed: 0 };

  for (const proof of pendingProofs) {
    const project = Array.isArray(proof.projects) ? proof.projects[0] : proof.projects;

    // ── Step 1: download pending OTS and extract commitment ──
    let commitmentHex: string | null = null;
    let calendarUrlFromOts: string | null = null;

    if (proof.ots_pending_path) {
      const { data: otsBlob, error: dlErr } = await supabase.storage
        .from("proofs")
        .download(proof.ots_pending_path);

      if (!dlErr && otsBlob) {
        const otsBytes = new Uint8Array(await otsBlob.arrayBuffer());
        console.log(`[proof ${proof.id}] downloaded pending OTS: ${otsBytes.length} bytes`);

        const extracted = await extractCommitment(otsBytes, proof.sha256_hash);
        if (extracted) {
          commitmentHex = extracted.commitmentHex;
          calendarUrlFromOts = extracted.calendarUrl;
          console.log(`[proof ${proof.id}] commitment: ${commitmentHex}`);
          console.log(`[proof ${proof.id}] calendar from OTS: ${calendarUrlFromOts}`);
        } else {
          console.warn(`[proof ${proof.id}] could not extract commitment from OTS`);
        }
      } else {
        console.warn(`[proof ${proof.id}] failed to download pending OTS:`, dlErr);
      }
    }

    // ── Step 2: build calendar list ──
    const storedUrls: string[] = (proof.calendar_responses || []).map(
      (r: { url: string }) => r.url
    );
    const fallback = [
      "https://alice.btc.calendar.opentimestamps.org",
      "https://bob.btc.calendar.opentimestamps.org",
      "https://finney.calendar.eternitywall.com",
    ];
    // Priority: OTS-embedded URL first, then stored responses, then fallback
    const toTry = calendarUrlFromOts
      ? [calendarUrlFromOts, ...storedUrls.filter(u => u !== calendarUrlFromOts), ...fallback.filter(u => u !== calendarUrlFromOts && !storedUrls.includes(u))]
      : storedUrls.length > 0 ? storedUrls : fallback;

    // ── Step 3: call /timestamp/{commitment} on each calendar ──
    const hashToCheck = commitmentHex ?? proof.sha256_hash;
    console.log(`[proof ${proof.id}] checking with hash: ${hashToCheck}`);

    let anchoredBytes: Uint8Array | null = null;
    let successCalendar = "";

    for (const calUrl of toTry) {
      try {
        const url = `${calUrl}/timestamp/${hashToCheck.toLowerCase()}`;
        console.log(`[upgrade] GET ${url}`);
        const resp = await fetch(url, {
          headers: { Accept: "application/octet-stream" },
        });
        console.log(`[upgrade] ${calUrl} -> HTTP ${resp.status}`);
        if (!resp.ok) continue;

        const bytes = new Uint8Array(await resp.arrayBuffer());
        console.log(`[upgrade] ${calUrl} -> ${bytes.length} bytes`);
        const preview = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, "0")).join(" ");
        console.log(`[upgrade] first bytes: ${preview}`);

        const att = parseBitcoinAttestation(bytes);
        if (att) {
          console.log(`[upgrade] ${calUrl} -> ANCHORED at block ${att.blockHeight} ✓`);
          anchoredBytes = bytes;
          successCalendar = calUrl;
          break;
        } else {
          console.log(`[upgrade] ${calUrl} -> no Bitcoin attestation yet`);
        }
      } catch (err) {
        console.warn(`[upgrade] ${calUrl} -> exception:`, err);
      }
    }

    // Always increment attempt counter
    await supabase
      .from("project_proofs")
      .update({ upgrade_attempts: proof.upgrade_attempts + 1, last_upgrade_attempt: new Date().toISOString() })
      .eq("id", proof.id);

    if (!anchoredBytes) {
      results.still_pending++;
      continue;
    }

    const attestation = parseBitcoinAttestation(anchoredBytes);
    if (!attestation) { results.still_pending++; continue; }

    // ── Store anchored .ots ──
    const anchoredPath = `${proof.project_id}/${proof.id}/anchored.ots`;
    const { error: uploadError } = await supabase.storage
      .from("proofs")
      .upload(anchoredPath, anchoredBytes, { contentType: "application/octet-stream", upsert: true });

    if (uploadError) {
      console.error(`Storage upload failed for ${proof.id}:`, uploadError);
      results.failed++;
      continue;
    }

    const anchoredAt = new Date().toISOString();

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
      console.error(`DB update failed for ${proof.id}:`, updateError);
      results.failed++;
      continue;
    }

    const versionLabel = proof.proof_type === "file"
      ? `Pitch deck v${proof.version}`
      : `Project snapshot v${proof.version}`;

    await supabase.from("proof_notifications").insert({
      filmmaker_id: project.owner_id,
      project_id: proof.project_id,
      proof_id: proof.id,
      title: `Bitcoin Proof Anchored — ${project.title}`,
      body: [
        `Your ${versionLabel} for "${project.title}" is now permanently anchored to the Bitcoin blockchain.`,
        ``,
        `Bitcoin Block: #${attestation.blockHeight.toLocaleString()}`,
        `Anchored: ${formatDate(anchoredAt)} UTC`,
        `SHA-256: ${proof.sha256_hash}`,
        ``,
        `Your certificate is ready to download from your project dashboard.`,
      ].join("\n"),
    });

    results.anchored++;
    console.log(`✓ Anchored proof ${proof.id} at block ${attestation.blockHeight}`);
  }

  return Response.json({
    processed: pendingProofs.length,
    ...results,
    timestamp: new Date().toISOString(),
  });
});
