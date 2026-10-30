import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { paragraphFindings, scriptFindings, SCRIPT } from "../../scripts/translation/checks.ts";
import { classify, generate, LANGS, MechanicalError, splitParagraphs, type ParagraphKind } from "../../scripts/translation/mechanical.ts";
import { glossaryFindings } from "./glossary.ts";

/**
 * Mechanical validation of a translated record against its English, under
 * the Vedanta Yojana Translation Standard (30 Oct 2026): §1 rules 1, 2, 3, 5;
 * §2 fields; §3.1 verse block; §3.2 Tamil Grantha spelling; §4.1 layout.
 *
 * Every finding names the file, language, field and (1-based) paragraph.
 * An "error" blocks completion and publication; a "warning" goes to the
 * human reviewer. Nothing here judges meaning, grammar, register or
 * theology: that is the separate linguistic and theological review, which
 * this module never records as passed.
 */

export interface Issue {
  level: "error" | "warning";
  rule: string;
  file: string;
  lang: LanguageCode | "en";
  field: string;
  paragraph?: number;
  detail: string;
}

type Loc = Pick<Issue, "file" | "lang" | "field" | "paragraph">;

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- Latin text

const LATIN_RUN = /\p{Script=Latin}+(?:['’.-]\p{Script=Latin}+)*/gu;
const IAST_MARKS = /[āīūṛṝḷḹṃṁḥśṣṇṭḍñṅēōĀĪŪṚṜḶṂṀḤŚṢṆṬḌÑṄĒŌ]/;
const URL = /\b(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|in|edu|io|gov)(?:\/[^\s)"”]*)?/gi;
// Alternatives are disjoint (a roman-numeral run, one other letter, or digits), so no token can backtrack exponentially.
const MARKER = /^(?:[ivxlcdm]+|[abefghjknopqrstuwyz]|\d+)(?:\.(?:[ivxlcdm]+|[abefghjknopqrstuwyz]|\d+))*$/i;

let allowlistCache: Record<string, string[]> | null = null;

/** Reviewed Latin tokens a book may keep (latin-allowlist.json); "*" applies to every book. */
function allowlist(book: string | undefined): Set<string> {
  allowlistCache ??= JSON.parse(fs.readFileSync(path.join(HERE, "latin-allowlist.json"), "utf8")) as Record<string, string[]>;
  return new Set([...(allowlistCache["*"] ?? []), ...(book ? allowlistCache[book] ?? [] : [])]);
}

const wordIn = (token: string, text: string) =>
  new RegExp(`(^|[^\\p{L}])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "u").test(text);

/**
 * Why a Latin token in a translation is allowed, or null if it is not.
 * Every exception must also appear, unchanged, in the English it translates:
 * a list or section marker shaped as one ("(i)", "a)", "iii.i"), an acronym
 * ("IAST"), or a token reviewed into latin-allowlist.json. URLs are handled
 * before tokens are split.
 */
function permitted(token: string, tr: string, at: number, en: string, book: string | undefined): string | null {
  const before = tr[at - 1] ?? "";
  const after = tr[at + token.length] ?? "";
  // "iii. ii)" in the English and "iii.ii)" in the translation are the same marker.
  if (MARKER.test(token) && (before === "(" || after === ")" || after === ".") && wordIn(token, en.replace(/\.\s+(?=\w+\))/g, "."))) return "marker";
  if (!wordIn(token, en)) return null;
  if (/^[A-Z][A-Z0-9]+$/.test(token)) return "acronym";
  if (allowlist(book).has(token)) return "allowlist";
  return null;
}

function excerpt(text: string, at: number, length: number): string {
  const s = Math.max(0, at - 15);
  return `…${text.slice(s, at + length + 15).replace(/\n/g, "⏎")}…`;
}

/**
 * Latin-script text left in a translation. Romanised Sanskrit (IAST marks)
 * and everything else (English) are reported separately so the reviewer
 * knows which fix applies. With `verse` set nothing is permitted.
 */
export function latinFindings(en: string, tr: string, opts: { book?: string; verse?: boolean } = {}): Array<Pick<Issue, "level" | "rule" | "detail">> {
  let scanned = tr;
  const out: Array<Pick<Issue, "level" | "rule" | "detail">> = [];
  for (const m of tr.matchAll(URL)) {
    if (!opts.verse && en.toLowerCase().includes(m[0].toLowerCase())) scanned = scanned.replace(m[0], " ".repeat(m[0].length));
  }
  const bad: Array<{ token: string; at: number }> = [];
  for (const m of scanned.matchAll(LATIN_RUN)) {
    if (!opts.verse && permitted(m[0], tr, m.index!, en, opts.book)) continue;
    bad.push({ token: m[0], at: m.index! });
  }
  if (!bad.length) return out;
  const roman = bad.filter((b) => IAST_MARKS.test(b.token));
  const english = bad.filter((b) => !IAST_MARKS.test(b.token));
  if (roman.length || opts.verse) {
    const first = roman[0] ?? bad[0];
    out.push({ level: "error", rule: "romanized-sanskrit", detail: `${(roman.length || bad.length)} romanised word(s) left, first: ${excerpt(tr, first.at, first.token.length)}` });
  }
  if (english.length && !opts.verse) {
    const first = english[0];
    out.push({ level: "error", rule: "untranslated-english", detail: `${english.length} English word(s) left (${english.slice(0, 6).map((b) => b.token).join(", ")}), first: ${excerpt(tr, first.at, first.token.length)}` });
  }
  return out;
}

// ---------------------------------------------------------------- verse paragraphs

// Bar style (। vs |) has its own finding, verse-bars; drift compares letters only.
const squash = (s: string) => s.replace(/\s+/g, "").replace(/॥/g, "||").replace(/।/g, "|");

/** Levenshtein-based similarity in [0, 1], on text without whitespace. */
function similarity(a: string, b: string): number {
  const x = [...squash(a)];
  const y = [...squash(b)];
  if (!x.length && !y.length) return 1;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

/**
 * "sh" in a romanised-only verse is ś or ṣ under the Library spelling
 * (Standard §6.1), and iastToScript reads it as s + h (स्ह). Without the
 * Devanagari, the verse cannot be converted without guessing (§6.1: never guess).
 */
export function ambiguousRomanisation(roman: string): string | null {
  return /sh/i.test(roman) ? `"sh" may be ś or ṣ; give the Devanagari above it or write the verse in full IAST` : null;
}

/** The mechanical form of a verse, name or mantra paragraph, or null when it cannot be derived. */
export function expectedForm(kind: ParagraphKind, en: string, prev: string | undefined, lang: LanguageCode): string | null {
  if (kind === "roman-alone" && ambiguousRomanisation(en)) return null;
  try {
    return generate(kind, en, prev, lang);
  } catch (e) {
    if (e instanceof MechanicalError) return null;
    throw e;
  }
}

function verseFindings(kind: ParagraphKind, en: string, prev: string | undefined, tr: string, lang: LanguageCode): Array<Pick<Issue, "level" | "rule" | "detail">> {
  const out: Array<Pick<Issue, "level" | "rule" | "detail">> = kind === "deva" ? [] : scriptFindings(tr, lang);
  if (kind === "deva") {
    if (tr !== en) {
      const keptLines = en.split("\n").filter((l) => tr.split("\n").includes(l)).length;
      out.push({ level: "error", rule: "devanagari-changed", detail: `the Devanagari verse must be kept character for character (${keptLines}/${en.split("\n").length} lines unchanged)` });
    }
    return out;
  }
  if (kind === "roman" || kind === "roman-alone") {
    out.push(...latinFindings(en, tr, { verse: true }));
    const target = lang === "hi" ? /[ऀ-ॿ]/ : SCRIPT[lang];
    if (!target.test(tr)) out.push({ level: "error", rule: "verse-script", detail: `the verse is not written in the ${lang} script` });
    const want = (kind === "roman" && prev ? prev : en).split("\n").length;
    const got = tr.split("\n").length;
    if (got !== want) out.push({ level: "error", rule: "verse-shape", detail: `${got} line(s); each transliterated line must sit under its Devanagari line (${want})` });
    if (/[।॥]/.test(tr)) out.push({ level: "warning", rule: "verse-bars", detail: "the transliterated verse uses । / ॥; the standard writes ASCII | and ||" });
    if (kind === "roman-alone") {
      const why = ambiguousRomanisation(en);
      if (why) out.push({ level: "warning", rule: "verse-unverifiable", detail: `cannot be checked against the English: ${why}` });
    }
  }
  const expected = expectedForm(kind, en, prev, lang);
  if (!expected) return out;
  // Standard §3.2: Tamil writes ś as ஶ. iastToScript's Sankalpam mode writes ச.
  if (lang === "ta" && /ஶ/.test(expected) && !/ஶ/.test(tr) && /ச/.test(tr)) {
    out.push({ level: "error", rule: "tamil-grantha", detail: "ś is written ச; Tamil Sanskrit verses write it ஶ (Standard §3.2)" });
  }
  if (squash(tr) !== squash(expected)) {
    const sim = similarity(tr, expected);
    const level = (kind === "name" || kind === "mantra") && sim < 0.9 ? "error" : "warning";
    out.push({ level, rule: "verse-drift", detail: `${Math.round(sim * 100)}% like the generated form "${expected.slice(0, 60).replace(/\n/g, "⏎")}…"` });
  }
  return out;
}

// ---------------------------------------------------------------- prose paragraphs

const LIST_MARKER = /^\s*(\((?:[ivxlcdm]+|[a-z]|\d+)\)|(?:[ivxlcdm]+|[a-z]|\d+)[.)](?=\s)|•)/i;

function markers(text: string): string[] {
  return text.split("\n").map((l) => l.match(LIST_MARKER)?.[1]).filter((m): m is string => !!m);
}

function proseFindings(en: string, tr: string, lang: LanguageCode, book: string | undefined): Array<Pick<Issue, "level" | "rule" | "detail">> {
  const out: Array<Pick<Issue, "level" | "rule" | "detail">> = paragraphFindings(en, tr, lang, "prose");
  out.push(...latinFindings(en, tr, { book }));
  out.push(...glossaryFindings(en, tr, lang, book));
  if (en.startsWith("*") && !tr.startsWith("*")) out.push({ level: "error", rule: "note-marker", detail: 'the English is a "did you know" note; keep the leading *' });
  if (!en.startsWith("*") && tr.startsWith("*")) out.push({ level: "error", rule: "note-marker", detail: "a leading * makes this a highlighted note; the English is not one" });
  const a = markers(en);
  const b = markers(tr);
  if (a.join(" ") !== b.join(" ")) out.push({ level: "warning", rule: "list-markers", detail: `list markers ${JSON.stringify(a)} in English, ${JSON.stringify(b)} in translation` });
  return out;
}

// ---------------------------------------------------------------- records

export interface CheckOptions {
  file: string;
  book?: string;
  /** The committed record, to prove the English fields were not touched. */
  original?: any;
  /** Checking an experiment candidate on purpose (cli `check --candidate`). */
  allowExperiment?: boolean;
}

/** Body checks: paragraph parity, then each paragraph by its English kind. */
export function checkBody(en: string, tr: string, lang: LanguageCode, opts: CheckOptions, field = "body"): Issue[] {
  const issues: Issue[] = [];
  const at = (paragraph?: number): Loc => ({ file: opts.file, lang, field, paragraph });
  const enParas = splitParagraphs(en);
  const trParas = splitParagraphs(tr);
  const kinds = classify(enParas);
  if (enParas.length === trParas.length) {
    enParas.forEach((p, i) => {
      const t = trParas[i];
      const found = kinds[i] === "prose" ? proseFindings(p, t, lang, opts.book) : verseFindings(kinds[i], p, enParas[i - 1], t, lang);
      for (const f of found) issues.push({ ...at(i + 1), ...f });
    });
    return issues;
  }
  // Paragraphs were merged or split, so pairing by position would compare the
  // wrong paragraphs. Report the structure, then only what holds regardless:
  // Latin text (exceptions judged against the whole English), script faults,
  // and every Devanagari block still present somewhere.
  issues.push({ ...at(), level: "error", rule: "paragraph-parity", detail: `${enParas.length} English paragraphs, ${trParas.length} translated; never merge or split (Standard §1 rule 5)` });
  trParas.forEach((t, i) => {
    const found = [...latinFindings(en, t, { book: opts.book }), ...scriptFindings(t, lang)];
    for (const f of found) issues.push({ ...at(i + 1), ...f });
  });
  enParas.forEach((p, i) => {
    if (kinds[i] === "deva" && !tr.includes(p)) {
      issues.push({ ...at(i + 1), level: "error", rule: "devanagari-changed", detail: "this Devanagari verse block is not in the translation character for character (English paragraph number)" });
    }
  });
  return issues;
}

function checkShort(en: string | undefined, tr: unknown, lang: LanguageCode, kind: "title" | "description", loc: Loc, book?: string): Issue[] {
  if (!en || !en.trim()) return [];
  if (typeof tr !== "string" || !tr.trim()) return [{ ...loc, level: "error", rule: "missing-field", detail: `no translated ${loc.field}` }];
  const found = [...paragraphFindings(en, tr, lang, kind), ...latinFindings(en, tr, { book }), ...glossaryFindings(en, tr, lang, book)];
  return found.map((f) => ({ ...loc, ...f }));
}

/** Everything outside translations (and image anchors), which a translation must never change. */
function englishPart(record: any): any {
  const copy = structuredClone(record);
  delete copy.translations;
  delete copy._experiment;
  for (const p of copy.parts ?? []) delete p.translations;
  for (const img of copy.images ?? []) delete img.placementAnchorTranslations;
  return copy;
}

export function englishDrift(original: any, candidate: any, file: string): Issue[] {
  const a = englishPart(original);
  const b = englishPart(candidate);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const changed = keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return changed.length
    ? [{ level: "error", rule: "english-changed", file, lang: "en", field: changed.join(", "), detail: "English fields and slug/order/status/images/resources must not change in a translation (Standard §1 rule 2)" }]
    : [];
}

function keyOrder(record: any, file: string): Issue[] {
  const keys = Object.keys(record.translations ?? {});
  const want = LANGS.filter((l) => keys.includes(l));
  return keys.filter((k) => LANGS.includes(k as LanguageCode)).join() === want.join()
    ? []
    : [{ level: "warning", rule: "translation-key-order", file, lang: "en", field: "translations", detail: `keys ${keys.join(", ")}; the standard orders them ${want.join(", ")}` }];
}

/**
 * One chapter or post in one language. A language with no translations entry
 * at all is "not started" and yields no issues here; callers that require
 * the language pass it to requireLanguage().
 */
export function checkChapter(record: any, lang: LanguageCode, opts: CheckOptions): Issue[] {
  const t = record.translations?.[lang];
  if (!t) return [];
  const issues: Issue[] = [];
  issues.push(...checkShort(record.title, t.title, lang, "title", { file: opts.file, lang, field: "title" }, opts.book));
  if (typeof record.body === "string" && record.body.trim()) {
    if (typeof t.body !== "string" || !t.body.trim()) issues.push({ file: opts.file, lang, field: "body", level: "error", rule: "missing-field", detail: "no translated body" });
    else issues.push(...checkBody(record.body, t.body, lang, opts));
  }
  return issues;
}

/** A book or blog's book.json in one language: title, description, every part title. */
export function checkBook(record: any, lang: LanguageCode, opts: CheckOptions): Issue[] {
  const t = record.translations?.[lang];
  const issues: Issue[] = [];
  if (!t && !(record.parts ?? []).some((p: any) => p.translations?.[lang])) return [];
  issues.push(...checkShort(record.title, t?.title, lang, "title", { file: opts.file, lang, field: "title" }, opts.book));
  issues.push(...checkShort(record.description, t?.description, lang, "description", { file: opts.file, lang, field: "description" }, opts.book));
  (record.parts ?? []).forEach((p: any, i: number) => {
    issues.push(...checkShort(p.title, p.translations?.[lang]?.title, lang, "title", { file: opts.file, lang, field: `parts[${i}].title` }, opts.book));
  });
  return issues;
}

const PLACEHOLDER = /lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|\bXXX\b|\[(?:missing|placeholder|insert)[^\]]*\]/i;

/**
 * Freeze check on the English (Standard §6.3), run before any translation is
 * prepared and again on every check: placeholder or extraction text, an
 * unresolved migration flag, a missing title or body, and verse blocks the
 * generator cannot handle without guessing (§3.1 shape, §6.1 "sh" ambiguity,
 * a name line or mantra it cannot parse, a romanised verse not in the §3.1
 * layout and so about to be sent to a translator as prose). Every finding is
 * an owner decision on the English; translation waits for it.
 */
export function checkEnglish(record: any, file: string, kind: "book" | "chapter" = "chapter"): Issue[] {
  const issues: Issue[] = [];
  const add = (field: string, rule: string, detail: string, paragraph?: number) =>
    issues.push({ level: "error", rule, file, lang: "en", field, paragraph, detail });
  if (record.migration?.needsReview) add("migration", "source-needs-review", "migration.needsReview is set; the English awaits editorial review (Standard §6.3)");
  if (typeof record.title !== "string" || !record.title.trim()) add("title", "source-missing", "no English title");
  for (const field of ["title", "description"]) {
    if (typeof record[field] === "string" && PLACEHOLDER.test(record[field])) add(field, "source-placeholder", `placeholder text: "${record[field].match(PLACEHOLDER)![0]}"`);
  }
  (record.parts ?? []).forEach((p: any, i: number) => {
    if (!p.title?.trim()) add(`parts[${i}].title`, "source-missing", "no English part title");
    else if (PLACEHOLDER.test(p.title)) add(`parts[${i}].title`, "source-placeholder", `placeholder text in a part title`);
  });
  if (kind === "book") return issues;
  if (typeof record.body !== "string" || !record.body.trim()) {
    add("body", "source-missing", "no English body");
    return issues;
  }
  const paras = splitParagraphs(record.body);
  const kinds = classify(paras);
  paras.forEach((p, i) => {
    const n = i + 1;
    if (PLACEHOLDER.test(p)) add("body", "source-placeholder", `placeholder text: "${p.match(PLACEHOLDER)![0]}"`, n);
    const k = kinds[i];
    if (k === "roman" && paras[i - 1].split("\n").length !== p.split("\n").length) {
      add("body", "source-verse-shape", `romanised verse has ${p.split("\n").length} line(s) under a ${paras[i - 1].split("\n").length}-line Devanagari block (Standard §3.1)`, n);
    }
    if (k === "roman-alone" && ambiguousRomanisation(p)) add("body", "source-verse-ambiguous", ambiguousRomanisation(p)!, n);
    if (k !== "prose" && k !== "deva" && expectedForm(k, p, paras[i - 1], "kn") === null && !(k === "roman-alone" && ambiguousRomanisation(p))) {
      add("body", "source-verse-unparsed", `this ${k} paragraph cannot be generated mechanically`, n);
    }
    if (k === "prose") {
      const lines = p.split("\n");
      const words = p.split(/\s+/).filter(Boolean);
      const iast = words.filter((w) => IAST_MARKS.test(w)).length;
      const lower = words.filter((w) => /^\p{Ll}/u.test(w)).length;
      // A heading ("Ahalyā") is not a verse: verse lines carry several words.
      const versey = words.length >= 4 && !lines.some((l) => LIST_MARKER.test(l)) && lines.every((l) => l.split(/\s+/).length >= 3 && IAST_MARKS.test(l) && !/[.?!:;"”]\s*$/.test(l)) && iast / words.length >= 0.4 && lower / words.length >= 0.6;
      if (versey) add("body", "source-verse-layout", "looks like a romanised verse but does not end with | / ||, so it would be sent to a translator as prose (Standard §3.1, §6.2)", n);
    }
  });
  return issues;
}

/**
 * Verse, name and mantra paragraphs the generator cannot write in a target
 * script without guessing: a Devanagari letter survives the conversion (the
 * Tamil rules of Standard §3.2 have no letter for vocalic ḷ, ॢ). Prep holds
 * that chapter-language and the owner settles the convention; nothing guesses.
 */
export function untransliterable(record: any, file: string, langs: LanguageCode[] = LANGS): Issue[] {
  if (typeof record.body !== "string") return [];
  const paras = splitParagraphs(record.body);
  const kinds = classify(paras);
  const issues: Issue[] = [];
  paras.forEach((p, i) => {
    if (kinds[i] === "prose" || kinds[i] === "deva") return;
    for (const lang of langs) {
      if (lang === "hi") continue;
      const g = expectedForm(kinds[i], p, paras[i - 1], lang);
      if (g === null) continue; // reported by checkEnglish
      // A name line keeps its Devanagari after "·" on purpose.
      const left = [...new Set(g.split("\n").map((l) => l.split("·")[0]).join("").match(/[\u0900-\u0963\u0966-\u097F]/gu) ?? [])];
      if (left.length) issues.push({ level: "error", rule: "source-untransliterable", file, lang, field: "body", paragraph: i + 1, detail: `${left.join(" ")} has no ${lang} rule in the Standard (§3.2); the owner must settle how to write it` });
    }
  });
  return issues;
}

export function requireLanguage(record: any, lang: LanguageCode, file: string): Issue[] {
  return record.translations?.[lang] ? [] : [{ level: "error", rule: "missing-translation", file, lang, field: "translations", detail: `no ${lang} translation` }];
}

/** Every check for one record, all languages, plus the English and key-order checks. */
export function checkRecord(record: any, opts: CheckOptions & { kind: "book" | "chapter"; langs?: LanguageCode[]; require?: boolean }): Issue[] {
  const issues: Issue[] = [];
  // Experiment candidates (translation-merge.ts --experiment) are marked so they can never pass as content.
  if (record._experiment && !opts.allowExperiment) {
    issues.push({ level: "error", rule: "experimental-candidate", file: opts.file, lang: "en", field: "_experiment", detail: `an experiment candidate (${record._experiment.name ?? "unnamed"}); it must never be copied into content/` });
  }
  if (opts.original) issues.push(...englishDrift(opts.original, record, opts.file));
  issues.push(...keyOrder(record, opts.file));
  issues.push(...checkEnglish(record, opts.file, opts.kind));
  for (const lang of opts.langs ?? LANGS) {
    if (opts.require && opts.kind === "chapter") issues.push(...requireLanguage(record, lang, opts.file));
    issues.push(...(opts.kind === "book" ? checkBook(record, lang, opts) : checkChapter(record, lang, opts)));
  }
  return issues;
}

export const blocking = (issues: Issue[]) => issues.filter((i) => i.level === "error");

export function formatIssue(i: Issue): string {
  const where = `${i.field}${i.paragraph ? ` ¶${i.paragraph}` : ""}`;
  return `${i.level === "error" ? "ERROR  " : "warning"} ${i.file} [${i.lang}] ${where} ${i.rule}: ${i.detail}`;
}
