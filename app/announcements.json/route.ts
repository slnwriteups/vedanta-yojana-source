import { loadAnnouncements } from "@/content-lib/announcements-loader.ts";

/**
 * Publishes the announcements as https://vedantayojana.org/announcements.json
 * -- the copy installed apps fetch (mobile/services/announcementsService.ts),
 * so a new announcement reaches them on the next deploy, without an app
 * update. Emitted once at build time, like robots.txt and the sitemap.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({ announcements: loadAnnouncements() });
}
