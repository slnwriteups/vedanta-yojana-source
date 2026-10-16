/**
 * Detects blog posts whose writing already lives in the app (a book
 * chapter, a Divya Desam record, a Knowledge record), so the importer can
 * leave them out instead of archiving a second copy.
 *
 * Matching is on the text itself, not just the title: many posts were
 * later revised into book chapters under new titles. Both sides are
 * normalised (lowercase, IAST diacritics folded, punctuation dropped) and
 * cut into overlapping 5-word "shingles"; a post's *containment* is the
 * share of its shingles found anywhere in the app's English text. Light
 * editing (a reworded sentence, added diacritics, a new heading) only
 * removes the shingles it touches, so a revised post still scores high,
 * while two different essays on the same topic share very few 5-word runs.
 *
 * Only the primary-language text is indexed: translations are derived
 * from it, and the blog posts are in English.
 */
import fs from "node:fs";
import path from "node:path";
import { duplicateKey } from "./slug.ts";

const SHINGLE_SIZE = 5;
/** At or above this share of a post's text found in the app, the post is a duplicate and is not imported. */
export const DUPLICATE_THRESHOLD = 0.5;
/** Between this and DUPLICATE_THRESHOLD (or on an exact title match) the post is imported but flagged for review. */
export const POSSIBLE_THRESHOLD = 0.15;
/**
 * A post whose title names a specific app record (e.g. "108 Divyadesam - 62) Tiruvidandai" and the
 * Tiruvidandai record) is a duplicate at this lower overlap with that one record. Posts later
 * revised into app records with small edits throughout (diacritics added, words changed in most
 * sentences) break many 5-word runs and can land just under DUPLICATE_THRESHOLD; the title
 * anchor makes the lower bar safe.
 */
export const TITLED_DUPLICATE_THRESHOLD = 0.2;
/** Posts shorter than this many shingles are too short to judge by text; only an exact title match flags them. */
const MIN_SHINGLES = 20;

/** Fields that hold no reader-facing prose, or hold derived/translated copies of it. */
const SKIP_KEYS = new Set(["translations", "migration", "images", "resources", "relatedContent", "coverImage", "slug", "status", "order", "chapterOrder", "parts", "mapsLink", "url"]);
/** Folders under content/ that are not part of the app (provenance notes, held-back records). */
const SKIP_DIRS = new Set(["_provenance", "_unresolved"]);

export interface AppRecord {
  /** Path relative to the content root, e.g. "library/jaya/chapters/a-pound-of-flour.json". */
  file: string;
  kind: string;
  title: string;
}

export interface AppCorpus {
  records: AppRecord[];
  /** shingle -> indexes into `records` that contain it */
  shingles: Map<string, number[]>;
  /** duplicateKey(title) -> record indexes */
  titles: Map<string, number[]>;
}

export interface AppMatch {
  file: string;
  kind: string;
  title: string;
  /** Share of the post's text found in this one record (0-1). */
  overlap: number;
}

export interface AppMatchResult {
  verdict: "duplicate" | "possible" | "none";
  /** Why a duplicate was judged one: most of its text is in the app, or its title names a record it substantially overlaps. */
  reason?: "text" | "title-and-text";
  /** Share of the post's text found anywhere in the app (0-1) -- covers a post split across several chapters. */
  containment: number;
  titleMatch: boolean;
  matches: AppMatch[];
}

export function normaliseWords(text: string): string[] {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/['’‘`]/g, "")
      .match(/[a-z0-9]+/g) ?? []
  );
}

export function shinglesOf(text: string): Set<string> {
  const words = normaliseWords(text);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) out.add(words.slice(i, i + SHINGLE_SIZE).join(" "));
  return out;
}

function collectText(value: unknown, out: string[]): void {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectText(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) if (!SKIP_KEYS.has(k)) collectText(v, out);
  }
}

function jsonFiles(dir: string, rel = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...jsonFiles(path.join(dir, entry.name), path.join(rel, entry.name)));
    } else if (entry.name.endsWith(".json")) out.push(path.join(rel, entry.name));
  }
  return out;
}

export function loadAppCorpus(contentRoot: string): AppCorpus {
  const corpus: AppCorpus = { records: [], shingles: new Map(), titles: new Map() };
  for (const file of jsonFiles(contentRoot)) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(fs.readFileSync(path.join(contentRoot, file), "utf8"));
    } catch {
      continue;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    const title = String(data.title ?? data.displayName ?? path.basename(file, ".json"));
    const parts = file.split(path.sep);
    const kind = parts[0] === "library" ? (parts.includes("chapters") ? "chapter" : "book") : parts[0];
    addRecord(corpus, { file: parts.join("/"), kind, title }, data);
  }
  return corpus;
}

/** Adds one record to a corpus. Exported for tests. */
export function addRecord(corpus: AppCorpus, record: AppRecord, data: unknown): void {
  const id = corpus.records.push(record) - 1;
  const text: string[] = [];
  collectText(data, text);
  for (const s of shinglesOf(text.join("\n"))) {
    const ids = corpus.shingles.get(s);
    if (!ids) corpus.shingles.set(s, [id]);
    else if (ids[ids.length - 1] !== id) ids.push(id);
  }
  const key = duplicateKey(record.title);
  if (key) corpus.titles.set(key, [...(corpus.titles.get(key) ?? []), id]);
}

export function findAppMatches(corpus: AppCorpus, title: string, plainText: string): AppMatchResult {
  const postShingles = shinglesOf(plainText);
  const perRecord = new Map<number, number>();
  let found = 0;
  for (const s of postShingles) {
    const ids = corpus.shingles.get(s);
    if (!ids) continue;
    found++;
    for (const id of ids) perRecord.set(id, (perRecord.get(id) ?? 0) + 1);
  }
  const total = postShingles.size;
  const containment = total ? found / total : 0;
  const titleIds = corpus.titles.get(duplicateKey(title)) ?? [];

  const ids = new Set([...titleIds, ...[...perRecord.entries()].filter(([, n]) => total && n / total >= 0.05).map(([id]) => id)]);
  const matches = [...ids]
    .map((id) => ({ ...corpus.records[id], overlap: round(total ? (perRecord.get(id) ?? 0) / total : 0) }))
    .sort((a, b) => b.overlap - a.overlap || a.file.localeCompare(b.file))
    .slice(0, 5);

  const judgeable = total >= MIN_SHINGLES;
  const titledOverlap =
    judgeable &&
    [...perRecord.entries()].some(([id, n]) => n / total >= TITLED_DUPLICATE_THRESHOLD && titleNamesRecord(title, corpus.records[id].title));

  let verdict: AppMatchResult["verdict"] = "none";
  let reason: AppMatchResult["reason"];
  if (judgeable && containment >= DUPLICATE_THRESHOLD) [verdict, reason] = ["duplicate", "text"];
  else if (titledOverlap) [verdict, reason] = ["duplicate", "title-and-text"];
  else if (titleIds.length || (judgeable && containment >= POSSIBLE_THRESHOLD)) verdict = "possible";
  return { verdict, ...(reason ? { reason } : {}), containment: round(containment), titleMatch: titleIds.length > 0, matches };
}

/**
 * True when every word of the record's title appears in the post's title, allowing one-letter
 * spelling differences in longer words -- transliterated names drift between versions
 * ("Tirudwarakai (Dwaraka)" vs "Tirudwarkai (Dwarka)").
 */
export function titleNamesRecord(postTitle: string, recordTitle: string): boolean {
  const recordWords = normaliseWords(recordTitle);
  if (recordWords.join("").length < 6) return false;
  const postWords = normaliseWords(postTitle);
  return recordWords.every((rw) => postWords.some((pw) => pw === rw || (rw.length >= 5 && editDistanceAtMostOne(pw, rw))));
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
