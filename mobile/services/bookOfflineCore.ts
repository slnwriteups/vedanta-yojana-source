import { BookPayloadSchema, BOOK_PAYLOAD_SCHEMA_VERSION, type BookPayload } from "../../content-lib/mobile-content.ts";
import { mapWithConcurrency } from "./concurrencyPool.ts";

/**
 * The actual download/validate/promote/delete orchestration for offline
 * Library books -- deliberately has ZERO import of expo-file-system, so
 * this file (and therefore this logic) can be loaded and unit-tested
 * under plain `node --test`, matching image-viewer-math.ts's own
 * established convention for isolating pure logic from a native import.
 * bookOfflineService.ts re-exports everything from this file, pre-bound
 * to the real filesystem, for app code to import normally.
 *
 * (Pasurams no longer have an equivalent download step at all -- every
 * Pasuram PDF is now bundled directly into the app, see
 * pasuramOfflineService.ts -- so BookFileSystem has no sibling
 * interface to compare itself against anymore; it's just this feature's
 * own filesystem seam.)
 */
export interface BookFileSystem {
  readonly documentDirectoryPath: string;
  readonly cacheDirectoryPath: string;
  fileExists(path: string): boolean;
  fileSize(path: string): number;
  readTextFile(path: string): string;
  deleteFile(path: string): void;
  /** Recursive. A no-op (not an error) if the directory doesn't exist. */
  deleteDirectory(path: string): void;
  ensureDirectoryExists(path: string): void;
  moveFile(fromPath: string, toPath: string): void;
  downloadTextFile(url: string, destinationPath: string): Promise<void>;
  downloadBinaryFile(url: string, destinationPath: string): Promise<void>;
}

const BOOKS_DIRECTORY_NAME = "books";

/**
 * Book images are served from our own GitHub Pages/Fastly-backed CDN
 * (see bookOfflineService.ts's IMAGE_BASE_URL), not a rate-sensitive
 * third party, so there's no politeness reason to hold this low -- 6
 * roughly matches a browser's per-host connection limit.
 */
const IMAGE_DOWNLOAD_CONCURRENCY = 6;

function localBookDir(bookSlug: string, fs: BookFileSystem): string {
  return `${fs.documentDirectoryPath}${BOOKS_DIRECTORY_NAME}/${bookSlug}`;
}

function localBookJsonPath(bookSlug: string, fs: BookFileSystem): string {
  return `${localBookDir(bookSlug, fs)}/book.json`;
}

function localBookImageDir(bookSlug: string, fs: BookFileSystem): string {
  return `${localBookDir(bookSlug, fs)}/images`;
}

function tempBookDir(bookSlug: string, fs: BookFileSystem): string {
  return `${fs.cacheDirectoryPath}${BOOKS_DIRECTORY_NAME}/${bookSlug}-download`;
}

/**
 * Parses and validates a local book.json's contents. Returns null (never
 * throws) for anything that isn't genuinely a valid, current-schema,
 * correctly-slugged payload -- missing file, malformed JSON, a payload
 * for a different book, or (critically) a `contentSchemaVersion` this
 * build of the app doesn't understand, which is exactly what
 * BOOK_PAYLOAD_SCHEMA_VERSION exists to catch: a future incompatible
 * payload shape must never be silently accepted by an older, still-
 * installed app.
 */
function readValidBookPayload(bookSlug: string, path: string, fs: BookFileSystem): BookPayload | null {
  if (!fs.fileExists(path)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readTextFile(path));
  } catch {
    return null;
  }
  const result = BookPayloadSchema.safeParse(raw);
  if (!result.success) return null;
  if (result.data.contentSchemaVersion !== BOOK_PAYLOAD_SCHEMA_VERSION) return null;
  if (result.data.book.slug !== bookSlug) return null;
  return result.data;
}

/**
 * Whether this book already has a valid local copy. Synchronous, local-
 * only -- safe to call on every render, never contacts the network.
 */
export function isBookAvailable(bookSlug: string, fs: BookFileSystem): boolean {
  return readValidBookPayload(bookSlug, localBookJsonPath(bookSlug, fs), fs) !== null;
}

/**
 * The full downloaded book (metadata + every chapter's real body/images),
 * or null if it hasn't been downloaded (or its local copy failed
 * validation). Callers must check isBookAvailable() first, or handle
 * null, rather than assuming a book is always there -- this never
 * attempts a download itself.
 */
export function loadOfflineBook(bookSlug: string, fs: BookFileSystem): BookPayload | null {
  return readValidBookPayload(bookSlug, localBookJsonPath(bookSlug, fs), fs);
}

/**
 * The local file:// URI for a downloaded book's image, given the exact
 * filename recorded in that book's own `imageFiles` map (BookPayload) --
 * or null if the book isn't downloaded, the uuid isn't one of its
 * images, or that specific image file is missing locally (e.g. an
 * interrupted per-image download -- see downloadBook()'s own doc
 * comment on why that's treated as a whole-book failure, making this
 * case not actually reachable for a book isBookAvailable() reports as
 * available, but still handled defensively).
 */
export function getOfflineBookImageUri(bookSlug: string, imageUuid: string, fs: BookFileSystem): string | null {
  const payload = loadOfflineBook(bookSlug, fs);
  const filename = payload?.imageFiles[imageUuid.toLowerCase()];
  if (!filename) return null;
  const imagePath = `${localBookImageDir(bookSlug, fs)}/${filename}`;
  return fs.fileExists(imagePath) ? imagePath : null;
}

export interface BookDownloadResult {
  success: boolean;
  error?: string;
}

/**
 * Downloads a book's full JSON payload and every image it references,
 * validates all of it, and only then promotes it into the book's real
 * local directory -- a scratch-then-validate-then-move pattern, since
 * expo-file-system's own docs disclose that a failed download can leave
 * a partially-written file. Every part of a book download (the JSON,
 * and every referenced image) is fetched into a shared temp directory
 * first; if ANY part fails or fails validation, the whole download is
 * discarded and any existing valid offline copy of this book is left
 * completely untouched. A book is therefore always either fully
 * available offline or not available at all -- never partially.
 * Images download up to IMAGE_DOWNLOAD_CONCURRENCY at once (see that
 * constant); if any fail, the ones already in flight are still allowed
 * to finish before the whole attempt is discarded, rather than trying
 * to cancel them.
 */
export async function downloadBook(
  bookSlug: string,
  bookJsonUrl: string,
  imageBaseUrl: string,
  fs: BookFileSystem
): Promise<BookDownloadResult> {
  const tempDir = tempBookDir(bookSlug, fs);
  fs.deleteDirectory(tempDir);
  fs.ensureDirectoryExists(tempDir);
  fs.ensureDirectoryExists(`${tempDir}/images`);

  const tempJsonPath = `${tempDir}/book.json`;
  try {
    await fs.downloadTextFile(bookJsonUrl, tempJsonPath);
  } catch (error) {
    fs.deleteDirectory(tempDir);
    return { success: false, error: describeError(error) };
  }

  const payload = readValidBookPayload(bookSlug, tempJsonPath, fs);
  if (!payload) {
    fs.deleteDirectory(tempDir);
    return { success: false, error: "The downloaded book content was not valid." };
  }

  const imageResults = await mapWithConcurrency(
    Object.entries(payload.imageFiles),
    IMAGE_DOWNLOAD_CONCURRENCY,
    async ([uuid, filename]) => {
      try {
        await fs.downloadBinaryFile(`${imageBaseUrl}/${filename}`, `${tempDir}/images/${filename}`);
        return { uuid, error: null as string | null };
      } catch (error) {
        return { uuid, error: describeError(error) };
      }
    }
  );
  const firstFailedImage = imageResults.find((result) => result.error !== null);
  if (firstFailedImage) {
    fs.deleteDirectory(tempDir);
    return { success: false, error: `Failed to download an image (${firstFailedImage.uuid}): ${firstFailedImage.error}` };
  }

  const finalDir = localBookDir(bookSlug, fs);
  try {
    fs.deleteDirectory(finalDir);
    fs.ensureDirectoryExists(finalDir);
    fs.moveFile(tempJsonPath, localBookJsonPath(bookSlug, fs));
    fs.ensureDirectoryExists(localBookImageDir(bookSlug, fs));
    for (const filename of Object.values(payload.imageFiles)) {
      fs.moveFile(`${tempDir}/images/${filename}`, `${localBookImageDir(bookSlug, fs)}/${filename}`);
    }
  } catch (error) {
    // The final directory may now be in a half-moved state -- but since
    // every file about to be moved was already validated above, the only
    // realistic cause here is a filesystem-level failure (disk full,
    // permissions), not a data problem. Surface it rather than pretend
    // success; a retry will re-attempt the whole download.
    return { success: false, error: describeError(error) };
  } finally {
    fs.deleteDirectory(tempDir);
  }

  return { success: true };
}

/** Removes a book's local copy, if any. Never contacts the network. */
export function deleteBook(bookSlug: string, fs: BookFileSystem): void {
  fs.deleteDirectory(localBookDir(bookSlug, fs));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown error occurred.";
}
