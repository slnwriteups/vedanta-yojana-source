import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { fold } from "../../scripts/translation/work.ts";
import type { Issue } from "./validate.ts";

/**
 * The four glossaries (docs/translation-glossaries/<lang>.md) as checkable
 * rules (Standard §1 rule 4, §4.3). Read-only: nothing here writes a
 * glossary. New terms go to a pending file (pending-terms.ts) and reach the
 * glossary only when the owner approves them.
 *
 * Line format: `English[ / alt] [(sense)] = form[ / alt] [(annotation)]`.
 * Annotations add accepted forms ("pl. ಪಾಸುರಗಳು", "oblique …", "vocative …",
 * "address: …", "record has …"), a verse spelling ("verse: கச்சி"), or a
 * wrong form ("not ஹனுமான்", "never पेरुमाळ्").
 *
 * Severity, chosen so the glossary is binding without rejecting natural
 * prose: only an explicit wrong form blocks. A term whose form (or its stem,
 * for inflection) is absent is a warning for the linguistic reviewer, since
 * a pronoun or a paraphrase may stand for it. Conflicting lines and lines
 * in sections still marked "(new terms; review)" are reported, never resolved.
 */

export interface GlossaryEntry {
  lang: LanguageCode;
  line: number;
  section: string;
  /** Book slug when the line sits under that book's `# --- <book>` header. */
  book?: string;
  english: string;
  needle: string;
  sense?: string;
  forms: string[];
  verseForms: string[];
  wrong: string[];
  /** Under "reviewer's preferences": a register choice, not a name. */
  preference: boolean;
  /** Under a "(new terms; review)" header: never confirmed by the owner. */
  unreviewed: boolean;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = process.env.VY_TRANSLATION_ROOT ? path.resolve(process.env.VY_TRANSLATION_ROOT) : path.resolve(HERE, "../..");

/**
 * English words that name a sense, not a term, and are rendered by context
 * ("the Lord" is பெருமாள், எம்பெருமான், ஸ்வாமி… by sentence). Their glossary
 * lines are checked as preferences, like the reviewer's-preference sections.
 */
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, "glossary-config.json"), "utf8"));
const ADVISORY = new Set<string>(CONFIG.advisoryTerms);
/** Forms the Standard accepts besides the glossary's own (Tamil மோட்சம்), keyed by language and glossary needle. */
const VARIANTS: Partial<Record<LanguageCode, Record<string, string[]>>> = CONFIG.acceptedVariants;

const LETTERS: Record<LanguageCode, string> = {
  ta: "\\u0B80-\\u0BFF",
  kn: "\\u0C80-\\u0CFF",
  te: "\\u0C00-\\u0C7F",
  hi: "\\u0900-\\u097F",
};
const runOf = (lang: LanguageCode) => new RegExp(`[${LETTERS[lang]}\\u200C\\u200D]+(?:[ ][${LETTERS[lang]}\\u200C\\u200D]+)*`, "gu");

/** Book slugs and, for each, a distinctive word that identifies it in a section header. */
function bookKeys(root: string): Array<[string, string[]]> {
  const dir = path.join(root, "content/library");
  if (!fs.existsSync(dir)) return [];
  const slugs = fs.readdirSync(dir).filter((s) => fs.existsSync(path.join(dir, s, "book.json")));
  const words = slugs.flatMap((s) => s.split("-"));
  return slugs.map((s) => [s, [s, ...s.split("-").filter((w) => w.length >= 8 && words.filter((x) => x === w).length === 1)]]);
}

function sectionBook(header: string, books: Array<[string, string[]]>): string | undefined {
  const h = fold(header);
  return books.find(([, keys]) => keys.some((k) => h.includes(k)))?.[0];
}

function parseAnnotation(text: string, lang: LanguageCode): { extra: string[]; verse: string[]; wrong: string[] } {
  const out = { extra: [] as string[], verse: [] as string[], wrong: [] as string[] };
  for (const clause of text.split(";")) {
    const forms = clause.match(runOf(lang)) ?? [];
    if (/\b(not|never)\b/i.test(clause)) {
      // "Divya Desam form; never पेरुमाळ्": forms after the negation are wrong.
      const after = clause.slice(clause.search(/\b(not|never)\b/i));
      out.wrong.push(...(after.match(runOf(lang)) ?? []));
    } else if (/^\s*verse\s*:/i.test(clause)) out.verse.push(...forms);
    else out.extra.push(...forms);
  }
  return out;
}

export function parseGlossary(text: string, lang: LanguageCode, books: Array<[string, string[]]> = []): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  let section = "";
  text.split("\n").forEach((raw, idx) => {
    const line = raw.trim();
    if (line.startsWith("# ---")) {
      section = line.replace(/^# ---\s*/, "");
      return;
    }
    if (!line || line.startsWith("#")) return;
    const eq = line.indexOf(" = ");
    if (eq < 0) return;
    const left = line.slice(0, eq).trim();
    const right = line.slice(eq + 3).trim();
    const sense = left.match(/\(([^)]*)\)\s*$/)?.[1]?.trim();
    const alts = left.replace(/\([^)]*\)\s*$/, "").split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
    const notes = [...right.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
    // Only target-script runs are forms; free notes after a bracket ("from "the-turning"") are not.
    const bare = right.replace(/\([^)]*\)/g, " ").split(/\s*\/\s*/).map((s) => s.match(runOf(lang)) ?? []).filter((r) => r.length);
    const ann = notes.map((n) => parseAnnotation(n, lang));
    const extra = ann.flatMap((a) => a.extra);
    const verse = ann.flatMap((a) => a.verse);
    const wrong = ann.flatMap((a) => a.wrong);
    alts.forEach((alt, k) => {
      const needle = fold(alt.replace(/\([^)]*\)/g, "")).trim();
      if (needle.length < 3) return;
      const own = (bare.length === alts.length ? [bare[k]] : bare).flat();
      entries.push({
        lang,
        line: idx + 1,
        section,
        book: section ? sectionBook(section, books) : undefined,
        english: alt,
        needle,
        sense,
        forms: [...new Set([...own, ...extra])],
        verseForms: verse,
        wrong,
        preference: /reviewer'?s preferences/i.test(section) || ADVISORY.has(fold(alt).trim()),
        unreviewed: /new terms; review/i.test(section),
      });
    });
  });
  return entries;
}

const cache = new Map<string, GlossaryEntry[]>();

/** One language's glossary, parsed once per process (Standard §7: load only what is needed). */
export function loadGlossaryRules(lang: LanguageCode, root = DEFAULT_ROOT): GlossaryEntry[] {
  const key = `${root}|${lang}`;
  if (!cache.has(key)) {
    const file = path.join(root, "docs/translation-glossaries", `${lang}.md`);
    cache.set(key, fs.existsSync(file) ? parseGlossary(fs.readFileSync(file, "utf8"), lang, bookKeys(root)) : []);
  }
  return cache.get(key)!;
}

// ---------------------------------------------------------------- matching the English

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const needleRe = new Map<string, RegExp>();

/**
 * Glossary terms the English uses, longest first, so "Garuḍa Vāhanam" claims
 * its span and "Garuḍa" inside it is not checked separately. A plural or
 * possessive "s" after the term still matches it.
 */
export function termsIn(english: string, entries: GlossaryEntry[]): Map<string, GlossaryEntry[]> {
  const hay = fold(english);
  // Singular and plural lines are one term ("brāhmaṇa(s) (people)" and "Brāhmaṇas (Vedic texts)"): all senses are judged together.
  const singular = (n: string) => (n.length > 4 ? n.replace(/(?<=[a-z])e?s$/, "") : n);
  const byNeedle = new Map<string, GlossaryEntry[]>();
  for (const e of entries) byNeedle.set(singular(e.needle), [...(byNeedle.get(singular(e.needle)) ?? []), e]);
  const taken: Array<[number, number]> = [];
  const found = new Map<string, GlossaryEntry[]>();
  for (const needle of [...byNeedle.keys()].sort((a, b) => b.length - a.length)) {
    // A group with a singular line matches singular and plural; a plural-only line ("Vedas") does not claim the singular.
    const exact = byNeedle.get(needle)!.some((e) => e.needle === needle);
    const body = exact ? `${escape(needle)})(?:e?s|'s)?` : `${[...new Set(byNeedle.get(needle)!.map((e) => escape(e.needle)))].join("|")})(?:'s)?`;
    if (!needleRe.has(body)) needleRe.set(body, new RegExp(`(^|[^a-z0-9])(${body}(?=[^a-z0-9]|$)`, "g"));
    const re = needleRe.get(body)!;
    re.lastIndex = 0;
    for (const m of hay.matchAll(re)) {
      const start = m.index! + m[1].length;
      const end = start + m[2].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      found.set(needle, byNeedle.get(needle)!);
    }
  }
  return found;
}

// ---------------------------------------------------------------- matching the translation

/** Endings stripped once from the last word of a form, so inflected forms still match. */
const ENDINGS: Record<LanguageCode, string[]> = {
  ta: ["ம்", "ன்", "ர்", "ள்", "ல்"],
  kn: ["ನು", "ರು", "ಳು", "ವು", "ಂ"],
  te: ["ుడు", "డు", "లు", "ము", "ం", "రు"],
  hi: ["म्", "एँ", "एं"], // आत्माएँ → आत्मा, so the oblique आत्माओं matches
};
const VIRAMA_OR_SIGN = /[ஂா-்ಂಃಾ-್ా-్ంఃा-्ंः]$/u;

export function stem(form: string, lang: LanguageCode): string {
  let s = form;
  const ending = ENDINGS[lang].find((e) => s.endsWith(e) && s.length - e.length >= 3);
  if (ending) s = s.slice(0, -ending.length);
  else if (VIRAMA_OR_SIGN.test(s) && s.length > 3) s = s.slice(0, -1);
  return s;
}

/** "Sri" in each script: a term written straight after it (श्रीकृष्ण, ஸ்ரீவைஷ்ணவ) still starts a word. */
const SRI = ["ஸ்ரீ", "ಶ್ರೀ", "श्री", "శ్రీ"];

function atWordStart(text: string, piece: string): boolean {
  let at = text.indexOf(piece);
  while (at >= 0) {
    if (at === 0 || !/[\p{L}\p{M}]/u.test(text[at - 1]) || SRI.some((s) => text.slice(0, at).endsWith(s))) return true;
    at = text.indexOf(piece, at + 1);
  }
  return false;
}

/**
 * The form, its stem, the form written as one word (ஸ்ரீவைஷ்ணவ for
 * ஸ்ரீ வைஷ்ணவ), or every word of a multi-word form by its stem (sandhi:
 * ஸ்ரீமந் நாராயணனே for ஸ்ரீமன் நாராயணன்).
 */
function hasForm(text: string, form: string, lang: LanguageCode): boolean {
  if (atWordStart(text, form) || atWordStart(text, stem(form, lang))) return true;
  const words = form.split(" ");
  if (words.length < 2) return false;
  return atWordStart(text, words.join("")) || words.every((w) => atWordStart(text, stem(w, lang)));
}

/**
 * A wrong form as written, or by its stem when that stem starts no accepted
 * form (पेरुमाळ for "never पेरुमाळ्", while पेरुमाल stays right).
 */
function usesWrong(text: string, wrong: string, accepted: string[], lang: LanguageCode): boolean {
  if (atWordStart(text, wrong)) return true;
  const s = stem(wrong, lang);
  return s !== wrong && !accepted.some((f) => f.startsWith(s)) && atWordStart(text, s);
}

/**
 * Lines that apply to a term in this book: general lines and this book's own
 * section add up (a book section adds forms; only "not …" forbids one).
 * Another book's lines count only when nothing else covers the term.
 */
function governing(entries: GlossaryEntry[], book: string | undefined): GlossaryEntry[] {
  const here = entries.filter((e) => !e.book || e.book === book);
  return here.length ? here : entries;
}

export interface TermCheck {
  english: string;
  status: "ok" | "missing" | "wrong" | "variant";
  expected: string[];
  found?: string;
  entries: GlossaryEntry[];
}

/** Each glossary term in the English, judged against one translated paragraph or title. */
export function checkTerms(english: string, translation: string, lang: LanguageCode, book?: string, root = DEFAULT_ROOT): TermCheck[] {
  const out: TermCheck[] = [];
  for (const [, all] of termsIn(english, loadGlossaryRules(lang, root))) {
    const entries = governing(all, book);
    if (!entries.length) continue;
    const accepted = [...new Set(entries.flatMap((e) => [...e.forms, ...e.verseForms]))];
    const wrong = [...new Set(entries.flatMap((e) => e.wrong))];
    const contested = wrong.filter((w) => accepted.includes(w));
    const used = wrong.find((w) => usesWrong(translation, w, accepted, lang));
    if (!accepted.length) continue; // kept as written in Latin ("prapatti.com"): nothing to find in the target script
    const base = { english: entries[0].english, expected: accepted.filter((f) => !contested.includes(f)), entries };
    // A contested form is accepted here; the conflict itself is an owner decision in glossaryAudit().
    if (used && !contested.includes(used)) out.push({ ...base, status: "wrong", found: used });
    else if (accepted.some((f) => hasForm(translation, f, lang))) out.push({ ...base, status: "ok" });
    else {
      const variant = (VARIANTS[lang]?.[entries[0].needle] ?? []).find((v) => hasForm(translation, v, lang));
      out.push({ ...base, status: variant ? "variant" : "missing", found: variant });
    }
  }
  return out;
}

const cite = (es: GlossaryEntry[]) => es.map((e) => `${e.lang}.md:${e.line}`).join(", ");

/** Glossary findings for one paragraph, as validator issues. */
export function glossaryFindings(english: string, translation: string, lang: LanguageCode, book?: string, root = DEFAULT_ROOT): Array<Pick<Issue, "level" | "rule" | "detail">> {
  const out: Array<Pick<Issue, "level" | "rule" | "detail">> = [];
  for (const t of checkTerms(english, translation, lang, book, root)) {
    const unreviewed = t.entries.every((e) => e.unreviewed);
    if (t.status === "wrong") {
      out.push({ level: unreviewed ? "warning" : "error", rule: "glossary-wrong-variant", detail: `"${t.found}" for ${t.english}; the glossary forbids it (use ${t.expected.join(" / ")}; ${cite(t.entries)})` });
    } else if (t.status === "variant") {
      out.push({ level: "warning", rule: "glossary-preferred-form", detail: `${t.english}: "${t.found}" is accepted in existing content; new work uses ${t.expected[0]} (${cite(t.entries)})` });
    } else if (t.status === "missing") {
      const kind = t.entries.every((e) => e.preference) ? "glossary-preference" : "glossary-missing";
      out.push({ level: "warning", rule: kind, detail: `${t.english}: expected ${t.expected.slice(0, 4).join(" / ")}${unreviewed ? " (unreviewed glossary line)" : ""} (${cite(t.entries)}); check the translation uses it or a pronoun` });
    }
  }
  return out;
}

/** Owner decisions the glossaries need: conflicting lines for one term, and lines never confirmed. */
export function glossaryAudit(lang: LanguageCode, root = DEFAULT_ROOT): { conflicts: string[]; unreviewed: GlossaryEntry[] } {
  const entries = loadGlossaryRules(lang, root);
  const groups = new Map<string, GlossaryEntry[]>();
  for (const e of entries) if (!e.preference) groups.set(`${e.needle}|${e.sense ?? ""}|${e.book ?? ""}`, [...(groups.get(`${e.needle}|${e.sense ?? ""}|${e.book ?? ""}`) ?? []), e]);
  const conflicts: string[] = [];
  for (const g of groups.values()) {
    const accepted = new Set(g.flatMap((e) => e.forms));
    const wrong = g.flatMap((e) => e.wrong).filter((w) => accepted.has(w));
    if (wrong.length) conflicts.push(`${g[0].english}: "${wrong.join(", ")}" both accepted and forbidden (${cite(g)})`);
    else if (g.length > 1 && !g.some((e) => g.some((o) => o !== e && o.forms.some((f) => e.forms.includes(f))))) {
      conflicts.push(`${g[0].english}: ${g.map((e) => `${e.forms[0]} (${e.lang}.md:${e.line})`).join(" vs ")}`);
    }
  }
  return { conflicts, unreviewed: entries.filter((e) => e.unreviewed) };
}

/**
 * Words in the English that look like names or terms (IAST marks) and are
 * in no glossary line: candidates for the pending-terms file, never added
 * on their own.
 */
export function unglossedTerms(english: string, lang: LanguageCode, root = DEFAULT_ROOT): string[] {
  const entries = loadGlossaryRules(lang, root);
  const covered = termsIn(english, entries);
  const coveredHay = [...covered.keys()];
  const words = english.match(/\p{Lu}?[\p{Ll}\p{M}]*[āīūṛṝḷṃṁḥśṣṇṭḍñṅēōĀĪŪṚṜḶṂṀḤŚṢṆṬḌÑṄĒŌ][\p{L}\p{M}]*/gu) ?? [];
  return [...new Set(words)].filter((w) => !coveredHay.some((n) => n.split(" ").includes(fold(w)) || fold(w).startsWith(n)));
}
