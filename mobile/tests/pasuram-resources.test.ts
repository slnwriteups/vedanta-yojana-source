import test from "node:test";
import assert from "node:assert/strict";
import { allPasuramResourceUrls } from "../content-lib/pasuram-resources.ts";
import { loadDivyaDesams } from "../content-lib/loader.ts";

/**
 * Exercises allPasuramResourceUrls() against both a small hand-built
 * fixture (so the dedup guarantees are checked precisely and
 * deterministically) and the real, generated Divya Desam manifest (so a
 * regression in the real content wouldn't slip past a fixture-only test).
 */

function fakeDivyaDesam(slug: string, resources: { language: string; type: string; url: string }[]) {
  return { slug, resources } as never;
}

test("allPasuramResourceUrls: collects every pasuram-pdf URL across records exactly once", () => {
  const records = [
    fakeDivyaDesam("temple-a", [
      { language: "English", type: "pasuram-pdf", url: "https://www.prapatti.com/a.pdf" },
      { language: "Tamil", type: "pasuram-pdf", url: "https://www.prapatti.com/b.pdf" },
    ]),
    fakeDivyaDesam("temple-b", [{ language: "Kannada", type: "pasuram-pdf", url: "https://www.prapatti.com/c.pdf" }]),
  ];
  const urls = allPasuramResourceUrls(records);
  assert.deepEqual(urls, [
    "https://www.prapatti.com/a.pdf",
    "https://www.prapatti.com/b.pdf",
    "https://www.prapatti.com/c.pdf",
  ]);
});

test("allPasuramResourceUrls: a URL shared by two different Divya Desams appears only once", () => {
  const sharedUrl = "https://www.prapatti.com/shared.pdf";
  const records = [
    fakeDivyaDesam("temple-a", [{ language: "Tamil", type: "pasuram-pdf", url: sharedUrl }]),
    fakeDivyaDesam("temple-b", [{ language: "Tamil", type: "pasuram-pdf", url: sharedUrl }]),
  ];
  const urls = allPasuramResourceUrls(records);
  assert.deepEqual(urls, [sharedUrl]);
});

test("allPasuramResourceUrls: the same URL repeated within one record's own resources[] still appears only once", () => {
  const repeatedUrl = "https://www.prapatti.com/repeated.pdf";
  const records = [
    fakeDivyaDesam("temple-a", [
      { language: "English", type: "pasuram-pdf", url: repeatedUrl },
      { language: "English", type: "pasuram-pdf", url: repeatedUrl },
      { language: "English", type: "pasuram-pdf", url: repeatedUrl },
    ]),
  ];
  assert.deepEqual(allPasuramResourceUrls(records), [repeatedUrl]);
});

test("allPasuramResourceUrls: a non-pasuram-pdf resource type is ignored", () => {
  const records = [
    fakeDivyaDesam("temple-a", [{ language: "English", type: "something-else", url: "https://example.com/x.pdf" }]),
  ];
  assert.deepEqual(allPasuramResourceUrls(records), []);
});

test("allPasuramResourceUrls: real content -- 432 unique Prapatti PDFs across all 107 Divya Desams (count as of the language/temple mapping audit fixing 30 mis-mapped resource entries -- see git history)", () => {
  const urls = allPasuramResourceUrls(loadDivyaDesams());
  assert.equal(urls.length, 432);
  assert.equal(new Set(urls).size, 432, "every entry must be unique");
  assert.ok(urls.every((u) => u.startsWith("https://www.prapatti.com/") && u.endsWith(".pdf")));
});
