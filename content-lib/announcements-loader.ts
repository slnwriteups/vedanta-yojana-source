import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnnouncements, type Announcement } from "./announcements.ts";

/**
 * Build-time (Node) reader for content/announcements.json -- the website's
 * source for the What's New card, the /whats-new/ page and the
 * /announcements.json file the app fetches. Kept apart from
 * content-lib/announcements.ts so that file stays free of node: imports
 * for the app's bundler.
 *
 * Throws on an invalid file rather than showing a partial list: a broken
 * edit should fail the build, not quietly drop an announcement.
 */
export const ANNOUNCEMENTS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content/announcements.json");

export function loadAnnouncements(): Announcement[] {
  const parsed = parseAnnouncements(JSON.parse(fs.readFileSync(ANNOUNCEMENTS_FILE, "utf8")));
  if (!parsed) throw new Error(`${ANNOUNCEMENTS_FILE} is not a valid announcements file -- see content-lib/announcements.ts`);
  return parsed;
}
