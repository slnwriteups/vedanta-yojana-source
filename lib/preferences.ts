import type { ColorScheme } from "./theme";
import type { LanguageCode } from "../content-lib/schemas/index.ts";

export { SUPPORTED_LANGUAGES } from "../content-lib/schemas/index.ts";
export type { LanguageCode } from "../content-lib/schemas/index.ts";

/**
 * Web port of mobile/content-lib/preferences.ts -- the pure,
 * storage-agnostic half of the settings foundation: key names, defaults,
 * and validation for values that came back from disk (localStorage
 * returns untyped JSON -- a corrupted or previous-shape value must never
 * crash the app or be trusted blindly). Deliberately has no storage
 * import, so it stays importable from both server and client code -- see
 * lib/storage.ts for the one module that actually touches localStorage.
 *
 * Storage keys are reused verbatim from the mobile app (not renamed to
 * match web's own `vy-welcome-seen`-style key elsewhere) so a value
 * saved on one platform stays meaningful if these are ever synced.
 */

export const THEME_STORAGE_KEY = "vy.preferences.themeOverride";
export const READING_STORAGE_KEY = "vy.preferences.reading";
/**
 * Whether the one-time appearance/text-size onboarding step (see
 * OnboardingGate.tsx) has ever been completed. Unlike the welcome
 * gate (WelcomeGate.tsx, shown on every fresh session, unpersisted),
 * this genuinely is "once ever" -- afterward the same controls stay
 * reachable any time from /settings.
 */
export const ONBOARDED_STORAGE_KEY = "vy.preferences.onboarded";
/** Reader-facing content language. null = English (the base language, always present). */
export const LANGUAGE_STORAGE_KEY = "vy.preferences.language";
/** The last Library chapter the reader had open -- powers a "Continue Reading" card. */
export const LAST_READ_STORAGE_KEY = "vy.preferences.lastRead";
/** Chapters the reader has explicitly bookmarked. */
export const BOOKMARKS_STORAGE_KEY = "vy.preferences.bookmarks";

export function isValidThemeOverride(value: unknown): value is ColorScheme | null {
  return value === null || value === "light" || value === "dark";
}

export function isValidLanguageCode(value: unknown): value is LanguageCode | null {
  return value === null || value === "ta" || value === "kn" || value === "hi";
}

export function isValidCompletedFlag(value: unknown): value is true {
  return value === true;
}

export interface ReadingPreferences {
  /** Multiplier applied to the base reading font size for long-form paragraphs. */
  fontScale: number;
}

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = { fontScale: 1 };

/** The only font scale steps the UI offers -- Small/Medium/Large/Extra Large. */
export const FONT_SCALE_STEPS: { label: string; value: number }[] = [
  { label: "Small", value: 0.9 },
  { label: "Medium", value: 1 },
  { label: "Large", value: 1.15 },
  { label: "Extra Large", value: 1.3 },
];

const VALID_FONT_SCALES = new Set(FONT_SCALE_STEPS.map((step) => step.value));

export function isValidReadingPreferences(value: unknown): value is ReadingPreferences {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.fontScale === "number" && VALID_FONT_SCALES.has(candidate.fontScale);
}

/** Only the coordinates needed to look the chapter back up -- title/book-title are resolved fresh at render time, never cached, so a later content edit is always reflected. */
export interface LastReadPosition {
  bookSlug: string;
  chapterSlug: string;
  /** Date.now() at save time -- not shown to the reader, but lets a future screen sort/prune multiple saved positions if that's ever added. */
  savedAt: number;
}

export function isValidLastReadPosition(value: unknown): value is LastReadPosition {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.bookSlug === "string" &&
    candidate.bookSlug.length > 0 &&
    typeof candidate.chapterSlug === "string" &&
    candidate.chapterSlug.length > 0 &&
    typeof candidate.savedAt === "number"
  );
}

/**
 * A reader can have several books open at once -- "Continue Reading"
 * shows one card per book with a saved position, not just the single
 * most-recent one. LAST_READ_STORAGE_KEY holds an array of these (at
 * most one entry per bookSlug -- recordChapterView() replaces that
 * book's own entry, leaving every other book's entry untouched) rather
 * than one overwritten slot.
 */
export function isValidLastReadPositionList(value: unknown): value is LastReadPosition[] {
  return Array.isArray(value) && value.every(isValidLastReadPosition);
}

/** One explicitly-bookmarked chapter -- same shape as LastReadPosition, but a list rather than a single overwritten slot, and never written to except by the reader's own bookmark toggle. */
export interface BookmarkEntry {
  bookSlug: string;
  chapterSlug: string;
  /** Date.now() at save time -- lets a Bookmarks view sort newest-first. */
  savedAt: number;
}

function isValidBookmarkEntry(value: unknown): value is BookmarkEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.bookSlug === "string" &&
    candidate.bookSlug.length > 0 &&
    typeof candidate.chapterSlug === "string" &&
    candidate.chapterSlug.length > 0 &&
    typeof candidate.savedAt === "number"
  );
}

export function isValidBookmarkList(value: unknown): value is BookmarkEntry[] {
  return Array.isArray(value) && value.every(isValidBookmarkEntry);
}
