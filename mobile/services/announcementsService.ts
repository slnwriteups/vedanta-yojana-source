import { useEffect, useState } from "react";
import { AppState } from "react-native";
import bundledAnnouncements from "../../content/announcements.json";
import {
  ANNOUNCEMENTS_URL,
  parseAnnouncements,
  preferredAnnouncements,
  type Announcement,
} from "../../content-lib/announcements.ts";
import { readJSON, writeJSON } from "../storage";

/**
 * The app's What's New list (content-lib/announcements.ts has the design).
 *
 * Three copies, best first: the live list on the website, refreshed on
 * launch and foreground, so an announcement reaches installed apps after the site
 * deploys; the last successful fetch, cached for offline launches; and
 * content/announcements.json bundled into the app itself, so the list is
 * never empty, even offline on first launch. preferredAnnouncements()
 * chooses between them.
 *
 * Same request pattern, and the same never-throws contract, as
 * updateCheckService.ts's app-version.json check; covered by the same
 * line of the privacy policy.
 */

const CACHE_KEY = "vy.announcements.cache";
const FETCH_TIMEOUT_MS = 8000;

const BUNDLED = parseAnnouncements(bundledAnnouncements);

function isCachedList(value: unknown): value is { announcements: unknown[] } {
  return parseAnnouncements(value) !== null;
}

/** Share in-flight requests; allow a fresh request on the next foreground. */
let liveRequest: Promise<Announcement[] | null> | null = null;
function fetchLiveOnce(): Promise<Announcement[] | null> {
  liveRequest ??= fetchLive().finally(() => { liveRequest = null; });
  return liveRequest;
}

async function fetchLive(): Promise<Announcement[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // GitHub Pages serves this file with max-age=600. A unique URL also
    // avoids native URL caches that may retain the old response across launches.
    const response = await fetch(`${ANNOUNCEMENTS_URL}?refresh=${Date.now()}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const parsed = parseAnnouncements(data);
    if (parsed) void writeJSON(CACHE_KEY, data);
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Newest first. Starts as the bundled list, then upgrades to the cached and live copies as they arrive. */
export function useAnnouncements(): Announcement[] {
  const [announcements, setAnnouncements] = useState<Announcement[]>(BUNDLED ?? []);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const cached = parseAnnouncements(await readJSON(CACHE_KEY, isCachedList));
      if (!cancelled) setAnnouncements(current => preferredAnnouncements(current, cached, BUNDLED));
      const live = await fetchLiveOnce();
      if (!cancelled) setAnnouncements(current => preferredAnnouncements(live, current, cached, BUNDLED));
    }
    void refresh();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void refresh();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
  return announcements;
}

