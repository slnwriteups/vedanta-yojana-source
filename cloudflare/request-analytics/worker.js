/**
 * Cloudflare Worker: counts requests for the two public manifests the
 * mobile app fetches, tagged by country, and writes them to Workers
 * Analytics Engine.
 *
 * Why this exists at all: the website is a fully static export served by
 * GitHub Pages (next.config.ts, `output: "export"`), so there is no
 * server of this project's own anywhere in the request path and
 * therefore no access log to count anything from. GitHub Pages exposes
 * no per-request analytics to the site owner, and GitHub's release API
 * reports only a running total of APK downloads with no geography and no
 * history.
 *
 * What it measures, and what it deliberately does not: every installed
 * copy of the Android app already fetches
 * https://vedantayojana.org/app-version.json on launch
 * (mobile/services/updateCheckService.ts) and
 * https://vedantayojana.org/content-manifest.json when the Library is
 * opened (mobile/services/libraryCatalogService.ts). Those requests are
 * made today, by the app as already shipped and already described in
 * docs/privacy-policy.html. Counting them at the edge adds no SDK, no
 * identifier, and no new network call -- it observes traffic that
 * already exists. The consequence is that this counts *launches*, not
 * unique devices: distinguishing one device from another would require
 * storing an identifier, which is exactly the tracking this project has
 * publicly committed not to do. Launches per day per country is a
 * proportional signal for active installs, and that is the intended
 * ceiling, not a limitation to be engineered around later.
 *
 * What is recorded per request: the two-letter country Cloudflare
 * resolves at the edge, the path, and the Cloudflare colo. No IP
 * address, no User-Agent, no cookie, no identifier of any kind, and
 * nothing that could be joined back to a person or a device.
 *
 * Deploy: this Worker is bound to a route on the zone rather than a
 * workers.dev URL, so it requires the vedantayojana.org DNS records to
 * be PROXIED (orange cloud) rather than DNS-only. See docs/ANALYTICS.md
 * for the full setup, including the SQL used to read the data back.
 */

/**
 * Paths this Worker is expected to sit in front of. The Worker only
 * ever runs on routes configured in wrangler.toml, so this set is a
 * second, independent guard rather than the primary one: if a route is
 * ever widened by accident (a `vedantayojana.org/*` catch-all, say),
 * the data set still does not silently start collecting the browsing
 * paths of every human visitor to the website. Page views for the
 * website are measured separately and by consent-free aggregate means
 * (the Cloudflare Web Analytics beacon in app/layout.tsx); this Worker
 * is only ever about the app's own two manifest fetches.
 */
const COUNTED_PATHS = new Set(["/app-version.json", "/content-manifest.json"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Fail-open by construction: the recording step is wrapped so that
    // no analytics failure can ever turn into a failed manifest fetch.
    // updateCheckService.checkForUpdate() treats any error as "no
    // update available" and libraryCatalogService degrades to the
    // bundled catalog, so a throw here would silently suppress update
    // prompts for every user -- an unacceptable price for a metric.
    try {
      if (request.method === "GET" && COUNTED_PATHS.has(url.pathname) && env.REQUEST_STATS) {
        env.REQUEST_STATS.writeDataPoint({
          // blob1: country, blob2: path, blob3: edge colo.
          blobs: [request.cf?.country ?? "XX", url.pathname, request.cf?.colo ?? "unknown"],
          // Analytics Engine samples under load; every query must sum
          // _sample_interval rather than count rows (see
          // docs/ANALYTICS.md). double1 is kept at 1 so that
          // SUM(double1 * _sample_interval) reads as a request count.
          doubles: [1],
          // The index is the sampling key -- queries filter by country
          // far more often than by anything else here.
          indexes: [request.cf?.country ?? "XX"],
        });
      }
    } catch {
      // Intentionally swallowed: see above.
    }

    // Pass through to the origin (GitHub Pages) unchanged. Nothing about
    // the response is rewritten -- the manifests' own Cache-Control and
    // CORS headers are what the app already depends on.
    return fetch(request);
  },
};
