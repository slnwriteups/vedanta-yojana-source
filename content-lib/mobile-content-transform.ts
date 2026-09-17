import type { Book, Chapter, DivyaDesam, ImageEntry, Knowledge } from "./schemas/index.ts";
import type {
  MobileBook,
  MobileChapter,
  MobileDivyaDesam,
  MobileImageEntry,
  MobileKnowledge,
  MobileMigration,
} from "./mobile-content.ts";

/**
 * The mobile public boundary: the actual private-record -> mobile-safe
 * projection functions, deliberately kept OUT of ./mobile-content.ts --
 * see that file's doc comment (point 2) for the full "why". In short:
 * toMobileImage() has to reference the literal property name
 * `sourceOriginalName` once, to strip it -- fine in a module only
 * mobile/scripts/generate-content-manifest.ts (a Node-only script Metro
 * never bundles) imports, but not in a module mobile/content-lib/
 * loader.ts (which Metro DOES bundle) also imports for its schemas.
 *
 * Every import above is `import type` -- erased entirely at compile
 * time, so this file has no runtime dependency on ./mobile-content.ts or
 * ./schemas/index.ts, even though it names types from both.
 */

export function toMobileImage(image: ImageEntry): MobileImageEntry {
  const { sourceOriginalName: _sourceOriginalName, ...mobileImage } = image;
  return mobileImage;
}

function toMobileMigration(migration: { needsReview: boolean }): MobileMigration {
  return { needsReview: migration.needsReview };
}

/**
 * `sourceOrder` is computed by the caller (generate-content-manifest.ts),
 * not derived here -- the "page.PageN" parse must not live in anything
 * Metro could ever bundle, and this file, unlike ./mobile-content.ts,
 * is imported only by that Node-only script -- but keeping the parse out
 * of here too means it stays true even if that ever changes.
 */
export function toMobileDivyaDesam(record: DivyaDesam, sourceOrder: number): MobileDivyaDesam {
  return {
    ...record,
    migration: toMobileMigration(record.migration),
    images: record.images.map(toMobileImage),
    sourceOrder,
  };
}

export function toMobileChapter(record: Chapter): MobileChapter {
  return {
    ...record,
    migration: toMobileMigration(record.migration),
    images: record.images.map(toMobileImage),
  };
}

export function toMobileKnowledge(record: Knowledge): MobileKnowledge {
  return {
    ...record,
    migration: toMobileMigration(record.migration),
    images: record.images.map(toMobileImage),
  };
}

export function toMobileBook(record: Book): MobileBook {
  return {
    ...record,
    migration: toMobileMigration(record.migration),
    coverImage: record.coverImage ? toMobileImage(record.coverImage) : record.coverImage,
  };
}
