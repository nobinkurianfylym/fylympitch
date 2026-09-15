/**
 * Posters uploaded after the resize change are stored as a pair in the
 * `thumbnails` bucket:
 *
 *   <stamp>-poster-full.webp    display size, capped at 1600px
 *   <stamp>-poster-thumb.webp   capped at 480px
 *
 * The thumbnail is derived from the stored path rather than kept in its own
 * column, so no migration is needed and nothing breaks for posters uploaded
 * before the change — their paths lack the marker and are returned untouched.
 *
 * Use preferThumb wherever the poster is drawn small (list rows, tiles, CRM
 * cards). Do NOT use it for share images or structured data: those are fetched
 * by crawlers that want the largest version.
 */
export function preferThumb(path: string | null | undefined): string {
  if (!path) return "";
  return path.includes("-poster-full.")
    ? path.replace("-poster-full.", "-poster-thumb.")
    : path;
}
