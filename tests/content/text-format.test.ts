import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimateReadingMinutes,
  getTableOfContents,
  paragraphsForReading,
  splitIntoReadableParagraphs,
  stripLeadingDuplicateTitle,
} from "../../content-lib/text-format.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ---------------------------------------------------------------------------
// splitIntoReadableParagraphs
// ---------------------------------------------------------------------------

test("A: a short paragraph is returned untouched, as a single element", () => {
  const short = "Sri Ranganathar reclines on Adisesha. Sri Ranganayaki resides beside him.";
  assert.deepEqual(splitIntoReadableParagraphs(short), [short]);
});

test("B: a paragraph longer than the target is split at sentence boundaries", () => {
  const sentence = "The Lord blesses every devotee who approaches with sincere devotion and surrender.";
  const long = Array(10).fill(sentence).join(" ");
  const chunks = splitIntoReadableParagraphs(long, 300);
  assert.ok(chunks.length > 1, "expected more than one chunk");
  for (const chunk of chunks) assert.ok(chunk.length <= 300 || !chunk.includes(" "), `chunk too long: ${chunk.length}`);
});

test("C: concatenating the chunks with single spaces reconstructs the original text exactly", () => {
  const sentence = "This kshethram is one of the 108 Divya Desams venerated by the Alwars.";
  const long = Array(8).fill(sentence).join(" ");
  const chunks = splitIntoReadableParagraphs(long, 200);
  assert.equal(chunks.join(" "), long);
});

test("D: a single sentence longer than the target is still returned whole, never truncated", () => {
  const oneHugeSentence = "This is a single unbroken sentence that just keeps going and going and going without any terminal punctuation until finally it ends";
  const chunks = splitIntoReadableParagraphs(oneHugeSentence + ".", 40);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], oneHugeSentence + ".");
});

test("E: Devanagari sentence-terminal punctuation (danda/double-danda) is recognized as a boundary", () => {
  const sentence = "सर्वं श्रीकृष्णार्पणम् अस्तु।";
  const long = Array(10).fill(sentence).join(" ");
  const chunks = splitIntoReadableParagraphs(long, 60);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(" "), long);
});

test("F: empty/whitespace-only input returns a single (empty) element, never crashes", () => {
  assert.deepEqual(splitIntoReadableParagraphs(""), [""]);
  assert.deepEqual(splitIntoReadableParagraphs("   "), [""]);
});

// ---------------------------------------------------------------------------
// paragraphsForReading
// ---------------------------------------------------------------------------

test("G: existing blank-line paragraph breaks are preserved as real breaks, not merged", () => {
  const text = "First short paragraph.\n\nSecond short paragraph.";
  assert.deepEqual(paragraphsForReading(text), ["First short paragraph.", "Second short paragraph."]);
});

test("H: a real paragraph break plus one overlong block produces both a hard break and sentence-level splits", () => {
  const sentence = "Every devotee who visits this kshethram is said to receive the Lord's blessing.";
  const overlong = Array(8).fill(sentence).join(" ");
  const text = `Short intro.\n\n${overlong}`;
  const result = paragraphsForReading(text, 300);
  assert.equal(result[0], "Short intro.");
  assert.ok(result.length > 2, "expected the overlong block to split into more than one paragraph");
});

test("I: matches the real corpus -- Sri Rangam's Vibishana narrative (one long unbroken source paragraph) splits into multiple readable chunks", () => {
  const record = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "content/divya-desams/sri-rangam.json"), "utf8"));
  const paragraphs = paragraphsForReading(record.sthalaPuranam);
  const longest = Math.max(...paragraphs.length ? paragraphs.map((p: string) => p.length) : [0]);
  assert.ok(paragraphs.length > 1, "expected Sri Rangam's sthalaPuranam to produce more than one paragraph");
  assert.ok(longest < record.sthalaPuranam.length, "expected at least one split to have occurred");
  assert.equal(paragraphs.join(" ").replace(/ {2,}/g, " "), record.sthalaPuranam.replace(/\n+/g, " ").trim().replace(/ {2,}/g, " "));
});

test("J: a single newline is honored as a real paragraph break, not erased when the surrounding block is resplit at sentence boundaries", () => {
  const sentence = "Every devotee who visits this kshethram is said to receive the Lord's blessing.";
  const overlong = Array(8).fill(sentence).join(" ");
  const text = `${overlong}\n(i) Sva-Nishta\n(ii) Ukti-Nishta\n(iii) Acharya-Nishta`;
  const result = paragraphsForReading(text, 300);
  assert.ok(result.includes("(i) Sva-Nishta"), "expected the first list item to survive as its own paragraph");
  assert.ok(result.includes("(ii) Ukti-Nishta"), "expected the second list item to survive as its own paragraph");
  assert.ok(result.includes("(iii) Acharya-Nishta"), "expected the third list item to survive as its own paragraph");
});

// ---------------------------------------------------------------------------
// stripLeadingDuplicateTitle
// ---------------------------------------------------------------------------

test("K: a body whose first line exactly repeats the title has that line (and the blank line after it) removed", () => {
  const text = "Bala Kanda: The Divine Beginnings\n\nIf you visit the banks of the Sarayu River...";
  const result = stripLeadingDuplicateTitle(text, "Bala Kanda: The Divine Beginnings");
  assert.equal(result, "If you visit the banks of the Sarayu River...");
});

test("K: the match is case-insensitive and whitespace-collapsed, still an exact match otherwise", () => {
  const text = "  bala   kanda: the DIVINE beginnings  \nRest of the body.";
  const result = stripLeadingDuplicateTitle(text, "Bala Kanda: The Divine Beginnings");
  assert.equal(result, "Rest of the body.");
});

test("K: a body whose first line only resembles (but does not exactly match) the title is left completely untouched", () => {
  const text = "Bala Kanda: The Divine Beginnings, Part One\n\nSome body text.";
  const result = stripLeadingDuplicateTitle(text, "Bala Kanda: The Divine Beginnings");
  assert.equal(result, text);
});

test("K: a body with no title repetition at all is returned byte-for-byte unchanged", () => {
  const text = "Some unrelated first line.\n\nMore body text.";
  assert.equal(stripLeadingDuplicateTitle(text, "Bala Kanda: The Divine Beginnings"), text);
});

test("K: a first line matching the title except for diacritics (a macron the title itself omits) is still recognized and removed", () => {
  // Real, reported case: rama-charama-shlokam's body opens with "Rāma
  // Charama Shlokam" while its own title is "Rama Charama Shlokam" --
  // the same heading, transliterated with vs. without a macron, not two
  // different lines.
  const text = "Rāma Charama Shlokam\n\nThe verse is as follows.";
  const result = stripLeadingDuplicateTitle(text, "Rama Charama Shlokam");
  assert.equal(result, "The verse is as follows.");
});

// ---------------------------------------------------------------------------
// estimateReadingMinutes
// ---------------------------------------------------------------------------

test("L: empty/whitespace-only text estimates 0 minutes", () => {
  assert.equal(estimateReadingMinutes(""), 0);
  assert.equal(estimateReadingMinutes("   \n  "), 0);
});

test("L: a very short passage still rounds up to at least 1 minute, never 0", () => {
  assert.equal(estimateReadingMinutes("A few short words here."), 1);
});

test("L: word count scales roughly with the 200-words-per-minute pace", () => {
  const words = Array(600).fill("word").join(" "); // 600 words -> 3 minutes at 200 wpm
  assert.equal(estimateReadingMinutes(words), 3);
});

test("L: matches the real corpus -- a full Sri Rangam chapter body estimates a plausible, non-zero minute count", () => {
  const record = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "content/divya-desams/sri-rangam.json"), "utf8"));
  const minutes = estimateReadingMinutes(record.sthalaPuranam);
  assert.ok(minutes >= 1 && minutes < 60, `expected a plausible reading-time estimate, got ${minutes}`);
});

// ---------------------------------------------------------------------------
// getTableOfContents
// ---------------------------------------------------------------------------

test("M: flowing narrative with no named sections gets no table of contents", () => {
  const sentence = "Every devotee who visits this kshethram is said to receive the Lord's blessing and grace.";
  const text = Array(6).fill(sentence).join(" ");
  assert.deepEqual(getTableOfContents(text, "A Narrative Chapter"), []);
});

test("M: a chapter with two or more genuine named sections gets a table of contents entry for each", () => {
  const longParagraph = Array(6).fill("This section explains the doctrine in careful, extended detail for the reader.").join(" ");
  const text = `Introduction\n\n${longParagraph}\n\nThe Moksha Virodhi\n\n${longParagraph}\n\nPhala Stuti\n\n${longParagraph}`;
  const toc = getTableOfContents(text, "Artha Panchakam");
  assert.deepEqual(
    toc.map((e) => e.label),
    ["Introduction", "The Moksha Virodhi", "Phala Stuti"]
  );
});

test("M: a single would-be entry that is a near-duplicate of the chapter's own title (different diacritics) is suppressed entirely, not shown as a useless one-item table of contents", () => {
  // Real, reported case: "rama-charama-shlokam"'s body opens with "Rāma
  // Charama Shlokam" (macron), but the chapter's own title is "Rama
  // Charama Shlokam" (no macron) -- stripLeadingDuplicateTitle's exact
  // match misses it, so it would otherwise become the ONLY table-of-
  // contents entry: a "contents" box pointing at nothing but the
  // chapter's own opening line.
  const longParagraph = Array(6).fill("The shloka's meaning is explained here in careful, extended detail for the reader.").join(" ");
  const text = `Rāma Charama Shlokam\n\n${longParagraph}`;
  assert.deepEqual(getTableOfContents(text, "Rama Charama Shlokam"), []);
});

test("M: an exact-match title repeated as the first line is still excluded, while the real sections after it still form a table of contents", () => {
  const longParagraph = Array(6).fill("This section explains the doctrine in careful, extended detail for the reader.").join(" ");
  const text = `Artha Panchakam\n\n${longParagraph}\n\nThe Moksha Virodhi\n\n${longParagraph}\n\nPhala Stuti\n\n${longParagraph}`;
  const toc = getTableOfContents(text, "Artha Panchakam");
  assert.deepEqual(
    toc.map((e) => e.label),
    ["The Moksha Virodhi", "Phala Stuti"]
  );
});

test("M: matches the real corpus -- no chapter across the Library ever produces a single-entry table of contents", async () => {
  const { loadBooks, loadChapters } = await import("../../content-lib/loader/index.ts");
  const singleEntryChapters: string[] = [];
  for (const book of loadBooks()) {
    for (const chapter of loadChapters(book.slug)) {
      const toc = getTableOfContents(chapter.body, chapter.title);
      if (toc.length === 1) singleEntryChapters.push(`${book.slug}/${chapter.slug}`);
    }
  }
  assert.deepEqual(singleEntryChapters, []);
});
