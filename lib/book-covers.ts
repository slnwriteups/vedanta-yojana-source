/**
 * Web port of mobile/book-covers.ts. Static book-cover artwork, keyed by
 * book slug -- only 4 Library books have real cover art, so a plain
 * hand-written map is simpler than a generated manifest. A book with no
 * entry here falls back to BookCard's no-cover rendering -- never a
 * fabricated cover. Source jpgs copied verbatim from
 * mobile/assets/book-covers/ into public/book-covers/; mobile's
 * require()-based numeric asset ids become plain BASE_PATH-prefixed
 * string paths here, following the same manual-prefixing convention as
 * lib/image-file.ts's resolveImageHref (a raw <img src> is never
 * rewritten by Next.js itself).
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const bookCovers: Record<string, string> = {
  "sri-rama-charithram": `${BASE_PATH}/book-covers/sri-rama-charithram.jpg`,
  jaya: `${BASE_PATH}/book-covers/jaya.jpg`,
  "srimad-bhagavata-kathasagaram": `${BASE_PATH}/book-covers/srimad-bhagavata-kathasagaram.jpg`,
  "untitled-recovered-book-pending-editorial-title": `${BASE_PATH}/book-covers/untitled-recovered-book-pending-editorial-title.jpg`,
};

export function bookCoverAsset(slug: string): string | null {
  return bookCovers[slug] ?? null;
}
