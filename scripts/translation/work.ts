import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { classify, generate, LANGS, splitParagraphs, type ParagraphKind } from "./mechanical.ts";

/**
 * Shared plumbing for the session-based translation workflow
 * (docs/TRANSLATION-WORKFLOW.md): what is still untranslated, the
 * translation-work/ store of finished prose paragraphs, the glossaries,
 * and assembling finished bodies back into content/.
 */

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const WORK_DIR = path.join(ROOT, "translation-work");

// ---------------------------------------------------------------- CLI + files

export function args(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? "true";
  }
  return out;
}

export function readJson<T = any>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/** Same format as every content file: two-space JSON, real characters, final newline. */
export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export function hash(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 10);
}

/** Puts translations.<lang> keys in the house order ta, kn, hi, te. */
export function orderTranslations<T>(t: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const l of LANGS) if (t[l] !== undefined) out[l] = t[l];
  for (const [k, v] of Object.entries(t)) if (!(k in out)) out[k] = v;
  return out;
}

// ---------------------------------------------------------------- the book

export interface Chapter {
  slug: string;
  file: string;
  record: any;
  paragraphs: string[];
  kinds: ParagraphKind[];
}

export interface Book {
  slug: string;
  dir: string;
  file: string;
  record: any;
  chapters: Chapter[];
}

export function loadBook(slug: string): Book {
  const dir = path.join(ROOT, "content/library", slug);
  const file = path.join(dir, "book.json");
  if (!fs.existsSync(file)) throw new Error(`No book at content/library/${slug}`);
  const record = readJson(file);
  const chapters = (record.chapterOrder as string[]).map((s) => {
    const cfile = path.join(dir, "chapters", `${s}.json`);
    const rec = readJson(cfile);
    const paragraphs = splitParagraphs(rec.body);
    return { slug: s, file: cfile, record: rec, paragraphs, kinds: classify(paragraphs) };
  });
  return { slug, dir, file, record, chapters };
}

export function parseLangs(value: string | undefined): LanguageCode[] {
  if (!value) return [...LANGS];
  const langs = value.split(",").map((s) => s.trim()) as LanguageCode[];
  for (const l of langs) if (!LANGS.includes(l)) throw new Error(`Unknown language "${l}" (use ta, kn, hi, te)`);
  return langs;
}

// ---------------------------------------------------------------- work items

/**
 * One translatable unit. Ids: `@book.title`, `@book.description`,
 * `@part.<i>.title`, `<chapter>.title`, `<chapter>.<paragraph index>`.
 */
export interface Item {
  id: string;
  group: string; // "@book" or the chapter slug
  kind: "title" | "description" | "prose";
  en: string;
  enHash: string;
}

export function bookItems(book: Book): Item[] {
  const r = book.record;
  const items: Item[] = [{ id: "@book.title", group: "@book", kind: "title", en: r.title, enHash: hash(r.title) }];
  if (r.description) items.push({ id: "@book.description", group: "@book", kind: "description", en: r.description, enHash: hash(r.description) });
  (r.parts ?? []).forEach((p: any, i: number) => items.push({ id: `@part.${i}.title`, group: "@book", kind: "title", en: p.title, enHash: hash(p.title) }));
  return items;
}

export function chapterItems(ch: Chapter): Item[] {
  const items: Item[] = [{ id: `${ch.slug}.title`, group: ch.slug, kind: "title", en: ch.record.title, enHash: hash(ch.record.title) }];
  ch.paragraphs.forEach((p, i) => {
    if (ch.kinds[i] === "prose") items.push({ id: `${ch.slug}.${i}`, group: ch.slug, kind: "prose", en: p, enHash: hash(p) });
  });
  return items;
}

/** Languages a group still needs in content/ (not counting the store). */
export function missingLangs(book: Book, group: string, langs: LanguageCode[]): LanguageCode[] {
  if (group === "@book") {
    const r = book.record;
    return langs.filter((l) => {
      const t = r.translations?.[l];
      if (!t?.title || (r.description && !t.description)) return true;
      return (r.parts ?? []).some((p: any) => !p.translations?.[l]?.title);
    });
  }
  const ch = book.chapters.find((c) => c.slug === group)!;
  return langs.filter((l) => !ch.record.translations?.[l]?.body || !ch.record.translations?.[l]?.title);
}

/** The live translation of a book-level item, if content/ already has it. */
export function bookValue(book: Book, id: string, lang: LanguageCode): string | undefined {
  const r = book.record;
  if (id === "@book.title") return r.translations?.[lang]?.title;
  if (id === "@book.description") return r.translations?.[lang]?.description;
  const m = id.match(/^@part\.(\d+)\.title$/);
  return m ? r.parts?.[Number(m[1])]?.translations?.[lang]?.title : undefined;
}

/** Whether content/ already carries this item in `lang` (a chapter counts once it has a body). */
export function inContent(book: Book, item: Item, lang: LanguageCode): boolean {
  if (item.group === "@book") return !!bookValue(book, item.id, lang);
  const t = book.chapters.find((c) => c.slug === item.group)!.record.translations?.[lang];
  return item.kind === "title" ? !!t?.title : !!t?.body;
}

// ---------------------------------------------------------------- the store

/** translation-work/<book>/store.json: finished prose, keyed by item id, per language. */
export interface Store {
  book: string;
  items: Record<string, { en: string } & Partial<Record<LanguageCode, string>>>;
}

export function storePath(book: string): string {
  return path.join(WORK_DIR, book, "store.json");
}

export function loadStore(book: string): Store {
  const file = storePath(book);
  return fs.existsSync(file) ? readJson<Store>(file) : { book, items: {} };
}

export function saveStore(store: Store): void {
  const sorted: Store["items"] = {};
  for (const k of Object.keys(store.items).sort()) sorted[k] = store.items[k];
  writeJson(storePath(store.book), { book: store.book, items: sorted });
}

/** A stored translation counts only while its English is unchanged. */
export function stored(store: Store, item: Item, lang: LanguageCode): string | undefined {
  const s = store.items[item.id];
  return s && s.en === item.enHash ? s[lang] : undefined;
}

// ---------------------------------------------------------------- glossaries

export interface GlossaryEntry {
  key: string; // English side, as written
  needles: string[]; // normalised search forms
  forms: Partial<Record<LanguageCode, string>>;
}

export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * The four glossaries merged into one row per English term. Lines like
 * "Devakī / Vasudeva = ದೇವಕಿ / ವಸುದೇವ" are split into one row per
 * alternative, so the same term lines up across languages even when the
 * four files group it differently. A bracketed note on the English side
 * ("Vasudeva (the Lord)") keeps that sense on its own row.
 */
export function loadGlossary(): GlossaryEntry[] {
  const rows = new Map<string, GlossaryEntry>();
  for (const lang of LANGS) {
    const file = path.join(ROOT, "docs/translation-glossaries", `${lang}.md`);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      const i = line.indexOf(" = ");
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      const form = line.slice(i + 3).trim();
      const note = (key.match(/\(([^)]*)\)\s*$/)?.[1] ?? "").trim();
      const alts = key.replace(/\([^)]*\)\s*$/, "").split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
      const forms = form.replace(/\s*\(verse:[^)]*\)\s*$/, "").split(/\s*\/\s*/);
      alts.forEach((alt, k) => {
        const needle = fold(alt.replace(/\([^)]*\)/g, "").trim());
        if (needle.length < 3) return;
        const rowKey = `${needle}|${fold(note)}`;
        let row = rows.get(rowKey);
        if (!row) {
          row = { key: note ? `${alt} (${note})` : alt, needles: [needle], forms: {} };
          rows.set(rowKey, row);
        }
        if (!row.forms[lang]) row.forms[lang] = forms.length === alts.length ? forms[k].trim() : form;
      });
    }
  }
  return [...rows.values()];
}

export function glossaryFor(entries: GlossaryEntry[], texts: string[]): GlossaryEntry[] {
  const hay = fold(texts.join("\n"));
  return entries.filter((e) =>
    e.needles.some((n) => new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(hay)),
  );
}

// ---------------------------------------------------------------- assembly

/** The full translated body for a chapter, or the list of prose ids still missing. */
export function assembleBody(ch: Chapter, store: Store, lang: LanguageCode): { body?: string; missing: string[] } {
  const out: string[] = [];
  const missing: string[] = [];
  ch.paragraphs.forEach((p, i) => {
    const kind = ch.kinds[i];
    if (kind === "prose") {
      const s = store.items[`${ch.slug}.${i}`];
      const t = s && s.en === hash(p) ? s[lang] : undefined;
      if (t) out.push(t);
      else missing.push(`${ch.slug}.${i}`);
    } else out.push(generate(kind, p, ch.paragraphs[i - 1], lang)!);
  });
  return missing.length ? { missing } : { body: out.join("\n\n"), missing };
}
