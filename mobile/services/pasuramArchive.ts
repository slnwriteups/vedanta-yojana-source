import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import { decompress } from "fzstd";
import { PASURAM_ARCHIVE_VERSION, pasuramFileHashes, pasuramFilenameByUrl } from "../content-lib/pasuram-manifest.generated.ts";
import { pasuramArchiveAsset } from "../content-lib/pasuram-archive-asset.generated.ts";
import { PASURAM_DIRECTORY_NAME, sha256HexBytes } from "./pasuramResourceId.ts";
import { parseUstar } from "./pasuramTar.ts";

/**
 * Unpacks mobile/assets/pasurams-archive.generated.zst -- the single
 * solid-compressed archive Metro actually bundles into the app for
 * Pasurams (see scripts/generate-pasuram-archive.ts for why: measured,
 * not guessed, ~52MB total APK vs. ~69MB bundling all 432 PDFs
 * individually) -- into ordinary loose PDF files under app-private
 * document storage, once, so every subsequent Pasuram open is a plain
 * local file read with zero decompression cost.
 *
 * This is the one place in mobile/ allowed to touch expo-asset/
 * expo-file-system/fzstd for this feature -- see mobile/tests/
 * offline.test.ts, which fails the build if app/, components/, or
 * content-lib/ reference fetch/XMLHttpRequest/axios (this file only
 * ever reads a bundled APK asset and app-private storage; nothing here
 * makes a network request, so it doesn't need to be exempted from
 * anything -- it just isn't scanned, matching pasuramOfflineService.ts's
 * and bookOfflineService.ts's own placement in services/).
 */

const VERSION_MARKER_FILENAME = ".archive-version";

/**
 * Hands control back to the JS event loop for one tick. React Native's
 * bridge/JSI dispatches touch events (including a Pressable's onPress)
 * through the SAME single JS thread this unpack loop runs on -- without
 * periodic yields, 432 synchronous File.write() calls plus a SHA-256
 * over ~29MB (see unpackArchive()) would monopolize that thread long
 * enough to make the whole app visibly unresponsive to touch for the
 * entire unpack, not just slow. Verified this was a real, not
 * theoretical, problem: a physical-device test hung on the very first
 * screen's own button during an unpack.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Files written between each yieldToEventLoop() call. */
const WRITE_BATCH_SIZE = 12;

function localPasuramDir(): Directory {
  return new Directory(Paths.document, PASURAM_DIRECTORY_NAME);
}

function versionMarkerFile(): File {
  return new File(localPasuramDir(), VERSION_MARKER_FILENAME);
}

/**
 * True once every Pasuram from the currently-bundled archive has been
 * unpacked to app-private storage and the version marker confirms
 * nothing is stale. Synchronous and local-only -- safe to call from any
 * render.
 */
function isUnpackCurrent(): boolean {
  const marker = versionMarkerFile();
  return marker.exists && marker.textSync() === PASURAM_ARCHIVE_VERSION;
}

/**
 * Decompresses the bundled archive and writes every entry to app-private
 * document storage, verifying each file's bytes against the digest
 * recorded at build time before trusting it. Throws (rather than
 * silently succeeding) if any entry fails that check or the archive is
 * missing an entry the manifest expects -- a corrupted unpack must not
 * be mistaken for a working one.
 */
async function unpackArchive(): Promise<void> {
  const asset = await Asset.fromModule(pasuramArchiveAsset).downloadAsync();
  if (!asset.localUri) {
    throw new Error("Could not resolve the bundled Pasuram archive.");
  }

  const compressed = new File(asset.localUri).bytesSync();
  const decompressed = decompress(compressed);
  const entries = parseUstar(decompressed);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  const dir = localPasuramDir();
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });

  let written = 0;
  for (const [filename, expectedHash] of Object.entries(pasuramFileHashes)) {
    const entry = byName.get(filename);
    if (!entry) {
      throw new Error(`Pasuram archive is missing an expected file: ${filename}`);
    }
    const actualHash = sha256HexBytes(entry.bytes);
    if (actualHash !== expectedHash) {
      throw new Error(`Pasuram archive entry ${filename} failed integrity verification.`);
    }
    new File(dir, filename).write(entry.bytes);

    written++;
    if (written % WRITE_BATCH_SIZE === 0) await yieldToEventLoop();
  }

  versionMarkerFile().write(PASURAM_ARCHIVE_VERSION);
}

let unpackPromise: Promise<void> | null = null;

/**
 * Ensures every bundled Pasuram is unpacked to app-private storage,
 * doing the actual decompression/extraction at most once per app
 * version (subsequent calls -- including a concurrent call already in
 * flight -- resolve immediately or await the same in-flight work,
 * rather than re-unpacking). Called once, fire-and-forget, from the
 * root layout on app start (see app/_layout.tsx) so the one-time cost
 * is almost always already paid by the time a user taps a Pasuram;
 * openOfflinePasuram() also awaits this directly as a safety net for
 * the rare case of a tap landing before that finishes.
 */
export function ensurePasuramsUnpacked(): Promise<void> {
  if (isUnpackCurrent()) return Promise.resolve();
  if (!unpackPromise) {
    unpackPromise = unpackArchive().catch((error) => {
      unpackPromise = null;
      throw error;
    });
  }
  return unpackPromise;
}

/**
 * The local file:// path a given Pasuram URL unpacks to, or null if the
 * URL isn't one the bundled archive covers. Callers must call (and
 * await) ensurePasuramsUnpacked() first -- this itself never triggers an
 * unpack, matching bookOfflineService's isBookAvailable()/
 * loadOfflineBook() split between availability and the actual local
 * path.
 */
export function localPasuramPath(url: string): string | null {
  const filename = pasuramFilenameByUrl[url];
  if (filename === undefined) return null;
  const file = new File(localPasuramDir(), filename);
  return file.exists ? file.uri : null;
}

export function isPasuramAvailable(url: string): boolean {
  return url in pasuramFilenameByUrl;
}
