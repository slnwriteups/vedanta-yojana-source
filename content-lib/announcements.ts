/**
 * "What's New" announcements -- the reader-facing list of new content and
 * features, shown on both the website (Home card + /whats-new/) and the
 * mobile app (Home card + whats-new screen).
 *
 * content/announcements.json is the single source. Only changes a reader
 * would notice belong there -- new books, translations, features -- never
 * fixes, refactors or other behind-the-scenes work. Every entry is
 * approved by the site owner before it is added (see CLAUDE.md).
 *
 * The website reads the file at build time. The app bundles the same file
 * (so the list is there offline, on first launch) and also fetches the
 * deployed copy, https://vedantayojana.org/announcements.json
 * (app/announcements.json/route.ts), so a new announcement reaches
 * installed apps as soon as the site deploys, with no app update.
 *
 * Plain TypeScript with no dependencies and no imports, so the website,
 * the app (Metro) and `node --test` can all use it. The remote copy is
 * untrusted input, which is why parseAnnouncements validates every field
 * rather than casting.
 */

export type AnnouncementPlatform = "app" | "website";
export type AnnouncementMobilePlatform = "ios" | "android";
export type AnnouncementLanguage = "ta" | "kn" | "hi" | "te";

export interface AnnouncementLink {
  /** A site path ("/library") -- the same route exists in the app -- or a full https:// URL. */
  href: string;
  label: string;
}

export interface AnnouncementTranslation {
  title?: string;
  body?: string;
  linkLabel?: string;
}

export interface Announcement {
  /** Stable and unique; by convention "<date>-<short-slug>". */
  id: string;
  /** YYYY-MM-DD, the day the change reached readers. */
  date: string;
  /** Where the change applies, shown as small tags. */
  platforms: AnnouncementPlatform[];
  /** Omitted means both iOS and Android; applies only to the app. */
  mobilePlatforms?: AnnouncementMobilePlatform[];
  title: string;
  body: string;
  link?: AnnouncementLink;
  translations?: Partial<Record<AnnouncementLanguage, AnnouncementTranslation>>;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLATFORMS: readonly string[] = ["app", "website"];
const LANGUAGES: readonly string[] = ["ta", "kn", "hi", "te"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLink(value: unknown): AnnouncementLink | null {
  if (!isRecord(value) || !isNonEmptyString(value.href) || !isNonEmptyString(value.label)) return null;
  // Only site paths and https URLs -- never javascript:, data: or similar.
  if (!value.href.startsWith("/") && !value.href.startsWith("https://")) return null;
  return { href: value.href, label: value.label };
}

function parseTranslations(value: unknown): Announcement["translations"] | null {
  if (!isRecord(value)) return null;
  const result: NonNullable<Announcement["translations"]> = {};
  for (const [language, raw] of Object.entries(value)) {
    if (!LANGUAGES.includes(language) || !isRecord(raw)) return null;
    const translation: AnnouncementTranslation = {};
    for (const field of ["title", "body", "linkLabel"] as const) {
      if (raw[field] === undefined) continue;
      if (!isNonEmptyString(raw[field])) return null;
      translation[field] = raw[field];
    }
    result[language as AnnouncementLanguage] = translation;
  }
  return result;
}

function parseAnnouncement(value: unknown): Announcement | null {
  if (!isRecord(value)) return null;
  const { id, date, platforms, mobilePlatforms, title, body, link, translations } = value;
  if (!isNonEmptyString(id) || !isNonEmptyString(title) || !isNonEmptyString(body)) return null;
  if (typeof date !== "string" || !DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  if (!Array.isArray(platforms) || platforms.length === 0 || !platforms.every((p) => PLATFORMS.includes(p))) return null;
  if (mobilePlatforms !== undefined && (!Array.isArray(mobilePlatforms) || mobilePlatforms.length === 0 || !mobilePlatforms.every((p) => p === "ios" || p === "android"))) return null;

  const parsedLink = link === undefined ? undefined : parseLink(link);
  if (parsedLink === null) return null;
  const parsedTranslations = translations === undefined ? undefined : parseTranslations(translations);
  if (parsedTranslations === null) return null;

  return {
    id,
    date,
    platforms: platforms as AnnouncementPlatform[],
    ...(mobilePlatforms ? { mobilePlatforms: mobilePlatforms as AnnouncementMobilePlatform[] } : {}),
    title,
    body,
    ...(parsedLink ? { link: parsedLink } : {}),
    ...(parsedTranslations ? { translations: parsedTranslations } : {}),
  };
}

/**
 * Validates an announcements document (`{ "announcements": [...] }`) and
 * returns its entries newest first. Returns null if ANY entry is invalid
 * or two share an id -- all or nothing, so a half-broken remote file is
 * ignored rather than partly shown, and a bad edit to the source file
 * fails the build (tests/content/announcements.test.ts) instead of
 * silently dropping an entry.
 */
export function parseAnnouncements(data: unknown): Announcement[] | null {
  if (!isRecord(data) || !Array.isArray(data.announcements)) return null;
  const parsed: Announcement[] = [];
  const ids = new Set<string>();
  for (const raw of data.announcements) {
    const announcement = parseAnnouncement(raw);
    if (!announcement || ids.has(announcement.id)) return null;
    ids.add(announcement.id);
    parsed.push(announcement);
  }
  // Newest first; same-day entries keep the file's order.
  return parsed
    .map((announcement, index) => ({ announcement, index }))
    .sort((a, b) => b.announcement.date.localeCompare(a.announcement.date) || a.index - b.index)
    .map(({ announcement }) => announcement);
}

/** Filter before limiting Home's list, so irrelevant notices never consume a slot. */
export function announcementsForMobile(announcements: Announcement[], platform: string): Announcement[] {
  if (platform !== "ios" && platform !== "android") return [];
  return announcements.filter((announcement) => announcement.platforms.includes("app") &&
    (!announcement.mobilePlatforms || announcement.mobilePlatforms.includes(platform)));
}

/** The reader's language version of an announcement, falling back field by field to English. */
export function localizeAnnouncement(announcement: Announcement, language: AnnouncementLanguage | null): Announcement {
  const t = language ? announcement.translations?.[language] : undefined;
  if (!t) return announcement;
  return {
    ...announcement,
    title: t.title ?? announcement.title,
    body: t.body ?? announcement.body,
    ...(announcement.link ? { link: { ...announcement.link, label: t.linkLabel ?? announcement.link.label } } : {}),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-10-18" -> "18 Oct 2026". Formatted by hand rather than with Intl:
 * the app's JS engine (Hermes) has only partial Intl date support, and
 * the website and app should show the same thing.
 */
export function formatAnnouncementDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** How long an unread announcement keeps its "New" badge. */
export const NEW_BADGE_DAYS = 30;

/**
 * Whether an announcement gets a "New" badge: recent (within
 * NEW_BADGE_DAYS of `today`), and dated after the newest announcement the
 * reader had already seen when they last opened the What's New list
 * (`lastSeenDate`, null if they never have).
 */
export function isNewAnnouncement(announcement: Announcement, lastSeenDate: string | null, today: Date = new Date()): boolean {
  const ageDays = (today.getTime() - Date.parse(`${announcement.date}T00:00:00Z`)) / 86_400_000;
  if (ageDays > NEW_BADGE_DAYS) return false;
  return lastSeenDate === null || announcement.date > lastSeenDate;
}

/** Storage key for the newest announcement date a reader has seen -- same key on web and in the app. */
export const ANNOUNCEMENTS_LAST_SEEN_KEY = "vy.announcements.lastSeenDate";

export function isValidLastSeenDate(value: unknown): value is string {
  return typeof value === "string" && DATE_PATTERN.test(value);
}

/** Where the deployed copy lives -- the app's live source. Hardcoded for the same reason as the app's other manifests (no build-time env in the app). */
export const ANNOUNCEMENTS_URL = "https://vedantayojana.org/announcements.json";

/**
 * Picks which copy of the list the app shows, from candidates in order of
 * preference (live fetch, then the cached last fetch, then the bundled
 * copy): the first one whose newest entry is at least as recent as every
 * other candidate's. So the live copy wins normally -- including its edits
 * to existing entries -- while an app update whose bundled list is newer
 * than an old cached fetch never shows the older one.
 */
export function preferredAnnouncements(...candidates: (Announcement[] | null)[]): Announcement[] {
  const valid = candidates.filter((list): list is Announcement[] => list !== null);
  const newest = (list: Announcement[]) => list[0]?.date ?? "";
  const latest = valid.reduce((max, list) => (newest(list) > max ? newest(list) : max), "");
  return valid.find((list) => newest(list) === latest) ?? [];
}

