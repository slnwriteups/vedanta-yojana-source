import { Platform } from "react-native";

/**
 * Reports which screens are opened in the app, which screen is opened
 * next, and how far a chapter is read -- as totals across all readers,
 * to the same Worker the website reports to
 * (cloudflare/request-analytics/worker.js).
 *
 * Why the app reports at all: until now it measured nothing, so the
 * Library could be read by every user of the Android app without a
 * single signal about which books or chapters were worth writing more
 * of. The website has answered that since the page beacon landed; this
 * closes the same gap for the app, using the same endpoint, the same
 * row shape and the same rules.
 *
 * What it sends: the screen's route, the route before it, the content
 * language, and for a chapter the furthest quarter reached. What it
 * never sends: any identifier, anything typed, anything read from the
 * device. Nothing is stored locally for this, so two openings of the
 * app cannot be joined, and the route pair is one hop -- the row knows
 * the screen before this one and nothing earlier.
 *
 * Android only, deliberately. iOS is being prepared for the App Store
 * separately and is out of scope here, exactly as the update check is
 * (updateCheckService.ts), so an iOS build reports nothing at all and
 * its privacy declaration is unaffected.
 */

const PING_URL = "https://vedantayojana.org/_ping";
const TIMEOUT_MS = 4000;

/** Reporting is a side effect of reading, and must never delay or break it. */
function send(query: string): void {
  if (Platform.OS !== "android") return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    // The Worker answers 204 and the answer is ignored; this is
    // fire-and-forget, never awaited by a screen.
    void fetch(`${PING_URL}?${query}`, { method: "POST", signal: controller.signal })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  } catch {
    // A lost count is never worth an error in front of a reader.
  }
}

/**
 * The route as the website would name the same content, so app and
 * website rows line up when counted: the router's group segments
 * ("(tabs)") are not content and are dropped, and a trailing slash is
 * removed. Anything that is not a plain route is reported as "(other)"
 * rather than sent as-is.
 */
export function screenPath(pathname: string): string {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return "";
  const cleaned = pathname
    .split("/")
    .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment))
    .join("/");
  const path = cleaned ? `/${cleaned}` : "/";
  return /^\/[\p{L}\p{M}\p{N}\/_.~%-]{0,200}$/u.test(path) ? path : "(other)";
}

/** Quartiles, so the figure is "how far", never a scroll trail. */
export function depthBucket(fraction: number): number {
  const percent = (Number.isFinite(fraction) ? fraction : 0) * 100;
  return Math.min(100, Math.max(0, Math.round(percent / 25) * 25));
}

/**
 * One screen opened, and the screen it was opened from.
 *
 * `language` is nullable because LanguageProvider loads the saved choice
 * from storage asynchronously, so the very first screen of a cold start
 * can be reported before it resolves; that case is recorded as the
 * site's default rather than dropped.
 */
export function reportScreen(pathname: string, from: string, language: string | null): void {
  const path = screenPath(pathname);
  if (!path) return;
  const hop = from ? `&f=${encodeURIComponent(screenPath(from))}` : "";
  const code = language && /^[a-z]{2,3}$/.test(language) ? language : "en";
  send(`t=app&p=${encodeURIComponent(path)}&l=${code}${hop}`);
}

/** How far a chapter was read, reported when the reader leaves it. */
export function reportDepth(pathname: string, fraction: number): void {
  const path = screenPath(pathname);
  if (!path) return;
  send(`t=ad&p=${encodeURIComponent(path)}&d=${depthBucket(fraction)}`);
}
