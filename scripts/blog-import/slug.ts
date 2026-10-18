/**
 * Lowercase kebab-case ASCII slug, matching content-lib's SlugSchema
 * pattern. Diacritics are folded ("Bhāgavata" -> "bhagavata") so IAST
 * titles produce readable slugs instead of empty strings.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/** Title normalised for cross-platform duplicate detection (the same post re-published on Wix after WordPress). */
export function duplicateKey(title: string): string {
  return slugify(title).replace(/-/g, "");
}
