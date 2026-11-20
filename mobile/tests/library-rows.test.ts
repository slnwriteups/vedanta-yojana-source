import test from "node:test";
import assert from "node:assert/strict";
import { chapterRows } from "../../content-lib/library-parts.ts";

test("chapterRows emits place, part and chapter rows, hiding a part heading equal to its place", () => {
  const book = {
    groups: [
      { title: "Tirumala", order: 1, chapters: ["a", "b", "c"] },
      { title: "Guruvāyūr", order: 2, chapters: ["d"] },
    ],
    parts: [
      { title: "Brahmotsavam", order: 1, chapters: ["a", "b"] },
      { title: "Guruvāyūr", order: 2, chapters: ["d"] },
    ],
  };
  const rows = chapterRows(book, ["a", "b", "c", "d", "e"].map((slug) => ({ slug })));
  assert.deepEqual(
    rows.map((r) => ("placeHeading" in r ? `P:${r.placeHeading}` : "heading" in r ? `H:${r.heading}` : `${r.item.slug}${r.index}`)),
    ["P:Tirumala", "H:Brahmotsavam", "a0", "b1", "c2", "P:Guruvāyūr", "d3", "e4"]
  );
});

test("chapterRows on a book without places gives the same rows as before (part headings, chapters)", () => {
  const rows = chapterRows({ parts: [{ title: "Part A", order: 1, chapters: ["b"] }] }, ["a", "b"].map((slug) => ({ slug })));
  assert.deepEqual(rows.map((r) => ("heading" in r ? `H:${r.heading}` : "placeHeading" in r ? "P" : r.item.slug)), ["a", "H:Part A", "b"]);
});
