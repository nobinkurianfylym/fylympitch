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
      // Attestation marker
      // OTS format: 0x00 + TAG(8 bytes) + varint(payload_len) + payload
      // TAG comes DIRECTLY after 0x00 — no varint before it
      if (pos + 8 > otsBytes.length) break;
      const attType = otsBytes.slice(pos, pos + 8);
      pos += 8;

      const isPending = attType.every((b, i) => b === PENDING_ATTESTATION_TAG[i]);
      if (isPending) {
        // Skip past payload_len varint, then read url_len varint + url
        const { bytesRead: payloadLenBytes } = readVarint(otsBytes, pos);
        pos += payloadLenBytes;
        const { value: urlLen, bytesRead } = readVarint(otsBytes, pos);
        pos += bytesRead;
        if (urlLen > 0 && pos + urlLen <= otsBytes.length) {
          const url = new TextDecoder().decode(otsBytes.slice(pos, pos + urlLen));
          if (url.startsWith("http")) {
            console.log(`[ots] extracted URL: ${url}`);
            return { commitmentHex: bytesToHex(current), calendarUrl: url };
          } else {
            console.warn(`[ots] URL parse produced invalid string: ${url.slice(0,30)}`);
          }
        }
      }
      break;
    } else if (tag === 0xf0) {
      // OpAppend (0xf0): result = current + data
      const { value: len, bytesRead } = readVarint(otsBytes, pos);
      pos += bytesRead;
      if (pos + len > otsBytes.length) break;
      const data = otsBytes.slice(pos, pos + len);
      pos += len;
      const combined = new Uint8Array(current.length + data.length);
      combined.set(current, 0);
      combined.set(data, current.length);
      current = combined;
    } else if (tag === 0xf1) {
      // OpPrepend (0xf1): result = data + current
      const { value: len, bytesRead } = readVarint(otsBytes, pos);
      pos += bytesRead;
      if (pos + len > otsBytes.length) break;
      const data = otsBytes.slice(pos, pos + len);
      pos += len;
      const combined = new Uint8Array(data.length + current.length);
      combined.set(data, 0);
      combined.set(current, data.length);
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
  // OTS format after Bitcoin TAG: varint(payload_len) + varuint(height)
  // TAG is: 05 88 96 0d 73 d7 19 01
  outer: for (let i = 0; i <= bytes.length - BITCOIN_ATTESTATION_TAG.length - 2; i++) {
    for (let j = 0; j < BITCOIN_ATTESTATION_TAG.length; j++) {
      if (bytes[i + j] !== BITCOIN_ATTESTATION_TAG[j]) continue outer;
    }
    // After TAG: varint(payload_len) then varuint(height)
    const pos = i + BITCOIN_ATTESTATION_TAG.length;
    const { bytesRead: payloadLenBytes } = readVarint(bytes, pos);
    const heightPos = pos + payloadLenBytes;
    const { value: height } = readVarint(bytes, heightPos);
    if (height > 100000 && height < 10000000) return { blockHeight: height };
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
    if (!project?.owner_id) {
      console.warn(`[proof ${proof.id}] project missing or no owner_id, skipping`);
      results.failed++;
      continue;
    }

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

    // ── Send anchor confirmation email via Resend ─────────────────────────────
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(project.owner_id);
      const filmmakerEmail = authUser?.user?.email;
      const filmmakerName  = authUser?.user?.user_metadata?.full_name
        ?? authUser?.user?.user_metadata?.name
        ?? "Filmmaker";
      const firstName = (filmmakerName as string).split(" ")[0];

      if (filmmakerEmail) {
        const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_KEY) {
          const verifyUrl  = `https://pitch.fylym.com/verify/${proof.sha256_hash}`;
          const dashUrl    = `https://pitch.fylym.com/dashboard/projects/${proof.project_id}`;
          const blockStr   = attestation.blockHeight.toLocaleString();
          const dateStr    = formatDate(anchoredAt);

          const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bitcoin Proof Anchored — PITCH.FYLYM</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1815;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Wordmark -->
        <tr><td style="padding-bottom:40px;">
          <p style="margin:0;font-size:14px;letter-spacing:0.32em;color:#1A1815;text-transform:uppercase;">
            <span style="color:#BF9953;">P</span>ITCH.<span style="color:#BF9953;">F</span>YLYM
          </p>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#FFFFFF;border:1px solid #E5E0D5;border-radius:14px;overflow:hidden;">

          <!-- Gold top stripe -->
          <div style="background:#BF9953;height:4px;"></div>

          <div style="padding:48px 40px;">

            <h1 style="margin:0 0 6px;font-size:28px;font-weight:400;font-family:Georgia,serif;color:#1A1815;">
              Anchored to Bitcoin
            </h1>
            <p style="margin:0 0 32px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#BF9953;">
              Proof of Existence · Confirmed
            </p>

            <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
              Hi ${firstName},
            </p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#1A1815;">
              Your ${versionLabel} for <strong style="font-weight:600;">${project.title}</strong> is now
              permanently recorded on the Bitcoin blockchain. This proof is immutable —
              it cannot be altered, deleted, or disputed.
            </p>

            <!-- Data block -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#F8F5F0;border:1px solid #E5E0D5;border-radius:10px;margin-bottom:32px;">
              <tr><td style="padding:24px;">

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:16px;">
                      <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">Bitcoin Block</p>
                      <p style="margin:0;font-size:22px;font-family:Georgia,serif;color:#BF9953;">#${blockStr}</p>
                    </td>
                    <td style="padding-bottom:16px;text-align:right;">
                      <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">Anchored</p>
                      <p style="margin:0;font-size:14px;color:#1A1815;">${dateStr} UTC</p>
                    </td>
                  </tr>
                </table>

                <div style="border-top:1px solid #E5E0D5;margin-bottom:16px;"></div>

                <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">SHA-256 Fingerprint</p>
                <p style="margin:0;font-size:10px;font-family:monospace;color:#1A1815;word-break:break-all;line-height:1.7;">${proof.sha256_hash}</p>

              </td></tr>
            </table>

            <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#8A857C;">
              Download your PDF certificate and the raw .ots file from your project dashboard.
              The public verify page is available to share with collaborators, distributors, or financiers.
            </p>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">
                  <a href="${dashUrl}"
                    style="display:inline-block;background:#1A1815;color:#F5F5F0;font-size:12px;
                           letter-spacing:0.12em;text-transform:uppercase;font-weight:500;
                           text-decoration:none;padding:14px 24px;border-radius:10px;">
                    Download Certificate
                  </a>
                </td>
                <td>
                  <a href="${verifyUrl}"
                    style="display:inline-block;background:transparent;color:#BF9953;font-size:12px;
                           letter-spacing:0.12em;text-transform:uppercase;font-weight:500;
                           text-decoration:none;padding:14px 24px;border-radius:10px;
                           border:1px solid #BF9953;">
                    View Public Proof
                  </a>
                </td>
              </tr>
            </table>

          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:32px;padding-bottom:8px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8A857C;text-align:center;">
            © PITCH.FYLYM · Intelligent film financing
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#8A857C;text-align:center;">
            <a href="https://pitch.fylym.com" style="color:#8A857C;text-decoration:underline;">pitch.fylym.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_KEY}`,
            },
            body: JSON.stringify({
              from: "PITCH.FYLYM <hello@fylym.com>",
              to: filmmakerEmail,
              subject: `₿ Bitcoin proof anchored — ${project.title}`,
              html: emailHtml,
            }),
          });

          if (!resendRes.ok) {
            const errText = await resendRes.text();
            console.warn(`[email] Resend failed for proof ${proof.id}: ${errText}`);
          } else {
            console.log(`[email] Anchor confirmation sent to ${filmmakerEmail}`);
          }
        } else {
          console.warn("[email] RESEND_API_KEY not set — skipping anchor email");
        }
      } else {
        console.warn(`[email] No email found for user ${project.owner_id}`);
      }
    } catch (emailErr) {
      console.error(`[email] Exception sending anchor email for ${proof.id}:`, emailErr);
    }

    results.anchored++;
    console.log(`✓ Anchored proof ${proof.id} at block ${attestation.blockHeight}`);
  }

  return Response.json({
    processed: pendingProofs.length,
    ...results,
    timestamp: new Date().toISOString(),
  });
});
