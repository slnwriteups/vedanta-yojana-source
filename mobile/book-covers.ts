/**
 * Static book-cover artwork, keyed by book slug. Unlike Divya Desams'
 * 230-photo generated manifest (image-manifest.generated.ts), there are
 * a handful of Library entries with real cover art, so a plain hand-written map
 * is simpler than generating one. A book with no entry here falls back
 * to ContentCard's monogram swatch -- never a fabricated cover.
 */
const bookCovers: Record<string, number> = {
  "sri-rama-charithram": require("./assets/book-covers/sri-rama-charithram.jpg"),
  jaya: require("./assets/book-covers/jaya.jpg"),
  "srimad-bhagavata-kathasagaram": require("./assets/book-covers/srimad-bhagavata-kathasagaram.jpg"),
  "untitled-recovered-book-pending-editorial-title": require("./assets/book-covers/untitled-recovered-book-pending-editorial-title.jpg"),
  "azhwar-vaibhavam": require("./assets/book-covers/azhwar-vaibhavam.jpg"),
  "nityasuri-vaibhavam": require("./assets/book-covers/nityasuri-vaibhavam.jpg"),
  "temples-and-festivals": require("./assets/book-covers/temples-and-festivals.jpg"),
  "sri-vishnu-sahasranaama-anubhavam": require("./assets/book-covers/sri-vishnu-sahasranaama-anubhavam.jpg"),
};

export function bookCoverAsset(slug: string): number | null {
  return bookCovers[slug] ?? null;
}
