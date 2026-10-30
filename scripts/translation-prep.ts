import fs from "node:fs";
import path from "node:path";
import type { LanguageCode } from "../content-lib/schemas/language.ts";
import { LANGS } from "./translation/mechanical.ts";
import {
  args, bookItems, chapterItems, glossaryFor, inContent, loadBook, loadGlossary, loadStore,
  parseLangs, readJson, ROOT, stored, WORK_DIR, writeJson, type Item,
} from "./translation/work.ts";

/**
 * Prepares the next batch of untranslated prose as one block to paste into
 * a Claude chat (docs/TRANSLATION-WORKFLOW.md).
 *
 *   node scripts/translation-prep.ts --book=<slug> [--size=3] [--max-chars=6000]
 *        [--langs=ta,kn,te,hi] [--no-card] [--batch=N]
 *
 * --size       most chapters in one batch (default 3)
 * --max-chars  most English characters in one batch (default 6000); a long
 *              chapter is split across batches, and is written to content/
 *              once all its prose is in
 * --langs      languages to ask for (default: every language still missing)
 * --no-card    leave out the prompt card (when it is already in the chat)
 * --batch=N    print batch N again instead of preparing a new one
 *
 * Only prose goes in the block: verses, name lines and mantras are generated
 * by translation-merge.ts. Only the glossary terms that occur in the batch
 * are included.
 */

const a = args();
const bookSlug = a.book ?? "sri-vishnu-sahasranaama-anubhavam";
const batchDir = path.join(WORK_DIR, bookSlug, "batches");
const pad = (n: number) => String(n).padStart(3, "0");

interface Manifest {
  book: string;
  batch: number;
  langs: LanguageCode[];
  items: Array<{ id: string; en: string }>;
  merged: boolean;
}

function manifests(): Manifest[] {
  if (!fs.existsSync(batchDir)) return [];
  return fs.readdirSync(batchDir).filter((f) => /^batch-\d+\.json$/.test(f)).map((f) => readJson<Manifest>(path.join(batchDir, f)));
}

function render(m: Manifest, items: Item[], withCard: boolean): string {
  const glossary = glossaryFor(loadGlossary(), items.map((i) => i.en)).filter((g) => m.langs.some((l) => g.forms[l]));
  const titles = items.map((it, i) => (it.kind === "title" ? i : -1)).filter((i) => i >= 0);
  const lines: string[] = [];
  if (withCard) lines.push(fs.readFileSync(path.join(ROOT, "prompts/translation-prompt-card.md"), "utf8").trim(), "");
  lines.push(`=== BATCH ${m.batch} · ${m.book} · languages: ${m.langs.join(", ")} · ${items.length} items ===`);
  if (titles.length) lines.push(`Titles (no final punctuation): items ${titles.join(", ")}`);
  if (items.some((i) => i.kind === "description")) lines.push(`Item ${items.findIndex((i) => i.kind === "description")} is the book's one-paragraph description.`);
  lines.push("", "GLOSSARY (binding)");
  if (!glossary.length) lines.push("(none in this batch)");
  for (const g of glossary) lines.push(`${g.key} = ${m.langs.filter((l) => g.forms[l]).map((l) => `${l} ${g.forms[l]}`).join(" | ")}`);
  lines.push("", "ITEMS", JSON.stringify(items.map((i) => i.en), null, 1));
  lines.push("", `Reply with JSON only: {${m.langs.map((l) => `"${l}": [${items.length} strings]`).join(", ")}} plus the optional "terms" key.`);
  return lines.join("\n") + "\n";
}

const book = loadBook(bookSlug);
const all: Item[] = [...bookItems(book), ...book.chapters.flatMap(chapterItems)];
const byId = new Map(all.map((i) => [i.id, i]));
const existing = manifests();

if (a.batch) {
  const m = existing.find((x) => x.batch === Number(a.batch));
  if (!m) throw new Error(`No batch ${a.batch} in translation-work/${bookSlug}/batches`);
  const items = m.items.map((x) => byId.get(x.id)!).filter(Boolean);
  process.stdout.write(render(m, items, !a["no-card"]));
  process.exit(0);
}

const wanted = parseLangs(a.langs);
const store = loadStore(bookSlug);
const inFlight = new Set(existing.filter((m) => !m.merged).flatMap((m) => m.items.map((i) => i.id)));
const needs = (it: Item): LanguageCode[] => wanted.filter((l) => !inContent(book, it, l) && !stored(store, it, l));

const size = Number(a.size ?? 3);
const maxChars = Number(a["max-chars"] ?? 6000);
const picked: Item[] = [];
let langs: LanguageCode[] = [];
let chars = 0;
const chapters = new Set<string>();

for (const it of all) {
  if (inFlight.has(it.id)) continue;
  const n = needs(it);
  if (!n.length) continue;
  if (!picked.length) langs = n;
  else if (n.join() !== langs.join()) continue;
  const newChapter = it.group !== "@book" && !chapters.has(it.group);
  if (picked.length && (chars + it.en.length > maxChars || (newChapter && chapters.size >= size))) break;
  picked.push(it);
  chars += it.en.length;
  if (it.group !== "@book") chapters.add(it.group);
}

if (!picked.length) {
  const open = existing.filter((m) => !m.merged).map((m) => m.batch);
  console.error(open.length
    ? `Nothing new to prepare. Batches waiting to be merged: ${open.join(", ")} (print one again with --batch=N).`
    : `Nothing left to translate in ${bookSlug} for ${wanted.join(", ")}.`);
  process.exit(0);
}

const number = Math.max(0, ...existing.map((m) => m.batch)) + 1;
const ordered = LANGS.filter((l) => langs.includes(l));
const manifest: Manifest = { book: bookSlug, batch: number, langs: ordered, items: picked.map((i) => ({ id: i.id, en: i.enHash })), merged: false };
writeJson(path.join(batchDir, `batch-${pad(number)}.json`), manifest);
const text = render(manifest, picked, !a["no-card"]);
fs.writeFileSync(path.join(batchDir, `batch-${pad(number)}.prompt.txt`), text);
process.stdout.write(text);
console.error(
  `\nBatch ${number}: ${picked.length} items, ${chars} English characters, ${chapters.size} chapter(s), languages ${ordered.join(", ")}.` +
    `\nSaved to translation-work/${bookSlug}/batches/batch-${pad(number)}.prompt.txt` +
    `\nPaste it into Claude, save the reply as translation-work/${bookSlug}/batches/batch-${pad(number)}.reply.json, then run:` +
    `\n  node scripts/translation-merge.ts --book=${bookSlug} --batch=${number}`,
);
