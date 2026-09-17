import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  toMobileBook,
  toMobileChapter,
  toMobileDivyaDesam,
  toMobileKnowledge,
} from "../../content-lib/mobile-content-transform.ts";
import type { MobileBook, MobileChapter, MobileDivyaDesam, MobileKnowledge } from "../../content-lib/mobile-content.ts";
import { BookSchema, ChapterSchema, DivyaDesamSchema, KnowledgeSchema } from "../../content-lib/schemas/index.ts";

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
 *
 * The output (mobile/content-lib/manifest.generated.ts) is checked in
 * (Metro needs it to exist at bundle time) but should never be hand-
 * edited -- it is fully mechanical, like a lockfile.
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

function main(): void {
  const ddFiles = listJsonFiles(path.join(CONTENT_ROOT, "divya-desams"));
  const mobileDivyaDesams: MobileDivyaDesam[] = ddFiles.map((f) => {
    const raw = DivyaDesamSchema.parse(readJson(f));
    return toMobileDivyaDesam(raw, sourcePageNumber(raw.migration.sourcePageId));
  });

  const knowledgeFiles = listJsonFiles(path.join(CONTENT_ROOT, "knowledge"));
  const mobileKnowledge: MobileKnowledge[] = knowledgeFiles.map((f) =>
    toMobileKnowledge(KnowledgeSchema.parse(readJson(f)))
  );

  const libraryRoot = path.join(CONTENT_ROOT, "library");
  const bookDirs = listSubdirectories(libraryRoot);

  const bookGroupEntries: string[] = [];

  for (const bookDir of bookDirs) {
    const bookJsonPath = path.join(libraryRoot, bookDir, "book.json");
    if (!fs.existsSync(bookJsonPath)) continue;
    const mobileBook: MobileBook = toMobileBook(BookSchema.parse(readJson(bookJsonPath)));

    const chapterFiles = listJsonFiles(path.join(libraryRoot, bookDir, "chapters"));
    const mobileChapters: MobileChapter[] = chapterFiles.map((f) =>
      toMobileChapter(ChapterSchema.parse(readJson(f)))
    );

    // "directory" is organizational only (matching the web loader's own
    // note in content-lib/loader/index.ts) -- callers key lookups off
    // the parsed book's validated `slug` field, never this string.
    bookGroupEntries.push(
      `  { directory: ${JSON.stringify(bookDir)}, book: ${JSON.stringify(mobileBook)}, chapters: ${JSON.stringify(
        mobileChapters
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

/** One entry per book.json under content/library/, each paired with its own mobile-safe chapters. */
export const rawBookGroups: { directory: string; book: unknown; chapters: unknown[] }[] = [
${bookGroupEntries.join("\n")}
];
`;

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, "utf8");

  console.log(
    `Generated ${path.relative(REPO_ROOT, OUTPUT_FILE)}: ${ddFiles.length} Divya Desams, ${bookDirs.length} book(s), ${knowledgeFiles.length} Knowledge record(s).`
  );
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
 */
function generateImageManifest(): void {
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

  for (const filename of entries) {
    const extension = path.extname(filename).toLowerCase();
    const uuid = path.basename(filename, path.extname(filename));
    if (!IMAGE_EXTENSIONS.has(extension) || !UUID_PATTERN.test(uuid)) {
      skipped += 1;
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
 * and were skipped rather than guessed at.
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
    `Generated ${path.relative(REPO_ROOT, IMAGE_OUTPUT_FILE)}: ${mapEntries.length} image(s) (${skipped} skipped).`
  );
}

main();
generateImageManifest();
