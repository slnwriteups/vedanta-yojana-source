import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeSnapshot,
  snapshotFromReleases,
  utcDate,
  type DownloadHistory,
} from "../../scripts/record-apk-downloads.ts";

/**
 * Covers the three measurement mechanisms added for traffic/install
 * visibility (docs/ANALYTICS.md): the APK download snapshot series, the
 * Cloudflare Web Analytics beacon in the site layout, and the
 * country-counting Worker.
 *
 * The download-stats assertions exercise the real merge/aggregation
 * logic. The other two are structural source checks in the style of
 * tests/app/ci.test.ts -- they cannot exercise a Cloudflare runtime or a
 * real page load, but they can hold the privacy-relevant properties in
 * place, which is the part that must not regress silently.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const emptyHistory: DownloadHistory = {
  schemaVersion: 1,
  source: "https://example.invalid",
  snapshots: [],
};

test("a snapshot totals .apk downloads and excludes .sha256 checksum files", () => {
  const snapshot = snapshotFromReleases(
    [
      {
        tag_name: "android-v13",
        published_at: "2026-09-19T10:10:16Z",
        assets: [
          { name: "vedanta-yojana.apk", download_count: 5 },
          { name: "vedanta-yojana.apk.sha256", download_count: 4 },
        ],
      },
      {
        tag_name: "android-v10",
        published_at: "2026-09-15T09:29:24Z",
        assets: [{ name: "vedanta-yojana.apk", download_count: 3 }],
      },
    ],
    "2026-09-20",
  );

  assert.equal(snapshot.totalApkDownloads, 8);
  // The checksum count is still recorded per asset -- excluded from the
  // total, not discarded.
  assert.equal(snapshot.releases[0].assets[1].downloads, 4);
});

test("a snapshot survives malformed or missing API fields rather than throwing", () => {
  const snapshot = snapshotFromReleases([{}, { assets: [{}] }, null, "nonsense"], "2026-09-20");

  assert.equal(snapshot.totalApkDownloads, 0);
  assert.equal(snapshot.releases.length, 4);
  assert.equal(snapshot.releases[0].tag, "(untagged)");
  assert.equal(snapshot.releases[1].assets[0].name, "(unnamed)");
});

test("a non-array API payload yields an empty snapshot, not a crash", () => {
  const snapshot = snapshotFromReleases({ message: "Not Found" }, "2026-09-20");

  assert.equal(snapshot.totalApkDownloads, 0);
  assert.deepEqual(snapshot.releases, []);
});

test("re-recording the same date replaces that day rather than duplicating it", () => {
  const first = mergeSnapshot(emptyHistory, { date: "2026-09-20", totalApkDownloads: 8, releases: [] });
  const second = mergeSnapshot(first, { date: "2026-09-20", totalApkDownloads: 9, releases: [] });

  assert.equal(second.snapshots.length, 1);
  assert.equal(second.snapshots[0].totalApkDownloads, 9);
});

test("snapshots stay sorted by date regardless of the order recorded", () => {
  const history = [
    { date: "2026-09-22", totalApkDownloads: 12, releases: [] },
    { date: "2026-09-20", totalApkDownloads: 8, releases: [] },
    { date: "2026-09-21", totalApkDownloads: 10, releases: [] },
  ].reduce(mergeSnapshot, emptyHistory);

  assert.deepEqual(
    history.snapshots.map((snapshot) => snapshot.date),
    ["2026-09-20", "2026-09-21", "2026-09-22"],
  );
});

test("the snapshot date is UTC, not the runner's local timezone", () => {
  // 00:30 UTC on the 20th is still the 19th in every timezone west of
  // UTC -- a local-time date would record the wrong day for half the
  // world's runners.
  assert.equal(utcDate(new Date("2026-09-20T00:30:00Z")), "2026-09-20");
  assert.equal(utcDate(new Date("2026-09-20T23:30:00Z")), "2026-09-20");
});

test("the stored download series parses and is sorted", () => {
  const stored: DownloadHistory = JSON.parse(read("stats/apk-downloads.json"));
  const dates = stored.snapshots.map((snapshot) => snapshot.date);

  assert.ok(stored.snapshots.length > 0);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(new Set(dates).size, dates.length, "one snapshot per date");
});

test("the download-stats workflow skips CI on its daily commit", () => {
  const source = read(".github/workflows/apk-download-stats.yml");

  // Without this the data commit redeploys the whole site every day.
  assert.ok(source.includes("[skip ci]"));
  assert.ok(source.includes("git diff --cached --quiet"), "no empty commits");
});

test("the web analytics beacon is omitted entirely when no token is configured", () => {
  const source = read("app/layout.tsx");

  assert.ok(source.includes("NEXT_PUBLIC_CF_BEACON_TOKEN"));
  // Conditional render, not an always-present tag with a possibly-empty
  // token: a beacon that loads and then fails is worse than no beacon.
  assert.ok(source.includes("CF_WEB_ANALYTICS_TOKEN ? ("));
  // Matched as a complete, quoted src attribute rather than as a bare
  // hostname substring. A bare `includes("<host>")` is indistinguishable
  // from a URL allowlist check that an attacker-controlled host could
  // slip past -- CodeQL flags that shape (js/incomplete-url-substring-
  // sanitization), and it is right to: the weaker assertion would also
  // pass on a beacon loaded from an entirely different origin that
  // merely mentions this one.
  assert.match(source, /src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"/);
});

test("the analytics Worker records no identifier and cannot break the request it observes", () => {
  const source = read("cloudflare/request-analytics/worker.js");
  // Comments stripped first: the file's own doc comment names the
  // identifiers it does NOT collect, and a naive substring check over
  // the whole file would match that prose rather than any real code.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // Country and colo only. If any of these ever appear, the privacy
  // claims in docs/privacy-policy.html and README.md stop being true.
  for (const term of ["cf-connecting-ip", "CF-Connecting-IP", "user-agent", "User-Agent", "cookie", "Cookie"]) {
    assert.ok(!code.includes(term), `Worker must not read ${term}`);
  }
  // Header reads at all are the mechanism by which any of the above
  // would arrive, so the absence of the mechanism is what is asserted.
  assert.ok(!code.includes("headers.get"), "Worker must not read request headers");

  // The write is wrapped and the request is always passed through --
  // an analytics failure must never suppress an update prompt.
  assert.ok(source.includes("try {"));
  assert.ok(source.includes("return fetch(request);"));
});

test("the analytics Worker is scoped to the app's two manifests, not the whole site", () => {
  const worker = read("cloudflare/request-analytics/worker.js");
  const config = read("cloudflare/request-analytics/wrangler.toml");

  assert.ok(worker.includes("/app-version.json"));
  assert.ok(worker.includes("/content-manifest.json"));
  assert.ok(!config.includes("vedantayojana.org/*"), "no catch-all route over human page views");
});

test("the Worker deploy workflow is scoped to the Worker's own directory", () => {
  const source = read(".github/workflows/deploy-request-analytics.yml");

  // A deploy that fires on every push to main would redeploy the Worker
  // for unrelated content commits -- churn, and a wider blast radius
  // than the change warrants.
  assert.ok(source.includes("cloudflare/request-analytics/**"));
  assert.ok(source.includes("branches: [main]"));
  assert.ok(source.includes("workflow_dispatch"));
});

test("the Worker deploy validates before it authenticates, and skips rather than fails without a credential", () => {
  const source = read(".github/workflows/deploy-request-analytics.yml");

  // --dry-run needs no credential, so config and bundle errors surface
  // with a clear message instead of inside an authenticated deploy.
  assert.ok(source.includes("--dry-run"));
  const dryRunIdx = source.indexOf("--dry-run");
  const deployIdx = source.lastIndexOf("wrangler@4 deploy\n");
  assert.ok(dryRunIdx < deployIdx, "validation must run before the deploy");

  // An absent credential is an honest skip with a warning, not a red X
  // on every Worker change -- a permanently failing deploy is one people
  // learn to ignore.
  assert.ok(source.includes('if [ -z "$CLOUDFLARE_API_TOKEN" ]'));
  assert.ok(source.includes("::warning::"));
});

test("the Worker deploy workflow writes nothing back to the repository", () => {
  const source = read(".github/workflows/deploy-request-analytics.yml");

  assert.ok(source.includes("contents: read"));
  assert.ok(!source.includes("contents: write"));
  // The token is referenced only as a secret, never inlined.
  assert.ok(source.includes("${{ secrets.CLOUDFLARE_API_TOKEN }}"));
  assert.ok(!/CLOUDFLARE_API_TOKEN:\s*[A-Za-z0-9_-]{20,}/.test(source), "no literal token");
});
