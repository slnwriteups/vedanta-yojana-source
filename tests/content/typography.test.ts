import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guards the reader-facing text under content/ against punctuation and
// spacing slips that a spell checker never flags, e.g. "in her dream,s and
// he would" (Tirutthangal) or "Mani ( a divine gem )". Every string a
// reader can see is checked, in every language; internal bookkeeping
// (_provenance/, _unresolved/, file names, slugs, ids) is not.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONTENT_ROOT = path.join(REPO_ROOT, "content");
const SKIPPED_DIRS = new Set(["_provenance", "_unresolved"]);
const SKIPPED_KEYS = new Set(["slug", "sourcePageId", "sourceOriginalName", "src", "url", "href", "path", "id"]);

const RULES: { name: string; pattern: RegExp }[] = [
  // "dream,s" / "Mutt,Mysuru": a comma or semicolon wedged into a word.
  { name: "comma or semicolon with no space after it", pattern: /[\p{L}\p{M}]{2}[,;]\p{L}/u },
  // "( a divine gem )": a space just inside a bracket.
  { name: "space just inside a parenthesis", pattern: /\( +| +\)/u },
  // "salvation(moksham)": a Latin-script word run into its bracket.
  { name: "no space before an opening parenthesis", pattern: /\p{Script=Latin}{2}\(\p{Script=Latin}/u },
  // "dream ,s" / "her dream ." : a space before the punctuation.
  { name: "space before a comma or full stop", pattern: /\p{L}[ \t]+[,.](?=\s|$)/u },
];

function contentFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : contentFiles(path.join(dir, entry.name));
    return entry.name.endsWith(".json") ? [path.join(dir, entry.name)] : [];
  });
}

function* readerStrings(value: unknown, at: string): Generator<[string, string]> {
  if (typeof value === "string") yield [at, value];
  else if (Array.isArray(value)) for (const [i, item] of value.entries()) yield* readerStrings(item, `${at}[${i}]`);
  else if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value)) if (!SKIPPED_KEYS.has(key)) yield* readerStrings(item, `${at}.${key}`);
}

test("reader-facing content has no misplaced punctuation or bracket spacing", () => {
  const problems: string[] = [];
  for (const file of contentFiles(CONTENT_ROOT)) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const [at, text] of readerStrings(record, "")) {
      for (const { name, pattern } of RULES) {
        const match = pattern.exec(text);
        if (!match) continue;
        const snippet = text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30).replace(/\n/g, "⏎");
        problems.push(`${path.relative(CONTENT_ROOT, file)} ${at}: ${name}: …${snippet}…`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("each rule catches the slip it is named for", () => {
  const examples = ["in her dream,s and", "the Mani ( a divine gem)", "salvation(moksham)", "in her dream , and"];
  for (const [i, { pattern }] of RULES.entries()) assert.match(examples[i], pattern);
  for (const fine of ["1,000 devotees", "i.e., the Lord", "(1) Yamam", "Āzhwār (Vishṇuchittar), who", "Mr. Rao"]) {
    for (const { pattern } of RULES) assert.doesNotMatch(fine, pattern);
  }
});
