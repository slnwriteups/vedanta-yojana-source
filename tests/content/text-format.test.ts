import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimateReadingMinutes,
  getTableOfContents,
  isListItemLine,
  isVerseLine,
  isVerseTransliterationLine,
  looksLikeSubheading,
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

// ---------------------------------------------------------------------------
// isVerseTransliterationLine
// ---------------------------------------------------------------------------

test("N: both lines of a quoted verse's IAST transliteration are recognized as verse continuation, not headings", () => {
  // Real, reported case: rama-charama-shlokam renders its Devanagari
  // couplet plain (correctly excluded from looksLikeSubheading by its
  // trailing daṇḍa) but its IAST transliteration couplet directly below
  // it -- the same verse, just transliterated -- rendered BOLD, since
  // looksLikeSubheading() alone has no way to know it isn't a genuine
  // heading. Reported directly from device testing as inconsistent,
  // unintentional-looking formatting.
  const paragraphs = paragraphsForReading(
    "The shlokam is as follows,\n\nसकृदेव प्रपन्नाय तवास्मीति च याचते ।\nअभयं सर्वभूतेभ्यो ददाम्येतत् व्रतं मम ॥\n\nsakṛd eva prapannāya tavāsmīti ca yācate\nabhayaṁ sarva-bhūtebhyo dadāmy etat vrataṁ mama\n\nThe meaning is as follows,"
  );
  const iastFirstLine = paragraphs.indexOf("sakṛd eva prapannāya tavāsmīti ca yācate");
  const iastSecondLine = paragraphs.indexOf("abhayaṁ sarva-bhūtebhyo dadāmy etat vrataṁ mama");
  assert.ok(iastFirstLine >= 0 && iastSecondLine >= 0, "expected both IAST lines to be present as their own paragraphs");
  // Both lines still pass looksLikeSubheading() on their own -- the bug
  // this guards is exactly that a bolding renderer must NOT stop there.
  assert.equal(looksLikeSubheading(paragraphs[iastFirstLine]), true);
  assert.equal(looksLikeSubheading(paragraphs[iastSecondLine]), true);
  assert.equal(isVerseTransliterationLine(paragraphs, iastFirstLine), true);
  assert.equal(isVerseTransliterationLine(paragraphs, iastSecondLine), true);
});

test("N: a genuine short heading with no Devanagari two paragraphs back is never mistaken for verse continuation", () => {
  const paragraphs = paragraphsForReading(
    `Some introductory sentence that reads normally here.\n\nAnother plain sentence right here.\n\nThe Moksha Virodhi\n\n${"This section explains the doctrine in extended detail. ".repeat(6)}`
  );
  const headingIndex = paragraphs.indexOf("The Moksha Virodhi");
  assert.ok(headingIndex >= 0);
  assert.equal(isVerseTransliterationLine(paragraphs, headingIndex), false);
});

// ---------------------------------------------------------------------------
// isVerseLine / isListItemLine
// ---------------------------------------------------------------------------

test("O: every line of a quoted shlokam -- its Devanagari couplet AND its IAST transliteration -- is recognized as a verse line, for uniform bolding", () => {
  // Every shlokam in the app should render bold and consistent, not just
  // whichever half happens to lack terminal punctuation. The Devanagari
  // couplet ends in daṇḍa (।/॥), so looksLikeSubheading() alone calls it
  // false; isVerseLine() must still say true for it, and for its IAST
  // transliteration directly below.
  const paragraphs = paragraphsForReading(
    "The shlokam is as follows,\n\nसकृदेव प्रपन्नाय तवास्मीति च याचते ।\nअभयं सर्वभूतेभ्यो ददाम्येतत् व्रतं मम ॥\n\nsakṛd eva prapannāya tavāsmīti ca yācate\nabhayaṁ sarva-bhūtebhyo dadāmy etat vrataṁ mama\n\nThe meaning is as follows,"
  );
  const devanagariFirstLine = paragraphs.findIndex((p) => p.startsWith("सकृदेव"));
  const devanagariSecondLine = paragraphs.findIndex((p) => p.startsWith("अभयं"));
  const iastFirstLine = paragraphs.indexOf("sakṛd eva prapannāya tavāsmīti ca yācate");
  const iastSecondLine = paragraphs.indexOf("abhayaṁ sarva-bhūtebhyo dadāmy etat vrataṁ mama");
  for (const index of [devanagariFirstLine, devanagariSecondLine, iastFirstLine, iastSecondLine]) {
    assert.ok(index >= 0);
    assert.equal(isVerseLine(paragraphs, index), true);
  }
  // The surrounding narrative prose is not swept up by the same check.
  assert.equal(isVerseLine(paragraphs, 0), false);
  assert.equal(isVerseLine(paragraphs, paragraphs.length - 1), false);
});

test("O: a numbered list item is recognized so a renderer can keep it plain, matching getTableOfContents' own exclusion", () => {
  // Real, reported case: Artha Panchakam's "1) Hayagrīva Stotram" ...
  // "10) Kamasikashatakam" -- 8 of 10 items short enough, with no
  // terminal punctuation, to pass looksLikeSubheading() and render
  // every item in bold as if each were its own subsection.
  assert.equal(isListItemLine("1) Hayagrīva Stotram"), true);
  assert.equal(isListItemLine("(iii) Parama bhakti"), true);
  assert.equal(isListItemLine("7) Nityam"), true);
  assert.equal(isListItemLine("The word charama in Sanskrit translates to ultimate."), false);
});

test("O: a '1.'-style (period, not closing paren) numbered list item is recognized too", () => {
  // Real, reported case: swami-desikan-s-return-to-kanchipuram's 5-item
  // doctrine list uses "1. ... 2. ... 3. ... 4. ... 5. ...". Items 1-2
  // happened to end their own line in "." (terminal punctuation, so
  // looksLikeSubheading() already called them false) while items 3-5
  // had no trailing punctuation and rendered BOLD -- the same list,
  // inconsistently styled, because isListItemLine() only recognized the
  // "1)" marker style and not "1.".
  assert.equal(isListItemLine("3. The obstacles that prevent us from reaching Paramapadam"), true);
  assert.equal(isListItemLine("i. Being free from any sin"), true);
  assert.equal(isListItemLine("1. The Svarūpam of Parabrahman."), true);
});
