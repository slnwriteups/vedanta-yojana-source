"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";

/**
 * The only host that reports. `next dev`, preview builds, forks and the
 * test suite all run elsewhere and must never count into this site's
 * numbers -- and outside this host there is no Worker at PING_PATH to
 * answer anyway.
 */
const PRODUCTION_HOST = "vedantayojana.org";

/** Answered by cloudflare/request-analytics/worker.js itself, never forwarded to the origin. */
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
 * The referring site's host name for a visit -- "google.com", never the
 * full address it linked from -- or "" when there is none (a typed
 * address, a bookmark, or an app such as WhatsApp that withholds it).
 */
function sourceHost(): string {
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return "";
  }
}

/**
 * Counts one page view per route, including client-side navigations the
 * static export performs without a full page load. It sends the page's
 * path (`p=`, never its query string, so nothing typed into search is
 * sent) and `v=0`, or for a view that began a visit `v=1` plus `s=`, the
 * referring site's host name, and `l=`, the language the site is being
 * read in ("en" for the English default). No title, no identifier, and it reads and
 * stores nothing on the device, so page counts are totals per page, never
 * one reader's path through the site. Country and approximate city are
 * resolved by Cloudflare at the edge, not here.
 */
export function SitePing() {
  const pathname = usePathname();
  const { language, ready } = useLanguage();
  const first = useRef(true);
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (location.hostname !== PRODUCTION_HOST) return;
    // Wait for the saved language to load, so the first page of a visit
    // is not reported as English by default; then report each route
    // once (switching language mid-page is not a new page view).
    if (!ready || reported.current === pathname) return;
    reported.current = pathname;
    const visit = first.current && startsVisit();
    first.current = false;
    try {
      const query = visit ? `v=1&s=${encodeURIComponent(sourceHost())}` : "v=0";
      const page = `&p=${encodeURIComponent(pathname)}&l=${language ?? "en"}`;
      navigator.sendBeacon?.(`${PING_PATH}?${query}${page}`);
    } catch {
      // Measurement must never be able to break the page it measures.
    }
    // `language` is read, not a dependency: a change of language alone
    // must not count as another view.
  }, [pathname, ready]);

  return null;
}
