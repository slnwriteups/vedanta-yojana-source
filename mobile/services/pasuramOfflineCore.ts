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
}

/**
 * Downloads every URL in `urls` that isn't already available locally,
 * strictly one at a time (never concurrent) so as not to overwhelm
 * Prapatti's server with a burst of ~400 simultaneous requests. A
 * failure on one URL is recorded and the loop continues -- one bad PDF
 * never aborts the rest of the batch. Callers are expected to pass an
 * already-deduplicated list (see content-lib/pasuram-resources.ts's
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
  };

  let completed = 0;
  for (const url of urls) {
    if (isPasuramAvailable(url, fs)) {
      summary.alreadyAvailable += 1;
    } else {
      const result = await downloadPasuram(url, fs);
      if (result.success) {
        summary.downloaded += 1;
      } else {
        summary.failed += 1;
        summary.failedUrls.push(url);
      }
    }
    completed += 1;
    onProgress?.({ completed, total: urls.length, currentUrl: url });
  }

  return summary;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown error occurred.";
}
