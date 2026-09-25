"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * The only host that reports. `next dev`, preview builds, forks and the
 * test suite all run elsewhere and must never count into this site's
 * numbers -- and outside this host there is no Worker at PING_PATH to
 * answer anyway.
 */
const PRODUCTION_HOST = "vedantayojana.org";

/** Answered by cloudflare/request-analytics/worker.js; see docs/ANALYTICS.md. */
const PING_PATH = "/_ping";

/**
 * Whether this page load began a visit: the reader arrived from another
 * site (a search engine, a shared link) or with no referrer at all (a
 * typed address, a bookmark) -- but not a reload of a page already open.
 * This is the same cookieless definition Cloudflare Web Analytics uses;
 * a true "session" count would need a cookie, which this site does not
 * set.
 */
function startsVisit(): boolean {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "reload") return false;
  if (!document.referrer) return true;
  try {
    return new URL(document.referrer).host !== location.host;
  } catch {
    return true;
  }
}

/**
 * Counts one page view per route, including client-side navigations the
 * static export performs without a full page load. It sends nothing but
 * `v=1` (this view began a visit) or `v=0`: no path, no title, no
 * identifier, and it reads and stores nothing on the device. Country and
 * approximate city are resolved by Cloudflare at the edge, not here.
 */
export function SitePing() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (location.hostname !== PRODUCTION_HOST) return;
    const visit = first.current && startsVisit();
    first.current = false;
    try {
      navigator.sendBeacon?.(`${PING_PATH}?v=${visit ? 1 : 0}`);
    } catch {
      // Measurement must never be able to break the page it measures.
    }
  }, [pathname]);

  return null;
}
