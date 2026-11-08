import { Directory, File, Paths } from "expo-file-system";
import { AppState, type AppStateStatus } from "react-native";
import { pasuramFilenameByUrl } from "../content-lib/pasuram-manifest.generated.ts";
import { pasuramOriginLengthByUrl } from "../content-lib/pasuram-origin.generated.ts";
import { mapWithConcurrency } from "./concurrencyPool.ts";
import {
  conditionalHeaders,
  isSweepDue,
  looksLikeCompletePdf,
  OFFLINE_RETRY_MS,
  parseLatestIndex,
  remoteDiffers,
  remoteInfoFromHeaders,
  shouldCheckOnOpen,
  type LatestEntry,
  type LatestIndex,
} from "./pasuramLatestCore.ts";

/**
 * Keeps Pasuram PDFs current with Prapatti.com, where scholars publish
 * corrections over time, while every Pasuram still opens offline. See
 * pasuramLatestCore.ts for the full design; this file is the part that
 * touches the network and app-private storage (like the other network
 * adapters, it lives in services/, which tests/offline.test.ts does not
 * scan).
 *
 * Downloaded copies live in their own directory, separate from the
 * bundled archive's unpack directory, so an app update that re-unpacks
 * the archive never discards a newer copy the reader already has.
 */

const LATEST_DIRECTORY_NAME = "pasurams-latest";
const INDEX_FILENAME = "index.json";
/** How long a tap waits for Prapatti.com before opening the local copy instead. */
const OPEN_FETCH_TIMEOUT_MS = 5000;
const SWEEP_TIMEOUT_MS = 10000;
/** Kept low on purpose: Prapatti.com is a volunteer-run site. */
const SWEEP_CONCURRENCY = 2;

function latestDir(): Directory {
  return new Directory(Paths.document, LATEST_DIRECTORY_NAME);
}

function indexFile(): File {
  return new File(latestDir(), INDEX_FILENAME);
}

function readIndex(): LatestIndex {
  try {
    const file = indexFile();
    return parseLatestIndex(file.exists ? file.textSync() : null);
  } catch {
    return parseLatestIndex(null);
  }
}

function writeIndex(index: LatestIndex): void {
  const dir = latestDir();
  dir.create({ intermediates: true, idempotent: true });
  const tmp = new File(dir, `${INDEX_FILENAME}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.write(JSON.stringify(index));
  const target = indexFile();
  if (target.exists) target.delete();
  tmp.move(target);
}

/** Serializes index updates so concurrent opens and the background check never overwrite each other. */
let indexQueue: Promise<unknown> = Promise.resolve();
function updateIndex(mutate: (index: LatestIndex) => void): Promise<void> {
  const next = indexQueue.then(() => {
    const index = readIndex();
    mutate(index);
    writeIndex(index);
  });
  indexQueue = next.catch(() => {});
  return next;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** Saves verified PDF bytes atomically, so a failure part-way never leaves a broken file in place of a good one. */
function saveBytes(filename: string, bytes: Uint8Array): void {
  const dir = latestDir();
  dir.create({ intermediates: true, idempotent: true });
  const tmp = new File(dir, `${filename}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.write(bytes);
  const target = new File(dir, filename);
  if (target.exists) target.delete();
  tmp.move(target);
}

/**
 * Asks Prapatti.com for the current version of one Pasuram and stores it
 * if it changed. Never throws: offline, slow, an error page, or anything
 * unexpected simply leaves the existing local copy in place.
 */
async function refreshPasuram(url: string, timeoutMs: number): Promise<void> {
  const filename = pasuramFilenameByUrl[url];
  if (!filename) return;
  const existing = readIndex().entries[url];
  const hasLocalLatest = existing ? new File(latestDir(), existing.filename).exists : false;

  try {
    const response = await fetchWithTimeout(
      url,
      { headers: hasLocalLatest ? conditionalHeaders(existing) : {} },
      timeoutMs
    );
    const now = Date.now();

    if (response.status === 304 && existing && hasLocalLatest) {
      await updateIndex((index) => {
        const entry = index.entries[url];
        if (entry) entry.checkedAt = now;
      });
      return;
    }
    if (!response.ok) return;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!looksLikeCompletePdf(bytes)) return;

    saveBytes(filename, bytes);
    const info = remoteInfoFromHeaders((name) => response.headers.get(name));
    const entry: LatestEntry = {
      filename,
      etag: info.etag,
      lastModified: info.lastModified,
      length: bytes.length,
      fetchedAt: now,
      checkedAt: now,
    };
    await updateIndex((index) => {
      index.entries[url] = entry;
    });
  } catch {
    // Offline, timed out, or storage failed: the local copy still opens.
  }
}

/**
 * The newest local copy of a Pasuram downloaded from Prapatti.com, or
 * null if none has been downloaded yet (the caller then opens the
 * bundled copy).
 */
export function latestLocalPasuramPath(url: string): string | null {
  const entry = readIndex().entries[url];
  if (!entry) return null;
  const file = new File(latestDir(), entry.filename);
  return file.exists ? file.uri : null;
}

/**
 * Called when the reader taps a Pasuram: if online and not checked in the
 * last hour, fetches the current version from Prapatti.com first (waiting
 * at most a few seconds), so the reader sees any corrections. Resolves
 * either way; the caller then opens latestLocalPasuramPath() or the
 * bundled copy.
 */
export async function refreshBeforeOpen(url: string): Promise<void> {
  if (!shouldCheckOnOpen(readIndex().entries[url], Date.now())) return;
  await refreshPasuram(url, OPEN_FETCH_TIMEOUT_MS);
}

let sweepRunning = false;

type SweepOutcome = "done" | "not-due" | "unreachable" | "busy";

/**
 * Checks for corrected PDFs: sends a cheap HEAD request for each Pasuram
 * and downloads only the ones whose file on Prapatti.com differs from the
 * copy the app would open. Keeps readers current for Pasurams they
 * haven't opened yet, so the corrected text is there offline later. At
 * most once a day once it succeeds; never throws.
 */
async function sweepForCorrections(): Promise<SweepOutcome> {
  if (sweepRunning) return "busy";
  if (!isSweepDue(readIndex(), Date.now())) return "not-due";
  sweepRunning = true;

  try {
    const urls = Object.keys(pasuramFilenameByUrl);
    let reachable = 0;

    await mapWithConcurrency(urls, SWEEP_CONCURRENCY, async (url, i) => {
      // Offline: after the first few files fail, don't keep hammering timeouts.
      if (reachable === 0 && i >= SWEEP_CONCURRENCY * 2) return;
      try {
        const response = await fetchWithTimeout(
          url,
          { method: "HEAD", headers: { "Accept-Encoding": "identity" } },
          SWEEP_TIMEOUT_MS
        );
        // Any HTTP answer, even a 404 for one file, means we're online.
        reachable++;
        if (!response.ok) return;
        const remote = remoteInfoFromHeaders((name) => response.headers.get(name));
        const entry = readIndex().entries[url];
        const entryUsable = entry ? new File(latestDir(), entry.filename).exists : false;
        if (remoteDiffers(remote, entryUsable ? entry : undefined, pasuramOriginLengthByUrl[url])) {
          await refreshPasuram(url, SWEEP_TIMEOUT_MS);
        }
      } catch {
        // One unreachable file shouldn't stop the rest.
      }
    });

    if (reachable === 0) return "unreachable";
    await updateIndex((index) => {
      index.lastSweepAt = Date.now();
    });
    return "done";
  } finally {
    sweepRunning = false;
  }
}

/**
 * Runs the correction check whenever the app comes online: once now (at
 * launch), again each time the app returns to the foreground, and, while
 * the app is open but Prapatti.com can't be reached, every couple of
 * minutes until it can -- so the check happens soon after the connection
 * comes back. Uses only what React Native already provides (no new
 * native module), so it can ship as an over-the-air update.
 *
 * Returns a cleanup function. Call once from the root layout.
 */
export function startCorrectionChecks(): () => void {
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const run = async () => {
    if (stopped) return;
    clearRetry();
    const outcome = await sweepForCorrections().catch((): SweepOutcome => "unreachable");
    if (!stopped && outcome === "unreachable" && AppState.currentState === "active") {
      retryTimer = setTimeout(run, OFFLINE_RETRY_MS);
    }
  };

  const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") void run();
    else clearRetry();
  });
  void run();

  return () => {
    stopped = true;
    clearRetry();
    subscription.remove();
  };
}
