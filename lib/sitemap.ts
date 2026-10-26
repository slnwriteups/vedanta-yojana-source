import type { MetadataRoute } from "next";
import { loadBooks, loadChapters, loadDivyaDesams, loadKnowledge } from "../content-lib/loader/index.ts";
import { siteUrl } from "./site.ts";

/**
 * Phase 5N -- sitemap built from the real content loader, not a
 * separately maintained list. Includes only genuinely publicly routable
 * pages:
 *   - the fixed set of static application routes
 *   - all 107 normal Divya Desam records, plus the "introduction" page
 *     (still the same Knowledge-schema record, loaded the same way --
 *     only its URL moved from /knowledge/introduction to
 *     /divya-desams/introduction, see app/divya-desams/introduction/
 *     page.tsx)
 *   - the 1 Book + all of its 55 Chapters (via loadChapters, so the
 *     count always matches whatever the loader actually returns)
 *
 * Deliberately excluded, structurally rather than by a denylist:
 *   - Page150 (the held-back record) -- it has no slug and is never
 *     returned by loadDivyaDesams(), so there is no code path that
 *     could include it
 *   - Page112/Page115/Page116 (known source gaps) and the nonexistent
 *     Page117 -- none of these were ever migrated into a real record,
 *     so none can appear here either
 *   - arbitrary /search?q=... URLs -- only the bare /search route is
 *     listed, matching its own noindex-on-query metadata policy
 *
 * No production origin has been established for this project (see
 * lib/site.ts) -- entries are absolute URLs when NEXT_PUBLIC_SITE_URL is
 * configured, and root-relative paths otherwise. A sitemap with
 * root-relative <loc> values does not strictly conform to the
 * sitemaps.org protocol (which expects absolute URLs), but this is the
 * only choice that doesn't fabricate a production domain; it becomes
 * fully conformant automatically once a real origin is configured, with
 * no further code changes.
 *
 * Uses RELATIVE imports (not the "@/" alias) so this module can be
 * imported directly by `node --test` -- the same reason
 * content-lib/search/*.ts does the same. app/sitemap.ts (the actual
 * Next.js convention file) is a thin wrapper around this.
 */

const STATIC_ROUTES = ["/", "/about", "/divya-desams", "/library", "/search", "/whats-new"];

/** Mirrors the same source-page-derived ordering already used by the Divya Desam index page (app/divya-desams/page.tsx), applied here only for deterministic sitemap ordering. */
function sourcePageNumber(sourcePageId: string): number {
  const match = sourcePageId.match(/^page\.Page(\d+)$/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function buildSitemapEntries(): MetadataRoute.Sitemap {
  // siteUrl() applies both the deployment origin (when configured) and
  // the basePath the site is served under -- without the latter every
  // <loc> would point at a 404 on a project-page deployment.
  //
  // The trailing slash matches next.config.ts's `trailingSlash: true`:
  // it is the form every page is actually served at and the form its
  // own <link rel="canonical"> uses. Without it, every <loc> 301-
  // redirects and disagrees with the page's canonical, which Search
  // Console reports as "Page with redirect" and leaves unindexed.
  const toUrl = (path: string) => siteUrl(path.endsWith("/") ? path : `${path}/`);

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({ url: toUrl(path) }));

  const divyaDesams = [...loadDivyaDesams()].sort(
    (a, b) => sourcePageNumber(a.migration.sourcePageId) - sourcePageNumber(b.migration.sourcePageId)
  );
  for (const record of divyaDesams) {
    entries.push({ url: toUrl(`/divya-desams/${record.slug}`) });
  }

  for (const book of loadBooks()) {
    entries.push({ url: toUrl(`/library/${book.slug}`) });
    for (const chapter of loadChapters(book.slug)) {
      entries.push({ url: toUrl(`/library/${book.slug}/${chapter.slug}`) });
    }
  }

  for (const record of loadKnowledge()) {
    entries.push({ url: toUrl(`/divya-desams/${record.slug}`) });
  }

  return entries;
}
