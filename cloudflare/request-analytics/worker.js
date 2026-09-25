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
 * What is recorded per request: the two-letter country, approximate
 * city and region Cloudflare resolves at the edge, the path, and the
 * Cloudflare colo. No IP address, no User-Agent, no cookie, no
 * identifier of any kind, and nothing that could be joined back to a
 * person or a device.
 *
 * It also answers the website's page-view ping (PING_PATH below), which
 * records the same geography plus whether the view began a visit -- and
 * nothing about which page was viewed.
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

/**
 * The website's own page-view ping (components/SitePing.tsx). Unlike the
 * manifests above, nothing lives at this path on GitHub Pages: the
 * Worker answers it itself and never forwards it to the origin.
 *
 * The page sends no path, no title and no identifier -- only `?v=1` when
 * the page load is a *visit* (the reader arrived from another site, a
 * search engine, a shared link, or typed the address) and `?v=0` for a
 * further page within the same visit. That is the same cookieless
 * definition of a visit Cloudflare Web Analytics uses, and it is what
 * stands in for a "session" here: counting true sessions would require
 * a cookie or a stored identifier, which this project does not use.
 */
const PING_PATH = "/_ping";

/**
 * The geography recorded for every data point: country, then the
 * approximate city and region Cloudflare derives from the connection at
 * the edge. City-level geolocation is coarse (it names the nearest
 * large place the network is registered to, often the ISP's city), so
 * it is a "where is traction coming from" signal, not a location.
 */
function geography(request) {
  const cf = request.cf ?? {};
  return {
    country: cf.country ?? "XX",
    colo: cf.colo ?? "unknown",
    city: cf.city ?? "",
    region: cf.region ?? "",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === PING_PATH) {
      try {
        if (request.method === "POST" && env.REQUEST_STATS) {
          const geo = geography(request);
          env.REQUEST_STATS.writeDataPoint({
            // Same blob layout as the manifest counts, with "web" in the
            // path slot so every existing per-path query is unaffected.
            blobs: [geo.country, "web", geo.colo, geo.city, geo.region],
            // double1: one page view. double2: 1 when that view began a
            // visit, so SUM(double2 * _sample_interval) counts visits.
            doubles: [1, url.searchParams.get("v") === "1" ? 1 : 0],
            indexes: [geo.country],
          });
        }
      } catch {
        // A lost page view is not worth an error in the reader's console.
      }
      // 204 whatever happened: the page ignores the answer, and there is
      // nothing on the origin to forward to.
      return new Response(null, { status: 204 });
    }

    // Fail-open by construction: the recording step is wrapped so that
    // no analytics failure can ever turn into a failed manifest fetch.
    // updateCheckService.checkForUpdate() treats any error as "no
    // update available" and libraryCatalogService degrades to the
    // bundled catalog, so a throw here would silently suppress update
    // prompts for every user -- an unacceptable price for a metric.
    try {
      if (request.method === "GET" && COUNTED_PATHS.has(url.pathname) && env.REQUEST_STATS) {
        const geo = geography(request);
        env.REQUEST_STATS.writeDataPoint({
          // blob1: country, blob2: path, blob3: edge colo, blob4: city,
          // blob5: region. City and region were appended after the first
          // deploy, so older rows read as empty strings there.
          blobs: [geo.country, url.pathname, geo.colo, geo.city, geo.region],
          // Analytics Engine samples under load; every query must sum
          // _sample_interval rather than count rows (see
          // docs/ANALYTICS.md). double1 is kept at 1 so that
          // SUM(double1 * _sample_interval) reads as a request count.
          doubles: [1],
          // The index is the sampling key -- queries filter by country
          // far more often than by anything else here.
          indexes: [geo.country],
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
