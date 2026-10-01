import http from "node:http";
import { PAGE } from "../cloudflare/analytics-dashboard/worker.js";

/**
 * Serves the analytics dashboard locally against fixture data.
 *
 *   node scripts/preview-dashboard.ts [port]
 *
 * Why: the dashboard page is a string inside a Cloudflare Worker that needs
 * a password, an API token and live Analytics Engine rows, so the ordinary
 * way to see a presentation change is to deploy and look. That is a slow,
 * credentialed loop for what is a layout question. This serves the EXACT
 * page the Worker serves, with the same /data contract filled by invented
 * rows, so the rendering can be checked -- by eye or by a screenshot tool --
 * before anything is deployed.
 *
 * The fixtures are deliberately awkward rather than tidy: a dead day, a
 * single huge spike, a country with no name in the table, a very long page
 * path, a source nobody has a friendly name for. Those are the rows that
 * break a layout; evenly-growing numbers never do.
 */

const PORT = Number(process.argv[2]) || 8787;
const DAY = 86_400_000;

function dayKey(offset: number): string {
  return new Date(Date.now() - offset * DAY).toISOString().slice(0, 10);
}

/** A plausible series: weekly rhythm, gentle drift, one dead day, one spike. */
function shape(days: number, base: number, seed: number): number[] {
  return Array.from({ length: days }, (_, index) => {
    const weekly = 1 + 0.35 * Math.sin((index / 7) * Math.PI * 2 + seed);
    const drift = 1 + index / (days * 2);
    const jitter = 0.75 + (((index * 9301 + seed * 49297) % 233280) / 233280) * 0.5;
    return Math.round(base * weekly * drift * jitter);
  }).map((value, index, all) => (index === Math.floor(days * 0.3) ? 0 : index === all.length - 2 ? value * 4 : value));
}

function fixture(days: number) {
  const hourly = days === 1;
  const buckets = hourly ? 24 : days;
  const views = shape(buckets, hourly ? 4 : 48, 2);
  const visits = views.map((value) => Math.round(value / 2.6));
  const launches = shape(buckets, hourly ? 3 : 41, 5);

  // The Worker returns one row per bucket per kind; "web" rows carry views
  // in `hits` and visits in `visits`, and the app's rows carry launches.
  const daily = [];
  for (let index = 0; index < buckets; index += 1) {
    const offset = buckets - 1 - index;
    const day = hourly
      ? new Date(Date.now() - offset * 3_600_000).toISOString().slice(0, 13).replace("T", " ") + ":00:00"
      : `${dayKey(offset)} 00:00:00`;
    daily.push({ day, kind: "web", hits: views[index], visits: visits[index] });
    daily.push({ day, kind: "/app-version.json", hits: launches[index], visits: 0 });
  }

  const places = [
    { country: "IN", city: "Chennai", region: "Tamil Nadu", kind: "web", hits: 980, visits: 377 },
    { country: "IN", city: "Bengaluru", region: "Karnataka", kind: "web", hits: 412, visits: 160 },
    { country: "IN", city: "Chennai", region: "Tamil Nadu", kind: "/app-version.json", hits: 1043, visits: 0 },
    { country: "US", city: "Edison", region: "New Jersey", kind: "web", hits: 388, visits: 151 },
    { country: "US", city: "Fremont", region: "California", kind: "/app-version.json", hits: 388, visits: 0 },
    { country: "GB", city: "London", region: "England", kind: "web", hits: 96, visits: 44 },
    { country: "AE", city: "Dubai", region: "Dubai", kind: "/app-version.json", hits: 96, visits: 0 },
    { country: "AU", city: "Sydney", region: "New South Wales", kind: "web", hits: 71, visits: 28 },
    { country: "SG", city: "Singapore", region: "", kind: "web", hits: 44, visits: 19 },
    // No name in the table, and an empty city: both must still render.
    { country: "ZZ", city: "", region: "", kind: "web", hits: 12, visits: 6 },
    { country: "XX", city: "", region: "", kind: "/app-version.json", hits: 9, visits: 0 },
  ];

  return {
    days,
    hourly,
    daily,
    places,
    sources: [
      { source: "(direct)", visits: 402 },
      { source: "www.google.com", visits: 151 },
      { source: "com.google.android.googlequicksearchbox", visits: 44 },
      { source: "l.facebook.com", visits: 28 },
      { source: "t.co", visits: 11 },
      { source: "some-aggregator-nobody-has-a-name-for.example.org", visits: 4 },
    ],
    pages: [
      { page: "/", views: 612, entries: 288 },
      { page: "/library/jaya/", views: 288, entries: 94 },
      { page: "/divya-desams/", views: 176, entries: 41 },
      { page: "/library/sri-rama-charithram/the-vanaras-doubt-about-the-bridge/", views: 94, entries: 22 },
      { page: "/settings/", views: 41, entries: 3 },
    ],
    languages: [
      { language: "en", views: 904 },
      { language: "ta", views: 311 },
      { language: "hi", views: 96 },
      { language: "kn", views: 44 },
    ],
    downloads: Array.from({ length: Math.min(days, 30) }, (_, index) => ({
      date: dayKey(Math.min(days, 30) - 1 - index),
      total: 4 + index + (index > 12 ? 3 : 0),
    })),
  };
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/data") {
    const days = Number(url.searchParams.get("days")) || 30;
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(fixture(days)));
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(PAGE);
    return;
  }
  response.writeHead(404).end("Not found");
});

server.listen(PORT, () => {
  console.log(`Dashboard preview (fixture data) on http://localhost:${PORT}/`);
});
