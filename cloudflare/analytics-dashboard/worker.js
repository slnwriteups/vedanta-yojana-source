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
const RANGES = new Set([7, 30, 90]);

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

async function loadData(env, days) {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    return { error: "The dashboard is not connected yet: set the CF_ACCOUNT_ID and CF_API_TOKEN secrets on this Worker in Cloudflare (Settings -> Variables and Secrets)." };
  }
  // `days` is one of RANGES, never raw input, so interpolating it is safe.
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  try {
    const [daily, places] = await Promise.all([
      query(
        env,
        `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, blob2 AS kind,
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
    ]);
    return { days, daily, places };
  } catch (error) {
    return { error: `Cloudflare returned an error: ${error.message}` };
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
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Vedanta Yojana Analytics</title>
<style>
:root {
  color-scheme: light;
  --bg: #f6f5f1; --surface: #fcfcfb; --border: #e4e2dc; --grid: #ecebe6;
  --text: #0b0b0b; --text-2: #52514e; --muted: #7a7873;
  --s1: #2a78d6; --s2: #eb6834; --bar: #86b6ef; --accent: #2a78d6;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #111110; --surface: #1a1a19; --border: #2f2f2c; --grid: #262624;
    --text: #ffffff; --text-2: #c3c2b7; --muted: #8f8e86;
    --s1: #3987e5; --s2: #d95926; --bar: #1c5cab; --accent: #6da7ec;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111110; --surface: #1a1a19; --border: #2f2f2c; --grid: #262624;
  --text: #ffffff; --text-2: #c3c2b7; --muted: #8f8e86;
  --s1: #3987e5; --s2: #d95926; --bar: #1c5cab; --accent: #6da7ec;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 24px 16px 48px; }
header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 20px; }
h1 { font-size: 20px; margin: 0; }
h2 { font-size: 15px; margin: 0 0 4px; }
.sub { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
.range { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.range button { background: var(--surface); color: var(--text-2); border: 0; padding: 7px 14px; font: inherit; cursor: pointer; }
.range button + button { border-left: 1px solid var(--border); }
.range button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.tile, .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
.tile .label { color: var(--text-2); font-size: 13px; }
.tile .value { font-size: 28px; font-weight: 650; font-variant-numeric: tabular-nums; margin-top: 2px; }
.tile .hint { color: var(--muted); font-size: 12px; }
.card { margin-bottom: 16px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.grid2 .card { margin-bottom: 0; }
.legend { display: flex; gap: 16px; font-size: 13px; color: var(--text-2); margin-bottom: 6px; }
.legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
.chart { position: relative; }
.chart svg { display: block; width: 100%; height: 220px; overflow: visible; }
.chart text { fill: var(--muted); font-size: 11px; }
.tip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 10px; font-size: 12px; box-shadow: 0 4px 14px rgba(0,0,0,.12); white-space: nowrap; display: none; }
.tip b { display: block; margin-bottom: 2px; }
.tip i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.tabs { display: flex; gap: 6px; margin: 8px 0 10px; flex-wrap: wrap; }
.tabs button { background: none; border: 1px solid var(--border); color: var(--text-2); border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.tabs button[aria-pressed="true"] { border-color: var(--accent); color: var(--text); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; padding: 6px 4px; border-bottom: 1px solid var(--border); }
td { padding: 7px 4px; border-bottom: 1px solid var(--grid); }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; width: 1%; white-space: nowrap; padding-left: 12px; }
.place small { color: var(--muted); display: block; font-size: 12px; }
.barcell { position: relative; }
.barcell span { position: absolute; left: 0; top: 4px; bottom: 4px; background: var(--bar); border-radius: 0 4px 4px 0; opacity: .45; }
.barcell div { position: relative; }
.empty, .error { color: var(--text-2); padding: 18px 4px; }
.error { color: var(--text); }
footer { color: var(--muted); font-size: 12px; margin-top: 20px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Vedanta Yojana analytics</h1>
    <div class="range" role="group" aria-label="Time range">
      <button data-days="7">7 days</button><button data-days="30" aria-pressed="true">30 days</button><button data-days="90">90 days</button>
    </div>
  </header>
  <div id="status" class="empty">Loading…</div>
  <div id="content" hidden>
    <div class="tiles">
      <div class="tile"><div class="label">Website visits</div><div class="value" id="t-visits"></div><div class="hint">arrivals from outside the site</div></div>
      <div class="tile"><div class="label">Website page views</div><div class="value" id="t-views"></div><div class="hint">every page loaded</div></div>
      <div class="tile"><div class="label">App launches</div><div class="value" id="t-launches"></div><div class="hint">Android app opens</div></div>
      <div class="tile"><div class="label">Countries</div><div class="value" id="t-countries"></div><div class="hint">with any site or app activity</div></div>
    </div>
    <div class="card">
      <h2>Website, per day</h2>
      <p class="sub">A visit is someone arriving from a search, a link or a typed address; views count every page they then open.</p>
      <div class="legend"><span><i style="background:var(--s1)"></i>Page views</span><span><i style="background:var(--s2)"></i>Visits</span></div>
      <div class="chart" id="c-web"></div>
    </div>
    <div class="card">
      <h2>App launches, per day</h2>
      <p class="sub">Each time the Android app is opened it checks for updates; that check is what is counted. Launches, not people.</p>
      <div class="chart" id="c-app"></div>
    </div>
    <div class="grid2">
      <div class="card">
        <h2>Countries</h2>
        <div class="tabs" data-for="countries"></div>
        <div id="countries"></div>
      </div>
      <div class="card">
        <h2>Cities</h2>
        <div class="tabs" data-for="cities"></div>
        <div id="cities"></div>
      </div>
    </div>
    <footer>Days are UTC. Cities are approximate — usually the nearest large city of the reader's internet provider. No cookies, IP addresses or identifiers are stored; figures are Cloudflare's, adjusted for its sampling.</footer>
  </div>
</div>
<script>
(function () {
  var state = { days: 30, data: null, sort: { countries: "visits", cities: "visits" } };
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
    var byDay = {};
    var start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    for (var i = d.days - 1; i >= 0; i--) {
      var key = new Date(start.getTime() - i * 86400000).toISOString().slice(0, 10);
      byDay[key] = { day: key, views: 0, visits: 0, launches: 0 };
    }
    d.daily.forEach(function (row) {
      var key = String(row.day).slice(0, 10);
      var slot = byDay[key];
      var m = metricOf(row.kind);
      if (!slot || !m) return;
      if (m === "web") { slot.views += Number(row.hits); slot.visits += Number(row.visits); }
      else slot.launches += Number(row.hits);
    });
    var days = Object.keys(byDay).sort().map(function (k) { return byDay[k]; });

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
    document.getElementById("t-countries").textContent = fmt.format(Object.keys(countries).filter(function (k) { return k !== "XX"; }).length);

    // Shown before drawing: a hidden container measures zero wide.
    document.getElementById("status").hidden = true;
    document.getElementById("content").hidden = false;

    lineChart(document.getElementById("c-web"), days, [
      { key: "views", label: "Page views", color: "var(--s1)" },
      { key: "visits", label: "Visits", color: "var(--s2)" },
    ]);
    lineChart(document.getElementById("c-app"), days, [
      { key: "launches", label: "App launches", color: "var(--s1)" },
    ]);
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
  function shortDate(key) {
    return new Date(key + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  }

  function lineChart(host, days, series) {
    host.textContent = "";
    var NS = "http://www.w3.org/2000/svg";
    var W = Math.max(280, host.clientWidth || 600), H = 220, L = 40, R = 8, T = 8, B = 24;
    var max = niceMax(Math.max.apply(null, days.map(function (d) {
      return Math.max.apply(null, series.map(function (s) { return d[s.key]; }));
    })));
    var x = function (i) { return L + (days.length === 1 ? 0 : (i / (days.length - 1)) * (W - L - R)); };
    var y = function (v) { return T + (1 - v / max) * (H - T - B); };
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", series.map(function (s) { return s.label; }).join(" and ") + " per day");
    function add(tag, attrs, text) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text != null) n.textContent = text;
      svg.appendChild(n);
      return n;
    }
    for (var g = 0; g <= 4; g++) {
      var v = (max / 4) * g, gy = y(v);
      add("line", { x1: L, x2: W - R, y1: gy, y2: gy, stroke: "var(--grid)", "stroke-width": 1 });
      add("text", { x: L - 6, y: gy + 4, "text-anchor": "end" }, fmt.format(v));
    }
    // Evenly spaced date labels, always ending on the latest day; any
    // label that would crowd that last one is dropped.
    var every = Math.ceil(days.length / Math.max(2, Math.floor((W - L) / 70)));
    var last = days.length - 1;
    days.forEach(function (d, i) {
      if (i !== last && (i % every !== 0 || x(last) - x(i) < 60)) return;
      add("text", { x: x(i), y: H - 6, "text-anchor": i === 0 ? "start" : i === last ? "end" : "middle" }, shortDate(d.day));
    });
    series.forEach(function (s) {
      var dAttr = days.map(function (d, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d[s.key]).toFixed(1); }).join(" ");
      add("path", { d: dAttr, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
    });
    var cross = add("line", { y1: T, y2: H - B, stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "3 3", visibility: "hidden" });
    var dots = series.map(function (s) {
      return add("circle", { r: 4, fill: s.color, stroke: "var(--surface)", "stroke-width": 2, visibility: "hidden" });
    });
    var hit = add("rect", { x: L, y: 0, width: W - L - R, height: H, fill: "transparent" });
    host.appendChild(svg);
    var tip = el("div", { class: "tip" });
    host.appendChild(tip);

    function show(evt) {
      var box = svg.getBoundingClientRect();
      var px = ((evt.clientX - box.left) / box.width) * W;
      var i = Math.round(((px - L) / (W - L - R)) * (days.length - 1));
      i = Math.max(0, Math.min(days.length - 1, i));
      var d = days[i], cx = x(i);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
      dots.forEach(function (dot, k) {
        dot.setAttribute("cx", cx); dot.setAttribute("cy", y(d[series[k].key])); dot.setAttribute("visibility", "visible");
      });
      tip.textContent = "";
      tip.appendChild(el("b", {}, shortDate(d.day)));
      series.forEach(function (s) {
        var line = el("div");
        var sw = el("i"); sw.style.background = s.color;
        line.appendChild(sw);
        line.appendChild(document.createTextNode(s.label + ": " + fmt.format(Math.round(d[s.key]))));
        tip.appendChild(line);
      });
      tip.style.display = "block";
      var left = (cx / W) * box.width + 12;
      if (left + tip.offsetWidth > box.width) left = (cx / W) * box.width - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = "8px";
    }
    function hide() {
      tip.style.display = "none";
      cross.setAttribute("visibility", "hidden");
      dots.forEach(function (dot) { dot.setAttribute("visibility", "hidden"); });
    }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", hide);
  }

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
