import { Asset } from "expo-asset";
import { Directory, File, Paths } from "expo-file-system";
import { Decompress } from "fzstd";
import { PASURAM_ARCHIVE_VERSION, pasuramFileHashes, pasuramFilenameByUrl } from "../content-lib/pasuram-manifest.generated.ts";
import { pasuramArchiveAsset } from "../content-lib/pasuram-archive-asset.generated.ts";
import { PASURAM_DIRECTORY_NAME, sha256HexBytes } from "./pasuramResourceId.ts";
import { UstarStream } from "./pasuramTar.ts";

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
 * periodic yields, the unpack (see unpackArchive()) would monopolize that thread long
 * enough to make the whole app visibly unresponsive to touch for the
 * entire unpack, not just slow. Verified this was a real, not
 * theoretical, problem: a physical-device test hung on the very first
 * screen's own button during an unpack.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The unpack runs in slices: it feeds the decompressor PUSH_BYTES of the
 * archive at a time and hands the JS thread back once a slice has run for
 * SLICE_MS. Yielding every 12 files was not enough on budget Android
 * phones: the archive was decompressed in one synchronous call (20 MB into
 * 40 MB) and every file was hashed in pure JS, which froze the very first
 * screens for a minute or more (no JIT in Hermes; ~23 s even on a server
 * CPU with V8's JIT off).
 */
const PUSH_BYTES = 32 * 1024;
const SLICE_MS = 12;

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
 * Streams the bundled archive into app-private document storage, one
 * slice at a time (see SLICE_MS), and writes the version marker only once
 * every file the manifest expects has been written. Files are not hashed
 * here: the build already checks every archived file against its recorded
 * SHA-256 (tests/pasuram-archive.test.ts), and localPasuramPath() checks
 * each one again on the phone when it is opened.
 */
async function unpackArchive(): Promise<void> {
  const asset = await Asset.fromModule(pasuramArchiveAsset).downloadAsync();
  if (!asset.localUri) {
    throw new Error("Could not resolve the bundled Pasuram archive.");
  }
  const compressed = new File(asset.localUri).bytesSync();

  const dir = localPasuramDir();
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });

  const missing = new Set(Object.keys(pasuramFileHashes));
  const tar = new UstarStream();
  const zstd = new Decompress((chunk) => {
    for (const entry of tar.push(chunk)) {
      if (missing.delete(entry.name)) new File(dir, entry.name).write(entry.bytes);
    }
  });

  let sliceStart = Date.now();
  for (let offset = 0; offset < compressed.length; offset += PUSH_BYTES) {
    const end = offset + PUSH_BYTES;
    zstd.push(compressed.subarray(offset, end), end >= compressed.length);
    if (Date.now() - sliceStart >= SLICE_MS) {
      await yieldToEventLoop();
      sliceStart = Date.now();
    }
  }

  if (missing.size > 0) {
    throw new Error(`Pasuram archive is missing ${missing.size} expected file(s).`);
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
  if (!file.exists) return null;
  // One file (tens of KB) is hashed here, when it is opened, instead of
  // all of them during the unpack. A copy damaged on the phone is removed
  // with the version marker, so the next ensurePasuramsUnpacked() unpacks
  // the archive again.
  if (sha256HexBytes(file.bytesSync()) !== pasuramFileHashes[filename]) {
    file.delete();
    const marker = versionMarkerFile();
    if (marker.exists) marker.delete();
    unpackPromise = null;
    return null;
  }
  return file.uri;
}

export function isPasuramAvailable(url: string): boolean {
  return url in pasuramFilenameByUrl;
}
