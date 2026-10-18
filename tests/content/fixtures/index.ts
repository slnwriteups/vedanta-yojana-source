import type {
  Book,
  BookPart,
  Chapter,
  DivyaDesam,
  ImageEntry,
  Knowledge,
  MigrationMetadata,
  RelatedContentRef,
  ResourceEntry,
  Shrine,
} from "../../../content-lib/schemas/index.ts";

// NOTE: these tests run via Node's native TypeScript execution
// (`node --test`), which uses Node's own module resolution — it does NOT
// read tsconfig.json's "paths" mapping the way Next.js's bundler does.
// Test files therefore use relative imports (with explicit ".ts"
// extensions, required by Node's ESM resolution) rather than the "@/..."
// alias used inside /app and /components.

/**
 * Synthetic test fixtures ONLY.
 *
 * Every value here is invented for testing schema behavior. None of it is
 * copied from `content-extraction/` — no real temple names, no real book
 * chapter text, no real Page5/Page93/Page150 content, no real prapatti.com
 * or maps.app.goo.gl URLs, no real image UUIDs. `example.com` URLs and
 * "test-source-page-N" identifiers are used specifically so nothing here
 * could be mistaken for recovered content.
 */

export function makeMigrationMetadata(
  overrides: Partial<MigrationMetadata> = {}
): MigrationMetadata {
  return {
    sourcePageId: "test-source-page-1",
    extractionConfidence: "high",
    needsReview: false,
    ...overrides,
  };
}

export function makeImageEntry(overrides: Partial<ImageEntry> = {}): ImageEntry {
  return {
    assetId: "example-image-1",
    sourceAssetUuid: "00000000-0000-4000-8000-000000000001",
    sourceOriginalName: "example-photo.jpg",
    alt: null,
    altStatus: "needs-review",
    ...overrides,
  };
}

export function makeShrine(overrides: Partial<Shrine> = {}): Shrine {
  return {
    label: null,
    mapsLink: "https://example.com/maps/example-shrine",
    ...overrides,
  };
}

export function makeResourceEntry(overrides: Partial<ResourceEntry> = {}): ResourceEntry {
  return {
    language: "English",
    type: "pasuram-pdf",
    url: "https://example.com/resources/example-pasuram.pdf",
    ...overrides,
  };
}

export function makeRelatedContentRef(
  overrides: Partial<RelatedContentRef> = {}
): RelatedContentRef {
  return {
    type: "knowledge",
    slug: "example-related-item",
    ...overrides,
  };
}

export function makeBookPart(overrides: Partial<BookPart> = {}): BookPart {
  return {
    title: "Example Part",
    order: 1,
    chapters: [],
    ...overrides,
  };
}

/** Minimal valid Divya Desam input (before Zod defaults are applied). */
export function makeDivyaDesamInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: "example-temple",
    displayName: "Example Temple",
    migration: makeMigrationMetadata(),
    ...overrides,
  };
}

/** A more fully-populated Divya Desam input, for "everything present" cases. */
export function makeFullDivyaDesamInput(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    slug: "example-temple",
    displayName: "Example Temple",
    status: "draft",
    migration: makeMigrationMetadata(),
    templeInformation: {
      moolavar: "Example Moolavar",
      thayaar: "Example Thayaar",
      vimanam: "Example Vimanam",
      theertham: "Example Theertham",
      travelNote: "Example travel note.",
    },
    sthalaPuranam: "Example sthala puranam narrative text.",
    azhwarPasuram: "Example azhwar pasuram summary text.",
    shrines: [makeShrine()],
    images: [makeImageEntry()],
    resources: [makeResourceEntry()],
    relatedContent: [],
    ...overrides,
  } satisfies Record<string, unknown>;
}

export function makeBookInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: "example-book",
    title: "Example Book",
    migration: makeMigrationMetadata(),
    ...overrides,
  };
}

export function makeChapterInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Example Chapter",
    slug: "example-chapter",
    order: 1,
    migration: makeMigrationMetadata(),
    body: "Example body text.",
    ...overrides,
  };
}

export function makeKnowledgeInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Example Knowledge Item",
    slug: "example-knowledge-item",
    contentType: "educational",
    migration: makeMigrationMetadata(),
    body: "Example body text.",
    ...overrides,
  };
}

// Re-export types for convenience in test files.
export type { Book, Chapter, DivyaDesam, Knowledge };
