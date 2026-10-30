import fs from "node:fs";
import path from "node:path";
import type { LanguageCode } from "../content-lib/schemas/language.ts";
import { paragraphFindings, type Finding } from "./translation/checks.ts";
import {
  args, assembleBody, bookItems, bookValue, chapterItems, loadBook, loadStore, missingLangs, orderTranslations,
  readJson, ROOT, saveStore, workDir, writeJson, type Item,
} from "./translation/work.ts";
import { applyBaseline, loadBaseline } from "../tools/translation-engine/baseline.ts";
import { glossaryFindings } from "../tools/translation-engine/glossary.ts";
import { proposeTerms } from "../tools/translation-engine/pending-terms.ts";
import { checkRecord, formatIssue, latinFindings } from "../tools/translation-engine/validate.ts";

/**
 * Takes Claude's JSON reply for a batch made by translation-prep.ts, checks
 * every paragraph, stores what passes in translation-work/<book>/store.json,
 * and writes each chapter whose prose is now complete into content/,
 * with the verses, name lines and mantras generated around it.
 *
 *   node scripts/translation-merge.ts --book=<slug> --batch=N --translator=<label> [--reply=<file> | --reply=-] [--experiment=<name>]
 *
 * The reply defaults to translation-work/<book>/batches/batch-NNN.reply.json
 * (--reply=- reads standard input). Code fences and text around the JSON
 * are ignored. --translator names who produced the reply (a person, or a
 * chat session such as "claude-chat-2026-10-30a"); the linguistic review
 * must come from someone else.
 *
 * Each paragraph is rejected (not stored; the next prep asks again) on any
 * blocking finding: script faults (scripts/translation/checks.ts), English or
 * romanised Sanskrit left in it, or a glossary form the glossary forbids.
 * A finished chapter is checked as a whole by the translation engine
 * before it is written; if anything new blocks, it stays in the store and
 * content/ is not touched. Only missing fields are filled: an existing
 * translated title or body is never replaced. English fields are never
 * written. New terms go to pending-terms.json for owner approval, never
 * into the glossaries. With --experiment, finished chapters are written to
 * translation-work/<book>/experiments/<name>/candidates/ instead of content/.
 */

const a = args();
const bookSlug = a.book ?? "sri-vishnu-sahasranaama-anubhavam";
if (!a.batch) throw new Error("Give the batch number: --batch=N");
if (!a.translator || a.translator === "true") throw new Error("Give --translator=<label>: who produced this reply (needed to keep the linguistic review independent)");
const experiment = a.experiment;
const pad = (n: number) => String(n).padStart(3, "0");
const batchDir = path.join(workDir(bookSlug, experiment), "batches");
const manifestFile = path.join(batchDir, `batch-${pad(Number(a.batch))}.json`);
if (!fs.existsSync(manifestFile)) throw new Error(`No batch ${a.batch}: ${path.relative(ROOT, manifestFile)} is missing`);
const manifest = readJson<{ book: string; batch: number; langs: LanguageCode[]; items: Array<{ id: string; en: string }>; merged: boolean; experiment?: string; translator?: string }>(manifestFile);

if ((manifest.experiment ?? undefined) !== experiment) {
  throw new Error(manifest.experiment
    ? `Batch ${manifest.batch} belongs to experiment "${manifest.experiment}"; merge it with --experiment=${manifest.experiment}. Experiment work never goes to content/.`
    : `Batch ${manifest.batch} is not an experiment batch; run merge without --experiment.`);
}

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
const store = loadStore(bookSlug, experiment);
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
    const findings: Finding[] = [
      ...paragraphFindings(item.en, text, lang, item.kind),
      ...latinFindings(item.en, text, { book: bookSlug }),
      ...glossaryFindings(item.en, text, lang, bookSlug),
    ];
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
saveStore(store, experiment);

// ---------------------------------------------------------------- new terms: pending owner approval

const proposed = proposeTerms(bookSlug, reply.terms, manifest.batch, experiment);

// Ambiguities the translator saw in the English: recorded for the owner, never acted on here.
const concerns = (Array.isArray(reply.concerns) ? (reply.concerns as Array<{ item?: number; note?: string }>) : [])
  .filter((c) => Number.isInteger(c?.item) && manifest.items[c.item!] && typeof c.note === "string" && c.note.trim())
  .map((c) => ({ id: manifest.items[c.item!].id, english: current.get(manifest.items[c.item!].id)?.en ?? "", note: c.note!.trim(), batch: manifest.batch, translator: a.translator, status: "open" }));
if (concerns.length) {
  const file = path.join(workDir(bookSlug, experiment), "source-concerns.json");
  const prev = fs.existsSync(file) ? readJson<{ concerns: unknown[] }>(file).concerns : [];
  writeJson(file, { note: "English passages a translator found ambiguous. For the owner to settle in the English (Standard §1 rule 1); translations follow the English as written until then.", concerns: [...prev, ...concerns] });
}

// ---------------------------------------------------------------- write finished records

const written: string[] = [];
const waiting: string[] = [];
const held: string[] = [];
const baseline = loadBaseline();
const groups = new Set(manifest.items.map((i) => current.get(i.id)?.group).filter(Boolean) as string[]);
const candidatesDir = path.join(workDir(bookSlug, experiment), "candidates");

/** Engine check of a candidate against its committed English; known historical defects do not hold it back, new ones do. */
function blockers(candidate: any, original: any, file: string, kind: "book" | "chapter", lang: LanguageCode): string[] {
  const issues = checkRecord(candidate, { file, book: bookSlug, original, kind, langs: [lang] });
  return applyBaseline(issues, new Map([[file, candidate]]), experiment ? null : baseline).blocking.map(formatIssue);
}

for (const group of groups) {
  if (group === "@book") {
    if (experiment) continue; // experiments re-translate a chapter, never book metadata
    const r = book.record;
    const rel = path.relative(ROOT, book.file);
    for (const lang of missingLangs(book, group, manifest.langs)) {
      const get = (id: string) =>
        store.items[id] && store.items[id].en === current.get(id)?.enHash ? store.items[id][lang] : bookValue(book, id, lang);
      const title = get("@book.title");
      const description = r.description ? get("@book.description") : undefined;
      const parts = (r.parts ?? []).map((_: unknown, i: number) => get(`@part.${i}.title`));
      if (!title || (r.description && !description) || parts.some((p: string | undefined) => !p)) {
        waiting.push(`book title/description/parts [${lang}]`);
        continue;
      }
      // Fill only what is missing; a live title, description or part title is never replaced.
      const candidate = structuredClone(book.record); // carries the languages already filled in this run
      const t = candidate.translations?.[lang] ?? {};
      candidate.translations = orderTranslations({ ...(candidate.translations ?? {}), [lang]: { ...t, title: t.title ?? title, ...(description || t.description ? { description: t.description ?? description } : {}) } });
      (candidate.parts ?? []).forEach((p: any, i: number) => {
        if (!p.translations?.[lang]?.title) p.translations = orderTranslations({ ...(p.translations ?? {}), [lang]: { ...(p.translations?.[lang] ?? {}), title: parts[i] } });
      });
      const why = blockers(candidate, r, rel, "book", lang);
      if (why.length) {
        held.push(`book.json [${lang}]:\n      ${why.join("\n      ")}`);
        continue;
      }
      book.record = candidate;
      written.push(`book.json [${lang}]`);
    }
    if (book.record !== r) writeJson(book.file, book.record);
    continue;
  }
  const ch = book.chapters.find((c) => c.slug === group)!;
  const rel = path.relative(ROOT, ch.file);
  const original = structuredClone(ch.record);
  let next = ch.record;
  const langs = experiment ? manifest.langs : missingLangs(book, group, manifest.langs);
  for (const lang of langs) {
    const t = store.items[`${ch.slug}.title`];
    const title = t && t.en === current.get(`${ch.slug}.title`)!.enHash ? t[lang] : undefined;
    const { body, missing: holes } = assembleBody(ch, store, lang);
    const live = experiment ? undefined : ch.record.translations?.[lang];
    const needTitle = !live?.title;
    const needBody = !live?.body;
    if ((needTitle && !title) || (needBody && !body)) {
      waiting.push(`${ch.slug} [${lang}]: ${holes.length + (title ? 0 : 1)} item(s) to go`);
      continue;
    }
    const candidate = structuredClone(experiment ? { ...original, translations: {} } : next);
    candidate.translations = orderTranslations({
      ...(candidate.translations ?? {}),
      [lang]: { ...(live ?? {}), title: needTitle ? title : live!.title, body: needBody ? body : live!.body },
    });
    const why = blockers(candidate, original, rel, "chapter", lang);
    if (why.length) {
      held.push(`${ch.slug} [${lang}]:\n      ${why.join("\n      ")}`);
      continue;
    }
    if (experiment) {
      const out = path.join(candidatesDir, `${ch.slug}.json`);
      const prev = fs.existsSync(out) ? readJson(out) : { ...original, translations: {} };
      prev._experiment = { name: experiment, note: "Experimental candidate translation. Not approved; never copy into content/ (the engine's check blocks it)." };
      prev.translations = orderTranslations({ ...(prev.translations ?? {}), [lang]: candidate.translations[lang] });
      writeJson(out, prev);
    } else next = candidate;
    written.push(`${ch.slug} [${lang}]${experiment ? " (experiment candidate)" : ""}`);
  }
  if (!experiment && next !== ch.record) writeJson(ch.file, next);
}

manifest.merged = true;
manifest.translator = a.translator;
writeJson(manifestFile, manifest);

console.log(`Batch ${manifest.batch}: ${accepted} paragraph translations stored, ${rejected} rejected, ${warnings} warning(s).`);
if (report.length) console.log(report.join("\n"));
if (concerns.length) console.log(`English concerns for the owner (${path.relative(ROOT, path.join(workDir(bookSlug, experiment), "source-concerns.json"))}): ${concerns.map((c) => c.id).join(", ")}`);
if (proposed.length) console.log(`New terms proposed (pending owner approval, not in the glossaries): ${proposed.map((t) => t.en).join(", ")}`);
if (written.length) console.log(`Written to ${experiment ? path.relative(ROOT, candidatesDir) : "content/"}: ${written.join(", ")}`);
if (held.length) console.log(`Complete but NOT written (blocking errors; the prose stays in the store):\n  ${held.join("\n  ")}`);
if (waiting.length) console.log(`Waiting for more batches: ${waiting.join("; ")}`);
if (rejected) console.log("Rejected paragraphs go back into the pool; the next prep run asks for them again.");
console.log("Next: node tools/translation-engine/cli.ts check --changed && npm run test:content");
if (held.length) process.exitCode = 1;
