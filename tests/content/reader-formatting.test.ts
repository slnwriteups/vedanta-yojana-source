// Reader-facing formatting guard. Scans every piece of text readers see
// (Divya Desams, Library chapters, knowledge pages, announcements), in
// every language, and fails when one of these simple mistakes appears:
//
// 1. a long prose paragraph drawn bold (e.g. every Hindi paragraph, or a
//    meaning paragraph after a verse);
// 2. one list drawn partly bold, partly plain (e.g. "Vinnulaga
//    Tirupatigal" plain beside six bold regions);
// 3. a word mixing two scripts (e.g. Tamil "நமः" with a Devanagari visarga);
// 4. an English prose sentence broken across two lines (a PDF hard-wrap),
//    which shows as a stray short paragraph.
//
// The website deploy and the app OTA update run this file before
// publishing, so a failure here stops the mistake reaching readers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isBoldParagraph, isListItemLine, paragraphsForReading } from "../../content-lib/text-format.ts";

const CONTENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");
const LANGUAGES = new Set(["ta", "kn", "hi", "te"]);

interface Field {
  where: string;
  language: string;
  text: string;
}

function readerFields(): Field[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        if (!name.startsWith("_")) walk(full); // _provenance, _unresolved: source records, never shown
      } else if (name.endsWith(".json")) files.push(full);
    }
  };
  walk(CONTENT);
  const fields: Field[] = [];
  for (const file of files) {
    const visit = (value: unknown, where: string, language: string) => {
      if (typeof value === "string") {
        if (value.length >= 40) fields.push({ where, language, text: value });
      } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          visit(child, `${where}.${key}`, LANGUAGES.has(key) ? key : language);
        }
      }
    };
    visit(JSON.parse(fs.readFileSync(file, "utf8")), path.relative(CONTENT, file), "en");
  }
  return fields;
}

const FIELDS = readerFields();
const MAX_BOLD_PARAGRAPH = 200;

function report(problems: string[], what: string) {
  assert.deepEqual(problems, [], `${problems.length} ${what}:\n${problems.slice(0, 20).join("\n")}`);
}

test("no long prose paragraph is drawn bold", () => {
  const problems: string[] = [];
  for (const { where, text } of FIELDS) {
    const paragraphs = paragraphsForReading(text);
    paragraphs.forEach((p, i) => {
      if ([...p].length > MAX_BOLD_PARAGRAPH && isBoldParagraph(paragraphs, i, text)) {
        problems.push(`${where} [${i}]: ${p.slice(0, 80)}`);
      }
    });
  }
  report(problems, "long paragraphs drawn bold");
});

const BULLET = /^[●•▪◦]/;
const LABEL = /^[^:.!?।]{2,45}:\s*\S/;
function listKind(p: string): string | null {
  if (isListItemLine(p)) return "numbered";
  if (BULLET.test(p)) return "bullet";
  if (p.length <= 120 && LABEL.test(p)) return "label";
  return null;
}

test("every list is drawn all bold or all plain", () => {
  const problems: string[] = [];
  for (const { where, text } of FIELDS) {
    const paragraphs = paragraphsForReading(text);
    const bold = paragraphs.map((_, i) => isBoldParagraph(paragraphs, i, text));
    for (let i = 0; i < paragraphs.length; ) {
      const kind = listKind(paragraphs[i]);
      let end = i + 1;
      while (kind && end < paragraphs.length && listKind(paragraphs[end]) === kind) end++;
      const group = bold.slice(i, end);
      if (kind && end - i > 1 && group.some(Boolean) && !group.every(Boolean)) {
        problems.push(`${where} [${i}..${end - 1}]: ${paragraphs.slice(i, end).map((p, k) => (group[k] ? "B " : "- ") + p.slice(0, 40)).join(" | ")}`);
      }
      i = end;
    }
  }
  report(problems, "lists drawn partly bold");
});

test("no word mixes Devanagari with another script", () => {
  const DEVANAGARI = /[ऀ-ॣ०-ॿ]/; // letters and signs, not the shared daṇḍas
  const OTHER = /[a-zA-Z஀-௿ఀ-౿ಀ-೿]/; // Latin, Tamil, Telugu, Kannada
  const problems: string[] = [];
  for (const { where, text } of FIELDS) {
    for (const word of text.split(/[\s"'“”‘’()\[\],.;:!?—–-]+/)) {
      if (DEVANAGARI.test(word) && OTHER.test(word)) problems.push(`${where}: ${word}`);
    }
  }
  report(problems, "mixed-script words (see docs/TRANSLATION-GUIDE.md §5.2)");
});

// Common English words: a line pair rich in them is prose, not a verse.
const ENGLISH = /\b(the|of|and|to|in|is|was|that|which|with|for|as|by|his|her|their|this|from|are|be|he|she|it|on|at|who|not|has|have|had|were|one|all|its)\b/gi;
const englishWords = (s: string) => (s.match(ENGLISH) ?? []).length;

/** Line `a` breaks off mid-sentence and `b` carries on: a hard-wrap left over from a PDF. */
export function isHardWrap(a: string, b: string): boolean {
  a = a.trim();
  b = b.trim();
  if (a.length < 25 || !b) return false;
  if (/[.!?:;)"'”’…|]$/.test(a)) return false; // a finished line or a verse pada
  if (BULLET.test(b) || isListItemLine(b) || b.includes("|")) return false;
  if (englishWords(a) < 1 || englishWords(b) < 1 || englishWords(a) + englishWords(b) < 3) return false;
  const continuesLowercase = /^[a-z(]/.test(b);
  if (a.endsWith(",")) return continuesLowercase; // "as follows," then a capitalised quote is a lead-in
  return continuesLowercase || /\b(the|of|and|a|an|in|to|as|is|by|for|with|on|at|from|or|that|which|his|her|their|was|were|be)$/i.test(a);
}

test("the hard-wrap check catches a real PDF hard-wrap and passes verse and finished lines", () => {
  assert.equal(isHardWrap("Of these, 106 are located on Earth (105 in", "India, 1 in Nepal), while the remaining two are celestial abodes"), true);
  assert.equal(isHardWrap("(8) Samadhi (reaching a state of anubhavam through dhyAnam,", "wherein the performer feels that he is seeing the Lord directly)."), true);
  assert.equal(isHardWrap("yama niyama aasanangaL iyal aavi pulanadakkam", "tamathu aRiyum dhAraNaikaL tArai aRA ninaivu ozhukkam"), false);
  assert.equal(isHardWrap("surēśaḥ śaraṇaṃ śarma viśvarētāḥ prajābhavaḥ |", "ahassaṃvatsarō vyāḻaḥ pratyayaḥ sarvadarśanaḥ ||"), false);
  assert.equal(isHardWrap("The meaning of the shloka is as follows,", "Give up all (the other) dharmas and seek Me alone."), false);
});

test("no English sentence is broken across two lines", () => {
  const problems: string[] = [];
  for (const { where, language, text } of FIELDS) {
    if (language !== "en") continue; // translations keep the English line structure
    const lines = text.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (isHardWrap(lines[i], lines[i + 1])) problems.push(`${where} line ${i}: …${lines[i].trim().slice(-40)} ⏎ ${lines[i + 1].trim().slice(0, 30)}`);
    }
  }
  report(problems, "sentences broken across lines (join the lines, and the same lines in each translation)");
});
