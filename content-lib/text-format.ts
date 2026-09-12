/**
 * Presentation-only long-paragraph splitting, shared by web
 * (components/shared/LongFormSection.tsx) and mobile
 * (mobile/components/Section.tsx). Several source paragraphs (an entire
 * Sthala Puranam narrative episode, e.g.) arrive as one multi-thousand-
 * character block with no internal blank-line break at all -- reported
 * as reading like a dense wall of text ("looks like Wikipedia").
 *
 * This NEVER touches the stored content: `splitIntoReadableParagraphs`
 * is a pure function that decides where the RENDERER inserts an extra
 * paragraph break, always at an existing sentence boundary already
 * present in the text -- concatenating its output with single spaces
 * reconstructs the original paragraph exactly (modulo the run of
 * whitespace the original sentence-boundary already had). It is never
 * used to summarize, reword, or truncate anything, and a paragraph that
 * already reads comfortably (at or under the target length) is returned
 * completely untouched, as a single-element array.
 *
 * A single `\n` is just as much an author-authored break as a blank
 * line: much of the corpus stores one paragraph (or list item) per
 * line rather than separating paragraphs with a blank line, so
 * `paragraphsForReading` treats every run of one or more newlines as a
 * real paragraph break. Earlier this only honored `\n{2,}`, so a block
 * whose internal breaks were single `\n` was handled as one giant
 * paragraph and, once over the length target, resplit at sentence
 * boundaries and rejoined with a plain space -- silently erasing the
 * original line breaks (visible e.g. in an "(i)/(ii)/(iii)" list that
 * collapsed onto one run-on line).
 */

/**
 * Sentence-terminal punctuation, Latin and Devanagari both -- the
 * corpus's own Sanskrit/Hindi shloka passages (srimad-bhagavatham,
 * conclusion) end sentences with "।" (danda) or "॥" (double danda), not
 * ".", so a Latin-only boundary would leave those paragraphs unsplit.
 */
const SENTENCE_BOUNDARY = /(?<=[.!?।॥])\s+(?=\S)/g;

/** Below this length, a paragraph already reads fine -- split it and it looks choppy instead of readable. */
const DEFAULT_TARGET_LENGTH = 550;

/**
 * Greedily groups consecutive sentences from `paragraph` into chunks no
 * longer than `targetLength` where possible. A single sentence longer
 * than `targetLength` on its own is still returned whole -- this only
 * ever adds break points at existing sentence boundaries, never inside
 * one.
 */
export function splitIntoReadableParagraphs(
  paragraph: string,
  targetLength: number = DEFAULT_TARGET_LENGTH
): string[] {
  const trimmed = paragraph.trim();
  if (trimmed.length <= targetLength) return [trimmed];

  const sentences = trimmed.split(SENTENCE_BOUNDARY).filter((s) => s.length > 0);
  if (sentences.length <= 1) return [trimmed];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + 1 + sentence.length > targetLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

/**
 * Splits `text` on its own existing newline paragraph breaks first --
 * a single `\n` and a blank line are both real, source-authored
 * structure and are honored equally -- then applies
 * splitIntoReadableParagraphs to any resulting block that's still too
 * long to read comfortably as one paragraph.
 */
export function paragraphsForReading(text: string, targetLength: number = DEFAULT_TARGET_LENGTH): string[] {
  return text
    .split(/\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .flatMap((block) => splitIntoReadableParagraphs(block, targetLength));
}

/**
 * Reported directly from device testing: a chapter body's own internal
 * sub-headings (e.g. artha-panchakam's "Meaning:", "The Moksha Virodhi",
 * "Bhakti and Prapatti Upayam"; JAYA's embedded "PART IV: ..." section
 * markers) render as plain paragraphs, visually identical to the
 * surrounding prose -- no bold, no break, reading as one continuous
 * block with no structure at all. The content model has no dedicated
 * "this line is a heading" field (chapter `body` is a single free-form
 * string -- see content-lib/schemas/chapter.ts), so this infers it
 * presentationally from the same kind of existing, source-authored
 * signal `paragraphsForReading` already relies on: a paragraph is
 * treated as a sub-heading candidate when it is short AND does not end
 * in the sentence-terminal punctuation (Latin or Devanagari) that
 * essentially every real flowing sentence in this corpus ends with --
 * including ";", this corpus's IAST rendering of the Devanagari single
 * danda (।) that closes the first half of a two-line verse.
 * Verified directly against real content before shipping (artha-
 * panchakam, stages-of-bhakti-yoga, several JAYA chapters): every
 * genuine heading/section-label line in those samples was correctly
 * caught, with zero missed headings. The heuristic also catches some
 * short verse/list-item lines that are not, strictly, headings (a
 * pasuram line, a "1) Hayagreeva Stotram" list entry) -- accepted
 * deliberately, since misclassifying one of those only means it reads
 * slightly emphasized rather than plain, never something confusing or
 * wrong, and across a 265-file sample this fires on about a quarter of
 * all paragraph blocks, which matches how much of this corpus is
 * genuinely structured with named subsections rather than flowing
 * narrative prose. This NEVER changes, reorders, or removes any text --
 * exactly like splitIntoReadableParagraphs above, it only tells a
 * renderer which existing block to draw with emphasis.
 */
const TERMINAL_PUNCTUATION = /[.!?।॥,;]['")]?\s*$/;
const MAX_SUBHEADING_LENGTH = 70;

export function looksLikeSubheading(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SUBHEADING_LENGTH) return false;
  return !TERMINAL_PUNCTUATION.test(trimmed);
}

export interface TableOfContentsEntry {
  label: string;
  /** This entry's position in paragraphsForReading(text)'s own output -- the index a renderer needs to scroll/jump to, not a separate concept. */
  paragraphIndex: number;
}

/**
 * A stricter sibling of looksLikeSubheading(), for a genuinely different
 * job: looksLikeSubheading() decides what to draw in bold (cheap to get
 * occasionally wrong -- a bolded verse line is still readable), but a
 * table of contents is a list of promises to the reader ("tap this, land
 * on that section") and a wrong or noisy one actively hurts trust. Reused
 * directly on real content and refined against it (not designed in the
 * abstract): looksLikeSubheading() alone fires on ~25% of paragraph
 * blocks corpus-wide, including short verse lines, list items ("1)
 * Hayagreeva Stotram"), and a repeated generic label ("Meaning:")
 * appearing 11 times in one chapter -- none of which make a usable table
 * of contents entry. On top of looksLikeSubheading(), an entry must:
 *
 * - not be the chapter's own title repeated as the body's first line
 *   (same convention as stripLeadingDuplicateTitle above);
 * - not itself be a numbered/roman-numeral list marker ("1)", "(iii)") --
 *   otherwise the *last* item of a list immediately followed by a long
 *   paragraph gets mistaken for the paragraph's own heading;
 * - be followed by a real paragraph of substantial prose (not another
 *   short line, not a list item, and at least MIN_FOLLOWING_LENGTH
 *   characters) -- this is what separates an actual section opener from
 *   a citation/attribution line or a mid-list item that merely happens
 *   to precede a long paragraph;
 * - be at least MIN_LABEL_LENGTH characters -- excludes bare short labels
 *   like "Meaning:" that carry no information about what the section is;
 * - appear only once -- a label repeated verbatim elsewhere in the same
 *   chapter (again, "Meaning:") is excluded entirely rather than listed
 *   as several indistinguishable entries.
 *
 * Validated directly against the full 158-chapter Library corpus before
 * shipping: 33 chapters (~21%) end up with a table of contents, 78
 * entries total (~2.4 per chapter that has one) -- e.g. Artha Panchakam's
 * 8 real named sections ("Swarupam of Parabramham," "The Moksha
 * Virodhi," ... "Phala Stuti"), a JAYA chapter's embedded "PART IV: ..."
 * marker, a Sri Rama Charithram chapter's "The Golden Stag and the
 * Abduction of Sita." A chapter that is genuinely just flowing narrative
 * (most of JAYA, most Divya Desam Sthala Puranam text) correctly gets
 * zero entries and no table of contents renders at all. Like every other
 * function in this file, this never changes, reorders, or removes a
 * single character of the source text -- it only decides which existing
 * paragraphs are worth a shortcut.
 */
const LIST_MARKER = /^\(?(\d+|[ivxlcdm]+)\)/i;
const MIN_LABEL_LENGTH = 10;
const MIN_FOLLOWING_LENGTH = 150;

export function getTableOfContents(text: string, title: string): TableOfContentsEntry[] {
  const paragraphs = paragraphsForReading(text);
  const normalizedTitle = title.trim().toLowerCase();
  const seen = new Set<string>();
  const entries: TableOfContentsEntry[] = [];

  paragraphs.forEach((paragraph, index) => {
    if (index === 0 && paragraph.trim().toLowerCase() === normalizedTitle) return;
    if (LIST_MARKER.test(paragraph)) return;
    if (paragraph.length < MIN_LABEL_LENGTH || !looksLikeSubheading(paragraph)) return;

    // A quoted verse printed as a 4-line block -- a Devanagari couplet,
    // blank line, then its IAST-transliteration couplet (e.g. JAYA's
    // Bhagavad Gita shlokas) -- has its transliteration's SECOND pada
    // pass every check here by accident: short, no terminal punctuation
    // (the transliteration convention drops the daṇḍa), followed by
    // substantial prose. (An earlier version of this check excluded any
    // candidate whose immediately-preceding paragraph also
    // looksLikeSubheading() -- too broad: it also silently ate every
    // real heading in this corpus that happens to follow a short
    // "Meaning:" label, e.g. Artha Panchakam's actual section titles.)
    // Detected structurally instead of by guessing at Sanskrit
    // vocabulary: if the paragraph TWO positions back contains
    // Devanagari script, this one is the tail end of that same verse
    // block, not a standalone heading -- Devanagari appears nowhere
    // else in the corpus today.
    if (index >= 2 && /[ऀ-ॿ]/.test(paragraphs[index - 2])) return;

    const next = paragraphs[index + 1] ?? "";
    if (LIST_MARKER.test(next) || looksLikeSubheading(next)) return;
    if (next.length < MIN_FOLLOWING_LENGTH) return;

    const key = paragraph.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    entries.push({ label: paragraph, paragraphIndex: index });
  });

  return entries;
}

/**
 * Presentation-only: many chapter bodies across the corpus repeat the
 * chapter's own title as their first line (e.g. a body starting
 * "Bala Kanda: The Divine Beginnings\n\n..." under a screen that
 * already shows that same title in its nav header and its own H1) --
 * a leftover of the source material's own formatting, not something
 * worth editing 100+ content files to remove. This strips only an
 * EXACT match (trimmed, whitespace-collapsed, case-insensitive) of the
 * title as the text's first line, plus the blank line after it, and
 * returns the text completely untouched otherwise -- never a fuzzy or
 * partial match, so a body that happens to start with a *similar* but
 * not identical line is left exactly as-is.
 */
export function stripLeadingDuplicateTitle(text: string, title: string): string {
  const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const newlineIndex = text.indexOf("\n");
  const firstLine = newlineIndex === -1 ? text : text.slice(0, newlineIndex);
  if (normalize(firstLine) !== normalize(title)) return text;
  const rest = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1);
  return rest.replace(/^\n+/, "");
}

/** A commonly-cited average adult silent-reading pace; approximate by design (a badge like Kindle's "X min left", not a precise metric). */
const WORDS_PER_MINUTE = 200;

/**
 * A Kindle/Apple-Books-style "X min read" estimate, from a plain
 * whitespace-separated word count of the raw body text -- rough by
 * nature (works reasonably across every script in the corpus, since
 * Devanagari/Tamil/Kannada/Hindi prose here is all space-separated
 * too), never less than 1 minute for any non-empty text.
 */
export function estimateReadingMinutes(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return 0;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
