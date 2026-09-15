import type { Book, Chapter, DivyaDesam, ImageEntry, Knowledge } from "@/content-lib/schemas";

/**
 * The public rendering boundary.
 *
 * A loaded content record (DivyaDesam/Chapter/Knowledge/Book) carries
 * migration/provenance metadata -- `migration.sourcePageId`,
 * `migration.extractionConfidence`, and each image's `sourceAssetUuid`/
 * `sourceOriginalName` -- that exists for traceability back to
 * content-extraction/, not for the public website. Every page currently
 * passes the *whole* loaded record as a prop into a Client Component
 * (for language-toggle localization, see content-lib/i18n.ts), and
 * Next.js serializes whatever crosses that boundary into the page's RSC
 * payload -- present in "View Source"/devtools even though no component
 * renders it.
 *
 * These functions produce a narrower "public" object -- same shape,
 * internal-only fields removed -- to pass across that boundary instead.
 * The source-of-truth files under content/ are never touched; this is a
 * read-only projection applied at render time, the same pattern
 * content-lib/search/corpus.ts already uses for the search index (which
 * is why that index was never part of this exposure).
 *
 * `status` and `migration.needsReview` are deliberately KEPT: DraftBadge
 * (components/shared/DraftBadge.tsx) is a real, intentional public-facing
 * indicator built on exactly those two fields, and corpus.ts already
 * treats them as the public subset of `migration`. Only `sourcePageId`
 * and `extractionConfidence` -- never surfaced by design, per DraftBadge's
 * own doc comment -- are dropped.
 */

export type PublicImageEntry = Omit<ImageEntry, "sourceAssetUuid" | "sourceOriginalName">;

export function toPublicImage(image: ImageEntry): PublicImageEntry {
  const { sourceAssetUuid: _sourceAssetUuid, sourceOriginalName: _sourceOriginalName, ...publicImage } = image;
  return publicImage;
}

interface PublicMigration {
  needsReview: boolean;
}

function toPublicMigration(migration: { needsReview: boolean }): PublicMigration {
  return { needsReview: migration.needsReview };
}

export type PublicDivyaDesam = Omit<DivyaDesam, "migration" | "images"> & {
  migration: PublicMigration;
  images: PublicImageEntry[];
};

export function toPublicDivyaDesam(record: DivyaDesam): PublicDivyaDesam {
  return {
    ...record,
    migration: toPublicMigration(record.migration),
    images: record.images.map(toPublicImage),
  };
}

export type PublicChapter = Omit<Chapter, "migration" | "images"> & {
  migration: PublicMigration;
  images: PublicImageEntry[];
};

export function toPublicChapter(record: Chapter): PublicChapter {
  return {
    ...record,
    migration: toPublicMigration(record.migration),
    images: record.images.map(toPublicImage),
  };
}

export type PublicKnowledge = Omit<Knowledge, "migration" | "images"> & {
  migration: PublicMigration;
  images: PublicImageEntry[];
};

export function toPublicKnowledge(record: Knowledge): PublicKnowledge {
  return {
    ...record,
    migration: toPublicMigration(record.migration),
    images: record.images.map(toPublicImage),
  };
}

export type PublicBook = Omit<Book, "migration" | "coverImage"> & {
  migration: PublicMigration;
  coverImage: PublicImageEntry | null | undefined;
};

export function toPublicBook(record: Book): PublicBook {
  return {
    ...record,
    migration: toPublicMigration(record.migration),
    coverImage: record.coverImage ? toPublicImage(record.coverImage) : record.coverImage,
  };
}
