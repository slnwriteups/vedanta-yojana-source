import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as core from "./pasuramOfflineCore.ts";
import type { PasuramFileSystem } from "./pasuramOfflineCore.ts";

/**
 * Makes Prapatti.org Pasuram PDFs available offline: download once into
 * app-private persistent storage (Paths.document, never public Downloads,
 * never expo-file-system's reclaimable Paths.cache for the final copy),
 * then open the local copy with zero network contact on every subsequent
 * view. This is the one place in mobile/ allowed to touch the network for
 * this feature -- see mobile/tests/offline.test.ts, which fails the build
 * if app/, components/, or content-lib/ reference fetch/XMLHttpRequest/
 * axios, and mobile/services/updateCheckService.ts for the pre-existing
 * convention this follows.
 *
 * The URL itself (content-lib's ResourceEntry.url, type "pasuram-pdf")
 * is the resource's identity -- getPasuramResourceId() (a pure SHA-256,
 * see pasuramResourceId.ts) maps it deterministically to one local
 * filename, so the 7 PDFs genuinely shared between two Divya Desams, and
 * the handful of records that list the same URL more than once, both
 * collapse to a single downloaded file with no extra bookkeeping.
 *
 * Download safety: expo-file-system's own docs disclose that on Android
 * "if the download fails after it starts, a partially written file may
 * remain at the destination" -- so downloads always land in a scratch
 * subdirectory under Paths.cache first, get validated, and only then get
 * moved into the real pasurams/ directory under Paths.document. A failed
 * or invalid download therefore never touches, and can never corrupt, an
 * existing valid offline copy.
 *
 * This file is just the real expo-file-system/expo-sharing adapter, pre-
 * bound onto the actual orchestration logic in pasuramOfflineCore.ts.
 * That split exists because Node's native TypeScript support refuses to
 * strip types from .ts files under node_modules -- a module that
 * statically imports expo-file-system crashes under `node --test`
 * regardless of whether any given code path actually uses it, so the
 * genuinely test-covered logic has to live somewhere with no such
 * import at all. mobile/tests/pasuram-offline-service.test.ts exercises
 * pasuramOfflineCore.ts directly, against a small in-memory fake
 * filesystem, instead of this file.
 */

const realFileSystem: PasuramFileSystem = {
  get documentDirectoryPath() {
    return Paths.document.uri;
  },
  get cacheDirectoryPath() {
    return Paths.cache.uri;
  },
  fileExists(path) {
    return new File(path).exists;
  },
  fileSize(path) {
    return new File(path).size;
  },
  readFileBytes(path) {
    return new File(path).bytesSync();
  },
  deleteFile(path) {
    const file = new File(path);
    if (file.exists) file.delete();
  },
  ensureDirectoryExists(path) {
    const dir = new Directory(path);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  },
  moveFile(fromPath, toPath) {
    new File(fromPath).move(new File(toPath));
  },
  async downloadFile(url, destinationPath) {
    // expo-file-system's own static return type doesn't line up exactly
    // with the `File` class this module otherwise uses (an SDK typing
    // quirk, not a real distinction) -- the caller only needs the side
    // effect (a file now exists at destinationPath), so the resolved
    // value itself is discarded.
    await File.downloadFileAsync(url, new File(destinationPath));
  },
  async canOpenFiles() {
    return Sharing.isAvailableAsync();
  },
  async openFile(path) {
    await Sharing.shareAsync(path, { mimeType: "application/pdf", dialogTitle: "Open Pasuram" });
  },
};

export type {
  BulkDownloadProgress,
  BulkDownloadSummary,
  PasuramDownloadResult,
  PasuramFileSystem,
  PasuramOpenResult,
} from "./pasuramOfflineCore.ts";
export { isValidPdfBytes } from "./pasuramOfflineCore.ts";

export function getLocalPasuramPath(url: string): string {
  return core.getLocalPasuramPath(url, realFileSystem);
}

export function isPasuramAvailable(url: string): boolean {
  return core.isPasuramAvailable(url, realFileSystem);
}

export function downloadPasuram(url: string) {
  return core.downloadPasuram(url, realFileSystem);
}

export function openOfflinePasuram(url: string) {
  return core.openOfflinePasuram(url, realFileSystem);
}

export function deleteOfflinePasuram(url: string): void {
  core.deleteOfflinePasuram(url, realFileSystem);
}

export function estimatedPasuramLibrarySizeMb(uniqueUrlCount: number): number {
  return core.estimatedPasuramLibrarySizeMb(uniqueUrlCount);
}

export function downloadAllPasurams(
  urls: readonly string[],
  onProgress?: (progress: core.BulkDownloadProgress) => void
) {
  return core.downloadAllPasurams(urls, realFileSystem, onProgress);
}
