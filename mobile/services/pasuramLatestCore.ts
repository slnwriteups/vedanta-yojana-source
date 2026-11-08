/**
 * Pure, framework-free logic for keeping Pasuram PDFs current with
 * Prapatti.com while still working fully offline. The device-facing
 * adapter is services/pasuramLatest.ts; this file has no imports so it
 * can be unit-tested under plain `node --test` (tests/pasuram-latest.test.ts).
 *
 * Why: the scholars behind Prapatti.com correct their PDFs over time as
 * other experts catch errors. The copies bundled into the app are a
 * snapshot from build time, so on their own they would go stale. The
 * design is:
 *
 *   1. The bundled archive stays as the offline baseline, so every
 *      Pasuram opens on a fresh install with no connection.
 *   2. When the reader taps a Pasuram and is online, the app asks
 *      Prapatti.com for the current PDF first (a conditional request, so
 *      an unchanged file costs almost nothing), saves it, and opens it.
 *   3. Every downloaded copy is kept, so it is what opens offline later.
 *   4. Whenever the app comes online (launch, return to the foreground,
 *      or the connection coming back while it is open), a light check
 *      (HEAD requests, at most once a day) notices corrected PDFs the
 *      reader has not opened yet and downloads only those, so a reader
 *      who later goes offline (say, on a yatra) still has the corrected
 *      text.
 *
 * Opening order is always: latest downloaded copy, else bundled copy.
 */

/** What we remember about one Pasuram's most recent download from Prapatti.com. */
export interface LatestEntry {
  /** Local filename under the latest-copies directory. */
  filename: string;
  etag?: string;
  lastModified?: string;
  /** Byte length of the downloaded PDF. */
  length: number;
  /** When the bytes were last downloaded (ms since epoch). */
  fetchedAt: number;
  /** When Prapatti.com was last asked about this file, changed or not (ms since epoch). */
  checkedAt: number;
}

export interface LatestIndex {
  version: 1;
  /** When the last full background check finished (ms since epoch), or 0. */
  lastSweepAt: number;
  entries: Record<string, LatestEntry>;
}

export function emptyLatestIndex(): LatestIndex {
  return { version: 1, lastSweepAt: 0, entries: {} };
}

function isEntry(value: unknown): value is LatestEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.filename === "string" &&
    /^[0-9a-f]{32}\.pdf$/.test(e.filename) &&
    typeof e.length === "number" &&
    typeof e.fetchedAt === "number" &&
    typeof e.checkedAt === "number" &&
    (e.etag === undefined || typeof e.etag === "string") &&
    (e.lastModified === undefined || typeof e.lastModified === "string")
  );
}

/** Parses the persisted index; anything unreadable becomes an empty index (the bundled copies still work). */
export function parseLatestIndex(text: string | null): LatestIndex {
  if (!text) return emptyLatestIndex();
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object") return emptyLatestIndex();
    const obj = raw as Record<string, unknown>;
    if (obj.version !== 1 || !obj.entries || typeof obj.entries !== "object") return emptyLatestIndex();
    const entries: Record<string, LatestEntry> = {};
    for (const [url, entry] of Object.entries(obj.entries as Record<string, unknown>)) {
      if (isEntry(entry)) entries[url] = entry;
    }
    const lastSweepAt = typeof obj.lastSweepAt === "number" ? obj.lastSweepAt : 0;
    return { version: 1, lastSweepAt, entries };
  } catch {
    return emptyLatestIndex();
  }
}

/** Request headers that let Prapatti.com answer "304 Not Modified" instead of resending an unchanged PDF. */
export function conditionalHeaders(entry: LatestEntry | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (entry?.etag) headers["If-None-Match"] = entry.etag;
  if (entry?.lastModified) headers["If-Modified-Since"] = entry.lastModified;
  return headers;
}

/** Below this, a "PDF" is almost certainly an error page or a truncated download. */
const MIN_PDF_BYTES = 1024;

/**
 * True only for bytes that look like a complete PDF: the "%PDF-" header
 * and an "%%EOF" marker near the end. Guards against saving an HTML error
 * page, a captive-portal login page, or a cut-off download over a good
 * local copy.
 */
export function looksLikeCompletePdf(bytes: Uint8Array): boolean {
  if (bytes.length < MIN_PDF_BYTES) return false;
  const header = String.fromCharCode(...bytes.subarray(0, 5));
  if (header !== "%PDF-") return false;
  const tail = String.fromCharCode(...bytes.subarray(Math.max(0, bytes.length - 1024)));
  return tail.includes("%%EOF");
}

/** Skip the network on open if Prapatti.com was asked about this file this recently. */
export const RECENT_CHECK_MS = 60 * 60 * 1000;

/** Whether tapping a Pasuram should ask Prapatti.com for the current version first. */
export function shouldCheckOnOpen(entry: LatestEntry | undefined, now: number): boolean {
  if (!entry) return true;
  return now - entry.checkedAt >= RECENT_CHECK_MS;
}

/** How often the correction check runs at most, once it has succeeded. */
export const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** While the app is open but the last check could not reach Prapatti.com, how often to try again. */
export const OFFLINE_RETRY_MS = 2 * 60 * 1000;

export function isSweepDue(index: LatestIndex, now: number): boolean {
  return now - index.lastSweepAt >= SWEEP_INTERVAL_MS;
}

/** What a HEAD response told us about Prapatti.com's current file. */
export interface RemoteInfo {
  etag?: string;
  lastModified?: string;
  length?: number;
}

/**
 * Whether Prapatti.com's current file differs from the copy we would open
 * now. Uses the strongest signal both sides have: ETag, then
 * Last-Modified, then byte length. For a Pasuram never downloaded, the
 * only thing known about the bundled copy is its original byte length
 * (content-lib/pasuram-origin.generated.ts). Returns false when there is
 * nothing to compare, so an uninformative server never triggers a
 * download; tapping the Pasuram while online still fetches it.
 */
export function remoteDiffers(remote: RemoteInfo, entry: LatestEntry | undefined, bundledLength: number | undefined): boolean {
  if (entry) {
    if (remote.etag && entry.etag) return remote.etag !== entry.etag;
    if (remote.lastModified && entry.lastModified) return remote.lastModified !== entry.lastModified;
    if (remote.length !== undefined) return remote.length !== entry.length;
    return false;
  }
  if (remote.length !== undefined && bundledLength !== undefined) return remote.length !== bundledLength;
  return false;
}

/** Reads the cache validators off a response's headers. */
export function remoteInfoFromHeaders(get: (name: string) => string | null): RemoteInfo {
  const etag = get("etag") ?? undefined;
  const lastModified = get("last-modified") ?? undefined;
  const lengthHeader = get("content-length");
  const length = lengthHeader !== null && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : undefined;
  return { etag, lastModified, length };
}
