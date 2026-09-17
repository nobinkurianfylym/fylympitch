// ─────────────────────────────────────────────────────────────────────────────
// Supabase Storage image sizing.
//
// Every image on the site was served at its stored size. A poster shown in a
// 52x68 notification row downloaded the same file as the one on the project
// page — often 1600px wide. The Pro plan unlocks Storage's transform endpoint,
// so the size can be asked for at request time and Supabase's CDN caches the
// result.
//
// Deliberately NOT next/image. Every call site here sizes its image with
// `className="w-full h-full object-cover"` inside an already-sized parent;
// next/image would need `fill` and therefore a positioned parent at all ~30
// of them, which is a lot of layout risk for the same number of bytes saved.
// A URL helper changes nothing about the markup.
//
// Cost: Supabase bills per 1,000 *origin* images per month (Pro includes 100),
// not per request — so many sizes of one poster still count once, and the CDN
// serves repeat requests for free.
// ─────────────────────────────────────────────────────────────────────────────

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

/** Supabase rejects anything outside 1–2500. */
function clampWidth(w: number): number {
  return Math.max(1, Math.min(2500, Math.round(w)));
}

/**
 * Ask Supabase for this image at a given width.
 *
 * Anything that is not a Supabase public-object URL — a local /public asset, a
 * data: URI, an already-signed URL, an external avatar — is returned untouched.
 * That pass-through is the whole safety story: a URL this helper does not
 * recognise behaves exactly as it does today.
 *
 * Quality 70 rather than Supabase's default 80: at thumbnail sizes the
 * difference is invisible and the saving is roughly a third.
 */
export function sized(
  url: string | null | undefined,
  width: number,
  quality = 70,
): string {
  if (!url) return "";
  if (!url.includes(OBJECT_PATH)) return url;

  const base = url.split("?")[0].replace(OBJECT_PATH, RENDER_PATH);
  return `${base}?width=${clampWidth(width)}&quality=${quality}`;
}

/**
 * A 1x/2x srcSet for a fixed-size image, which is what almost every image on
 * this site is — a thumbnail or an avatar in a box of known pixel size. Retina
 * screens get the sharp version, everyone else downloads half the bytes.
 *
 * Returns "" for URLs `sized` passes through, so the caller can spread it into
 * JSX and have the attribute simply not appear.
 */
export function srcSet2x(
  url: string | null | undefined,
  width: number,
  quality = 70,
): string {
  if (!url || !url.includes(OBJECT_PATH)) return "";
  return `${sized(url, width, quality)} 1x, ${sized(url, width * 2, quality)} 2x`;
}
