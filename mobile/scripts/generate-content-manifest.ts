import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  toMobileBook,
  toMobileDivyaDesam,
  toMobileKnowledge,
} from "../../content-lib/mobile-content-transform.ts";
import type { MobileBook, MobileChapterSummary, MobileDivyaDesam, MobileKnowledge } from "../../content-lib/mobile-content.ts";
import { BookSchema, ChapterSchema, DivyaDesamSchema, KnowledgeSchema } from "../../content-lib/schemas/index.ts";
import type { Chapter } from "../../content-lib/schemas/index.ts";

/**
 * A chapter's bundled-catalog projection: title/slug/order/status only,
 * never `body`/`images`/`translations` -- see mobile-content.ts's
 * MobileChapterSummarySchema doc comment for the full "why". Kept local
 * to this script (like sourcePageNumber below) rather than added to
 * content-lib/mobile-content-transform.ts, since nothing else needs it.
 */
function toChapterSummary(chapter: Chapter): MobileChapterSummary {
  const translations = chapter.translations
    ? Object.fromEntries(
        Object.entries(chapter.translations)
          .filter(([, t]) => t?.title)
          .map(([lang, t]) => [lang, { title: t!.title }])
      )
    : undefined;
  return {
    title: chapter.title,
    slug: chapter.slug,
    order: chapter.order,
    status: chapter.status,
    migration: { needsReview: chapter.migration.needsReview },
    ...(translations && Object.keys(translations).length > 0 ? { translations } : {}),
  };
}

/**
 * Phase 6A, Step 3/4 -- the "build-time content export step" (Option C
 * from the Phase 6A brief) that bridges /content into the mobile app
 * without ever duplicating editorial content.
 *
 * WHY this exists: Metro (React Native's bundler) requires statically
 * analyzable import paths -- unlike the Node-based web loader
 * (content-lib/loader/index.ts), it cannot fs.readdirSync() an arbitrary
 * directory at runtime and dynamically import whatever it finds. This
 * script enumerates the real, validated /content tree ONCE at build
 * time and emits a TypeScript file with the resulting records inlined
 * as literals.
 *
 * Until this fix, that inlining was instead a live
 * `import x from "*.json" with { type: "json" }` of each raw file
 * verbatim -- which meant Metro embedded every field of every content
 * record, including internal-only migration/provenance metadata
 * (`migration.sourcePageId`, `migration.extractionConfidence`,
 * `images[].sourceOriginalName`) that has no legitimate reason to ship
 * inside a public APK. This script now reads each raw file itself and
 * runs it through content-lib/mobile-content.ts's toMobileX() projection
 * -- the mobile-safe shape -- before ever writing a literal into the
 * generated file, so those fields never reach anything Metro bundles.
 * /content remains the single source of truth; this script's output is
 * a derived, sanitized snapshot of it, not a second copy of the private
 * shape.
 *
 * Regenerate after any content change:
 *   node mobile/scripts/generate-content-manifest.ts
 * (also regenerate scripts/build-book-payloads.ts's output after a book
 * change -- see that script for the downloadable-book counterpart of
 * this one.)
 *
 * The output (mobile/content-lib/manifest.generated.ts) is checked in
 * (Metro needs it to exist at bundle time) but should never be hand-
 * edited -- it is fully mechanical, like a lockfile.
 *
 * Book-bundle-removal update: a book's own record (rawBookGroups) still
 * carries its full mobile-safe metadata, but each of its chapters is now
 * projected down to MobileChapterSummarySchema (title/slug/order/status
 * only, via toChapterSummary() above) rather than the full MobileChapter
 * -- a chapter's body/images/translations are large and are only ever
 * needed once a reader downloads that book, so they no longer enter the
 * Hermes bundle at all. See content-lib/mobile-content.ts's
 * MobileChapterSummarySchema doc comment and
 * mobile/services/bookOfflineService.ts.
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(MOBILE_ROOT, "..");
const CONTENT_ROOT = path.join(REPO_ROOT, "content");
const IMAGES_ROOT = path.join(REPO_ROOT, "public", "images");
const OUTPUT_FILE = path.join(MOBILE_ROOT, "content-lib", "manifest.generated.ts");
const IMAGE_OUTPUT_FILE = path.join(MOBILE_ROOT, "content-lib", "image-manifest.generated.ts");

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function listSubdirectories(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** A valid, unique-enough JS identifier for an import binding, derived from a file path. */
function identifierFor(filePath: string, prefix: string): string {
  const base = path
    .basename(filePath, ".json")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
  return `${prefix}_${base}`;
}

/** Reads and JSON-parses a real /content file. Not schema-validated yet -- see main(). */
function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * The "page.PageN" -> integer parse. Deliberately lives here, in a
 * Node-only script Metro never bundles, rather than in
 * content-lib/mobile-content.ts -- see that module's doc comment: a
 * version of this regex (and the raw sourcePageId string it parses)
 * living in a module the app imports showed up in the compiled Hermes
 * bundle's own error-message string literal, even though the record
 * data itself was already clean. Keeping it here means neither the
 * regex's error text nor a raw "page.PageN" value can ever reach
 * anything Metro bundles.
 */
function sourcePageNumber(sourcePageId: string): number {
  const match = sourcePageId.match(/^page\.Page(\d+)$/);
  if (!match) {
    throw new Error(`Cannot derive sourceOrder: sourcePageId "${sourcePageId}" does not match "page.PageN".`);
  }
  return parseInt(match[1], 10);
}

function main(): Set<string> {
  const ddFiles = listJsonFiles(path.join(CONTENT_ROOT, "divya-desams"));
  const mobileDivyaDesams: MobileDivyaDesam[] = ddFiles.map((f) => {
    const raw = DivyaDesamSchema.parse(readJson(f));
    return toMobileDivyaDesam(raw, sourcePageNumber(raw.migration.sourcePageId));
  });

  const knowledgeFiles = listJsonFiles(path.join(CONTENT_ROOT, "knowledge"));
  const mobileKnowledge: MobileKnowledge[] = knowledgeFiles.map((f) =>
    toMobileKnowledge(KnowledgeSchema.parse(readJson(f)))
  );

  // Every image any bundled (non-book) record references -- the set the
  // static Metro image manifest must keep. A book-exclusive image (used
  // by no Divya Desam/Knowledge record) is deliberately left OUT of that
  // manifest: it only becomes reachable once its book is downloaded, via
  // bookOfflineService's local-file resolution, not via a Metro asset id.
  // See generateImageManifest() below.
  const coreImageUuids = new Set<string>();
  for (const record of mobileDivyaDesams) for (const image of record.images) coreImageUuids.add(image.sourceAssetUuid.toLowerCase());
  for (const record of mobileKnowledge) for (const image of record.images) coreImageUuids.add(image.sourceAssetUuid.toLowerCase());

  const libraryRoot = path.join(CONTENT_ROOT, "library");
  const bookDirs = listSubdirectories(libraryRoot);

  const bookGroupEntries: string[] = [];

  for (const bookDir of bookDirs) {
    const bookJsonPath = path.join(libraryRoot, bookDir, "book.json");
    if (!fs.existsSync(bookJsonPath)) continue;
    const mobileBook: MobileBook = toMobileBook(BookSchema.parse(readJson(bookJsonPath)));

    const chapterFiles = listJsonFiles(path.join(libraryRoot, bookDir, "chapters"));
    // Only the lightweight catalog projection is bundled -- no body, no
    // images, no translations. See MobileChapterSummarySchema's doc
    // comment (content-lib/mobile-content.ts) for why: the full chapter
    // is exactly the payload this task moves out of the initial APK,
    // fetched only after a reader downloads this book
    // (mobile/services/bookOfflineService.ts).
    const chapterSummaries: MobileChapterSummary[] = chapterFiles.map((f) =>
      toChapterSummary(ChapterSchema.parse(readJson(f)))
    );

    // "directory" is organizational only (matching the web loader's own
    // note in content-lib/loader/index.ts) -- callers key lookups off
    // the parsed book's validated `slug` field, never this string.
    bookGroupEntries.push(
      `  { directory: ${JSON.stringify(bookDir)}, book: ${JSON.stringify(mobileBook)}, chapters: ${JSON.stringify(
        chapterSummaries
      )} },`
    );
  }

  const output = `/**
 * AUTO-GENERATED by mobile/scripts/generate-content-manifest.ts.
 * Do not edit by hand -- regenerate instead. See that script for why
 * this file exists (Metro cannot dynamically enumerate /content the way
 * the Node-based web loader does).
 *
 * Every record below is read directly from the real /content tree at
 * generation time, validated against its full private schema, then run
 * through content-lib/mobile-content.ts's toMobileX() projection and
 * inlined here as a plain literal -- deliberately NOT a live
 * \`import x from "*.json"\` of the raw file the way this file used to
 * work. A live import would embed every field of the raw file into the
 * Hermes bundle regardless of what any downstream code did with it,
 * including internal-only migration/provenance metadata
 * (migration.sourcePageId, migration.extractionConfidence,
 * images[].sourceOriginalName) that has no legitimate reason to ship
 * inside a public APK. /content remains the single source of truth;
 * what follows is a derived, sanitized snapshot of it, regenerated
 * mechanically, never hand-edited.
 */

/** One entry per file under content/divya-desams/, mobile-safe. */
export const rawDivyaDesams: unknown[] = ${JSON.stringify(mobileDivyaDesams)};

/** One entry per file under content/knowledge/, mobile-safe. */
export const rawKnowledge: unknown[] = ${JSON.stringify(mobileKnowledge)};

/** One entry per book.json under content/library/, paired with its chapters' mobile-safe SUMMARIES only (no body/images/translations -- see MobileChapterSummarySchema). */
export const rawBookGroups: { directory: string; book: unknown; chapters: unknown[] }[] = [
${bookGroupEntries.join("\n")}
];
`;

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, "utf8");

  console.log(
    `Generated ${path.relative(REPO_ROOT, OUTPUT_FILE)}: ${ddFiles.length} Divya Desams, ${bookDirs.length} book(s), ${knowledgeFiles.length} Knowledge record(s).`
  );

  return coreImageUuids;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/**
 * Phase 6B, Step 9 -- the same build-time "static import, never copy"
 * strategy as the content manifest, applied to public/images/. Each
 * on-disk file is keyed by the `sourceAssetUuid` already stored on every
 * ImageEntry (content-lib/schemas/shared.ts) -- the same identity the web
 * app's lib/image-file.ts resolves by, preserved exactly, never renamed
 * or re-encoded. Metro's asset pipeline (not this script) does the actual
 * hashing/bundling of the referenced bytes; this script only emits the
 * `import`/lookup-table glue, mirroring generate content manifest above.
 *
 * `coreImageUuids` (computed by main() above, from the bundled Divya
 * Desam/Knowledge records only) is the allowlist: a book-exclusive image
 * -- referenced only by a book's cover/chapters, never by any always-
 * bundled record -- is deliberately excluded from this static Metro
 * manifest. Its bytes still live in public/images/ (the web app and a
 * downloaded book's JSON payload both resolve it from there), but Metro
 * never sees a `require()`/`import` for it, so it never enters the APK
 * until a reader actually downloads that book, at which point
 * bookOfflineService.ts fetches it into the app's private storage and
 * resolves it as a local file:// URI instead of a Metro asset id.
 */
function generateImageManifest(coreImageUuids: Set<string>): void {
  const entries = fs.existsSync(IMAGES_ROOT)
    ? fs
        .readdirSync(IMAGES_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort()
    : [];

  const imports: string[] = [];
  const mapEntries: string[] = [];
  let skipped = 0;
  let bookExclusive = 0;

  for (const filename of entries) {
    const extension = path.extname(filename).toLowerCase();
    const uuid = path.basename(filename, path.extname(filename));
    if (!IMAGE_EXTENSIONS.has(extension) || !UUID_PATTERN.test(uuid)) {
      skipped += 1;
      continue;
    }
    if (!coreImageUuids.has(uuid.toLowerCase())) {
      bookExclusive += 1;
      continue;
    }

    const filePath = path.join(IMAGES_ROOT, filename);
    const identifier = identifierFor(filePath, "img");
    const relative = path.relative(path.dirname(IMAGE_OUTPUT_FILE), filePath);
    imports.push(`import ${identifier} from "${relative.startsWith(".") ? relative : `./${relative}`}";`);
    mapEntries.push(`  "${uuid.toLowerCase()}": ${identifier},`);
  }

  const output = `/**
 * AUTO-GENERATED by mobile/scripts/generate-content-manifest.ts.
 * Do not edit by hand -- regenerate instead.
 *
 * Every import below points DIRECTLY at the real public/images/ file for
 * that sourceAssetUuid (via mobile/metro.config.js's watchFolders) --
 * nothing here is a copy, a rename, or a re-encode. ${skipped} file(s)
 * under public/images/ did not match the expected UUID-named-image shape
 * and were skipped rather than guessed at. ${bookExclusive} book-exclusive
 * image(s) were deliberately excluded -- see this function's own doc
 * comment.
 */
${imports.join("\n")}

/** sourceAssetUuid (lowercased) -> Metro-resolved image asset. */
export const imagesByUuid: Record<string, number> = {
${mapEntries.join("\n")}
};
`;

  fs.mkdirSync(path.dirname(IMAGE_OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(IMAGE_OUTPUT_FILE, output, "utf8");

  console.log(
    `Generated ${path.relative(REPO_ROOT, IMAGE_OUTPUT_FILE)}: ${mapEntries.length} image(s) (${skipped} skipped, ${bookExclusive} book-exclusive/excluded).`
  );
}

const coreImageUuids = main();
generateImageManifest(coreImageUuids);
