import { getPasuramFileName, PASURAM_DIRECTORY_NAME } from "./pasuramResourceId.ts";

/**
 * The actual download/validate/promote/delete orchestration for offline
 * Pasuram PDFs -- deliberately has ZERO import of expo-file-system or
 * expo-sharing, so this file (and therefore this logic) can be loaded
 * and unit-tested under plain `node --test`. Node's native TypeScript
 * support refuses to type-strip .ts files that live under node_modules
 * ("Stripping types is currently unsupported for files under
 * node_modules"), so even a file that only USES expo-file-system behind
 * a fake in tests still crashes on import if it also has a real,
 * top-level `import ... from "expo-file-system"` -- which is exactly
 * why the real adapter lives in the separate pasuramOfflineService.ts
 * instead of here. That file re-exports everything from this one,
 * pre-bound to the real filesystem, for app code to import normally.
 *
 * See pasuramOfflineService.ts's own doc comment for the full picture:
 * URL-as-identity, why downloads land in a scratch location before
 * promotion, and the mobile/tests/offline.test.ts boundary this
 * respects (network/filesystem logic confined to mobile/services/).
 */

export interface PasuramFileSystem {
  readonly documentDirectoryPath: string;
  readonly cacheDirectoryPath: string;
  fileExists(path: string): boolean;
  fileSize(path: string): number;
  readFileBytes(path: string): Uint8Array;
  deleteFile(path: string): void;
  ensureDirectoryExists(path: string): void;
  moveFile(fromPath: string, toPath: string): void;
  downloadFile(url: string, destinationPath: string): Promise<void>;
  canOpenFiles(): Promise<boolean>;
  openFile(path: string): Promise<void>;
}

const TEMP_SUFFIX = ".download";
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // ASCII "%PDF"

/** True if the given bytes are actually a PDF, not e.g. an HTML error page or a truncated/empty response. Pure -- no filesystem access. */
export function isValidPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((expected, i) => bytes[i] === expected);
}

function localPasuramPath(url: string, fs: PasuramFileSystem): string {
  return `${fs.documentDirectoryPath}${PASURAM_DIRECTORY_NAME}/${getPasuramFileName(url)}`;
}

function tempPasuramPath(url: string, fs: PasuramFileSystem): string {
  return `${fs.cacheDirectoryPath}${PASURAM_DIRECTORY_NAME}/${getPasuramFileName(url)}${TEMP_SUFFIX}`;
}

function isValidPdfFile(path: string, fs: PasuramFileSystem): boolean {
  if (!fs.fileExists(path)) return false;
  if (fs.fileSize(path) <= 0) return false;
  let bytes: Uint8Array;
  try {
    bytes = fs.readFileBytes(path);
  } catch {
    return false;
  }
  return isValidPdfBytes(bytes);
}

/**
 * The local file:// URI a Pasuram PDF will have once downloaded --
 * whether or not it exists yet. Never touches the network or the
 * filesystem itself.
 */
export function getLocalPasuramPath(url: string, fs: PasuramFileSystem): string {
  return localPasuramPath(url, fs);
}

/**
 * Whether this exact Pasuram URL already has a valid local copy.
 * Synchronous, local-only -- safe to call on every render, never
 * contacts Prapatti.
 */
export function isPasuramAvailable(url: string, fs: PasuramFileSystem): boolean {
  return isValidPdfFile(localPasuramPath(url, fs), fs);
}

export interface PasuramDownloadResult {
  success: boolean;
  error?: string;
}

/**
 * Downloads a Pasuram PDF from its Prapatti URL into private, persistent
 * storage. Safe to call even if a valid copy already exists (the new
 * download is validated before it ever replaces the old one); safe to
 * call concurrently for different URLs.
 */
export async function downloadPasuram(url: string, fs: PasuramFileSystem): Promise<PasuramDownloadResult> {
  const tempDirPath = `${fs.cacheDirectoryPath}${PASURAM_DIRECTORY_NAME}`;
  fs.ensureDirectoryExists(tempDirPath);

  const tempPath = tempPasuramPath(url, fs);
  if (fs.fileExists(tempPath)) {
    try {
      fs.deleteFile(tempPath);
    } catch {
      // A stale temp file from an earlier interrupted attempt; the
      // download below would fail on it anyway, so surface that
      // failure instead of this best-effort cleanup step.
    }
  }

  try {
    await fs.downloadFile(url, tempPath);
  } catch (error) {
    return { success: false, error: describeError(error) };
  }

  if (!isValidPdfFile(tempPath, fs)) {
    try {
      fs.deleteFile(tempPath);
    } catch {
      // best-effort cleanup of the invalid temp file
    }
    return { success: false, error: "The downloaded file was not a valid PDF." };
  }

  const finalDirPath = `${fs.documentDirectoryPath}${PASURAM_DIRECTORY_NAME}`;
  fs.ensureDirectoryExists(finalDirPath);
  const finalPath = localPasuramPath(url, fs);
  try {
    if (fs.fileExists(finalPath)) {
      fs.deleteFile(finalPath);
    }
    fs.moveFile(tempPath, finalPath);
  } catch (error) {
    try {
      fs.deleteFile(tempPath);
    } catch {
      // best-effort cleanup
    }
    return { success: false, error: describeError(error) };
  }

  return { success: true };
}

export interface PasuramOpenResult {
  success: boolean;
  error?: string;
}

/**
 * Opens an already-downloaded Pasuram PDF with the OS's own PDF viewer.
 * Only ever inspects local storage -- never contacts Prapatti, performs
 * no connectivity check, and does not attempt a fresh download. Callers
 * must check isPasuramAvailable() first (or handle a `success: false`
 * result) rather than assuming this always has something to open.
 */
export async function openOfflinePasuram(url: string, fs: PasuramFileSystem): Promise<PasuramOpenResult> {
  const path = localPasuramPath(url, fs);
  if (!isValidPdfFile(path, fs)) {
    return { success: false, error: "This Pasuram has not been downloaded yet." };
  }

  const canOpen = await fs.canOpenFiles();
  if (!canOpen) {
    return { success: false, error: "No app on this device can open a PDF." };
  }

  try {
    await fs.openFile(path);
    return { success: true };
  } catch (error) {
    return { success: false, error: describeError(error) };
  }
}

/** Removes a Pasuram's local copy, if any. The Prapatti source URL itself is untouched -- this only affects the local cache. */
export function deleteOfflinePasuram(url: string, fs: PasuramFileSystem): void {
  const path = localPasuramPath(url, fs);
  if (fs.fileExists(path)) {
    fs.deleteFile(path);
  }
}

/**
 * A per-PDF size estimate derived from a small HEAD-request sample taken
 * during the architecture audit (10 real Prapatti PDFs, 51-203KB, mean
 * ~84KB) -- not a measurement of all ~402 unique PDFs, which would mean
 * firing hundreds of requests at Prapatti just to refine an estimate.
 * Deliberately named/used only for a rough "Approximately N MB" label,
 * never presented as exact.
 */
const ESTIMATED_MEAN_PASURAM_SIZE_MB = 0.084;

export function estimatedPasuramLibrarySizeMb(uniqueUrlCount: number): number {
  return Math.round(uniqueUrlCount * ESTIMATED_MEAN_PASURAM_SIZE_MB);
}

export interface BulkDownloadProgress {
  completed: number;
  total: number;
  currentUrl: string;
}

export interface BulkDownloadSummary {
  totalRequested: number;
  alreadyAvailable: number;
  downloaded: number;
  failed: number;
  failedUrls: string[];
  /**
   * True if the batch stopped before attempting every URL, because
   * PASURAM_CONSECUTIVE_FAILURE_LIMIT consecutive download attempts
   * failed in a row -- see the circuit breaker in downloadAllPasurams()
   * below. When true, `totalRequested - (alreadyAvailable + downloaded +
   * failed)` URLs were never attempted at all.
   */
  stoppedEarly: boolean;
}

/**
 * A small bounded concurrency, not the full ~400-wide burst a naive
 * Promise.all would fire, so Prapatti's server still only ever sees a
 * handful of simultaneous requests from one device -- roughly what a
 * browser would do loading that many links itself -- while still being
 * meaningfully faster than one-at-a-time.
 */
const PASURAM_DOWNLOAD_CONCURRENCY = 4;

/**
 * A floor on the gap between successive request *starts*, shared across
 * every concurrent worker (not per-worker) -- concurrency alone controls
 * how many requests are in flight at once, not how many are *started*
 * per second, and it's the latter that a rate limiter actually watches.
 * Confirmed necessary the hard way: a real run of the previous, fully
 * sequential (concurrency-1, no pacing) downloader against all ~400
 * Prapatti URLs got the download device's IP connection-reset-blocked
 * partway through (266/402 failed), meaning even one-at-a-time-as-fast-
 * as-possible was already too bursty. At ~4 req/s ceiling (concurrency 4
 * + this floor), ~400 requests finish in under two minutes -- still far
 * faster than one-at-a-time, but no longer bursty enough to reproduce
 * that block in manual retesting.
 */
const PASURAM_MIN_REQUEST_INTERVAL_MS = 250;

/**
 * If this many download attempts in a row fail, the batch stops issuing
 * new requests rather than ploughing through the rest of a ~400-URL list
 * against a server that's evidently already blocking this device --
 * every further attempt would just fail too, for free extra load on
 * Prapatti and a longer wait for a user who's already getting nothing
 * but failures. `isPasuramAvailable` skips (not attempts) don't count
 * against this -- only real download attempts do.
 */
const PASURAM_CONSECUTIVE_FAILURE_LIMIT = 6;

/**
 * Downloads every URL in `urls` that isn't already available locally, up
 * to PASURAM_DOWNLOAD_CONCURRENCY at once and no faster than one new
 * request every PASURAM_MIN_REQUEST_INTERVAL_MS. A failure on one URL is
 * recorded and the rest continue -- one bad PDF never aborts the batch --
 * unless PASURAM_CONSECUTIVE_FAILURE_LIMIT failures happen in a row, in
 * which case the whole batch stops early (see `stoppedEarly` on the
 * returned summary). Callers are expected to pass an already-
 * deduplicated list (see content-lib/pasuram-resources.ts's
 * allPasuramResourceUrls()) so each unique PDF is only attempted once
 * regardless of how many Divya Desams reference it.
 */
export async function downloadAllPasurams(
  urls: readonly string[],
  fs: PasuramFileSystem,
  onProgress?: (progress: BulkDownloadProgress) => void
): Promise<BulkDownloadSummary> {
  const summary: BulkDownloadSummary = {
    totalRequested: urls.length,
    alreadyAvailable: 0,
    downloaded: 0,
    failed: 0,
    failedUrls: [],
    stoppedEarly: false,
  };

  let completed = 0;
  let consecutiveFailures = 0;
  let stopped = false;
  let nextIndex = 0;
  let earliestNextStart = 0;

  async function worker(): Promise<void> {
    while (!stopped && nextIndex < urls.length) {
      const url = urls[nextIndex];
      nextIndex += 1;

      if (isPasuramAvailable(url, fs)) {
        summary.alreadyAvailable += 1;
      } else {
        // Reserves this worker's start slot synchronously (no `await`
        // between reading and advancing `earliestNextStart`), so two
        // concurrent workers can never read the same slot and both wait
        // the same amount before firing together -- each reservation
        // pushes the next one PASURAM_MIN_REQUEST_INTERVAL_MS further
        // out, regardless of how many workers race to reserve at once.
        const mySlot = Math.max(Date.now(), earliestNextStart);
        earliestNextStart = mySlot + PASURAM_MIN_REQUEST_INTERVAL_MS;
        const waitMs = mySlot - Date.now();
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

        const result = await downloadPasuram(url, fs);
        if (result.success) {
          summary.downloaded += 1;
          consecutiveFailures = 0;
        } else {
          summary.failed += 1;
          summary.failedUrls.push(url);
          consecutiveFailures += 1;
          if (consecutiveFailures >= PASURAM_CONSECUTIVE_FAILURE_LIMIT) {
            stopped = true;
            summary.stoppedEarly = true;
          }
        }
      }

      completed += 1;
      onProgress?.({ completed, total: urls.length, currentUrl: url });
    }
  }

  const workerCount = Math.max(1, Math.min(PASURAM_DOWNLOAD_CONCURRENCY, urls.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return summary;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown error occurred.";
}
