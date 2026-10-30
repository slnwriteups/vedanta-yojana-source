import fs from "node:fs";
import path from "node:path";
import type { LanguageCode } from "../content-lib/schemas/language.ts";
import { paragraphFindings, type Finding } from "./translation/checks.ts";
import { LANGS } from "./translation/mechanical.ts";
import {
  args, assembleBody, bookItems, bookValue, chapterItems, fold, loadBook, loadStore, missingLangs, orderTranslations,
  readJson, ROOT, saveStore, WORK_DIR, writeJson, type Item,
} from "./translation/work.ts";

/**
 * Takes Claude's JSON reply for a batch made by translation-prep.ts, checks
 * every paragraph, stores what passes in translation-work/<book>/store.json,
 * and writes each chapter whose prose is now complete into content/,
 * with the verses, name lines and mantras generated around it.
 *
 *   node scripts/translation-merge.ts --book=<slug> --batch=N [--reply=<file> | --reply=-]
 *
 * The reply defaults to translation-work/<book>/batches/batch-NNN.reply.json
 * (--reply=- reads standard input). Code fences and text around the JSON
 * are ignored. Rejected paragraphs are not stored; the next prep run picks
 * them up again. English fields are never written.
 */

const a = args();
const bookSlug = a.book ?? "sri-vishnu-sahasranaama-anubhavam";
if (!a.batch) throw new Error("Give the batch number: --batch=N");
const pad = (n: number) => String(n).padStart(3, "0");
const batchDir = path.join(WORK_DIR, bookSlug, "batches");
const manifestFile = path.join(batchDir, `batch-${pad(Number(a.batch))}.json`);
if (!fs.existsSync(manifestFile)) throw new Error(`No batch ${a.batch}: ${path.relative(ROOT, manifestFile)} is missing`);
const manifest = readJson<{ book: string; batch: number; langs: LanguageCode[]; items: Array<{ id: string; en: string }>; merged: boolean }>(manifestFile);

const replyFile = a.reply ?? path.join(batchDir, `batch-${pad(manifest.batch)}.reply.json`);
const raw = replyFile === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(replyFile, "utf8");
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start < 0 || end < start) throw new Error("The reply has no JSON object in it");
let reply: Record<string, unknown>;
try {
  reply = JSON.parse(raw.slice(start, end + 1));
} catch (e) {
  throw new Error(`The reply is not valid JSON (${(e as Error).message}). Ask Claude to resend it as one JSON object.`);
}

for (const lang of manifest.langs) {
  const arr = reply[lang];
  if (!Array.isArray(arr)) throw new Error(`The reply has no "${lang}" array`);
  if (arr.length !== manifest.items.length) {
    throw new Error(`"${lang}" has ${arr.length} strings but the batch has ${manifest.items.length} items. Nothing was stored; ask Claude for exactly one string per item, in order.`);
  }
}

const book = loadBook(bookSlug);
const current = new Map<string, Item>([...bookItems(book), ...book.chapters.flatMap(chapterItems)].map((i) => [i.id, i]));
const store = loadStore(bookSlug);
const report: string[] = [];
let accepted = 0;
let rejected = 0;
let warnings = 0;

manifest.items.forEach((mi, idx) => {
  const item = current.get(mi.id);
  if (!item || item.enHash !== mi.en) {
    report.push(`  ${mi.id}: English changed since the batch was prepared; skipped`);
    rejected += manifest.langs.length;
    return;
  }
  for (const lang of manifest.langs) {
    const text = String((reply[lang] as unknown[])[idx] ?? "").trim();
    if (text === "DEFECT") {
      report.push(`  ${mi.id} [${lang}]: flagged DEFECT by the translator; fix the English first`);
      rejected++;
      continue;
    }
    const findings: Finding[] = paragraphFindings(item.en, text, lang, item.kind);
    const errors = findings.filter((f) => f.level === "error");
    for (const f of findings) report.push(`  ${mi.id} [${lang}] ${f.level === "error" ? "REJECTED" : "warning"} ${f.rule}: ${f.detail}`);
    warnings += findings.length - errors.length;
    if (errors.length) {
      rejected++;
      continue;
    }
    const entry = store.items[mi.id] && store.items[mi.id].en === mi.en ? store.items[mi.id] : { en: mi.en };
    entry[lang] = text;
    store.items[mi.id] = entry;
    accepted++;
  }
});
saveStore(store);

// ---------------------------------------------------------------- new glossary terms

const terms = Array.isArray(reply.terms) ? (reply.terms as Array<Record<string, string>>) : [];
const added: string[] = [];
for (const lang of LANGS) {
  const file = path.join(ROOT, "docs/translation-glossaries", `${lang}.md`);
  const text = fs.readFileSync(file, "utf8");
  const known = new Set(text.split("\n").filter((l) => l.includes(" = ") && !l.startsWith("#")).map((l) => fold(l.slice(0, l.indexOf(" = ")).trim())));
  const lines = terms
    .filter((t) => t.en && t[lang] && !known.has(fold(t.en)) && !/[A-Za-z]/.test(t[lang]))
    .map((t) => `${t.en.trim()} = ${t[lang].trim()}`);
  if (lines.length) {
    const header = `# --- ${bookSlug}, batch ${manifest.batch} (new terms; review)`;
    fs.writeFileSync(file, text.replace(/\n*$/, "\n") + (text.includes(header) ? "" : `${header}\n`) + lines.join("\n") + "\n");
    added.push(`${lang} +${lines.length}`);
  }
}

// ---------------------------------------------------------------- write finished records

const written: string[] = [];
const waiting: string[] = [];
const groups = new Set(manifest.items.map((i) => current.get(i.id)?.group).filter(Boolean) as string[]);

for (const group of groups) {
  const missing = missingLangs(book, group, manifest.langs);
  if (group === "@book") {
    const r = book.record;
    for (const lang of missing) {
      const get = (id: string) =>
        store.items[id] && store.items[id].en === current.get(id)?.enHash ? store.items[id][lang] : bookValue(book, id, lang);
      const title = get("@book.title");
      const description = r.description ? get("@book.description") : undefined;
      const parts = (r.parts ?? []).map((_: unknown, i: number) => get(`@part.${i}.title`));
      if (!title || (r.description && !description) || parts.some((p: string | undefined) => !p)) {
        waiting.push(`book title/description/parts [${lang}]`);
        continue;
      }
      r.translations = orderTranslations({ ...(r.translations ?? {}), [lang]: { ...(r.translations?.[lang] ?? {}), title, ...(description ? { description } : {}) } });
      (r.parts ?? []).forEach((p: any, i: number) => (p.translations = orderTranslations({ ...(p.translations ?? {}), [lang]: { title: parts[i] } })));
      written.push(`book.json [${lang}]`);
    }
    writeJson(book.file, r);
    continue;
  }
  const ch = book.chapters.find((c) => c.slug === group)!;
  for (const lang of missing) {
    const t = store.items[`${ch.slug}.title`];
    const title = t && t.en === current.get(`${ch.slug}.title`)!.enHash ? t[lang] : undefined;
    const { body, missing: holes } = assembleBody(ch, store, lang);
    if (!title || !body) {
      waiting.push(`${ch.slug} [${lang}]: ${holes.length + (title ? 0 : 1)} item(s) to go`);
      continue;
    }
    ch.record.translations = orderTranslations({ ...(ch.record.translations ?? {}), [lang]: { title, body } });
    written.push(`${ch.slug} [${lang}]`);
  }
  writeJson(ch.file, ch.record);
}

manifest.merged = true;
writeJson(manifestFile, manifest);

console.log(`Batch ${manifest.batch}: ${accepted} paragraph translations stored, ${rejected} rejected, ${warnings} warning(s).`);
if (report.length) console.log(report.join("\n"));
if (added.length) console.log(`New glossary terms: ${added.join(", ")} (review them in docs/translation-glossaries/)`);
if (written.length) console.log(`Written to content/: ${written.join(", ")}`);
if (waiting.length) console.log(`Waiting for more batches: ${waiting.join("; ")}`);
if (rejected) console.log("Rejected paragraphs go back into the pool; the next prep run asks for them again.");
console.log("Next: node scripts/test-translation-quality.ts --changed && npm run test:content");
