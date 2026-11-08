/**
 * The website's own copy of each Prapatti.com Pasuram/Stotram PDF, so
 * the site can offer the same mechanics as the app: open Prapatti's
 * current file when online, and a kept copy when offline.
 *
 * A browser can only keep a file for offline use if this site serves
 * it, so the deploy workflow downloads every PDF from Prapatti.com into
 * out/pasurams/ (scripts/sync-pasuram-mirror.ts) and redeploys daily to
 * pick up corrections. public/sw.js keeps the copies a reader opens and
 * refreshes them when a corrected version appears.
 *
 * The mirror keeps Prapatti's own layout:
 *   https://www.prapatti.com/slokas/<language>/<file>.pdf
 *   -> /pasurams/<language>/<file>.pdf
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const PRAPATTI_PDF = /^https:\/\/www\.prapatti\.com\/slokas\/([a-z]+)\/([a-z0-9]+\.pdf)$/;

/** Site-relative path (without base path) of the mirrored copy, or null for a URL the mirror does not cover. */
export function pasuramMirrorRelativePath(url: string): string | null {
  const match = PRAPATTI_PDF.exec(url);
  return match ? `/pasurams/${match[1]}/${match[2]}` : null;
}

/** The mirrored copy's href on this site (base path applied), or null. */
export function pasuramMirrorHref(url: string): string | null {
  const relative = pasuramMirrorRelativePath(url);
  return relative ? `${BASE_PATH}${relative}` : null;
}
