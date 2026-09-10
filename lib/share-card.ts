// Client-only: compose a 1200x630 social share card for a project and store it
// in the public `thumbnails` bucket.
//
// Why pre-render rather than generate on request: a poster is 2:3 and every
// social card slot is roughly 1.91:1, so posting a bare poster gets centre-
// cropped — the title treatment at the top and the credit block at the bottom
// are the first things lost. This composes the poster into the correct frame
// alongside the title and logline, so nothing is cropped and the card carries
// the film's name even in a feed.
//
// Generated at save time, not at request time: dynamic OG routes on this
// deployment target fail silently, and a broken share card is invisible until
// someone posts it. Same pattern as lib/deck-cover.ts.

import { createClient } from "@/lib/supabase/client";

const W = 1200;
const H = 630;

const INK    = "#1A1815";
const IVORY  = "#F5F5F7";
const GOLD   = "#BF9953";

/** next/font mangles family names, so read the real one off a live element. */
function familyFor(className: string, fallback: string): string {
  try {
    const el = document.createElement("span");
    el.className = className;
    el.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    document.body.appendChild(el);
    const f = getComputedStyle(el).fontFamily;
    el.remove();
    return f || fallback;
  } catch {
    return fallback;
  }
}

async function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  const img = new Image();
  // Only needed for the URL path (backfill); a local File is same-origin.
  if (typeof source === "string") img.crossOrigin = "anonymous";
  const src = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
  } finally {
    if (typeof source !== "string") setTimeout(() => URL.revokeObjectURL(src), 0);
  }
  return img;
}

/** Greedy wrap, capped at `maxLines`; the last line is ellipsised if it runs over. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && cur && lines[maxLines - 1] !== cur) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

/** Letter-spaced small caps. ctx.letterSpacing is Chromium-only, so fall back. */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // `in` would narrow ctx to never in the fallback branch on newer lib.dom.
  const c = ctx as any;
  if (typeof c.letterSpacing === "string") {
    c.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    c.letterSpacing = "0px";
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

export type ShareCardMeta = {
  title:    string;
  logline?: string | null;
  genre?:   string | null;
  country?: string | null;
};

export async function renderShareCardBlob(
  source: File | Blob | string,
  meta: ShareCardMeta,
): Promise<Blob> {
  const display = familyFor("font-display", "Georgia, serif");
  const sans    = familyFor("font-sans", "system-ui, sans-serif");
  try {
    await Promise.all([
      (document as any).fonts?.load(`400 60px ${display.split(",")[0]}`),
      (document as any).fonts?.load(`400 26px ${sans.split(",")[0]}`),
      (document as any).fonts?.ready,
    ]);
  } catch { /* proceed with whatever is loaded */ }

  const img = await loadImage(source);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Ground ────────────────────────────────────────────────────────────────
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // A heavily darkened, blown-up copy of the artwork bleeds behind everything
  // so the card takes its colour from the film rather than looking like a
  // template with a picture dropped in.
  ctx.save();
  ctx.globalAlpha = 0.28;
  const coverScale = Math.max(W / img.width, H / img.height);
  const cw = img.width * coverScale, ch = img.height * coverScale;
  ctx.drawImage(img, (W - cw) / 2, (H - ch) / 2, cw, ch);
  ctx.restore();
  ctx.fillStyle = "rgba(26,24,21,0.78)";
  ctx.fillRect(0, 0, W, H);

  // ── Poster, contained (never cropped) ─────────────────────────────────────
  const PAD = 56;
  const boxH = H - PAD * 2;
  const boxW = 372;
  const fit  = Math.min(boxW / img.width, boxH / img.height);
  const pw = img.width * fit, ph = img.height * fit;
  const px = PAD, py = (H - ph) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = INK;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  ctx.drawImage(img, px, py, pw, ph);

  // ── Text column ───────────────────────────────────────────────────────────
  const tx = px + pw + 56;
  const tw = W - tx - PAD;

  ctx.textBaseline = "alphabetic";

  // Eyebrow
  ctx.fillStyle = GOLD;
  ctx.font = `500 15px ${sans}`;
  const eyebrow = [meta.genre, meta.country].filter(Boolean).join("  ·  ").toUpperCase();
  let y = 150;
  if (eyebrow) { tracked(ctx, eyebrow, tx, y, 3.2); y += 46; }

  // Title
  ctx.fillStyle = IVORY;
  ctx.font = `400 58px ${display}`;
  const titleLines = wrap(ctx, meta.title, tw, 3);
  for (const line of titleLines) { ctx.fillText(line, tx, y); y += 70; }

  // Logline
  if (meta.logline) {
    y += 8;
    ctx.fillStyle = "rgba(245,245,247,0.62)";
    ctx.font = `300 25px ${sans}`;
    for (const line of wrap(ctx, meta.logline, tw, 3)) { ctx.fillText(line, tx, y); y += 38; }
  }

  // ── Footer: gold rule + wordmark ──────────────────────────────────────────
  const fy = H - PAD - 6;
  ctx.fillStyle = GOLD;
  ctx.fillRect(tx, fy - 26, 34, 2);
  ctx.fillStyle = "rgba(245,245,247,0.75)";
  ctx.font = `500 15px ${sans}`;
  tracked(ctx, "PITCH.FYLYM", tx, fy, 4.5);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.9),
  );
}

/**
 * Render and upload to `thumbnails/share-cards/…`.
 * Returns the storage path, or null on any failure — the caller falls back to
 * the poster, so a failure costs a nicer card, never the share itself.
 */
export async function generateAndUploadShareCard(
  source: File | Blob | string,
  meta: ShareCardMeta,
  keyHint?: string,
): Promise<string | null> {
  try {
    if (!meta.title?.trim()) return null;
    const blob = await renderShareCardBlob(source, meta);
    const supabase = createClient();
    const key = (keyHint ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
    const path = `share-cards/${key}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}
