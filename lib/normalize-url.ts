/**
 * Accept a web address the way people actually type one.
 *
 * The profile fields used type="url", which the browser rejects unless the
 * value carries a scheme. That is not a ".com only" rule, though it reads like
 * one: "example.com" is refused exactly as "mystudio.co.uk", "banyan.film" and
 * "example.in" are. Anyone whose first attempt happened to include https://
 * concluded the site wanted .com.
 *
 * So the scheme is supplied rather than demanded. Everything below is accepted
 * and stored as a proper URL:
 *
 *   mystudio.co.uk            -> https://mystudio.co.uk
 *   www.example.in            -> https://www.example.in
 *   banyan.film/about         -> https://banyan.film/about
 *   http://legacy.example.org -> left alone, http is a real scheme
 *
 * Returns null for anything that is not a plausible address, so a typo is
 * dropped rather than stored as a dead link.
 */
export function normalizeUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  // A scheme we do not want to store, or a bare word with no dot, is not a site.
  if (/^(javascript|data|file|mailto):/i.test(raw)) return null;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  // Must look like a real host: a dot, and no spaces. This rejects "myfilm"
  // and "my site.com" without caring which top-level domain it ends in —
  // .film, .studio, .ngo and every country code are all fine.
  const host = url.hostname;
  if (!host.includes(".") || /\s/.test(host)) return null;
  if (host.startsWith(".") || host.endsWith(".")) return null;

  return url.toString().replace(/\/$/, "");
}
