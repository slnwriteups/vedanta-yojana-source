import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteOfflinePasuram,
  downloadAllPasurams,
  downloadPasuram,
  getLocalPasuramPath,
  isPasuramAvailable,
  isValidPdfBytes,
  openOfflinePasuram,
  type PasuramFileSystem,
} from "../services/pasuramOfflineCore.ts";

/**
 * Exercises the real download/validate/promote/delete orchestration in
 * pasuramOfflineService.ts against a small in-memory fake filesystem --
 * no expo-file-system, no network, fully deterministic. See that
 * module's own doc comment for why every exported function takes an
 * injectable PasuramFileSystem as its last (optional-in-production)
 * parameter.
 */

const VALID_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const HTML_ERROR_PAGE = new TextEncoder().encode("<html><body>404 Not Found</body></html>");

function makeFakeFileSystem(): PasuramFileSystem & { downloadResponses: Map<string, Uint8Array | Error> } {
  const files = new Map<string, Uint8Array>();
  const downloadResponses = new Map<string, Uint8Array | Error>();

  return {
    documentDirectoryPath: "file:///document/",
    cacheDirectoryPath: "file:///cache/",
    downloadResponses,
    fileExists(path) {
      return files.has(path);
    },
    fileSize(path) {
      return files.get(path)?.length ?? 0;
    },
    readFileBytes(path) {
      const bytes = files.get(path);
      if (!bytes) throw new Error(`no such file: ${path}`);
      return bytes;
    },
    deleteFile(path) {
      if (!files.delete(path)) throw new Error(`no such file: ${path}`);
    },
    ensureDirectoryExists() {
      // the fake has no real directory concept -- files are addressed by full path
    },
    moveFile(fromPath, toPath) {
      const bytes = files.get(fromPath);
      if (!bytes) throw new Error(`no such file: ${fromPath}`);
      files.set(toPath, bytes);
      files.delete(fromPath);
    },
    async downloadFile(url, destinationPath) {
      const response = downloadResponses.get(url);
      if (response instanceof Error) throw response;
      if (!response) throw new Error(`no fake response configured for ${url}`);
      files.set(destinationPath, response);
    },
    async canOpenFiles() {
      return true;
    },
    async openFile() {
      // no-op: tests only assert on the PasuramOpenResult, not on which
      // OS share-sheet call happened
    },
  };
}

test("isValidPdfBytes: accepts real %PDF magic bytes", () => {
  assert.equal(isValidPdfBytes(VALID_PDF), true);
});

test("isValidPdfBytes: rejects an empty byte array", () => {
  assert.equal(isValidPdfBytes(new Uint8Array()), false);
});

test("isValidPdfBytes: rejects HTML content (e.g. an error page served instead of a PDF)", () => {
  assert.equal(isValidPdfBytes(HTML_ERROR_PAGE), false);
});

test("downloadPasuram: a successful download becomes available afterward", async () => {
  const fs = makeFakeFileSystem();
  const url = "https://www.prapatti.com/slokas/english/example.pdf";
  fs.downloadResponses.set(url, VALID_PDF);

  assert.equal(isPasuramAvailable(url, fs), false);
  const result = await downloadPasuram(url, fs);
  assert.equal(result.success, true);
  assert.equal(isPasuramAvailable(url, fs), true);
});

test("downloadPasuram: a non-PDF response (e.g. an HTML error page) is rejected and never becomes available", async () => {
  const fs = makeFakeFileSystem();
  const url = "https://www.prapatti.com/slokas/english/broken.pdf";
  fs.downloadResponses.set(url, HTML_ERROR_PAGE);

  const result = await downloadPasuram(url, fs);
  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.equal(isPasuramAvailable(url, fs), false);
});

test("downloadPasuram: a network failure on the first attempt leaves the resource unavailable", async () => {
  const fs = makeFakeFileSystem();
  const url = "https://www.prapatti.com/slokas/english/unreachable.pdf";
  fs.downloadResponses.set(url, new Error("network request failed"));

  const result = await downloadPasuram(url, fs);
  assert.equal(result.success, false);
  assert.equal(isPasuramAvailable(url, fs), false);
});

test("downloadPasuram: a failed REPLACEMENT download preserves the existing valid offline copy", async () => {
  const fs = makeFakeFileSystem();
  const url = "https://www.prapatti.com/slokas/english/existing.pdf";

  fs.downloadResponses.set(url, VALID_PDF);
  const first = await downloadPasuram(url, fs);
  assert.equal(first.success, true);
  const pathAfterFirst = getLocalPasuramPath(url, fs);
  const bytesAfterFirst = fs.readFileBytes(pathAfterFirst);

  // Now simulate the update check re-downloading and getting garbage back.
  fs.downloadResponses.set(url, HTML_ERROR_PAGE);
  const second = await downloadPasuram(url, fs);
  assert.equal(second.success, false);

  assert.equal(isPasuramAvailable(url, fs), true, "the original valid copy must still be there");
  assert.deepEqual(fs.readFileBytes(getLocalPasuramPath(url, fs)), bytesAfterFirst, "bytes must be unchanged");
});

test("deleteOfflinePasuram: removes the local copy and availability becomes false", async () => {
  const fs = makeFakeFileSystem();
  const url = "https://www.prapatti.com/slokas/english/deleteme.pdf";
  fs.downloadResponses.set(url, VALID_PDF);
  await downloadPasuram(url, fs);
  assert.equal(isPasuramAvailable(url, fs), true);

  deleteOfflinePasuram(url, fs);
  assert.equal(isPasuramAvailable(url, fs), false);
});

test("deleteOfflinePasuram: is safe to call when nothing was ever downloaded", () => {
  const fs = makeFakeFileSystem();
  assert.doesNotThrow(() => deleteOfflinePasuram("https://www.prapatti.com/never-downloaded.pdf", fs));
});

test("openOfflinePasuram: opens the local file and never attempts a download", async () => {
  const fs = makeFakeFileSystem();
  const url = "https://www.prapatti.com/slokas/english/toopen.pdf";
  fs.downloadResponses.set(url, VALID_PDF);
  await downloadPasuram(url, fs);

  // Deliberately do NOT configure a download response for a second call --
  // if openOfflinePasuram tried to fetch, downloadFile() would throw
  // "no fake response configured", which would surface as a thrown error
  // or a failure result rather than success.
  fs.downloadResponses.delete(url);

  const result = await openOfflinePasuram(url, fs);
  assert.equal(result.success, true);
});

test("openOfflinePasuram: fails cleanly (no crash, no phantom download) when nothing has been downloaded", async () => {
  const fs = makeFakeFileSystem();
  const result = await openOfflinePasuram("https://www.prapatti.com/slokas/english/never.pdf", fs);
  assert.equal(result.success, false);
});

test("Resource independence: downloading one language's Pasuram does not mark a different language's Pasuram as available", async () => {
  const fs = makeFakeFileSystem();
  const englishUrl = "https://www.prapatti.com/slokas/english/independence.pdf";
  const tamilUrl = "https://www.prapatti.com/slokas/tamil/independence.pdf";
  fs.downloadResponses.set(englishUrl, VALID_PDF);

  await downloadPasuram(englishUrl, fs);

  assert.equal(isPasuramAvailable(englishUrl, fs), true);
  assert.equal(isPasuramAvailable(tamilUrl, fs), false);
});

test("Two Divya Desams sharing the exact same Prapatti URL share one downloaded resource", async () => {
  const fs = makeFakeFileSystem();
  const sharedUrl = "https://www.prapatti.com/slokas/kannada/shared-shrine.pdf";
  fs.downloadResponses.set(sharedUrl, VALID_PDF);

  // Simulates temple-a's UI downloading it first...
  await downloadPasuram(sharedUrl, fs);
  // ...and temple-b's UI, for the exact same URL, seeing it as already available.
  assert.equal(isPasuramAvailable(sharedUrl, fs), true);
  assert.equal(getLocalPasuramPath(sharedUrl, fs), getLocalPasuramPath(sharedUrl, fs));
});

test("downloadAllPasurams: skips already-downloaded URLs, downloads the rest, and continues past individual failures", async () => {
  const fs = makeFakeFileSystem();
  const already = "https://www.prapatti.com/a.pdf";
  const good = "https://www.prapatti.com/b.pdf";
  const bad = "https://www.prapatti.com/c.pdf";

  fs.downloadResponses.set(already, VALID_PDF);
  await downloadPasuram(already, fs);

  fs.downloadResponses.set(good, VALID_PDF);
  fs.downloadResponses.set(bad, new Error("server error"));

  const progressCalls: number[] = [];
  const summary = await downloadAllPasurams([already, good, bad], fs, (p) => progressCalls.push(p.completed));

  assert.equal(summary.totalRequested, 3);
  assert.equal(summary.alreadyAvailable, 1);
  assert.equal(summary.downloaded, 1);
  assert.equal(summary.failed, 1);
  assert.deepEqual(summary.failedUrls, [bad]);
  assert.deepEqual(progressCalls, [1, 2, 3]);

  assert.equal(isPasuramAvailable(already, fs), true);
  assert.equal(isPasuramAvailable(good, fs), true);
  assert.equal(isPasuramAvailable(bad, fs), false);
});

test("getLocalPasuramPath: never contains the public Downloads/external-storage segments this project deliberately avoids", () => {
  const fs = makeFakeFileSystem();
  const path = getLocalPasuramPath("https://www.prapatti.com/x.pdf", fs);
  assert.doesNotMatch(path.toLowerCase(), /downloads|external-storage|sdcard/);
  assert.match(path, /^file:\/\/\/document\/pasurams\//);
});
