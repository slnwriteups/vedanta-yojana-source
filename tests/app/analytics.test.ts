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
 * Cloudflare Web Analytics beacon in the site layout, the counting
 * Worker and the website's page-view ping.
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

  // Geography (country, approximate city and region) and colo only. If
  // any of these ever appear, the privacy claims in
  // docs/privacy-policy.html and README.md stop being true.
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

test("the website ping sends no title, query string or identifier, and only from the production host", () => {
  const source = read("components/SitePing.tsx");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // The ping's whole payload is the page's path, the visit flag and, for
  // a visit, the referring site's host name -- never the full referring
  // address. The path comes from usePathname, which has no query string,
  // so nothing typed into site search is ever sent.
  assert.ok(code.includes('const query = visit ? `v=1&s=${encodeURIComponent(sourceHost())}` : "v=0";'));
  assert.ok(code.includes("return new URL(document.referrer).hostname;"));
  assert.ok(!/sendBeacon[^;]*document\.referrer/.test(code), "the full referrer must not be sent");
  assert.ok(code.includes("const page = `&p=${encodeURIComponent(pathname)}&l=${language ?? \"en\"}`;"));
  // The saved language loads after first paint; reporting before it has
  // would record every visit's first page as English.
  assert.ok(code.includes("if (!ready || reported.current === pathname) return;"));
  for (const term of ["location.search", "location.href", "searchParams"]) {
    assert.ok(!code.includes(term), `the ping must not send ${term}`);
  }
  for (const term of ["document.title", "localStorage", "sessionStorage", "document.cookie", "indexedDB"]) {
    assert.ok(!code.includes(term), `the ping must not use ${term}`);
  }
  // Dev servers, previews and forks never report into this site's numbers.
  assert.ok(code.includes('location.hostname !== PRODUCTION_HOST'));
  // Inside AppProviders, so the language context is available to it.
  const layout = read("app/layout.tsx");
  assert.ok(layout.indexOf("<SitePing />") > layout.indexOf("<AppProviders>"));
  assert.ok(layout.indexOf("<SitePing />") < layout.indexOf("</AppProviders>"));
});

test("the ping is answered by the Worker itself and never forwarded to the origin", () => {
  const worker = read("cloudflare/request-analytics/worker.js");
  const config = read("cloudflare/request-analytics/wrangler.toml");

  assert.ok(worker.includes('const PING_PATH = "/_ping";'));
  // The ping carries ?v=, so the route must be a prefix match -- an exact
  // `/_ping` pattern lets every real ping fall through to the origin.
  assert.ok(config.includes('pattern = "vedantayojana.org/_ping*"'));
  assert.ok(worker.includes("return new Response(null, { status: 204 });"));
  // The page is stored only if it is a plain path.
  assert.ok(worker.includes("function pagePath(url)"));
  // The source is stored only if it is a plain host name.
  assert.ok(worker.includes("/^[a-z0-9.-]{1,100}$/.test(host)"));
});

test("the page beacon reports the hop it came from and how far the page was read", () => {
  const ping = read("components/SitePing.tsx");

  // `f=` is one hop, not a trail: the beacon knows the page before this
  // one and nothing before that.
  assert.ok(ping.includes("const from = first.current ? \"\" : previous.current;"));
  assert.ok(ping.includes("&f=${encodeURIComponent(from)}"));
  // The first page of a visit was reached from outside, so it has no hop.
  assert.ok(ping.includes("previous.current = pathname;"));

  // Depth is quartiles, never a scroll trail, and is flushed when the tab
  // hides -- `unload` does not fire reliably on a phone.
  assert.ok(ping.includes("Math.round(percent / 25) * 25"));
  assert.ok(ping.includes('document.addEventListener("visibilitychange", onHide)'));
  assert.ok(ping.includes('window.addEventListener("pagehide", sendDepth)'));

  // Still no identifier and nothing kept on the device.
  for (const banned of ["localStorage", "sessionStorage", "document.cookie", "crypto.randomUUID"]) {
    assert.ok(!ping.includes(banned), `SitePing must not use ${banned}`);
  }
});

test("read depth is its own row kind and can never inflate the page-view count", () => {
  const worker = read("cloudflare/request-analytics/worker.js");

  // A view is reported when a page opens, depth when it is left; one row
  // cannot carry both without either delaying the view or double-counting.
  assert.ok(worker.includes('"web-depth"'));
  assert.ok(worker.includes("doubles: [0, 0, depth]"), "a depth row is not a page view");
  // Only the values this site's own page sends are stored.
  assert.ok(worker.includes("[0, 25, 50, 75, 100].includes(raw)"));
  assert.ok(worker.includes("function fromPath(url)"));
});

test("nothing still claims the site records no path", () => {
  // The site now counts page-to-page moves, so the places that said
  // otherwise had to change in the same commit as the collection.
  for (const file of ["docs/privacy-policy.html", "README.md"]) {
    assert.ok(!read(file).includes("never one reader's path"), `${file} still claims no path is recorded`);
  }
  const policy = read("docs/privacy-policy.html");
  assert.ok(policy.includes("which page is opened next"), "the policy describes what is now collected");
  assert.ok(policy.includes("fewer than five readers"), "the policy states the disclosure floor");
});

test("the Android app reports what is read, and iOS reports nothing", () => {
  const service = read("mobile/services/readingPingService.ts");

  // Same gate as the update check: iOS is being prepared for the App
  // Store separately, so an iOS build sends nothing and its privacy
  // declaration is unaffected by any of this.
  assert.ok(service.includes('if (Platform.OS !== "android") return;'));
  // Router group segments are not content, so app and website rows line
  // up on the same route names.
  assert.ok(service.includes("!/^\\(.*\\)$/.test(segment)"));
  assert.ok(service.includes("Math.round(percent / 25) * 25"), "depth is quartiles");

  // Still no identifier and nothing kept on the device, so two openings
  // of the app cannot be joined.
  for (const banned of ["AsyncStorage", "writeJSON", "randomUUID", "getItem", "installationId"]) {
    assert.ok(!service.includes(banned), `the reading ping must not use ${banned}`);
  }
});

test("app rows are their own kind, so app and website figures are never summed", () => {
  const worker = read("cloudflare/request-analytics/worker.js");

  // A screen route and a page path are different namespaces; adding them
  // would give a number that is neither.
  assert.ok(worker.includes('isDepth ? "app-depth" : "app"'));
  assert.ok(worker.includes("doubles: isDepth ? [0, 0, depth] : [1, 0]"), "a depth row is not a view");

});

test("the app's screen reporting rides the language provider and fires once per route", () => {
  const layout = read("mobile/app/_layout.tsx");

  assert.ok(layout.includes("function ScreenReporting()"));
  assert.ok(layout.includes("reported.current === pathname"), "a language change is not another view");
  // Mounted inside LanguageProvider, so the content language travels with
  // the screen rather than defaulting.
  const tree = layout.slice(layout.indexOf("<LanguageProvider>"), layout.indexOf("</LanguageProvider>"));
  assert.ok(tree.includes("<ScreenReporting />"));

  // Depth reuses the progress the chapter screen already computes for its
  // progress bar, and reports the furthest point, not the last one.
  const chapter = read("mobile/app/(tabs)/library/[book]/[chapter].tsx");
  assert.ok(chapter.includes("deepest.current = Math.max(deepest.current, reached)"));
  assert.ok(chapter.includes("reportDepth(`/library/${bookSlug}/${chapterSlug}`, deepest.current)"));
});

test("nothing still claims the app measures nothing", () => {
  for (const file of ["docs/privacy-policy.html", "README.md"]) {
    assert.ok(!read(file).includes("measures nothing"), `${file} still claims the app measures nothing`);
  }
  const policy = read("docs/privacy-policy.html");
  assert.ok(policy.includes("What is read in the Android app"));
  assert.ok(policy.includes("The iOS app reports none of this."));
});

