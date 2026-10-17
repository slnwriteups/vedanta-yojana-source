/**
 * Where a chapter's images go in its text, shared by the web reader
 * (components/library/LocalizedChapterBody.tsx) and the app's
 * (mobile/app/(tabs)/library/[book]/[chapter].tsx).
 *
 * An image with a `placementAnchor` is shown directly after the paragraph
 * that anchor ends -- the anchor is the closing words of that paragraph,
 * copied verbatim (scripts/blog-import/publish-blog.ts writes it from an
 * "@image N" line in the edited text). So a photo of a procession sits
 * right below the paragraph describing it instead of in a gallery.
 *
 * In a translation, `placementAnchorTranslations[language]` is used
 * instead. Images with no anchor, or whose anchor isn't in the text being
 * shown (a translation without its own anchor), go above the text, as every chapter image did before --
 * an image is never dropped.
 *
 * `paragraphs` is paragraphsForReading(text): the same blocks the
 * renderers draw, so the returned indexes line up with what they render.
 * A long paragraph may have been split there at sentence boundaries; the
 * anchor is matched against the END of a block, so an image still lands
 * after the whole paragraph, never inside it.
 */

export interface InlineImagePlacement<T> {
  /** Images to show above the text. */
  top: T[];
  /** Block index -> images to show directly after that block. */
  after: Map<number, T[]>;
}

/** Whitespace-insensitive, so a reflowed line break never breaks the match. */
function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function placeInlineImages<
  T extends { placementAnchor?: string | null; placementAnchorTranslations?: Partial<Record<string, string>> | null },
>(paragraphs: string[], images: T[], language: string | null = null): InlineImagePlacement<T> {
  const ends = paragraphs.map(squash);
  const placement: InlineImagePlacement<T> = { top: [], after: new Map() };
  for (const image of images) {
    // In a translation, the anchor in that language (when there is one).
    const raw = (language && image.placementAnchorTranslations?.[language]) || image.placementAnchor;
    const anchor = raw ? squash(raw) : "";
    // A block split at a sentence boundary may end with only part of the
    // anchor, so the previous block is considered together with it too.
    const index = anchor
      ? ends.findIndex((block, i) => block.endsWith(anchor) || (i > 0 && `${ends[i - 1]} ${block}`.endsWith(anchor)))
      : -1;
    if (index === -1) {
      placement.top.push(image);
      continue;
    }
    placement.after.set(index, [...(placement.after.get(index) ?? []), image]);
  }
  return placement;
}

/**
 * The anchor for an image placed after `paragraph`: its closing words,
 * long enough to be unique in practice (and checked to be by the
 * publishing script), short enough to survive a sentence-boundary split.
 */
export function anchorForParagraph(paragraph: string, length = 48): string {
  const text = squash(paragraph);
  if (text.length <= length) return text;
  const tail = text.slice(-length);
  // Start at a word boundary so the anchor reads as words, not a fragment.
  const space = tail.indexOf(" ");
  return space >= 0 && space < tail.length - 12 ? tail.slice(space + 1) : tail;
}
