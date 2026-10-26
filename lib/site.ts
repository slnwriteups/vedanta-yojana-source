/**
 * Site-wide, non-content configuration -- Phase 5N. Deliberately separate
 * from content-lib/** (the migrated-content type/access layer): this is
 * application infrastructure (name, description, deployment origin), not
 * anything derived from a content record.
 */

export const SITE_NAME = "Vedanta Yojana";

export const SITE_DESCRIPTION =
  "The 108 Divya Desams with sthala puranam and Azhwar pasurams, a library of Sanātana Dharma books, and a daily Panchangam. Free on web and Android.";

/**
 * The home page's own <title>. Longer and more descriptive than the bare
 * SITE_NAME every other page's title template ends with, since it is
 * what a search result for the site itself shows.
 */
export const SITE_HOME_TITLE = `${SITE_NAME} — 108 Divya Desams, Sacred Texts & Daily Panchangam`;

/** The project's own public profiles, for structured data's `sameAs`. */
export const SITE_PROFILES = [
  "https://www.instagram.com/vedantayojana/",
  "https://github.com/slnwriteups/vedanta-yojana-releases",
];

/**
 * The sub-path the site is served under, mirroring next.config.ts's
 * `basePath` (which exports it as NEXT_PUBLIC_BASE_PATH). Empty string
 * under plain `node --test`, where Next.js has not injected it, and
 * empty for a root-served deployment such as a custom domain.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * The deployment origin, scheme and host only -- e.g. for a GitHub Pages
 * project site, "https://slnwriteups.github.io" without the repository
 * sub-path. Returns undefined rather than fabricating a domain when
 * NEXT_PUBLIC_SITE_URL is unset; callers MUST handle that case
 * explicitly (a relative URL, or an omitted field).
 */
export function getSiteOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/**
 * Turns a root-relative application path into the URL it is actually
 * reachable at, which is NOT the same string once the site is served
 * from a sub-path.
 *
 * Returns an absolute URL when an origin is configured, and a
 * basePath-prefixed relative one otherwise. Both include BASE_PATH --
 * that is the entire point: /divya-desams/sri-rangam is a 404 on a
 * project-page deployment, where the real URL is
 * /vedanta-yojana/divya-desams/sri-rangam.
 *
 * Concatenated rather than built with `new URL(path, base)`, because an
 * absolute-path argument ("/x") discards the base's own path segment --
 * which is exactly the bug this function exists to prevent. Callers pass
 * an already-absolute result straight through to Next.js metadata, so
 * `metadataBase` never gets the chance to re-resolve (and re-break) it.
 */
export function siteUrl(path: string): string {
  return `${getSiteOrigin() ?? ""}${BASE_PATH}${path}`;
}
