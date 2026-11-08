/*
 * Vedanta Yojana service worker -- gives the website the same Pasuram
 * mechanics as the app (see mobile/services/pasuramLatest.ts):
 *
 *   - Pasuram PDFs a reader opens are kept, so they open offline.
 *   - Online, the newest version is always fetched first.
 *   - Whenever the site comes online (page load, the connection coming
 *     back), kept PDFs are compared against /pasurams/index.json and any
 *     that Prapatti.com has corrected are re-downloaded. At most once a
 *     day, like the app.
 *
 * So that a reader can actually reach a Pasuram offline, pages they
 * visit and the site's static files are kept too. Pages are always
 * fetched fresh when online; the kept copy is only a fallback.
 *
 * Registered by components/shared/ServiceWorkerRegistration.tsx. The
 * PDFs themselves are mirrored from Prapatti.com by
 * scripts/sync-pasuram-mirror.ts (see lib/pasuram-mirror.ts).
 */

const PAGES_CACHE = "vy-pages-v1";
const STATIC_CACHE = "vy-static-v1";
const PASURAM_CACHE = "vy-pasurams-v1";
const META_CACHE = "vy-meta-v1";
const KNOWN_CACHES = [PAGES_CACHE, STATIC_CACHE, PASURAM_CACHE, META_CACHE];

const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const PASURAM_PREFIX = `${SCOPE_PATH}/pasurams/`;
const PASURAM_INDEX = `${PASURAM_PREFIX}index.json`;
const LAST_CHECK_KEY = `${SCOPE_PATH}/__sw/pasuram-last-check`;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const NETWORK_TIMEOUT_MS = 6000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("vy-") && !KNOWN_CACHES.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function offlineResponse() {
  return new Response("You're offline, and this hasn't been saved for offline reading yet.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Online: fresh copy, kept for later. Offline: the kept copy. On a slow
 * connection, the kept copy is shown after a few seconds if there is
 * one (the fresh copy still finishes downloading and is kept for next
 * time); with no kept copy, it simply waits for the network.
 */
async function networkFirst(request, cacheName, cacheKey = request) {
  const cache = await caches.open(cacheName);
  const network = fetch(request).then(async (response) => {
    if (response.ok && response.type === "basic") await cache.put(cacheKey, response.clone());
    return response;
  });
  const keptCopy = () => cache.match(cacheKey, { ignoreSearch: true });

  const slow = new Promise((resolve) => setTimeout(() => resolve("slow"), NETWORK_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, slow]);
    if (first !== "slow") return first;
    const kept = await keptCopy();
    if (kept) {
      network.catch(() => {});
      return kept;
    }
    return await network;
  } catch {
    return (await keptCopy()) || offlineResponse();
  }
}

/** Next.js build files have content hashes in their names, so a kept copy never goes stale. */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

function isPasuramPdf(url) {
  return url.pathname.startsWith(PASURAM_PREFIX) && url.pathname.endsWith(".pdf");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${SCOPE_PATH}/_ping`)) return;

  if (isPasuramPdf(url)) {
    // Keyed without the query string, so one kept copy per Pasuram.
    event.respondWith(networkFirst(request, PASURAM_CACHE, url.pathname));
    return;
  }
  if (url.pathname === PASURAM_INDEX) return; // always live

  if (url.pathname.startsWith(`${SCOPE_PATH}/_next/static/`)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES_CACHE, url.pathname));
    return;
  }
  // Data, images and fonts the pages use: fresh when online, kept for offline.
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Downloads one Pasuram and keeps it. Returns false if it couldn't. */
async function keepPasuram(pathname) {
  try {
    const response = await fetchWithTimeout(new Request(pathname, { cache: "no-store" }), 20000);
    if (!response.ok) return false;
    const cache = await caches.open(PASURAM_CACHE);
    await cache.put(pathname, response);
    return true;
  } catch {
    return false;
  }
}

let checking = null;

/**
 * Re-downloads every kept Pasuram whose bytes no longer match the
 * site's current copy (which the daily deploy refreshes from
 * Prapatti.com). At most once a day once it succeeds; if offline, it
 * simply tries again next time the site comes online.
 */
async function checkForCorrections(force) {
  const meta = await caches.open(META_CACHE);
  if (!force) {
    const last = await meta.match(LAST_CHECK_KEY);
    if (last && Date.now() - Number(await last.text()) < CHECK_INTERVAL_MS) return;
  }

  let index;
  try {
    const response = await fetchWithTimeout(new Request(PASURAM_INDEX, { cache: "no-store" }));
    if (!response.ok) return;
    index = await response.json();
  } catch {
    return; // offline: try again when the connection comes back
  }
  const files = (index && index.files) || {};

  const cache = await caches.open(PASURAM_CACHE);
  for (const request of await cache.keys()) {
    const pathname = new URL(request.url).pathname;
    const relative = pathname.slice(SCOPE_PATH.length);
    const expected = files[relative];
    if (!expected) continue;
    const kept = await cache.match(request);
    const actual = kept ? await sha256Hex(await kept.arrayBuffer()) : null;
    if (actual !== expected) await keepPasuram(pathname);
  }

  await meta.put(LAST_CHECK_KEY, new Response(String(Date.now())));
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "check-pasurams") {
    if (!checking) checking = checkForCorrections(Boolean(data.force)).finally(() => (checking = null));
    event.waitUntil(checking);
  } else if (data.type === "keep-pasuram" && typeof data.path === "string" && data.path.startsWith(PASURAM_PREFIX)) {
    event.waitUntil(keepPasuram(data.path));
  }
});
