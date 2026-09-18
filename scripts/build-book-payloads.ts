import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toMobileBook, toMobileChapter } from "../content-lib/mobile-content-transform.ts";
import { BOOK_PAYLOAD_SCHEMA_VERSION, type BookPayload } from "../content-lib/mobile-content.ts";
import { BookSchema, ChapterSchema } from "../content-lib/schemas/index.ts";

/**
 * Emits public/books/<slug>.json -- the downloadable counterpart of
 * mobile/scripts/generate-content-manifest.ts's bundled catalog. That
 * script keeps only each chapter's lightweight summary (title/slug/
 * order/status) in the Hermes bundle; the full book (every chapter's
 * body/images/translations) now lives here instead, published as a
 * static file and fetched on demand by
 * mobile/services/bookOfflineService.ts once a reader actually taps
 * Download for that book. Same sanitizing projection either way
 * (toMobileBook/toMobileChapter, content-lib/mobile-content-transform.ts)
 * -- migration.sourcePageId, migration.extractionConfidence, and
 * images[].sourceOriginalName never reach either output.
 *
 * Generated rather than committed (like public/search-index.json --
 * see scripts/build-search-index.ts and this repo's .gitignore), and
 * wired into the same `prebuild` step, so it can never go stale
 * relative to content/library/ or drift out of sync with a content
 * edit the way a checked-in derived file could.
 *
 * `imageFiles` records the exact on-disk filename (with its real
 * extension) for every image UUID this book's cover/chapters reference,
 * resolved the same way mobile's own image manifest resolves one --
 * matching by basename against public/images/, never assuming an
 * extension. The mobile downloader fetches each one individually from
 * the same public/images/ URL space the web app already serves them
 * from (see lib/image-file.ts's resolveImageHref for the URL shape this
 * mirrors), rather than the book JSON embedding image bytes itself.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_LIBRARY_ROOT = path.join(REPO_ROOT, "content", "library");
const IMAGES_ROOT = path.join(REPO_ROOT, "public", "images");
const OUTPUT_ROOT = path.join(REPO_ROOT, "public", "books");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** uuid (lowercased) -> real on-disk filename, built once from public/images/. */
function buildImageFilenameIndex(): Map<string, string> {
  const index = new Map<string, string>();
  if (!fs.existsSync(IMAGES_ROOT)) return index;
  for (const entry of fs.readdirSync(IMAGES_ROOT, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const uuid = path.basename(entry.name, path.extname(entry.name));
    if (UUID_PATTERN.test(uuid)) index.set(uuid.toLowerCase(), entry.name);
  }
  return index;
}

function main(): void {
  const imageFilenameIndex = buildImageFilenameIndex();
  const bookDirs = listSubdirectories(CONTENT_LIBRARY_ROOT);

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  let written = 0;
  let totalBytes = 0;
  let missingImages = 0;

  for (const bookDir of bookDirs) {
    const bookJsonPath = path.join(CONTENT_LIBRARY_ROOT, bookDir, "book.json");
    if (!fs.existsSync(bookJsonPath)) continue;

    const book = toMobileBook(BookSchema.parse(readJson(bookJsonPath)));
    const chapterFiles = listJsonFiles(path.join(CONTENT_LIBRARY_ROOT, bookDir, "chapters"));
    // listJsonFiles() returns filesystem order (alphabetical by filename),
    // not reading order -- every consumer of this array (the chapter
    // screen's "Chapter X of Y" position, findAdjacentChapters()'s
    // previous/next lookup) assumes ascending `order`, the same
    // assumption content-lib/loader.ts's bundled loadChapters() already
    // upholds for the lightweight summary list. Without this sort,
    // Previous/Next silently walked alphabetically-adjacent chapters
    // instead of narratively-adjacent ones, and the position counter
    // reported an alphabetical rank instead of the real chapter number.
    const chapters = chapterFiles
      .map((f) => toMobileChapter(ChapterSchema.parse(readJson(f))))
      .sort((a, b) => a.order - b.order);

    for (let i = 1; i < chapters.length; i++) {
      if (chapters[i].order <= chapters[i - 1].order) {
        throw new Error(
          `${bookDir}: chapter order is not strictly increasing after sort (${chapters[i - 1].slug}=${chapters[i - 1].order} then ${chapters[i].slug}=${chapters[i].order}) -- duplicate or unsortable order value`
        );
      }
    }

    const referencedUuids = new Set<string>();
    if (book.coverImage) referencedUuids.add(book.coverImage.sourceAssetUuid.toLowerCase());
    for (const chapter of chapters) for (const image of chapter.images) referencedUuids.add(image.sourceAssetUuid.toLowerCase());

    const imageFiles: Record<string, string> = {};
    for (const uuid of referencedUuids) {
      const filename = imageFilenameIndex.get(uuid);
      if (!filename) {
        missingImages += 1;
        console.warn(`  warning: ${bookDir} references image ${uuid} with no matching file under public/images/ -- omitted from imageFiles`);
        continue;
      }
      imageFiles[uuid] = filename;
    }

    const payload: BookPayload = {
      contentSchemaVersion: BOOK_PAYLOAD_SCHEMA_VERSION,
      book,
      chapters,
      imageFiles,
    };

    const outputPath = path.join(OUTPUT_ROOT, `${book.slug}.json`);
    const json = JSON.stringify(payload);
    fs.writeFileSync(outputPath, json, "utf8");
    written += 1;
    totalBytes += Buffer.byteLength(json);
  }

  const totalMb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(
    `book payloads: ${written} book(s) -> ${path.relative(REPO_ROOT, OUTPUT_ROOT)}/ (${totalMb} MB total${missingImages ? `, ${missingImages} image(s) missing from public/images/` : ""})`
  );
}

main();
