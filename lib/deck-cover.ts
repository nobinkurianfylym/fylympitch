// Client-only utility: render page 1 of a pitch-deck PDF to a watermarked JPEG
// and store it in the public `thumbnails` bucket, so public pages can show a
// plain <img> instead of running pdf.js in every visitor's browser.
//
// Must only be imported from client components (uses canvas + pdfjs + browser).

import { createClient } from "@/lib/supabase/client";

function paintWatermark(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#1A1815";
  ctx.font = `${Math.round(w * 0.038)}px Montserrat, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  const step = Math.round(w * 0.38);
  for (let row = -h; row < h; row += step)
    for (let col = -w; col < w; col += step) ctx.fillText("www.fylym.com", col, row);
  ctx.restore();
}

/** Render page 1 of a PDF (a File or a URL) to a watermarked JPEG blob. */
export async function renderDeckCoverBlob(
  source: File | string,
  targetWidth = 640,
): Promise<Blob> {
  const pdfjsLib: any = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const docParams =
    typeof source === "string" ? { url: source } : { data: await source.arrayBuffer() };
  const pdf = await pdfjsLib.getDocument(docParams).promise;
  const page = await pdf.getPage(1);

  const vp0 = page.getViewport({ scale: 1 });
  const scale = targetWidth / vp0.width;
  const vp = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp } as any).promise;
  paintWatermark(canvas);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.82),
  );
}

/**
 * Generate the cover and upload it to `thumbnails/deck-covers/…`.
 * Returns the storage path, or null on any failure (caller falls back to pdf.js).
 */
export async function generateAndUploadDeckCover(
  source: File | string,
  keyHint?: string,
): Promise<string | null> {
  try {
    const blob = await renderDeckCoverBlob(source);
    const supabase = createClient();
    const key = (keyHint ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
    const path = `deck-covers/${key}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}
