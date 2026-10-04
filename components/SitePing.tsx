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
 * How far down the page the reader has been, as a percentage, counting
 * the bottom of the viewport. A page shorter than the window counts as
 * fully read, because there was nothing further to reach.
 */
function readDepth(): number {
  const doc = document.documentElement;
  const height = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
  if (height <= window.innerHeight) return 100;
  return Math.min(100, ((window.scrollY + window.innerHeight) / height) * 100);
}

/** Quartiles, so the figure is "how far", never a cursor trail. */
function depthBucket(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent / 25) * 25));
}

/**
 * Reports what is read, as totals across all readers.
 *
 * Two kinds of ping, both without any identifier and both reading and
 * storing nothing on the device:
 *
 *   A page view, once per route, including the client-side navigations
 *   the static export performs without a full page load. It sends the
 *   path (`p=`, never the query string, so nothing typed into search
 *   leaves the browser), `l=` the language being read in, `v=1` plus
 *   `s=` the referring site for a view that began a visit, and `f=` the
 *   path of the page moved here FROM when that page was on this site.
 *
 *   A read-depth ping when the reader leaves a page (`t=d`), carrying
 *   the furthest quarter of that page they reached. It is deliberately a
 *   separate kind of row, so it cannot inflate the page-view count.
 *
 * `f=` is what makes "readers who opened this chapter opened that one
 * next" answerable. It is a pair of pages, never a trail: each row knows
 * one hop and nothing about the hop before it, there is no identifier to
 * join rows by, and the dashboard discards any pair seen fewer than five
 * times so a single unusual route cannot be picked out.
 */
export function SitePing() {
  const pathname = usePathname();
  const { language, ready } = useLanguage();
  const first = useRef(true);
  const reported = useRef<string | null>(null);
  /** The page the next view will be reported as coming from. */
  const previous = useRef<string>("");
  /** Furthest point reached on the page currently open, and that page. */
  const depth = useRef(0);
  const depthPage = useRef<string>("");
  const depthSent = useRef(false);

  // Read depth for the page being left. Flushed on navigation and when
  // the tab is hidden, which is the last moment a beacon is reliable --
  // `unload` is not, and `visibilitychange` is what fires when a phone
  // reader switches apps or locks the screen.
  useEffect(() => {
    if (location.hostname !== PRODUCTION_HOST) return;

    const sendDepth = () => {
      if (depthSent.current || !depthPage.current) return;
      depthSent.current = true;
      try {
        const bucket = depthBucket(Math.max(depth.current, readDepth()));
        navigator.sendBeacon?.(
          `${PING_PATH}?t=d&p=${encodeURIComponent(depthPage.current)}&d=${bucket}`,
        );
      } catch {
        // Measurement must never be able to break the page it measures.
      }
    };

    const onScroll = () => {
      depth.current = Math.max(depth.current, readDepth());
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") sendDepth();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", sendDepth);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", sendDepth);
      // Leaving this route: report how far this page was read before the
      // next one replaces it.
      sendDepth();
    };
  }, [pathname]);

  useEffect(() => {
    if (location.hostname !== PRODUCTION_HOST) return;
    // Wait for the saved language to load, so the first page of a visit
    // is not reported as English by default; then report each route
    // once (switching language mid-page is not a new page view).
    if (!ready || reported.current === pathname) return;
    reported.current = pathname;
    const visit = first.current && startsVisit();
    const from = first.current ? "" : previous.current;
    first.current = false;
    previous.current = pathname;
    depth.current = 0;
    depthPage.current = pathname;
    depthSent.current = false;
    try {
      const query = visit ? `v=1&s=${encodeURIComponent(sourceHost())}` : "v=0";
      const page = `&p=${encodeURIComponent(pathname)}&l=${language ?? "en"}`;
      const hop = from ? `&f=${encodeURIComponent(from)}` : "";
      navigator.sendBeacon?.(`${PING_PATH}?${query}${page}${hop}`);
    } catch {
      // Measurement must never be able to break the page it measures.
    }
    // `language` is read, not a dependency: a change of language alone
    // must not count as another view.
  }, [pathname, ready]);

  return null;
}
