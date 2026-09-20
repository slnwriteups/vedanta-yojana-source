import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Appends a daily snapshot of the public APK download counts to
 * stats/apk-downloads.json.
 *
 * Why a snapshot file rather than just reading the API when curious:
 * GitHub's releases API reports `download_count` as a RUNNING TOTAL
 * with no history and no time dimension at all. "How many downloads so
 * far" is answerable at any moment; "how many last week", "is it
 * accelerating", and "what did publishing v1.1 do" are not answerable
 * from it, ever, unless someone writes the number down each day. This
 * script is that someone -- see .github/workflows/apk-download-stats.yml,
 * which runs it daily.
 *
 * What this can and cannot tell you: GitHub exposes download counts
 * only, with no geography whatsoever and no distinction between a
 * download and an install. It is a count of APK fetches. Where those
 * installs are in the world is a different question, answered by a
 * different mechanism (cloudflare/request-analytics/worker.js, which
 * counts the app's own manifest fetches by country), and authoritatively
 * by the Play Console once the app is published there. See
 * docs/ANALYTICS.md for how the three sources fit together.
 *
 * The releases live in a SEPARATE public repository
 * (slnwriteups/vedanta-yojana-releases -- binary release host only, see
 * its README), which is why this reads the public API rather than
 * anything in this checkout.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = path.join(REPO_ROOT, "stats", "apk-downloads.json");
const RELEASES_API_URL = "https://api.github.com/repos/slnwriteups/vedanta-yojana-releases/releases?per_page=100";
const SCHEMA_VERSION = 1;

export interface AssetCount {
  name: string;
  downloads: number;
}

export interface ReleaseCount {
  tag: string;
  publishedAt: string | null;
  assets: AssetCount[];
}

export interface Snapshot {
  date: string;
  totalApkDownloads: number;
  releases: ReleaseCount[];
}

export interface DownloadHistory {
  schemaVersion: number;
  source: string;
  snapshots: Snapshot[];
}

/** The shape this script relies on from the GitHub releases API. */
interface ApiRelease {
  tag_name?: unknown;
  published_at?: unknown;
  assets?: unknown;
}

/**
 * Only `.apk` assets are counted toward the headline total. Every
 * release also ships an `app-release.apk.sha256` checksum file (see the
 * releases repository README and docs/APK-VERIFICATION.md), and a
 * checksum fetched by someone verifying a download is not a second
 * download of the app. Both counts are still recorded per asset --
 * nothing is discarded, only the total is defined precisely.
 */
function isApkAsset(name: string): boolean {
  return name.toLowerCase().endsWith(".apk");
}

/**
 * Pure: turns an API payload into the snapshot recorded for `date`.
 * Tolerates unexpected/missing fields rather than throwing -- a
 * malformed entry must not cost the day's data for every other release.
 */
export function snapshotFromReleases(releases: unknown, date: string): Snapshot {
  const list = Array.isArray(releases) ? (releases as ApiRelease[]) : [];

  const recorded: ReleaseCount[] = list.map((entry) => {
    // `?? {}` rather than a type assertion alone: a null element in the
    // array is a real possibility from malformed JSON, and reading
    // `.assets` off it would throw and cost the whole day's snapshot.
    const release = (entry ?? {}) as ApiRelease;
    const rawAssets = Array.isArray(release.assets) ? release.assets : [];
    const assets: AssetCount[] = rawAssets.map((asset) => {
      const fields = (asset ?? {}) as Record<string, unknown>;
      return {
        name: typeof fields.name === "string" ? fields.name : "(unnamed)",
        downloads: typeof fields.download_count === "number" ? fields.download_count : 0,
      };
    });
    return {
      tag: typeof release.tag_name === "string" ? release.tag_name : "(untagged)",
      publishedAt: typeof release.published_at === "string" ? release.published_at : null,
      assets,
    };
  });

  const totalApkDownloads = recorded.reduce(
    (runningTotal, release) =>
      runningTotal +
      release.assets.reduce((assetTotal, asset) => (isApkAsset(asset.name) ? assetTotal + asset.downloads : assetTotal), 0),
    0,
  );

  return { date, totalApkDownloads, releases: recorded };
}

/**
 * Pure: merges one snapshot into the stored history, replacing any
 * existing entry for the same date rather than appending a duplicate.
 * Re-running on the same day (a retry, a manual `workflow_dispatch`)
 * must be idempotent -- two rows for one date would silently corrupt
 * every rate computed from the series afterwards.
 */
export function mergeSnapshot(history: DownloadHistory, snapshot: Snapshot): DownloadHistory {
  const withoutSameDate = history.snapshots.filter((existing) => existing.date !== snapshot.date);
  const snapshots = [...withoutSameDate, snapshot].sort((a, b) => a.date.localeCompare(b.date));
  return { ...history, snapshots };
}

/** UTC, so the series never gains or loses a day to a runner's timezone. */
export function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function readHistory(): DownloadHistory {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return { schemaVersion: SCHEMA_VERSION, source: RELEASES_API_URL, snapshots: [] };
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  const candidate = (parsed ?? {}) as Partial<DownloadHistory>;
  return {
    schemaVersion: SCHEMA_VERSION,
    source: RELEASES_API_URL,
    snapshots: Array.isArray(candidate.snapshots) ? candidate.snapshots : [],
  };
}

async function main(): Promise<void> {
  // The releases repository is public, so this works unauthenticated
  // (60 requests/hour/IP -- ample for one daily call). A token is used
  // when one is present purely for the higher rate limit, and would
  // become required if that repository were ever made private.
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "vedanta-yojana-download-stats",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub releases API returned ${response.status} ${response.statusText}`);
  }

  const snapshot = snapshotFromReleases(await response.json(), utcDate(new Date()));
  const merged = mergeSnapshot(readHistory(), snapshot);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log(`Recorded ${snapshot.date}: ${snapshot.totalApkDownloads} APK downloads across ${snapshot.releases.length} release(s).`);
}

// Only run when executed directly -- the exported functions above are
// imported by tests/app/analytics.test.ts, which must not perform a
// network request.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
