import { useEffect, useState } from "react";
import { Platform } from "react-native";
import bundledAnnouncements from "../../content/announcements.json";
import {
  ANNOUNCEMENTS_URL,
  announcementsForApp,
  parseAnnouncements,
  preferredAnnouncements,
  type Announcement,
} from "../../content-lib/announcements.ts";
import { readJSON, writeJSON } from "../storage";

/**
 * The app's What's New list (content-lib/announcements.ts has the design).
 *
 * Three copies, best first: the live list on the website, fetched once per
 * launch, so an announcement reaches installed apps as soon as the site
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

/** One fetch per app launch, shared by Home and the What's New screen. */
let liveRequest: Promise<Announcement[] | null> | null = null;
function fetchLiveOnce(): Promise<Announcement[] | null> {
  liveRequest ??= fetchLive();
  return liveRequest;
}

async function fetchLive(): Promise<Announcement[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(ANNOUNCEMENTS_URL, { signal: controller.signal });
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
    (async () => {
      const cached = parseAnnouncements(await readJSON(CACHE_KEY, isCachedList));
      if (!cancelled) setAnnouncements(preferredAnnouncements(cached, BUNDLED));
      const live = await fetchLiveOnce();
      if (!cancelled) setAnnouncements(preferredAnnouncements(live, cached, BUNDLED));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Entries limited to the other operating system (appPlatforms) are left out.
  return announcementsForApp(announcements, Platform.OS);
}
