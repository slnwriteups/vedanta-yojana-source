import { File, Paths } from "expo-file-system";
import { loadBooks, loadChapters } from "../content-lib/loader.ts";
import { ContentManifestSchema, type ContentManifest } from "../../content-lib/content-manifest.ts";
import { booksNeedingResync, mergeCatalog, type CatalogEntry } from "./libraryCatalogCore.ts";
import { downloadBook, getLocalBookContentHash, isBookAvailable } from "./bookOfflineService.ts";

/**
 * The real adapter for the Library's content-update architecture (see
 * libraryCatalogCore.ts's doc comment for the full design) -- the one
 * place in mobile/ allowed to touch fetch/expo-file-system for this
 * feature, matching updateCheckService.ts's and bookOfflineService.ts's
 * own placement in services/ for the identical reason (mobile/tests/
 * offline.test.ts only scans app/, components/, content-lib/).
 *
 * Same GitHub Pages deploy bookOfflineService.ts's PAGES_BASE_URL
 * already points at -- content-manifest.json is published alongside
 * app-version.json and every books/<slug>.json payload by the existing,
 * unmodified .github/workflows/deploy-pages.yml (see
 * scripts/build-content-manifest.ts, wired into `prebuild`).
 */

const CONTENT_MANIFEST_URL = "https://slnwriteups.github.io/vedanta-yojana/content-manifest.json";
const FETCH_TIMEOUT_MS = 8000;

function cachedManifestFile(): File {
  return new File(Paths.document, "content-manifest.json");
}

/**
 * The last successfully-fetched, schema-valid manifest, or null if none
 * has ever been cached (a fresh install with no connectivity yet) or the
 * cached copy fails to parse (e.g. a future contentManifestVersion this
 * build's bundled Zod schema doesn't understand -- see
 * content-lib/content-manifest.ts's own doc comment on why that's a
 * `z.literal`, not a range check). Synchronous and local-only -- safe to
 * call from any render.
 */
function getCachedManifest(): ContentManifest | null {
  const file = cachedManifestFile();
  if (!file.exists) return null;
  try {
    const parsed: unknown = JSON.parse(file.textSync());
    const result = ContentManifestSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Fetches content-manifest.json fresh from the network. Returns null --
 * never throws -- if unreachable, timed out, or fails schema validation;
 * the caller (syncLibraryCatalog()) treats that identically to "nothing
 * changed", leaving whatever was already cached/bundled completely
 * untouched. Mirrors updateCheckService.ts's checkForUpdate() almost
 * exactly, down to the timeout value.
 */
async function fetchRemoteManifest(): Promise<ContentManifest | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(CONTENT_MANIFEST_URL, { signal: controller.signal });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const result = ContentManifestSchema.safeParse(data);
    return result.success ? result.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The unified catalog the Library screens render: every bundled book,
 * with the remote manifest's data substituted in wherever it's known
 * (see mergeCatalog()) -- reading only the LOCALLY CACHED manifest, so
 * this never makes a network request and works fully offline, including
 * on a device that has synced at least once before going offline again.
 */
export function getLibraryCatalog(): CatalogEntry[] {
  const bundled = loadBooks().map((book) => ({ book, chapters: loadChapters(book.slug) }));
  return mergeCatalog(bundled, getCachedManifest());
}

/** A single catalog entry by slug, or null if no book (bundled or remote) uses that slug. */
export function getLibraryCatalogEntry(slug: string): CatalogEntry | null {
  return getLibraryCatalog().find((entry) => entry.book.slug === slug) ?? null;
}

/**
 * Fire-and-forget catalog sync: fetches the remote manifest, caches it
 * locally if valid (so getLibraryCatalog() reflects it -- and continues
 * to, offline, until the next successful sync), then silently
 * re-downloads any ALREADY-DOWNLOADED book whose content has changed
 * upstream. Never auto-downloads a book the person hasn't already opted
 * into -- see libraryCatalogCore.ts's booksNeedingResync() doc comment
 * for why that split is the deliberate "least intrusive sensible
 * behavior" this architecture settled on. Safe to call repeatedly (e.g.
 * every time the Library tab is opened); a call that finds nothing
 * stale does very little work beyond the one manifest fetch.
 */
export async function syncLibraryCatalog(): Promise<void> {
  const remote = await fetchRemoteManifest();
  if (!remote) return;

  cachedManifestFile().write(JSON.stringify(remote));

  const catalog = getLibraryCatalog();
  const stale = booksNeedingResync(catalog, isBookAvailable, getLocalBookContentHash);
  for (const entry of stale) {
    await downloadBook(entry.book.slug);
  }
}
