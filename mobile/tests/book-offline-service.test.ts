import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteBook,
  downloadBook,
  getLocalBookContentHash,
  getOfflineBookImageUri,
  isBookAvailable,
  loadOfflineBook,
  type BookFileSystem,
} from "../services/bookOfflineCore.ts";
import { sha256Hex } from "../services/sha256.ts";
import { BOOK_PAYLOAD_SCHEMA_VERSION, type BookPayload } from "../../content-lib/mobile-content.ts";

/**
 * Exercises the real download/validate/promote/delete orchestration in
 * bookOfflineCore.ts against a small in-memory fake filesystem -- no
 * expo-file-system, no network, fully deterministic. See that module's
 * own doc comment for why every exported function takes an injectable
 * BookFileSystem as its last parameter, mirroring
 * pasuram-offline-service.test.ts's own fake-filesystem pattern.
 */

function validPayload(overrides: Partial<BookPayload> = {}): BookPayload {
  return {
    contentSchemaVersion: BOOK_PAYLOAD_SCHEMA_VERSION,
    book: {
      slug: "test-book",
      title: "Test Book",
      status: "published",
      migration: { needsReview: false },
      parts: [],
      chapterOrder: ["chapter-one"],
    },
    chapters: [
      {
        title: "Chapter One",
        slug: "chapter-one",
        order: 1,
        status: "published",
        migration: { needsReview: false },
        body: "Once upon a time.",
        images: [],
      },
    ],
    imageFiles: {},
    ...overrides,
  };
}

function makeFakeFileSystem(): BookFileSystem & { remoteResponses: Map<string, string | Error> } {
  const files = new Map<string, string>();
  const remoteResponses = new Map<string, string | Error>();

  function isUnderDirectory(path: string, dirPath: string): boolean {
    const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;
    return path.startsWith(prefix);
  }

  return {
    documentDirectoryPath: "file:///document/",
    cacheDirectoryPath: "file:///cache/",
    remoteResponses,
    fileExists(path) {
      return files.has(path);
    },
    fileSize(path) {
      return files.get(path)?.length ?? 0;
    },
    readTextFile(path) {
      const content = files.get(path);
      if (content === undefined) throw new Error(`no such file: ${path}`);
      return content;
    },
    writeTextFile(path, content) {
      files.set(path, content);
    },
    deleteFile(path) {
      files.delete(path);
    },
    deleteDirectory(dirPath) {
      for (const path of [...files.keys()]) {
        if (isUnderDirectory(path, dirPath)) files.delete(path);
      }
    },
    ensureDirectoryExists() {
      // the fake has no real directory concept -- files are addressed by full path
    },
    moveFile(fromPath, toPath) {
      const content = files.get(fromPath);
      if (content === undefined) throw new Error(`no such file: ${fromPath}`);
      files.set(toPath, content);
      files.delete(fromPath);
    },
    async downloadTextFile(url, destinationPath) {
      const response = remoteResponses.get(url);
      if (response instanceof Error) throw response;
      if (response === undefined) throw new Error(`no fake response configured for ${url}`);
      files.set(destinationPath, response);
    },
    async downloadBinaryFile(url, destinationPath) {
      const response = remoteResponses.get(url);
      if (response instanceof Error) throw response;
      if (response === undefined) throw new Error(`no fake response configured for ${url}`);
      files.set(destinationPath, response);
    },
  };
}

const BOOK_JSON_URL = "https://example.com/books/test-book.json";
const IMAGE_BASE_URL = "https://example.com/images";

test("downloadBook: a successful download becomes available afterward, with the real body readable", async () => {
  const fs = makeFakeFileSystem();
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify(validPayload()));

  assert.equal(isBookAvailable("test-book", fs), false);
  const result = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(result.success, true);
  assert.equal(isBookAvailable("test-book", fs), true);

  const offline = loadOfflineBook("test-book", fs);
  assert.ok(offline);
  assert.equal(offline!.chapters[0].body, "Once upon a time.");
});

test("downloadBook: also downloads every referenced image and makes it resolvable locally", async () => {
  const fs = makeFakeFileSystem();
  const payload = validPayload({
    chapters: [
      {
        title: "Chapter One",
        slug: "chapter-one",
        order: 1,
        status: "published",
        migration: { needsReview: false },
        body: "Once upon a time.",
        images: [{ assetId: "a1", sourceAssetUuid: "ABCD1234", alt: null, altStatus: "needs-review" }],
      },
    ],
    imageFiles: { abcd1234: "abcd1234.jpg" },
  });
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify(payload));
  fs.remoteResponses.set(`${IMAGE_BASE_URL}/abcd1234.jpg`, "<fake image bytes>");

  const result = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(result.success, true);
  assert.equal(getOfflineBookImageUri("test-book", "ABCD1234", fs), "file:///document/books/test-book/images/abcd1234.jpg");
});

test("downloadBook: a malformed JSON response is rejected and never becomes available", async () => {
  const fs = makeFakeFileSystem();
  fs.remoteResponses.set(BOOK_JSON_URL, "<html>404 Not Found</html>");

  const result = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.equal(isBookAvailable("test-book", fs), false);
});

test("downloadBook: a payload for the wrong book slug is rejected", async () => {
  const fs = makeFakeFileSystem();
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify(validPayload({ book: { ...validPayload().book, slug: "other-book" } })));

  const result = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(result.success, false);
  assert.equal(isBookAvailable("test-book", fs), false);
});

test("downloadBook: an incompatible contentSchemaVersion is rejected", async () => {
  const fs = makeFakeFileSystem();
  const payload = validPayload();
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify({ ...payload, contentSchemaVersion: 999 }));

  const result = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(result.success, false);
  assert.equal(isBookAvailable("test-book", fs), false);
});

test("downloadBook: a network failure on the book JSON itself leaves the book unavailable", async () => {
  const fs = makeFakeFileSystem();
  fs.remoteResponses.set(BOOK_JSON_URL, new Error("network request failed"));

  const result = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(result.success, false);
  assert.equal(isBookAvailable("test-book", fs), false);
});

test("downloadBook: a failure downloading one referenced image fails the whole book, not a partial book", async () => {
  const fs = makeFakeFileSystem();
  const payload = validPayload({
    chapters: [
      {
        title: "Chapter One",
        slug: "chapter-one",
        order: 1,
        status: "published",
        migration: { needsReview: false },
        body: "Once upon a time.",
        images: [{ assetId: "a1", sourceAssetUuid: "ABCD1234", alt: null, altStatus: "needs-review" }],
      },
    ],
    imageFiles: { abcd1234: "abcd1234.jpg" },
  });
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify(payload));
  fs.remoteResponses.set(`${IMAGE_BASE_URL}/abcd1234.jpg`, new Error("connection reset"));

  const result = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(result.success, false);
  assert.equal(isBookAvailable("test-book", fs), false, "a book with a failed image must not be marked available");
});

test("downloadBook: a failed REPLACEMENT download preserves the existing valid offline copy", async () => {
  const fs = makeFakeFileSystem();
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify(validPayload()));

  const first = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(first.success, true);
  const bodyAfterFirst = loadOfflineBook("test-book", fs)!.chapters[0].body;

  // Simulate a later re-download attempt getting a broken response.
  fs.remoteResponses.set(BOOK_JSON_URL, "not json at all");
  const second = await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(second.success, false);

  assert.equal(isBookAvailable("test-book", fs), true, "the original valid copy must still be there");
  assert.equal(loadOfflineBook("test-book", fs)!.chapters[0].body, bodyAfterFirst);
});

test("getLocalBookContentHash: matches sha256Hex of the exact downloaded body, and is null before any download", async () => {
  const fs = makeFakeFileSystem();
  assert.equal(getLocalBookContentHash("test-book", fs), null);

  const json = JSON.stringify(validPayload());
  fs.remoteResponses.set(BOOK_JSON_URL, json);
  await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);

  assert.equal(getLocalBookContentHash("test-book", fs), sha256Hex(json));
});

test("getLocalBookContentHash: changes after a genuine content re-sync, and deleteBook clears it", async () => {
  const fs = makeFakeFileSystem();
  const firstJson = JSON.stringify(validPayload());
  fs.remoteResponses.set(BOOK_JSON_URL, firstJson);
  await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  const firstHash = getLocalBookContentHash("test-book", fs);

  const secondJson = JSON.stringify(
    validPayload({ chapters: [{ ...validPayload().chapters[0], body: "A genuinely different body." }] })
  );
  fs.remoteResponses.set(BOOK_JSON_URL, secondJson);
  await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);

  assert.notEqual(getLocalBookContentHash("test-book", fs), firstHash);
  assert.equal(getLocalBookContentHash("test-book", fs), sha256Hex(secondJson));

  deleteBook("test-book", fs);
  assert.equal(getLocalBookContentHash("test-book", fs), null);
});

test("deleteBook: removes the local copy and availability becomes false", async () => {
  const fs = makeFakeFileSystem();
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify(validPayload()));
  await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);
  assert.equal(isBookAvailable("test-book", fs), true);

  deleteBook("test-book", fs);
  assert.equal(isBookAvailable("test-book", fs), false);
});

test("deleteBook: is safe to call when nothing was ever downloaded", () => {
  const fs = makeFakeFileSystem();
  assert.doesNotThrow(() => deleteBook("never-downloaded", fs));
});

test("loadOfflineBook: returns null (not a crash) when nothing has been downloaded", () => {
  const fs = makeFakeFileSystem();
  assert.equal(loadOfflineBook("never-downloaded", fs), null);
});

test("getOfflineBookImageUri: returns null for an image the book doesn't reference", async () => {
  const fs = makeFakeFileSystem();
  fs.remoteResponses.set(BOOK_JSON_URL, JSON.stringify(validPayload()));
  await downloadBook("test-book", BOOK_JSON_URL, IMAGE_BASE_URL, fs);

  assert.equal(getOfflineBookImageUri("test-book", "not-a-real-uuid", fs), null);
});

test("Two books download and coexist independently", async () => {
  const fs = makeFakeFileSystem();
  const bookAUrl = "https://example.com/books/book-a.json";
  const bookBUrl = "https://example.com/books/book-b.json";
  fs.remoteResponses.set(bookAUrl, JSON.stringify(validPayload({ book: { ...validPayload().book, slug: "book-a" } })));
  fs.remoteResponses.set(bookBUrl, JSON.stringify(validPayload({ book: { ...validPayload().book, slug: "book-b" } })));

  await downloadBook("book-a", bookAUrl, IMAGE_BASE_URL, fs);
  await downloadBook("book-b", bookBUrl, IMAGE_BASE_URL, fs);

  assert.equal(isBookAvailable("book-a", fs), true);
  assert.equal(isBookAvailable("book-b", fs), true);

  deleteBook("book-a", fs);
  assert.equal(isBookAvailable("book-a", fs), false);
  assert.equal(isBookAvailable("book-b", fs), true, "deleting one book must not affect another");
});
