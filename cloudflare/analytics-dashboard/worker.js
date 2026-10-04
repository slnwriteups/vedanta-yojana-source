/**
 * Cloudflare Worker: a private dashboard over the counts that
 * cloudflare/request-analytics/ writes to Workers Analytics Engine --
 * website views and visits per day, app launches per day, and where they
 * come from by country and approximate city.
 *
 * Why a separate Worker rather than a route on request-analytics: that
 * Worker sits in front of the app's update check and is deliberately
 * kept too simple to fail (it reads no request headers at all, a
 * property tests/app/analytics.test.ts holds in place). A dashboard has
 * to read the Authorization header and call an authenticated API, so it
 * lives here, on its own workers.dev address, where nothing it does can
 * touch the site or the app.
 *
 * Access: HTTP Basic auth against the DASHBOARD_PASSWORD secret (any
 * user name). Every response, the page and its data alike, is behind
 * it, and with the secret unset every request is refused.
 *
 * Reading: the Analytics Engine SQL API, with CF_ACCOUNT_ID and a
 * CF_API_TOKEN that holds Account Analytics: Read and nothing else. The
 * token never reaches the browser -- the page asks this Worker for
 * already-aggregated rows.
 */

const DATASET = "vedanta_yojana_requests";

/**
 * The daily APK download snapshots scripts/record-apk-downloads.ts
 * commits (GitHub only reports a running total, so this file is the only
 * download history there is). The repository is public, so this needs
 * no credential; a failure here blanks the downloads chart and nothing
 * else.
 */
const DOWNLOADS_URL =
  "https://raw.githubusercontent.com/slnwriteups/vedanta-yojana-source/main/stats/apk-downloads.json";
// In days. 1 is the "24 hours" view, which is bucketed by hour rather
// than by day.
const RANGES = new Set([1, 7, 30, 90]);

export default {
  async fetch(request, env) {
    if (!(await authorized(request, env))) {
      return new Response("Password required.", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Vedanta Yojana analytics", charset="UTF-8"',
          "Cache-Control": "no-store",
        },
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/data") {
      const days = Number(url.searchParams.get("days"));
      return json(await loadData(env, RANGES.has(days) ? days : 30));
    }
    if (url.pathname === "/") {
      return new Response(PAGE, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          "Content-Security-Policy":
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'",
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};

async function authorized(request, env) {
  const expected = env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let supplied;
  try {
    const decoded = atob(header.slice(6));
    supplied = decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return false;
  }
  // Compared as fixed-length digests in constant time, so neither the
  // length nor the content of the password leaks through timing.
  const [a, b] = await Promise.all([digest(supplied), digest(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

async function digest(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
}

export async function loadData(env, days) {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    return { error: "The dashboard is not connected yet: set the CF_ACCOUNT_ID and CF_API_TOKEN secrets on this Worker in Cloudflare (Settings -> Variables and Secrets)." };
  }
  // `days` is one of RANGES, never raw input, so interpolating it is safe.
  const hourly = days === 1;
  const since = hourly ? "timestamp > NOW() - INTERVAL '24' HOUR" : `timestamp > NOW() - INTERVAL '${days}' DAY`;
  const bucket = hourly ? "INTERVAL '1' HOUR" : "INTERVAL '1' DAY";
  try {
    const [daily, places, sources, pages, languages, nextPages, depths, downloads] = await Promise.all([
      query(
        env,
        `SELECT toStartOfInterval(timestamp, ${bucket}) AS day, blob2 AS kind,
                SUM(_sample_interval) AS hits, SUM(_sample_interval * double2) AS visits
         FROM ${DATASET} WHERE ${since}
         GROUP BY day, kind ORDER BY day`,
      ),
      query(
        env,
        `SELECT blob1 AS country, blob4 AS city, blob5 AS region, blob2 AS kind,
                SUM(_sample_interval) AS hits, SUM(_sample_interval * double2) AS visits
         FROM ${DATASET} WHERE ${since}
         GROUP BY country, city, region, kind ORDER BY hits DESC LIMIT 5000`,
      ),
      // Visits by the site they came from. Blank blob6 is a visit recorded
      // before sources were, and is left out rather than shown as direct.
      query(
        env,
        `SELECT blob6 AS source, SUM(_sample_interval * double2) AS visits
         FROM ${DATASET} WHERE ${since} AND blob2 = 'web' AND double2 = 1 AND blob6 != ''
         GROUP BY source ORDER BY visits DESC LIMIT 500`,
      ),
      // Views per page, and how many visits began on each. Blank blob7 is
      // a view recorded before pages were, and is left out.
      query(
        env,
        `SELECT blob2 AS surface, blob7 AS page, SUM(_sample_interval) AS views, SUM(_sample_interval * double2) AS entries
         FROM ${DATASET} WHERE ${since} AND blob2 IN ('web', 'app') AND blob7 != ''
         GROUP BY surface, page ORDER BY views DESC LIMIT 200`,
      ),
      // Views by the language the site was read in. Blank blob8 is a view
      // recorded before languages were, and is left out.
      query(
        env,
        `SELECT blob8 AS language, SUM(_sample_interval) AS views
         FROM ${DATASET} WHERE ${since} AND blob2 = 'web' AND blob8 != ''
         GROUP BY language ORDER BY views DESC LIMIT 50`,
      ),
      // What readers open next. HAVING is the disclosure control, not a
      // tidy-up: at this traffic a rare pair can be close to unique, so a
      // pair seen fewer than five times is dropped in the query and never
      // reaches the page.
      query(
        env,
        `SELECT blob2 AS surface, blob9 AS src, blob7 AS dst, SUM(_sample_interval) AS moves
         FROM ${DATASET} WHERE ${since} AND blob2 IN ('web', 'app') AND blob9 != '' AND blob7 != ''
         GROUP BY surface, src, dst HAVING moves >= 5 ORDER BY moves DESC LIMIT 200`,
      ),
      // How far pages are actually read. Depth rows are written when a
      // page is left, so they are their own kind and never counted as
      // views; the same five-reader floor applies.
      query(
        env,
        `SELECT blob2 AS surface, blob7 AS page, SUM(_sample_interval) AS readers,
                SUM(_sample_interval * double3) / SUM(_sample_interval) AS depth
         FROM ${DATASET} WHERE ${since} AND blob2 IN ('web-depth', 'app-depth') AND blob7 != ''
         GROUP BY surface, page HAVING readers >= 5 ORDER BY readers DESC LIMIT 100`,
      ),
      loadDownloads(),
    ]);
    return { days, hourly, daily, places, sources, pages, languages, nextPages, depths, downloads };
  } catch (error) {
    return { error: `Cloudflare returned an error: ${error.message}` };
  }
}

/** [{ date: "YYYY-MM-DD", total }] ascending, or null if unavailable. */
async function loadDownloads() {
  try {
    const response = await fetch(DOWNLOADS_URL, { cf: { cacheTtl: 900, cacheEverything: true } });
    if (!response.ok) return null;
    const history = await response.json();
    return (history.snapshots ?? [])
      .map((snapshot) => ({ date: String(snapshot.date), total: Number(snapshot.totalApkDownloads) || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

async function query(env, sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      body: `${sql} FORMAT JSON`,
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 300)}`);
  return JSON.parse(text).data ?? [];
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// The page is self-contained -- no external script, font or stylesheet
// -- so the Content-Security-Policy above can forbid every other origin.
// Its script avoids backticks so it can live inside this template.
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Vedanta Yojana Analytics</title>
<style>
/* One colour per measure, held across the whole page: website visits blue,
   page views orange, and the two app measures as two shades of aqua -- in
   the chart, the tile and the bar behind each table row. Colour follows the
   measure, never its rank, so nothing is repainted when a sort changes.

   THREE hue families, not four, and that is a measured constraint rather
   than a preference. All four measures are on screen at once, so the honest
   test is every pair, not just neighbours. Under that test a fourth hue has
   nowhere to go: yellow against orange scores dE 4.8 under deuteranopia on
   the dark surface (floor 8) and 13.7 unsimulated on light (floor 15);
   violet against blue scores 1.9 under protanopia. Both are the same colour
   to a colourblind reader. Blue/orange/aqua clears every pair in both modes
   -- worst CVD dE 9.2 light / 9.4 dark, worst unsimulated 24.0 / 20.9 -- so
   the fourth measure takes a second shade of aqua instead of a fourth hue.
   The two app measures share a family because they are the same subject,
   and they never share a plot, so the shade is never load-bearing.

   On the light surface aqua is 2.74:1, under 3:1, which is legal only with
   visible relief: every chart carries a peak label and every table its
   numbers. No text anywhere wears a measure colour. */
:root {
  color-scheme: light;
  --bg: #f6f5f1; --surface: #fcfcfb; --border: #e4e2dc; --grid: #ecebe6;
  --text: #0b0b0b; --text-2: #52514e; --muted: #7a7873;
  --accent: #2a78d6;
  --m-visits: #2a78d6; --m-views: #eb6834; --m-launches: #1baf7a; --m-downloads: #0e7a55;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #111110; --surface: #1a1a19; --border: #2f2f2c; --grid: #262624;
    --text: #ffffff; --text-2: #c3c2b7; --muted: #8f8e86;
    --accent: #6da7ec;
    --m-visits: #3987e5; --m-views: #d95926; --m-launches: #199e70; --m-downloads: #46c79a;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111110; --surface: #1a1a19; --border: #2f2f2c; --grid: #262624;
  --text: #ffffff; --text-2: #c3c2b7; --muted: #8f8e86;
  --accent: #6da7ec;
  --m-visits: #3987e5; --m-views: #d95926; --m-launches: #199e70; --m-downloads: #46c79a;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 24px 16px 48px; }
header { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.provenance { color: var(--muted); font-size: 12px; margin: 4px 0 0; font-variant-numeric: tabular-nums; }
.theme { background: var(--surface); color: var(--text-2); border: 1px solid var(--border);
  border-radius: 8px; padding: 7px 12px; font: inherit; font-size: 13px; cursor: pointer; }
h1 { font-size: 19px; margin: 0; font-weight: 650; letter-spacing: -0.01em; }
h2 { font-size: 15px; margin: 0 0 4px; }
.sub { color: var(--text-2); font-size: 13px; line-height: 1.55; margin: 0 0 14px; max-width: 76ch; }
.sub b { color: var(--text); font-weight: 600; }
.section-head { margin-top: 4px; }
.range { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.range button { background: var(--surface); color: var(--text-2); border: 0; padding: 7px 14px; font: inherit; cursor: pointer; }
.range button + button { border-left: 1px solid var(--border); }
.range button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
/* Colour rides the marks; every word stays in an ink token. A 28px value
   in aqua (2.74:1) or yellow (2.11:1) on the light surface is not readable,
   so each tile carries a coloured rule down its edge instead. */
.tile, .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
/* Identity on the edge, never a wash behind the figures: a tinted panel is
   decoration, and decoration is the first thing a sceptical reader
   discounts. The surface stays the neutral one the palette was validated
   against. */
.tile { border: 1px solid var(--border); border-left: 3px solid var(--measure, var(--border)); }
.barcell div, .pagecell a { color: var(--text); }
.place small { color: var(--muted); }
.tile .label { color: var(--text-2); font-size: 13px; }
.tile .value { font-size: 30px; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; margin-top: 2px; }
.tile .hint { color: var(--muted); font-size: 12px; }
.card { margin-bottom: 16px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.grid2 .card { margin-bottom: 0; }
/* Bars, not lines: these are discrete per-day counts, and a line drawn
   between them implies values on the way that do not exist.

   The plot is a stretched SVG; every LABEL is HTML beside it. Text inside a
   non-uniformly scaled SVG is distorted and shrinks with the viewport -- at
   phone width an 11px SVG label renders near 5px, and this page is mostly
   read on a phone. */
.chart { position: relative; padding-left: 40px; }
.plot { position: relative; height: 180px; }
.plot svg { display: block; width: 100%; height: 100%; }
.plot rect.col { fill: var(--measure, var(--accent)); }
.plot line.grid { stroke: var(--grid); stroke-width: 1; }
.ylab { position: absolute; right: calc(100% + 8px); transform: translateY(-50%);
  color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.peak { position: absolute; transform: translateX(-50%); color: var(--text-2); font-size: 11px; font-weight: 600; }
.xaxis { display: flex; justify-content: space-between; margin-top: 7px; color: var(--muted); font-size: 11px; }
.crosshair { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--muted); pointer-events: none; }
.hero { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; margin: 2px 0 18px; }
.hero::before { content: ""; width: 4px; align-self: stretch; border-radius: 2px; background: var(--m-launches); }
.hero .value { font-size: 46px; line-height: 1; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
.hero .unit { color: var(--text-2); font-size: 14px; padding-bottom: 6px; }
.tip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 10px; font-size: 12px; box-shadow: 0 4px 14px rgba(0,0,0,.12); white-space: nowrap; display: none; }
.tip b { display: block; margin-bottom: 2px; }
.tip i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.tabs { display: flex; gap: 6px; margin: 8px 0 10px; flex-wrap: wrap; }
.tabs button { background: none; border: 1px solid var(--border); color: var(--text-2); border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.tabs button[aria-pressed="true"] { border-color: var(--accent); color: var(--text); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; padding: 6px 4px; border-bottom: 1px solid var(--border); }
td { padding: 7px 4px; border-bottom: 1px solid var(--grid); color: var(--text); }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; width: 1%; white-space: nowrap; padding-left: 12px; }
.place small { color: var(--muted); display: block; font-size: 12px; }
.barcell { position: relative; }
.barcell span { position: absolute; left: 0; top: 4px; bottom: 4px; background: var(--measure, var(--accent)); border-radius: 0 4px 4px 0; opacity: .3; }
.barcell div { position: relative; }
.pagecell div { overflow-wrap: anywhere; }
.pagecell a { color: var(--text); text-decoration: none; }
.pagecell a:hover { text-decoration: underline; }
.empty, .error { color: var(--text-2); padding: 18px 4px; }
.error { color: var(--text); }
footer { color: var(--muted); font-size: 12px; margin-top: 20px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Vedanta Yojana analytics</h1>
      <!-- Provenance on the page itself: a screenshot of this ends up in a
           slide or a document, where the window it covers and the moment it
           was taken are the first things anyone should be able to check
           without having to ask. -->
      <p class="provenance" id="provenance"></p>
    </div>
    <div class="controls">
      <div class="range" role="group" aria-label="Time range">
        <button data-days="1">24 hours</button><button data-days="7">7 days</button><button data-days="30" aria-pressed="true">30 days</button><button data-days="90">90 days</button>
      </div>
      <!-- Projectors crush dark backgrounds and shift hues, so the theme has
           to be forcible rather than left to whatever the room's laptop
           prefers. -->
      <button class="theme" id="theme" type="button" title="Switch theme">Theme: auto</button>
    </div>
  </header>
  <div id="status" class="empty">Loading…</div>
  <div id="content" hidden>
    <div class="hero">
      <span class="value" id="hero-value">—</span>
      <span class="unit" id="hero-unit">app launches</span>
    </div>
    <div class="tiles">
      <div class="tile" style="--measure:var(--m-visits)"><div class="label">Website visits</div><div class="value" id="t-visits"></div><div class="hint">arrivals from outside the site</div></div>
      <div class="tile" style="--measure:var(--m-views)"><div class="label">Website page views</div><div class="value" id="t-views"></div><div class="hint">every page loaded</div></div>
      <div class="tile" style="--measure:var(--m-launches)"><div class="label">App launches</div><div class="value" id="t-launches"></div><div class="hint" id="t-launches-hint">Android app opens</div></div>
      <div class="tile" style="--measure:var(--m-downloads)"><div class="label">APK downloads, all time</div><div class="value" id="t-downloads"></div><div class="hint" id="t-downloads-hint"></div></div>
      <div class="tile"><div class="label">Countries</div><div class="value" id="t-countries"></div><div class="hint">with any site or app activity</div></div>
    </div>
    <div class="card">
      <h2>Website visits, <span class="per">per day</span></h2>
      <p class="sub">Someone arriving from a search, a link or a typed address.</p>
      <div class="chart" id="c-visits" style="--measure:var(--m-visits)"></div>
    </div>
    <div class="card">
      <h2>Website page views, <span class="per">per day</span></h2>
      <p class="sub">Every page opened. One visitor reading six chapters counts six times.</p>
      <div class="chart" id="c-views" style="--measure:var(--m-views)"></div>
    </div>
    <div class="card">
      <h2>App launches, <span class="per">per day</span></h2>
      <p class="sub">Each time the Android app is opened it checks for updates; that check is what is counted. Launches, not people.</p>
      <div class="chart" id="c-app" style="--measure:var(--m-launches)"></div>
    </div>
    <div class="card">
      <h2>App downloads, per day</h2>
      <p class="sub">APK downloads from GitHub, recorded once a day. People updating download it again, so this runs ahead of the number of people using the app.</p>
      <div class="chart" id="c-downloads" style="--measure:var(--m-downloads)"></div>
    </div>
    <div class="card">
      <h2>Where visitors come from</h2>
      <p class="sub">The site that sent each visit. "Direct" is a typed address, a bookmark, or an app that doesn't say where the link was opened — WhatsApp usually lands here.</p>
      <div id="sources" style="--measure:var(--m-visits)"></div>
    </div>
    <div class="card">
      <h2>Languages</h2>
      <p class="sub">The language readers had the website set to for each page they opened.</p>
      <div id="languages" style="--measure:var(--m-views)"></div>
    </div>
    <div class="card">
      <h2>What is read</h2>
      <p class="sub">The website and the Android app keep separate figures: a page path and a screen route are different things, and adding them together would give a number that is neither.</p>
      <div class="tabs" id="surface-tabs"></div>
    </div>
    <div class="card">
      <h2>Top pages</h2>
      <p class="sub">How often each page was opened, and how many visits began on it, as totals across all readers.</p>
      <div id="pages" style="--measure:var(--m-views)"></div>
    </div>
    <div class="card">
      <h2>What readers open next</h2>
      <p class="sub">Where readers went after each page, as totals across everyone. Pairs seen fewer than five times are left out.</p>
      <div id="nextpages" style="--measure:var(--m-views)"></div>
    </div>
    <div class="card">
      <h2>How far pages are read</h2>
      <p class="sub">The average share of a page reached before leaving it. A short page counts as fully read.</p>
      <div id="depths" style="--measure:var(--m-views)"></div>
    </div>
    <div class="grid2">
      <div class="card">
        <h2>Countries</h2>
        <p class="sub">Where the site and the app are being used.</p>
        <div class="tabs" data-for="countries"></div>
        <div id="countries" style="--measure:var(--m-visits)"></div>
      </div>
      <div class="card">
        <h2>Cities</h2>
        <p class="sub">Approximate — usually the nearest large city on the reader's provider.</p>
        <div class="tabs" data-for="cities"></div>
        <div id="cities" style="--measure:var(--m-visits)"></div>
      </div>
    </div>
    <footer>Days are UTC; hours in the 24-hour view are your local time. Cities are approximate — usually the nearest large city of the reader's internet provider. No cookies, IP addresses or identifiers are stored; figures are Cloudflare's, adjusted for its sampling.</footer>
  </div>
</div>
<script>
(function () {
  var state = { days: 30, data: null, sort: { countries: "visits", cities: "visits" }, surface: "web" };
  var METRICS = [["visits", "Visits"], ["views", "Page views"], ["launches", "App launches"]];
  var names;
  try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { names = null; }
  var fmt = new Intl.NumberFormat("en");

  function countryName(code) {
    if (!code || code === "XX") return "Unknown";
    if (code === "T1") return "Tor network";
    try { return (names && names.of(code)) || code; } catch (e) { return code; }
  }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    for (var k in attrs || {}) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }
  // Friendly names for the sources most sites see. Anything else is shown
  // as its host name.
  var SOURCE_NAMES = [
    [/^\\(direct\\)$/, "Direct / WhatsApp / bookmarks"],
    [/(^|\\.)google\\.[a-z.]+$|^com\\.google\\.android\\.googlequicksearchbox$/, "Google"],
    [/(^|\\.)bing\\.com$/, "Bing"],
    [/(^|\\.)duckduckgo\\.com$/, "DuckDuckGo"],
    [/(^|\\.)yahoo\\.com$/, "Yahoo"],
    [/(^|\\.)facebook\\.com$|^fb\\.me$/, "Facebook"],
    [/(^|\\.)instagram\\.com$/, "Instagram"],
    [/(^|\\.)whatsapp\\.(com|net)$/, "WhatsApp"],
    [/(^|\\.)youtube\\.com$|^youtu\\.be$/, "YouTube"],
    [/^t\\.co$|(^|\\.)twitter\\.com$|(^|\\.)x\\.com$/, "X (Twitter)"],
    [/(^|\\.)linkedin\\.com$|^lnkd\\.in$/, "LinkedIn"],
    [/(^|\\.)reddit\\.com$/, "Reddit"],
    [/(^|\\.)t\\.me$|(^|\\.)telegram\\.org$/, "Telegram"],
    [/(^|\\.)github\\.com$/, "GitHub"],
    [/(^|\\.)chatgpt\\.com$|(^|\\.)openai\\.com$/, "ChatGPT"],
    [/(^|\\.)claude\\.ai$/, "Claude"],
    [/(^|\\.)perplexity\\.ai$/, "Perplexity"],
  ];
  function sourceName(host) {
    for (var i = 0; i < SOURCE_NAMES.length; i++) if (SOURCE_NAMES[i][0].test(host)) return SOURCE_NAMES[i][1];
    return host.replace(/^(m|l|lm)\\./, "");
  }

  function sourceTable(rows) {
    var merged = {};
    rows.forEach(function (r) {
      var name = sourceName(String(r.source));
      merged[name] = (merged[name] || 0) + Number(r.visits);
    });
    var list = Object.keys(merged).map(function (k) { return { name: k, visits: merged[k] }; })
      .filter(function (r) { return r.visits > 0; })
      .sort(function (a, b) { return b.visits - a.visits; }).slice(0, 20);
    var box = document.getElementById("sources");
    box.textContent = "";
    if (!list.length) { box.appendChild(el("div", { class: "empty" }, "No sources recorded in this range yet.")); return; }
    var total = list.reduce(function (a, r) { return a + r.visits; }, 0);
    var table = el("table");
    var head = el("tr");
    head.appendChild(el("th", {}, "Source"));
    head.appendChild(el("th", { class: "n" }, "Visits"));
    head.appendChild(el("th", { class: "n" }, "Share"));
    table.appendChild(head);
    list.forEach(function (r) {
      var tr = el("tr");
      var cell = el("td", { class: "place barcell" });
      var bar = el("span");
      bar.style.width = Math.max(2, (r.visits / list[0].visits) * 100) + "%";
      cell.appendChild(bar);
      cell.appendChild(el("div", {}, r.name));
      tr.appendChild(cell);
      tr.appendChild(el("td", { class: "n" }, fmt.format(Math.round(r.visits))));
      tr.appendChild(el("td", { class: "n" }, Math.round((r.visits / total) * 100) + "%"));
      table.appendChild(tr);
    });
    box.appendChild(table);
  }

  var langNames;
  try { langNames = new Intl.DisplayNames(["en"], { type: "language" }); } catch (e) { langNames = null; }
  function languageName(code) {
    try { return (langNames && langNames.of(code)) || code; } catch (e) { return code; }
  }

  function languageTable(rows) {
    var list = rows.map(function (r) { return { name: languageName(String(r.language)), views: Number(r.views) }; })
      .filter(function (r) { return r.views > 0; })
      .sort(function (a, b) { return b.views - a.views; });
    var box = document.getElementById("languages");
    box.textContent = "";
    if (!list.length) { box.appendChild(el("div", { class: "empty" }, "No languages recorded in this range yet.")); return; }
    var total = list.reduce(function (a, r) { return a + r.views; }, 0);
    var table = el("table");
    var head = el("tr");
    head.appendChild(el("th", {}, "Language"));
    head.appendChild(el("th", { class: "n" }, "Page views"));
    head.appendChild(el("th", { class: "n" }, "Share"));
    table.appendChild(head);
    list.forEach(function (r) {
      var tr = el("tr");
      var cell = el("td", { class: "place barcell" });
      var bar = el("span");
      bar.style.width = Math.max(2, (r.views / list[0].views) * 100) + "%";
      cell.appendChild(bar);
      cell.appendChild(el("div", {}, r.name));
      tr.appendChild(cell);
      tr.appendChild(el("td", { class: "n" }, fmt.format(Math.round(r.views))));
      tr.appendChild(el("td", { class: "n" }, Math.round((r.views / total) * 100) + "%"));
      table.appendChild(tr);
    });
    box.appendChild(table);
  }

  /**
   * The website/app switch above the three content cards. One switch for
   * all of them, so the three always describe the same surface and can
   * never be read as one mixed set.
   */
  function surfaceTabs() {
    var tabs = document.getElementById("surface-tabs");
    tabs.textContent = "";
    [["web", "Website"], ["app", "Android app"]].forEach(function (option) {
      var button = el("button", { "aria-pressed": String(state.surface === option[0]) }, option[1]);
      button.onclick = function () { state.surface = option[0]; surfaceTabs(); contentTables(); };
      tabs.appendChild(button);
    });
  }

  /** Rows for the selected surface only. Depth rows carry their own kind. */
  function forSurface(rows, depth) {
    var want = state.surface + (depth ? "-depth" : "");
    return (rows || []).filter(function (r) { return String(r.surface) === want; });
  }

  function contentTables() {
    var d = state.data;
    pageTable(forSurface(d.pages));
    nextPageTable(forSurface(d.nextPages));
    depthTable(forSurface(d.depths, true));
  }

  // "Readers who opened this page opened that one next." The share is of
  // the moves away from the source page, so it reads as "of everyone who
  // left this page, this is where they went".
  function nextPageTable(rows) {
    var bySource = {};
    rows.forEach(function (r) {
      var src = String(r.src);
      (bySource[src] = bySource[src] || []).push({ dst: String(r.dst), moves: Number(r.moves) });
    });
    var sources = Object.keys(bySource).map(function (src) {
      var moves = bySource[src].reduce(function (a, r) { return a + r.moves; }, 0);
      return { src: src, moves: moves, next: bySource[src].sort(function (a, b) { return b.moves - a.moves; }).slice(0, 4) };
    }).sort(function (a, b) { return b.moves - a.moves; }).slice(0, 12);

    var box = document.getElementById("nextpages");
    box.textContent = "";
    if (!sources.length) {
      box.appendChild(el("div", { class: "empty" },
        "No page-to-page moves recorded yet in this range. Pairs appear once five readers have made the same move."));
      return;
    }
    var table = el("table");
    var head = el("tr");
    head.appendChild(el("th", {}, "After this page"));
    head.appendChild(el("th", {}, "they opened"));
    head.appendChild(el("th", { class: "n" }, "Readers"));
    head.appendChild(el("th", { class: "n" }, "Share"));
    table.appendChild(head);
    sources.forEach(function (s) {
      s.next.forEach(function (r, i) {
        var tr = el("tr");
        var from = el("td", {}, i === 0 ? pageLabel(s.src) : "");
        if (i === 0) from.className = "place";
        tr.appendChild(from);
        var cell = el("td", { class: "place barcell pagecell" });
        var bar = el("span");
        bar.style.width = Math.max(2, (r.moves / s.next[0].moves) * 100) + "%";
        cell.appendChild(bar);
        cell.appendChild(el("div", {}, pageLabel(r.dst)));
        tr.appendChild(cell);
        tr.appendChild(el("td", { class: "n" }, fmt.format(Math.round(r.moves))));
        tr.appendChild(el("td", { class: "n" }, Math.round((r.moves / s.moves) * 100) + "%"));
        table.appendChild(tr);
      });
    });
    box.appendChild(table);
  }

  function depthTable(rows) {
    var list = rows.map(function (r) {
      return { page: String(r.page), readers: Number(r.readers), depth: Number(r.depth) };
    }).sort(function (a, b) { return b.readers - a.readers; }).slice(0, 25);
    var box = document.getElementById("depths");
    box.textContent = "";
    if (!list.length) {
      box.appendChild(el("div", { class: "empty" },
        "No read-depth recorded yet in this range. A page appears once five readers have opened and left it."));
      return;
    }
    var table = el("table");
    var head = el("tr");
    head.appendChild(el("th", {}, "Page"));
    head.appendChild(el("th", { class: "n" }, "Readers"));
    head.appendChild(el("th", { class: "n" }, "Average read"));
    table.appendChild(head);
    list.forEach(function (r) {
      var tr = el("tr");
      var cell = el("td", { class: "place barcell pagecell" });
      var bar = el("span");
      // The bar is the depth itself, so a page people abandon early reads
      // as a short bar however many readers it had.
      bar.style.width = Math.max(2, r.depth) + "%";
      cell.appendChild(bar);
      cell.appendChild(el("div", {}, pageLabel(r.page)));
      tr.appendChild(cell);
      tr.appendChild(el("td", { class: "n" }, fmt.format(Math.round(r.readers))));
      tr.appendChild(el("td", { class: "n" }, Math.round(r.depth) + "%"));
      table.appendChild(tr);
    });
    box.appendChild(table);
  }

  /** "/" reads as Home; anything not a path is an unusual address. */
  function pageLabel(path) {
    if (path === "/") return "Home";
    return path.charAt(0) === "/" ? path : "Other (unusual address)";
  }

  function pageTable(rows) {
    var list = rows.map(function (r) { return { page: String(r.page), views: Number(r.views), entries: Number(r.entries) }; })
      .filter(function (r) { return r.views > 0; })
      .sort(function (a, b) { return b.views - a.views; }).slice(0, 25);
    var box = document.getElementById("pages");
    box.textContent = "";
    if (!list.length) { box.appendChild(el("div", { class: "empty" }, "No page views recorded in this range yet.")); return; }
    var table = el("table");
    var head = el("tr");
    head.appendChild(el("th", {}, "Page"));
    head.appendChild(el("th", { class: "n" }, "Views"));
    head.appendChild(el("th", { class: "n" }, "Visits began here"));
    table.appendChild(head);
    list.forEach(function (r) {
      var tr = el("tr");
      var cell = el("td", { class: "place barcell pagecell" });
      var bar = el("span");
      bar.style.width = Math.max(2, (r.views / list[0].views) * 100) + "%";
      cell.appendChild(bar);
      var label = el("div");
      if (r.page.charAt(0) === "/" && state.surface === "web") {
        var link = el("a", { href: "https://vedantayojana.org" + r.page, target: "_blank", rel: "noopener noreferrer" },
          r.page === "/" ? "Home" : r.page);
        label.appendChild(link);
      } else if (r.page.charAt(0) === "/") {
        // An app route is not a web address, so it is not a link.
        label.textContent = r.page === "/" ? "Home" : r.page;
      } else {
        label.textContent = "Other (unusual address)";
      }
      cell.appendChild(label);
      tr.appendChild(cell);
      tr.appendChild(el("td", { class: "n" }, fmt.format(Math.round(r.views))));
      tr.appendChild(el("td", { class: "n" }, fmt.format(Math.round(r.entries))));
      table.appendChild(tr);
    });
    box.appendChild(table);
  }

  function metricOf(kind) {
    if (kind === "web") return "web";
    if (kind === "/app-version.json") return "launches";
    return null;
  }

  function load() {
    document.getElementById("status").hidden = false;
    document.getElementById("status").className = "empty";
    document.getElementById("status").textContent = "Loading…";
    fetch("/data?days=" + state.days, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        state.data = data;
        render();
      })
      .catch(function (err) {
        var s = document.getElementById("status");
        s.className = "error";
        s.textContent = err.message;
        document.getElementById("content").hidden = true;
      });
  }

  function render() {
    var d = state.data;
    // One bucket per day, or per hour for the 24-hour view. Keys are UTC:
    // "YYYY-MM-DD" for days, "YYYY-MM-DDTHH" for hours.
    var byDay = {};
    var hourly = !!d.hourly;
    var step = hourly ? 3600000 : 86400000;
    var count = hourly ? 24 : d.days;
    document.querySelectorAll(".per").forEach(function (n) { n.textContent = hourly ? "per hour" : "per day"; });
    var start = new Date();
    if (hourly) start.setUTCMinutes(0, 0, 0); else start.setUTCHours(0, 0, 0, 0);
    for (var i = count - 1; i >= 0; i--) {
      var key = new Date(start.getTime() - i * step).toISOString().slice(0, hourly ? 13 : 10);
      byDay[key] = { day: key, views: 0, visits: 0, launches: 0, downloads: 0 };
    }
    d.daily.forEach(function (row) {
      var key = String(row.day).replace(" ", "T").slice(0, hourly ? 13 : 10);
      var slot = byDay[key];
      var m = metricOf(row.kind);
      if (!slot || !m) return;
      if (m === "web") { slot.views += Number(row.hits); slot.visits += Number(row.visits); }
      else slot.launches += Number(row.hits);
    });
    var days = Object.keys(byDay).sort().map(function (k) { return byDay[k]; });

    // Downloads per day are the difference between consecutive daily
    // snapshots of GitHub's running total. A missed day folds into the
    // next recorded one; the first snapshot has nothing to compare with.
    var snaps = d.downloads || [];
    snaps.forEach(function (snap, i) {
      if (i === 0 || !byDay[snap.date]) return;
      byDay[snap.date].downloads = Math.max(0, snap.total - snaps[i - 1].total);
    });

    var countries = {}, cities = {};
    d.places.forEach(function (row) {
      var m = metricOf(row.kind);
      if (!m) return;
      var c = countries[row.country] || (countries[row.country] = { name: countryName(row.country), views: 0, visits: 0, launches: 0 });
      var cityKey = row.country + "|" + row.region + "|" + row.city;
      var t = cities[cityKey] || (cities[cityKey] = {
        name: row.city || "Unknown city",
        detail: [row.region, countryName(row.country)].filter(Boolean).join(", "),
        views: 0, visits: 0, launches: 0,
      });
      [c, t].forEach(function (x) {
        if (m === "web") { x.views += Number(row.hits); x.visits += Number(row.visits); }
        else x.launches += Number(row.hits);
      });
    });

    function sum(key) { return days.reduce(function (a, x) { return a + x[key]; }, 0); }
    document.getElementById("t-visits").textContent = fmt.format(Math.round(sum("visits")));
    document.getElementById("t-views").textContent = fmt.format(Math.round(sum("views")));
    document.getElementById("t-launches").textContent = fmt.format(Math.round(sum("launches")));
    document.getElementById("t-launches-hint").textContent = hourly
      ? "Android app opens · last 24 hours"
      : "Android app opens · about " + fmt.format(Math.round(sum("launches") / d.days)) + " a day";
    if (snaps.length) {
      document.getElementById("t-downloads").textContent = fmt.format(snaps[snaps.length - 1].total);
      var lastSnap = snaps[snaps.length - 1];
      // Downloads are only known per day, so the 24-hour view shows the
      // latest recorded day's gain instead of a range total.
      document.getElementById("t-downloads-hint").textContent = hourly
        ? (snaps.length > 1 ? "+" + fmt.format(Math.max(0, lastSnap.total - snaps[snaps.length - 2].total)) + " on " : "as of ") + shortDate(lastSnap.date)
        : "+" + fmt.format(sum("downloads")) + " in this range · as of " + shortDate(lastSnap.date);
    } else {
      document.getElementById("t-downloads").textContent = "—";
      document.getElementById("t-downloads-hint").textContent = "download history unavailable";
    }
    var now = new Date();
    document.getElementById("provenance").textContent =
      (hourly ? "Last 24 hours" : "Last " + d.days + " days") +
      " \u00b7 as of " + now.toISOString().slice(0, 16).replace("T", " ") + " UTC" +
      " \u00b7 counts estimated from Cloudflare's sampling";
    document.getElementById("hero-value").textContent = fmt.format(Math.round(sum("launches")));
    document.getElementById("hero-unit").textContent = hourly
      ? "app launches in the last 24 hours"
      : "app launches in the last " + d.days + " days";
    document.getElementById("t-countries").textContent = fmt.format(Object.keys(countries).filter(function (k) { return k !== "XX"; }).length);

    // Shown before drawing: a hidden container measures zero wide.
    document.getElementById("status").hidden = true;
    document.getElementById("content").hidden = false;

    barChart(document.getElementById("c-visits"), days, "visits");
    barChart(document.getElementById("c-views"), days, "views");
    barChart(document.getElementById("c-app"), days, "launches");
    // Only days with a recorded figure: before the first snapshot, and
    // today until the daily snapshot runs, "no data" must not read as 0.
    var recorded = !hourly && snaps.length > 1 ? days.filter(function (x) {
      return x.day > snaps[0].date && x.day <= snaps[snaps.length - 1].date;
    }) : [];
    var dlHost = document.getElementById("c-downloads");
    if (recorded.length) {
      barChart(dlHost, recorded, "downloads");
    } else {
      dlHost.textContent = "";
      dlHost.appendChild(el("div", { class: "empty" }, hourly
        ? "Downloads are recorded once a day — choose 7 days or longer to see them."
        : "No daily download figures in this range yet."));
    }
    surfaceTabs();
    contentTables();
    sourceTable(d.sources || []);
    languageTable(d.languages || []);

    placeTable("countries", Object.values(countries));
    placeTable("cities", Object.values(cities));
  }

  function placeTable(id, rows) {
    var tabs = document.querySelector('.tabs[data-for="' + id + '"]');
    tabs.textContent = "";
    METRICS.forEach(function (m) {
      var b = el("button", { "aria-pressed": String(state.sort[id] === m[0]) }, m[1]);
      b.onclick = function () { state.sort[id] = m[0]; placeTable(id, rows); };
      tabs.appendChild(b);
    });
    var key = state.sort[id];
    var shown = rows.filter(function (r) { return r[key] > 0; })
      .sort(function (a, b) { return b[key] - a[key]; }).slice(0, 25);
    var box = document.getElementById(id);
    box.textContent = "";
    if (!shown.length) { box.appendChild(el("div", { class: "empty" }, "Nothing recorded in this range yet.")); return; }
    var max = shown[0][key];
    var table = el("table");
    var head = el("tr");
    head.appendChild(el("th", {}, id === "countries" ? "Country" : "City"));
    METRICS.forEach(function (m) { head.appendChild(el("th", { class: "n" }, m[1])); });
    table.appendChild(head);
    shown.forEach(function (r) {
      var tr = el("tr");
      var place = el("td", { class: "place barcell" });
      var bar = el("span");
      bar.style.width = Math.max(2, (r[key] / max) * 100) + "%";
      var label = el("div", {}, r.name);
      if (r.detail) label.appendChild(el("small", {}, r.detail));
      place.appendChild(bar); place.appendChild(label);
      tr.appendChild(place);
      METRICS.forEach(function (m) { tr.appendChild(el("td", { class: "n" }, fmt.format(Math.round(r[m[0]])))); });
      table.appendChild(tr);
    });
    box.appendChild(table);
  }

  // A maximum that splits into four whole, round steps (0, 5, 10, 15, 20).
  function niceMax(v) {
    var raw = Math.max(1, v / 4);
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i] * p;
      if (step >= raw && step === Math.round(step)) return step * 4;
    }
    return 10 * p * 4;
  }
  // Day keys read "Sep 25"; hour keys ("YYYY-MM-DDTHH", UTC) read as the
  // viewer's own local time, "3 PM".
  function shortDate(key) {
    if (key.length > 10) {
      return new Date(key + ":00:00Z").toLocaleTimeString("en", { hour: "numeric" });
    }
    return new Date(key + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  function longLabel(key) {
    if (key.length > 10) {
      return new Date(key + ":00:00Z").toLocaleString("en", { weekday: "short", hour: "numeric", minute: "2-digit" });
    }
    return shortDate(key);
  }

  // Columns, not a line. These are discrete per-day counts, and a line
  // drawn between them implies values on the way that do not exist. Each
  // chart carries one measure in that measure's own colour, taken from the
  // --measure property its card sets, so nothing has to be matched against
  // a legend.
  function barChart(host, rows, key) {
    host.textContent = "";
    if (!rows.length) {
      host.appendChild(el("div", { class: "empty" }, "Nothing recorded in this range yet."));
      return;
    }
    var NS = "http://www.w3.org/2000/svg";
    var W = 720, H = 166;
    var values = rows.map(function (r) { return Number(r[key]) || 0; });
    var max = niceMax(Math.max.apply(null, values));
    var slot = W / rows.length;
    var barW = Math.max(1, Math.min(24, slot - 2));
    var peakIndex = values.indexOf(Math.max.apply(null, values));

    var plot = el("div", { class: "plot" });
    [1, 0.5, 0].forEach(function (f) {
      plot.appendChild(el("span", { class: "ylab", style: "top:" + ((1 - f) * 100) + "%" },
        fmt.format(Math.round(max * f))));
    });

    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    function add(tag, attrs) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      svg.appendChild(n);
      return n;
    }
    [0, 0.5, 1].forEach(function (f) {
      add("line", { class: "grid", x1: 0, x2: W, y1: H - f * H, y2: H - f * H, "vector-effect": "non-scaling-stroke" });
    });
    values.forEach(function (v, i) {
      var h = max > 0 ? (v / max) * H : 0;
      // A zero-height rounded rect renders as a stray sliver; the day is
      // still in the data the crosshair reads.
      if (h < 0.5) return;
      var x = i * slot + (slot - barW) / 2, y = H - h;
      var r = Math.min(4, barW / 2, h);
      // Rounded cap plus a square-cornered foot, so the bar stays square
      // where it meets the baseline.
      add("rect", { class: "col", x: x, y: y, width: barW, height: h, rx: r });
      add("rect", { class: "col", x: x, y: y + h - r, width: barW, height: r });
    });
    plot.appendChild(svg);

    var cross = el("span", { class: "crosshair" });
    cross.hidden = true;
    plot.appendChild(cross);

    // Only the peak is labelled. A number on every column is unreadable,
    // and it is also the visible relief a sub-3:1 mark needs on light.
    if (values[peakIndex] > 0) {
      plot.appendChild(el("span", {
        class: "peak",
        style: "left:" + (((peakIndex + 0.5) / rows.length) * 100).toFixed(2) + "%;bottom:calc(" +
          ((values[peakIndex] / max) * 100).toFixed(2) + "% + 4px)",
      }, fmt.format(values[peakIndex])));
    }

    var tip = el("div", { class: "tip" });
    plot.appendChild(tip);
    host.appendChild(plot);

    // First, middle and last only: every date collides at 30 columns.
    var ticks = el("div", { class: "xaxis" });
    var marks = rows.length <= 2 ? [0, rows.length - 1] : [0, Math.floor((rows.length - 1) / 2), rows.length - 1];
    marks.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i) {
      ticks.appendChild(el("span", {}, shortDate(rows[i].day)));
    });
    host.appendChild(ticks);

    // The reader aims at a day, not at a 2px column: one overlay finds the
    // nearest, so the hit area is the whole plot however thin the columns
    // get at 90 days. Keyboard gets the identical readout.
    var active = -1;
    function show(i) {
      if (i < 0 || i >= rows.length) return;
      active = i;
      var centre = ((i + 0.5) / rows.length) * 100;
      cross.style.left = centre + "%";
      cross.hidden = false;
      tip.textContent = "";
      tip.appendChild(el("b", {}, longLabel(rows[i].day)));
      var line = el("div");
      var dot = el("i");
      dot.style.background = "var(--measure, var(--accent))";
      line.appendChild(dot);
      line.appendChild(document.createTextNode(fmt.format(Math.round(values[i]))));
      tip.appendChild(line);
      tip.style.display = "block";
      var width = plot.clientWidth;
      tip.style.left = Math.min(Math.max((centre / 100) * width - tip.offsetWidth / 2, 0),
        Math.max(0, width - tip.offsetWidth)) + "px";
      tip.style.top = "0px";
    }
    function hide() { active = -1; cross.hidden = true; tip.style.display = "none"; }
    host.addEventListener("pointermove", function (e) {
      var box = plot.getBoundingClientRect();
      if (!box.width) return;
      show(Math.min(rows.length - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * rows.length))));
    });
    host.addEventListener("pointerleave", hide);
    host.setAttribute("tabindex", "0");
    host.addEventListener("focus", function () { show(active < 0 ? rows.length - 1 : active); });
    host.addEventListener("blur", hide);
    host.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { show(Math.min(rows.length - 1, active + 1)); e.preventDefault(); }
      if (e.key === "ArrowLeft") { show(Math.max(0, active - 1)); e.preventDefault(); }
      if (e.key === "Escape") hide();
    });
  }

  // localStorage can throw in a private window or with site data blocked,
  // so every access is guarded and the page renders correctly without it.
  var THEMES = ["auto", "light", "dark"];
  function readTheme() {
    try { var v = localStorage.getItem("vy-theme"); return THEMES.indexOf(v) > -1 ? v : "auto"; }
    catch (e) { return "auto"; }
  }
  function applyTheme(value) {
    if (value === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", value);
    document.getElementById("theme").textContent = "Theme: " + value;
    try { localStorage.setItem("vy-theme", value); } catch (e) { /* not essential */ }
  }
  applyTheme(readTheme());
  document.getElementById("theme").onclick = function () {
    applyTheme(THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length]);
  };

  document.querySelectorAll(".range button").forEach(function (b) {
    b.onclick = function () {
      state.days = Number(b.getAttribute("data-days"));
      document.querySelectorAll(".range button").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      load();
    };
  });
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.data) render(); }, 150);
  });
  load();
})();
</script>
</body>
</html>`;
