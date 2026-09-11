/**
 * UI/UX pass: a per-section identity color, one for Divya Desams and
 * one for each Library book -- deliberately NOT distinct saturated
 * brand hues (that would contradict theme.ts's explicit "warm, muted,
 * scholarly not SaaS" palette intent). Instead, every value here is a
 * close analogous variant of the same base accent hue (~10°, a warm
 * red-brown) -- shifted a little toward orange, wine, ochre, or taupe
 * per section, all kept at the same low saturation/lightness band as
 * the existing accent color, so they read as siblings of one family
 * rather than a category-color-coded app. Used only as a thin card
 * accent stripe and (for books, which have no cover photos) a
 * monogram swatch -- never as a full background wash, so it never
 * risks text-contrast problems.
 *
 * Keyed by content slug (Divya Desams' own section, plus each of the
 * 4 real book slugs from content/library/*\/book.json) so a lookup
 * miss (a future 5th book, say) safely falls back to the app's one
 * existing accent color rather than needing a code change.
 */
export interface SectionTint {
  light: string;
  dark: string;
}

const FALLBACK: SectionTint = { light: "#7a3b2e", dark: "#d99879" };

const SECTION_TINTS: Record<string, SectionTint> = {
  "divya-desams": { light: "#80382d", dark: "#d39b92" },
  "sri-rama-charithram": { light: "#855932", dark: "#d4b69b" },
  "srimad-bhagavata-kathasagaram": { light: "#883a47", dark: "#d19ea6" },
  jaya: { light: "#7f6334", dark: "#d0ba95" },
  "untitled-recovered-book-pending-editorial-title": { light: "#80594d", dark: "#c7b0a8" },
};

export function sectionTint(slug: string, scheme: "light" | "dark"): string {
  return (SECTION_TINTS[slug] ?? FALLBACK)[scheme];
}
