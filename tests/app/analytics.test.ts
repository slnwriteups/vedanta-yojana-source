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
 * Worker and the website's page-view ping, and the private dashboard.
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

test("the analytics dashboard is password-protected and keeps its credentials out of the repository", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");
  const config = read("cloudflare/analytics-dashboard/wrangler.toml");

  // Every request is checked before routing, and an unset password
  // refuses everything rather than serving an open dashboard.
  const authIdx = worker.indexOf("if (!(await authorized(request, env)))");
  assert.ok(authIdx > 0 && authIdx < worker.indexOf('url.pathname === "/data"'));
  assert.ok(worker.includes("if (!expected) return false;"));
  assert.ok(worker.includes("timingSafeEqual"));

  // Secrets live in Cloudflare, never in wrangler.toml.
  assert.ok(!/^\s*\[vars\]/m.test(config), "no plain-text vars block");
  assert.ok(!/^\s*(DASHBOARD_PASSWORD|CF_API_TOKEN|CF_ACCOUNT_ID)\s*=/m.test(config));
  // Read-only: it queries the dataset and cannot write to it.
  assert.ok(!config.includes("analytics_engine_datasets"));
  assert.ok(!worker.includes("writeDataPoint"));
});

test("the dashboard reads download history from the committed snapshot file, without a credential", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  // The same file the daily snapshot workflow writes; GitHub itself keeps
  // no download history to read instead.
  assert.ok(worker.includes("/main/stats/apk-downloads.json"));
  const fn = worker.slice(worker.indexOf("async function loadDownloads()"), worker.indexOf("async function query("));
  assert.ok(!fn.includes("Authorization"), "the public file is fetched without any token");
  // A download-history failure blanks one chart, never the whole dashboard.
  assert.ok(fn.includes("return null;"));
});

test("the dashboard offers a 24-hour view bucketed by hour", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  assert.ok(worker.includes("const RANGES = new Set([1, 7, 30, 90]);"));
  assert.ok(worker.includes(`"timestamp > NOW() - INTERVAL '24' HOUR"`));
  assert.ok(worker.includes(`hourly ? "INTERVAL '1' HOUR" : "INTERVAL '1' DAY"`));
  assert.ok(worker.includes('<button data-days="1">24 hours</button>'));
});

test("the dashboard lists top pages from the stored path, excluding views recorded before paths were", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  assert.ok(worker.includes("blob7 AS page"));
  assert.ok(worker.includes("AND blob7 != ''"));
  assert.ok(worker.includes('id="pages"'));
});

test("the dashboard lists languages from the stored code, and the Worker keeps only plain codes", () => {
  const dashboard = read("cloudflare/analytics-dashboard/worker.js");
  const worker = read("cloudflare/request-analytics/worker.js");

  assert.ok(dashboard.includes("SELECT blob8 AS language"));
  assert.ok(dashboard.includes("AND blob8 != ''"));
  assert.ok(worker.includes("/^[a-z]{2,3}$/.test(code)"));
});

test("each section carries one short line of context, in plain wording", () => {
  const page = read("cloudflare/analytics-dashboard/worker.js");
  const body = page.slice(page.indexOf("export const PAGE"));

  const headings = (body.match(/<h2[^>]*>/g) ?? []).length;
  const subs = (body.match(/<p class="sub"/g) ?? []).length;
  assert.ok(headings >= 9, `expected a heading per section, saw ${headings}`);
  assert.ok(subs >= headings - 1, "each section keeps one line of context");

  // The two-line "What this counts / How to read it" scaffold was removed
  // deliberately: it read as generated boilerplate rather than as something
  // a person wrote. One short line per section is the replacement, not none.
  assert.ok(!body.includes("What this counts"));
  assert.ok(!body.includes("How to read it"));
});

test("the charts are bars, one measure each, with their labels outside the stretched SVG", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  // Discrete per-day counts: a line drawn between them implies values on
  // the way that do not exist.
  assert.ok(!worker.includes("lineChart"), "no line chart survives");
  assert.ok(worker.includes("function barChart(host, rows, key)"));
  const calls = [...worker.matchAll(/barChart\(.*?\);/g)].map((m) => m[0]);
  assert.equal(calls.length, 5, "one call per chart");
  for (const call of calls) {
    assert.ok(/, "(visits|views|launches|downloads|screens)"\);$/.test(call), `one measure per chart: ${call}`);
  }

  // Text inside a preserveAspectRatio="none" plot distorts and shrinks to
  // about 5px at phone width, which is where this page is mostly read.
  const fn = worker.slice(worker.indexOf("function barChart"), worker.indexOf('document.querySelectorAll(".range button")'));
  assert.ok(!fn.includes('createElementNS(NS, "text")'), "no text inside the stretched SVG");
  assert.ok(fn.includes("non-scaling-stroke"));
  assert.ok(fn.includes('class: "ylab"') && fn.includes('class: "xaxis"'));
});

test("the measure colours survive every pair, under colour blindness too", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  // All four measures are on screen at once, so the standard is every pair,
  // not just neighbours. Three hue families clear it in both modes (worst
  // CVD dE 9.2 light / 9.4 dark); a fourth hue cannot -- yellow against
  // orange is dE 4.8 under deuteranopia on dark, violet against blue 1.9
  // under protanopia. The fourth measure therefore takes a second shade of
  // the app's own aqua rather than a fourth hue.
  for (const hex of ["#2a78d6", "#eb6834", "#1baf7a", "#0e7a55"]) {
    assert.ok(worker.includes(hex), `missing light hue ${hex}`);
  }
  for (const hex of ["#3987e5", "#d95926", "#199e70", "#46c79a"]) {
    assert.ok(worker.includes(hex), `missing dark hue ${hex}`);
  }
  // The hues that failed the all-pairs test must not come back.
  for (const banned of ["#eda100", "#c98500", "#4a3aa7", "#9085e9"]) {
    assert.ok(!worker.includes(banned), `${banned} fails all-pairs CVD separation`);
  }

  // The hue travels in its own property, not currentColor: sharing the text
  // channel means fixing text to an ink token silently greys out every mark
  // that inherited it.
  assert.ok(worker.includes("fill: var(--measure, var(--accent))"));
  assert.ok(worker.includes("background: var(--measure, var(--accent))"));
  assert.ok(!worker.includes("currentColor"), "no mark reads the text colour");

  // Colour sits on marks and surfaces, never on words: aqua is 2.74:1 on
  // the light surface, which as text is unreadable.
  assert.ok(worker.includes("color: var(--text)"));
  assert.ok(worker.includes("td { padding: 7px 4px; border-bottom: 1px solid var(--grid); color: var(--text); }"));
  assert.ok(worker.includes(".barcell div, .pagecell a { color: var(--text); }"));
  assert.ok(worker.includes(".tile { border: 1px solid var(--border); border-left: 3px solid var(--measure, var(--border)); }"));
  assert.ok(!worker.includes("color-mix"), "no tinted surface behind the figures");

  assert.ok(worker.includes("@media (prefers-color-scheme: dark)"));
  assert.ok(worker.includes(':root:not([data-theme="light"])'));
  assert.ok(worker.includes(':root[data-theme="dark"]'));
});

test("the dashboard page is exported so it can be previewed without deploying", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");
  assert.ok(worker.includes("export const PAGE"));
  // The preview serves the same /data contract the Worker does.
  const preview = read("scripts/preview-dashboard.ts");
  assert.ok(preview.includes('from "../cloudflare/analytics-dashboard/worker.js"'));
  assert.ok(preview.includes('url.pathname === "/data"'));
});

test("the preview shows the real data or an honest error, and never invents figures", () => {
  const preview = read("scripts/preview-dashboard.ts");

  // It calls the Worker's own loader rather than reimplementing the
  // queries, so it cannot show anything the deployed dashboard would not.
  assert.ok(preview.includes("loadData(env, days)"));
  assert.ok(read("cloudflare/analytics-dashboard/worker.js").includes("export async function loadData"));

  // Without credentials loadData returns { error }, which the page renders.
  // Nothing here substitutes plausible-looking numbers for missing ones: a
  // screenshot of the preview is a screenshot of the real thing or of an
  // honest error, never of fiction.
  assert.ok(!/Math\.(random|sin)/.test(preview), "no generated series");
  assert.ok(!/\bhits:\s*\d/.test(preview) && !/\bvisits:\s*\d/.test(preview), "no hand-written rows");
  assert.ok(!/\bfixture/i.test(preview), "no fixture data path");
});

test("the page carries its own provenance and can be forced to a theme", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  // A screenshot of this ends up in a slide. The window it covers, the
  // moment it was taken, and the fact that the counts are sampled estimates
  // rather than exact tallies all have to travel with the image.
  assert.ok(worker.includes('<p class="provenance" id="provenance"></p>'));
  assert.ok(worker.includes('" \\u00b7 as of "'));
  assert.ok(worker.includes("counts estimated from Cloudflare's sampling"));

  // Projectors crush dark backgrounds, so the theme cannot be left to the
  // room's laptop. Auto / light / dark, remembered, with the storage access
  // guarded -- it throws in a private window.
  assert.ok(worker.includes('var THEMES = ["auto", "light", "dark"];'));
  assert.ok(worker.includes('document.documentElement.setAttribute("data-theme", value)'));
  const themeFns = worker.slice(worker.indexOf("function readTheme()"), worker.indexOf("applyTheme(readTheme());"));
  assert.equal((themeFns.match(/catch \(e\)/g) ?? []).length, 2, "every storage access is guarded");
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

test("a page pair is only shown once five readers have made the same move", () => {
  const dashboard = read("cloudflare/analytics-dashboard/worker.js");

  // The floor is applied in SQL, so a rare route never reaches the page
  // at all rather than being filtered after it arrives.
  assert.ok(dashboard.includes("HAVING moves >= 5"));
  assert.ok(dashboard.includes("HAVING readers >= 5"));
  assert.ok(dashboard.includes("blob2 IN ('web-depth', 'app-depth')"));
});

test("nothing still claims the site records no path", () => {
  // The site now counts page-to-page moves, so the three places that said
  // otherwise had to change in the same commit as the collection.
  for (const file of ["cloudflare/analytics-dashboard/worker.js", "docs/privacy-policy.html", "README.md"]) {
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

  const dashboard = read("cloudflare/analytics-dashboard/worker.js");
  // The dashboard keeps them apart behind one switch for all three
  // content cards, so the three always describe the same surface.
  assert.ok(dashboard.includes("blob2 IN ('web', 'app')"));
  assert.ok(dashboard.includes("blob2 IN ('web-depth', 'app-depth')"));
  assert.ok(dashboard.includes("function applySurface()"));
  assert.ok(dashboard.includes('state.surface + (depth ? "-depth" : "")'));
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

test("the website/app switch governs the whole page, not one section", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  // A visit and an app launch are different things. A page showing some
  // cards from one surface and some from the other invites exactly the
  // comparison that is not valid, so the switch is page-wide.
  assert.ok(worker.includes('<div class="range" role="group" aria-label="Surface" id="surface-switch">'));
  assert.ok(worker.includes("function applySurface()"));
  assert.ok(worker.includes('node.hidden = node.getAttribute("data-surface") !== state.surface'));

  // Cards and tiles that belong to one surface say so.
  assert.ok(worker.includes('<div class="card" data-surface="web">'));
  assert.ok(worker.includes('<div class="card" data-surface="app">'));
  assert.ok(worker.includes('<div class="tile" data-surface="app"'));

  // The surface switch shares .range's styling, so an unscoped
  // `.range button` selector would claim its buttons and overwrite their
  // handler -- the switch would then set days to NaN. Both handlers
  // select on the attribute they act on.
  assert.ok(worker.includes('.range button[data-days]'));
  assert.ok(!/querySelectorAll\("\.range button"\)/.test(worker));
});

test("each surface offers only measures that exist on it", () => {
  const worker = read("cloudflare/analytics-dashboard/worker.js");

  // A referring site exists only on the web; a screen view only in the app.
  assert.ok(worker.includes('web: [["visits", "Visits"], ["views", "Page views"]]'));
  assert.ok(worker.includes('app: [["launches", "App launches"], ["screens", "Screens opened"]]'));
  assert.ok(worker.includes('if (kind === "app") return "screens";'));
  // A sort chosen on one surface may not exist on the other.
  assert.ok(worker.includes("if (allowed.indexOf(state.sort[id]) === -1) state.sort[id] = allowed[0];"));

  // Wording and columns follow the surface rather than naming the website
  // while showing the app.
  assert.ok(worker.includes('app ? "Top screens" : "Top pages"'));
  assert.ok(worker.includes('app ? "How far chapters are read" : "How far pages are read"'));
  assert.ok(worker.includes('if (!app) head.appendChild(el("th", { class: "n" }, "Visits began here"));'),
    "a visit cannot begin on an app screen");
});
