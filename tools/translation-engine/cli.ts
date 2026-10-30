import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { args, hash, parseLangs, readJson, ROOT, WORK_DIR, writeJson } from "../../scripts/translation/work.ts";
import { blocking, checkRecord, formatIssue, type Issue } from "./validate.ts";
import { repairVerses } from "./verses.ts";

/**
 * Vedanta Yojana translation engine: mechanical gate (read-only unless a
 * command says otherwise). No network, no API.
 *
 *   node tools/translation-engine/cli.ts check --book=<slug> [--chapter=<slug>] [--langs=ta,kn] [--require] [--json] [--warnings]
 *   node tools/translation-engine/cli.ts check --file=<record.json> [--english=<record.json>] [--kind=chapter|book] ...
 *   node tools/translation-engine/cli.ts repair-verses --file=<chapter.json> --out=<path> [--langs=…]
 *   node tools/translation-engine/cli.ts certify --book=<slug> --chapter=<slug> [--langs=…]
 *
 * check     Exit 1 if any blocking error. --require treats a missing language
 *           as an error (use it for a chapter you call complete). --file
 *           checks a candidate record; its English is compared with --english,
 *           or with the committed version of the same path when it is under content/.
 * repair-verses  Writes a copy with every romanised verse converted (verses.ts).
 *           Never writes in place unless --out is the same path.
 * certify   Records that the chapter passed the mechanical gate in
 *           translation-work/<book>/certification.json. Refuses while any error
 *           remains. Linguistic and theological review stay "pending" until the
 *           reviewer records them there; this tool never sets them.
 */

const a = args();
const command = process.argv[2];
const langs: LanguageCode[] = parseLangs(a.langs);
const rel = (f: string) => path.relative(ROOT, path.resolve(f));

function committed(file: string): any | undefined {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${rel(file)}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return undefined;
  }
}

interface Target {
  file: string;
  kind: "book" | "chapter";
  book?: string;
  record: any;
  original?: any;
}

function targets(): Target[] {
  if (a.file) {
    const record = readJson(a.file);
    const kind = (a.kind as Target["kind"]) ?? (Array.isArray(record.chapterOrder) ? "book" : "chapter");
    const book = rel(a.file).match(/^content\/library\/([^/]+)\//)?.[1] ?? a.book;
    const original = a.english ? readJson(a.english) : committed(a.file);
    return [{ file: rel(a.file), kind, book, record, original }];
  }
  if (!a.book) throw new Error("Give --book=<slug> or --file=<record.json>");
  const dir = path.join(ROOT, "content/library", a.book);
  const bookFile = path.join(dir, "book.json");
  const book = readJson(bookFile);
  const out: Target[] = [];
  if (!a.chapter) out.push({ file: rel(bookFile), kind: "book", book: a.book, record: book });
  for (const slug of a.chapter ? [a.chapter] : (book.chapterOrder as string[])) {
    const f = path.join(dir, "chapters", `${slug}.json`);
    out.push({ file: rel(f), kind: "chapter", book: a.book, record: readJson(f) });
  }
  return out;
}

function run(ts: Target[], require: boolean): Issue[] {
  return ts.flatMap((t) => checkRecord(t.record, { file: t.file, book: t.book, original: t.original, kind: t.kind, langs, require }));
}

function report(ts: Target[], issues: Issue[]): void {
  const errors = blocking(issues);
  if (a.json) {
    process.stdout.write(JSON.stringify({ checked: ts.length, errors: errors.length, warnings: issues.length - errors.length, issues }, null, 2) + "\n");
    return;
  }
  const shown = a.warnings ? issues : errors;
  for (const i of shown) console.log(formatIssue(i));
  const perLang = langs.map((l) => {
    const chapters = ts.filter((t) => t.kind === "chapter");
    const started = chapters.filter((t) => t.record.translations?.[l]).length;
    const bad = new Set(errors.filter((e) => e.lang === l && chapters.some((c) => c.file === e.file)).map((e) => e.file)).size;
    return `${l}: ${started - bad}/${chapters.length} pass, ${bad} blocked, ${chapters.length - started} not started`;
  });
  console.log(`\nChecked ${ts.length} record(s): ${errors.length} blocking error(s), ${issues.length - errors.length} warning(s)${a.warnings ? "" : " (--warnings to list)"}.`);
  console.log(perLang.join("\n"));
}

if (command === "check") {
  const ts = targets();
  const issues = run(ts, !!a.require);
  report(ts, issues);
  process.exit(blocking(issues).length ? 1 : 0);
} else if (command === "repair-verses") {
  if (!a.file || !a.out) throw new Error("Give --file=<chapter.json> and --out=<path>");
  const record = readJson(a.file);
  for (const lang of langs) {
    const t = record.translations?.[lang];
    if (typeof t?.body !== "string") continue;
    const r = repairVerses(record.body, t.body, lang);
    t.body = r.body;
    for (const c of r.changed) console.log(`[${lang}] ¶${c.paragraph} ${c.kind}: ${c.reason}`);
    for (const u of r.unresolved) console.log(`[${lang}] ¶${u.paragraph} UNRESOLVED: ${u.reason}`);
  }
  writeJson(a.out, record);
  console.log(`Wrote ${rel(a.out)}. Check it: node tools/translation-engine/cli.ts check --file=${rel(a.out)} --english=${rel(a.file)}`);
} else if (command === "certify") {
  if (!a.book || !a.chapter) throw new Error("Give --book=<slug> and --chapter=<slug>");
  const ts = targets();
  const issues = run(ts, true);
  const errors = blocking(issues);
  if (errors.length) {
    for (const i of errors) console.log(formatIssue(i));
    console.log(`\nNot certified: ${errors.length} blocking error(s). Fix them and run certify again.`);
    process.exit(1);
  }
  const ledgerFile = path.join(WORK_DIR, a.book, "certification.json");
  const ledger = fs.existsSync(ledgerFile) ? readJson(ledgerFile) : {};
  const record = ts[0].record;
  for (const lang of langs) {
    const key = `${a.chapter}.${lang}`;
    const textHash = hash(JSON.stringify([record.title, record.body, record.translations[lang]]));
    // A review recorded for other text does not carry over to this text.
    const review = ledger[key]?.textHash === textHash ? ledger[key].review : { linguistic: "pending", theological: "pending" };
    ledger[key] = {
      textHash,
      mechanical: { passed: true, checkedAt: new Date().toISOString(), warnings: issues.filter((i) => i.lang === lang).length },
      review,
    };
  }
  writeJson(ledgerFile, ledger);
  console.log(`Mechanical gate passed for ${a.chapter} [${langs.join(", ")}]; recorded in ${rel(ledgerFile)}. Linguistic and theological review remain separate.`);
} else {
  console.error("Commands: check, repair-verses, certify (see the header of tools/translation-engine/cli.ts)");
  process.exit(2);
}
