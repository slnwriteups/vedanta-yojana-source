import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseVisishtadvaitaBook } from "./visishtadvaita-chapters.ts";
import { wordOverlapRatio, normalizeForCompare } from "./compare.ts";
import { loadBook, loadChapters } from "../../content-lib/loader/index.ts";
import { BookSchema } from "../../content-lib/schemas/index.ts";

/**
 * Phase 6E, Part 6 -- per user direction (asked directly, since this is
 * an editorial call about how to represent a book's authorship): the
 * existing 55-chapter "recovered book" is a COMPOSITE of multiple
 * original sources, and "A Brief Insight to Visishtadvaita Philosophy"
 * by Vishnu Sreenivas is confirmed (by direct text comparison, not just
 * title matching) to be the source for 17 of those 55 chapters
 * (Foreword through Guru Parampara, plus the 6 Charama-Shlokam/Bhakti-
 * Yoga/Conclusion chapters). Creating a SECOND, separate Book with its
 * own copies of the same 17 chapters' text would duplicate editorial
 * content already living in the existing book -- so instead this
 * supplements the EXISTING book's title/author (previously "Untitled
 * Recovered Book (pending editorial title)", no author) and records
 * the full chapter-to-page correspondence as provenance. No chapter
 * file is modified -- every chapter's body/title/order is completely
 * untouched; this only touches book.json's title/author fields.
 */

/**
 * The PDF's chapter 12 ("Charama Shlokas") covers all three individual
 * Charama Shlokams as ONE continuous chapter, plus its own introductory
 * section -- but the existing recovered book split this into 4 separate
 * chapters. Verified directly (not assumed): word-overlap between this
 * one PDF chapter and each of the 4 existing chapters is 0.92-1.00.
 */
const CHARAMA_SHLOKAS_SPECIAL_CASE_SLUGS = [
  "varaha-charama-shlokam",
  "charama-shlokams",
  "rama-charama-shlokam",
  "krishna-charama-shlokam",
];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PDF_PATH = path.join(REPO_ROOT, "source-material/Books/A Brief Insight to Visishtadvaita Philosophy.pdf");
const BOOK_SLUG = "a-brief-insight-to-visishtadvaita-philosophy";
const BOOK_JSON_PATH = path.join(REPO_ROOT, "content/library", BOOK_SLUG, "book.json");
const PROVENANCE_DIR = path.join(REPO_ROOT, "content/_provenance/library");
const SOURCE_FILE = "A Brief Insight to Visishtadvaita Philosophy.pdf";
const NEW_TITLE = "A Brief Insight to Visishtadvaita Philosophy";
const NEW_AUTHOR = "Vishnu Sreenivas";

/** Minimum word-overlap ratio to trust a title match as a genuine content match, not a coincidence. */
const MIN_CONFIDENT_OVERLAP = 0.6;

export interface ChapterMatch {
  pdfTitle: string;
  pdfPage: number;
  existingSlug: string;
  overlapRatio: number;
}

export function runVisishtadvaitaComparison(): {
  matched: ChapterMatch[];
  unmatchedPdfChapters: { title: string; page: number }[];
} {
  const structure = parseVisishtadvaitaBook(PDF_PATH);
  const existingChapters = loadChapters(BOOK_SLUG);

  const existingByNormTitle = new Map(existingChapters.map((c) => [normalizeForCompare(c.title), c] as const));

  const matched: ChapterMatch[] = [];
  const unmatchedPdfChapters: { title: string; page: number }[] = [];

  const pdfSections: { title: string; page: number; text: string }[] = [];
  if (structure.foreword) pdfSections.push({ title: "Foreword", page: structure.foreword.startPage, text: structure.foreword.text });
  for (const ch of structure.chapters) pdfSections.push({ title: ch.title, page: ch.startPage, text: ch.text });

  const existingBySlug = new Map(existingChapters.map((c) => [c.slug, c] as const));

  for (const section of pdfSections) {
    if (normalizeForCompare(section.title) === normalizeForCompare("Charama Shlokas")) {
      for (const slug of CHARAMA_SHLOKAS_SPECIAL_CASE_SLUGS) {
        const existing = existingBySlug.get(slug);
        if (!existing) continue;
        const ratio = wordOverlapRatio(existing.body, section.text);
        if (ratio >= MIN_CONFIDENT_OVERLAP) {
          matched.push({ pdfTitle: section.title, pdfPage: section.page, existingSlug: slug, overlapRatio: ratio });
        }
      }
      continue;
    }

    const existing = existingByNormTitle.get(normalizeForCompare(section.title));
    if (!existing) {
      unmatchedPdfChapters.push({ title: section.title, page: section.page });
      continue;
    }
    const ratio = wordOverlapRatio(existing.body, section.text);
    if (ratio < MIN_CONFIDENT_OVERLAP) {
      unmatchedPdfChapters.push({ title: section.title, page: section.page });
      continue;
    }
    matched.push({ pdfTitle: section.title, pdfPage: section.page, existingSlug: existing.slug, overlapRatio: ratio });
  }

  return { matched, unmatchedPdfChapters };
}

export function runVisishtadvaitaMerge(): { matched: ChapterMatch[]; unmatchedPdfChapters: { title: string; page: number }[] } {
  const { matched, unmatchedPdfChapters } = runVisishtadvaitaComparison();

  const book = loadBook(BOOK_SLUG);
  if (!book) throw new Error(`Book "${BOOK_SLUG}" not found`);

  const raw = JSON.parse(fs.readFileSync(BOOK_JSON_PATH, "utf8"));
  raw.title = NEW_TITLE;
  raw.author = NEW_AUTHOR;

  const result = BookSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Supplementing book title/author would fail BookSchema validation: ${result.error.message}`);
  }
  fs.writeFileSync(BOOK_JSON_PATH, JSON.stringify(raw, null, 2) + "\n", "utf8");

  fs.mkdirSync(PROVENANCE_DIR, { recursive: true });
  const importedAt = new Date().toISOString().slice(0, 10);
  const provenance = {
    field: "title, author",
    value: `title: "${NEW_TITLE}", author: "${NEW_AUTHOR}"`,
    sourceFile: SOURCE_FILE,
    importedAt,
    note: `This book is a composite of multiple original sources. "${SOURCE_FILE}" was confirmed (by direct text comparison, not title alone) as the source for ${matched.length} of this book's chapters -- listed below -- but NOT for the other ${loadChapters(BOOK_SLUG).length - matched.length} chapters (a separate Ramanujar/Swami Desikan biographical narrative and other material), which remain under the same book/title pending identification of their own source.`,
    chapterCorrespondence: matched.map((m) => ({
      chapterSlug: m.existingSlug,
      sourcePage: m.pdfPage,
      sourceSection: m.pdfTitle,
      textOverlapRatio: Number(m.overlapRatio.toFixed(3)),
    })),
  };
  fs.writeFileSync(path.join(PROVENANCE_DIR, `${BOOK_SLUG}.json`), JSON.stringify(provenance, null, 2) + "\n", "utf8");

  return { matched, unmatchedPdfChapters };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { matched, unmatchedPdfChapters } = runVisishtadvaitaMerge();
  console.log(`Confirmed ${matched.length} chapter(s) sourced from "${SOURCE_FILE}":`);
  for (const m of matched) console.log(`  - ${m.existingSlug} <- page ${m.pdfPage} "${m.pdfTitle}" (overlap ${m.overlapRatio.toFixed(2)})`);
  console.log(`Unmatched PDF chapters (needs human review): ${unmatchedPdfChapters.length}`);
  for (const u of unmatchedPdfChapters) console.log(`  - page ${u.page} "${u.title}"`);
}
