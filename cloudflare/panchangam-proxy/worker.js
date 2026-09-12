/**
 * Cloudflare Worker: a minimal CORS-adding proxy for the two Sri Ahobila
 * Mutt Panchangam RPC hosts the web app calls (see
 * lib/panchangam-service.ts). Those endpoints send no CORS headers at
 * all, so a browser blocks the response outright; the mobile app's
 * React Native `fetch` isn't subject to browser CORS, so it calls them
 * directly and needs no proxy. This Worker exists only for the static
 * web build, which has no server of its own to make the request from.
 *
 * Deliberately NOT an open proxy: only these two exact hostnames are
 * ever forwarded to, regardless of what `url` a caller passes -- so a
 * public, unauthenticated Worker URL can't be abused to fetch arbitrary
 * third-party sites through this origin.
 *
 * Deploy: Cloudflare dashboard -> Workers & Pages -> Create -> "Create
 * Worker" -> replace the default code with this file's contents ->
 * Deploy. No wrangler CLI or config needed for this single-file form.
 * Then give the resulting https://<name>.<subdomain>.workers.dev URL to
 * lib/panchangam-service.ts's PANCHANGAM_PROXY_BASE_URL.
 */

const ALLOWED_HOSTS = new Set([
  "samdailycal-324121.uc.r.appspot.com",
  "samekadasi-324123.uc.r.appspot.com",
]);

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const target = requestUrl.searchParams.get("url");

    if (!target) {
      return new Response("Missing url parameter", { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("Invalid url parameter", { status: 400 });
    }

    if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
      return new Response("Host not allowed", { status: 403 });
    }

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString());
    } catch {
      return new Response("Upstream fetch failed", { status: 502 });
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  },
};
