// Client-only: shrink an image before it is uploaded.
//
// Every image upload previously stored the original file — posters and avatars
// up to 10MB, opportunity posters up to 5MB — and every surface then served
// that original into a box a few hundred pixels wide. The homepage ticker alone
// pulls a full-resolution poster per project into a 176px tile. That is the
// bulk of Supabase egress.
//
// Two outputs per image:
//   full  — capped at 1600px, for detail pages and share cards
//   thumb — capped at 480px, for tickers, grids and lists
//
// WebP at 0.82 with a JPEG fallback: every browser that can run this code can
// encode WebP, but canvas.toBlob silently hands back a PNG if it cannot, which
// would be larger than the original — so the type is checked rather than
// assumed.

export type ResizedImage = { blob: Blob; ext: string; contentType: string; width: number; height: number };

const FULL_MAX  = 1600;
const THUMB_MAX = 480;

async function loadBitmap(file: File): Promise<{ w: number; h: number; draw: (c: HTMLCanvasElement, w: number, h: number) => void }> {
  // createImageBitmap handles EXIF orientation and is far faster on large
  // files; fall back to an <img> where it is missing.
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file);
    return {
      w: bmp.width,
      h: bmp.height,
      draw: (c, w, h) => c.getContext("2d")!.drawImage(bmp, 0, 0, w, h),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode failed"));
      i.src = url;
    });
    return {
      w: img.naturalWidth,
      h: img.naturalHeight,
      draw: (c, w, h) => c.getContext("2d")!.drawImage(img, 0, 0, w, h),
    };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<{ blob: Blob; ext: string; contentType: string }> {
  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", contentType: "image/webp" };
  const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!jpeg) throw new Error("encode failed");
  return { blob: jpeg, ext: "jpg", contentType: "image/jpeg" };
}

async function scaleTo(file: File, maxEdge: number, quality: number): Promise<ResizedImage> {
  const src = await loadBitmap(file);
  const ratio = Math.min(1, maxEdge / Math.max(src.w, src.h));   // never upscale
  const w = Math.max(1, Math.round(src.w * ratio));
  const h = Math.max(1, Math.round(src.h * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  src.draw(canvas, w, h);

  const { blob, ext, contentType } = await encode(canvas, quality);
  return { blob, ext, contentType, width: w, height: h };
}

/**
 * Returns a display-size copy and a thumbnail. On any failure — an unsupported
 * format, a canvas the browser refuses to encode — returns null so the caller
 * falls back to uploading the original. A heavier image is better than a
 * blocked upload.
 */
export async function resizeForUpload(
  file: File,
): Promise<{ full: ResizedImage; thumb: ResizedImage } | null> {
  try {
    if (!file.type.startsWith("image/")) return null;
    if (file.type === "image/svg+xml") return null;            // vector: leave alone
    const [full, thumb] = await Promise.all([
      scaleTo(file, FULL_MAX, 0.82),
      scaleTo(file, THUMB_MAX, 0.78),
    ]);
    return { full, thumb };
  } catch {
    return null;
  }
}

/** Storage paths here are timestamped and never overwritten, so the bytes at a
 *  given URL never change — a year is safe and takes repeat visits to zero. */
export const IMMUTABLE_CACHE = "31536000";
