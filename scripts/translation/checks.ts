import type { LanguageCode } from "../../content-lib/schemas/language.ts";

/**
 * Text checks shared by translation-merge.ts (per paragraph, before anything
 * is stored) and test-translation-quality.ts (per record, in CI).
 * docs/TRANSLATION-GUIDE.md §3, §4, §9.
 */

export interface Finding {
  level: "error" | "warning";
  rule: string;
  detail: string;
}

export const SCRIPT: Record<LanguageCode, RegExp> = {
  ta: /[஀-௿]/,
  kn: /[ಀ-೿]/,
  te: /[ఀ-౿]/,
  hi: /[ऀ-ॿ]/,
};

const BLOCK_NAMES: Record<LanguageCode, string> = { ta: "Tamil", kn: "Kannada", te: "Telugu", hi: "Devanagari" };

/** Script blocks that must never appear in a language's text. */
const FORBIDDEN: Record<LanguageCode, LanguageCode[]> = {
  ta: ["kn", "te"],
  kn: ["te", "ta"],
  te: ["kn", "ta"],
  hi: ["ta", "kn", "te"],
};

const NATIVE_DIGITS: Record<LanguageCode, RegExp> = {
  ta: /[௦-௯]/,
  kn: /[೦-೯]/,
  te: /[౦-౯]/,
  hi: /[०-९]/,
};

/**
 * "word (word)" pairs that are correct, because the term and its gloss
 * genuinely coincide in that language. Add a pair here only after checking it.
 */
export const GLOSS_WHITELIST: Partial<Record<LanguageCode, string[]>> = {
  te: ["విల్లు"],
};

const GLOSS_ECHO = /(\S+)\s*\(\s*\1\s*\)/gu;

/** Lines of a verse block that keep their Devanagari digits (॥ १ ॥). */
function withoutVerseLines(text: string): string {
  return text.split("\n").filter((l) => !/[।॥]/.test(l)).join("\n");
}

export function scriptFindings(text: string, lang: LanguageCode): Finding[] {
  const out: Finding[] = [];
  // A letter quoted on purpose, as in 'the "ழ" letter', is not a leak.
  const scanned = text.replace(/["'“‘(]\s*[஀-௿ఀ-೿ऀ-ॿ]{1,3}\s*["'”’)]/gu, " ");
  for (const other of FORBIDDEN[lang]) {
    const m = scanned.match(new RegExp(SCRIPT[other].source, "u"));
    if (m) {
      const at = scanned.indexOf(m[0]);
      out.push({ level: "error", rule: "script-leak", detail: `${BLOCK_NAMES[other]} character U+${m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")} in ${BLOCK_NAMES[lang]} text: "…${scanned.slice(Math.max(0, at - 12), at + 12)}…"` });
    }
  }
  if (lang !== "hi") {
    // A kept Devanagari verse line has no letters of the target script, and a
    // Sahasranaama name line carries its Devanagari after "·". Anywhere else,
    // Devanagari next to the target script (नमः in Tamil, ಮೇऽಪಿ in Kannada) is a slip.
    for (const line of text.split("\n")) {
      if (line.includes("·") || !SCRIPT[lang].test(line)) continue;
      // । and ॥ (U+0964, U+0965) are shared Indic punctuation, not Devanagari letters.
      const dev = line.match(new RegExp("\\S*[\\u0900-\\u0963\\u0966-\\u097F]\\S*", "u"));
      if (dev) {
        out.push({ level: "error", rule: "devanagari-in-prose", detail: `Devanagari inside ${BLOCK_NAMES[lang]} text: "${dev[0]}"` });
        break;
      }
    }
  }
  // A vowel sign, virama or anusvara cannot start a word: that is a broken conjunct.
  // (Tamil ஃ is a letter in its own right, as in ஃபிகஸ், so it is not listed.)
  const marks = /(^|[\s"'“‘(\[,;:.!?-])([ஂா-்ௗఀ-ఃా-ౖಀ-ಃಾ-ೖऀ-ःऺ-ॏॢॣ])/u;
  const broken = text.match(marks);
  if (broken) {
    const at = (broken.index ?? 0) + broken[1].length;
    out.push({ level: "error", rule: "broken-glyph", detail: `a combining mark starts a word: "…${text.slice(Math.max(0, at - 8), at + 8)}…"` });
  }
  const digits = withoutVerseLines(text).match(NATIVE_DIGITS[lang]);
  if (digits) out.push({ level: "error", rule: "native-digits", detail: `native digit "${digits[0]}" (use 0-9)` });
  for (const m of text.matchAll(GLOSS_ECHO)) {
    const word = m[1].replace(/^[("“]+|[,.;:)"”]+$/g, "");
    if (!/[ऀ-෿]/.test(word)) continue; // English-side echoes are not this defect
    if (GLOSS_WHITELIST[lang]?.includes(word)) continue;
    out.push({ level: "error", rule: "gloss-echo", detail: `"${m[0]}" repeats the word inside its gloss` });
  }
  return out;
}

/** Hindi words of Perso-Arabic origin; reported for review, never blocking (live Hindi uses हजार). */
const PERSO_ARABIC_HI = ["हजार", "हज़ार", "ज़िंदगी", "जिंदगी", "दुनिया", "इंसान", "किताब", "शुरू", "ख़ुद", "खुद", "मशहूर", "बेहद", "हमेशा", "ज़रूरत", "जरूरत", "इस्तेमाल", "कोशिश", "मदद", "क़ीमत", "कीमत", "ताक़त", "ताकत", "सिर्फ़", "सिर्फ"];

/** Checks for one translated prose paragraph against its English. */
export function paragraphFindings(en: string, tr: string, lang: LanguageCode, kind: "title" | "description" | "prose"): Finding[] {
  const out = scriptFindings(tr, lang);
  if (!tr.trim()) return [{ level: "error", rule: "empty", detail: "empty translation" }];
  if (/\n\s*\n/.test(tr)) out.push({ level: "error", rule: "paragraph-split", detail: "contains a blank line, which would split the paragraph" });
  if (/[A-Za-z]/.test(en) && !SCRIPT[lang].test(tr)) out.push({ level: "error", rule: "not-translated", detail: `no ${BLOCK_NAMES[lang]} text at all` });
  const latin = (tr.match(/[A-Za-z]/g) ?? []).length;
  const letters = (tr.match(/\p{L}/gu) ?? []).length;
  if (letters > 20 && latin / letters > 0.3) out.push({ level: "warning", rule: "leftover-english", detail: `${Math.round((100 * latin) / letters)}% Latin letters` });
  const enLines = en.split("\n").length;
  const trLines = tr.split("\n").length;
  if (enLines !== trLines) out.push({ level: "warning", rule: "line-count", detail: `${enLines} line(s) in English, ${trLines} in translation` });
  if (kind === "prose") {
    const enEnds = /[.?!:;"'”’)\]]\s*$/.test(en);
    const trEnds = /[.?!:;"'”’)\]।॥]\s*$/.test(tr);
    if (enEnds && !trEnds) out.push({ level: "warning", rule: "final-punctuation", detail: "English ends with punctuation; the translation does not (it would render as a heading)" });
    if (!enEnds && /[.।]\s*$/.test(tr) && en.length < 120) out.push({ level: "warning", rule: "heading-punctuation", detail: "English is a sub-heading (no final punctuation); the translation ends with a full stop" });
  }
  if (kind === "title" && /[.।]\s*$/.test(tr)) out.push({ level: "warning", rule: "title-punctuation", detail: "title ends with a full stop" });
  if (lang === "hi") {
    const found = PERSO_ARABIC_HI.filter((w) => new RegExp(`(^|[^\\u0900-\\u097F])${w}($|[^\\u0900-\\u097F])`).test(tr));
    if (found.length) out.push({ level: "warning", rule: "perso-arabic", detail: `consider a Tatsama form for: ${found.join(", ")}` });
  }
  return out;
}

export function paragraphCount(text: string): number {
  return text.split(/\n\s*\n/).filter((p) => p.trim()).length;
}
