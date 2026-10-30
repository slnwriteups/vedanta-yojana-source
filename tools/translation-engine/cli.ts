import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { args, parseLangs, readJson, ROOT, workDir, writeJson } from "../../scripts/translation/work.ts";
import { applyBaseline, BASELINE_FILE, baselineFrom, loadBaseline, markdownCell, saveBaseline } from "./baseline.ts";
import { glossaryAudit } from "./glossary.ts";
import { loadPending, savePending, writeApproved } from "./pending-terms.ts";
import { chapterHash, loadLedger, ownerGuard, owners, readiness, recordReview, reviewPacket, saveLedger, translatorsOf, type ReviewReply } from "./review.ts";
import { blocking, checkRecord, formatIssue, type Issue } from "./validate.ts";
import { repairVerses } from "./verses.ts";

/**
 * Vedanta Yojana translation engine. No network, no API, no dependencies.
 * See README.md for the workflow. Commands:
 *
 *   check           --book=<slug> [--chapter=] | --file=<record.json> [--english=] [--candidate] | --changed[=<base ref>] | --all
 *                   [--langs=] [--require] [--warnings] [--json] [--no-baseline]
 *                   Exit 1 on any blocking error not in baseline.json.
 *   baseline        --init (once; refuses if it exists) | --prune (drops fixed entries only)
 *   remediation     writes REMEDIATION.md from baseline.json and the glossary audit
 *   glossary        owner decisions in the glossaries: conflicts, unreviewed lines
 *   terms           --book=  pending proposed terms
 *   approve-terms   --book=  (owner, interactive) approve pending terms into the glossaries
 *   repair-verses   --file=<chapter.json> --out=<path> [--langs=]
 *   certify         --book= --chapter= [--langs=]  record a passed mechanical gate
 *   review-packet   --book= --chapter= --lang= [--experiment=] [--file=<candidate>]
 *   record-review   --book= --reply=<reply.json> [--experiment=] [--file=<candidate>]
 *   approve-theology --book= --chapter= --lang=  (owner, interactive)
 *   status          --book= [--chapter=] [--langs=]  READY or the reasons not
 */

const a = args();
const command = process.argv[2];
const langs: LanguageCode[] = parseLangs(a.langs);
const rel = (f: string) => path.relative(ROOT, path.resolve(f));
const CONTENT_FILE = /^content\/library\/[^/]+\/(book\.json|chapters\/[^/]+\.json)$/;

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

function target(file: string, english?: string): Target {
  const record = readJson(file);
  const kind: Target["kind"] = (a.kind as Target["kind"]) ?? (Array.isArray(record.chapterOrder) ? "book" : "chapter");
  const book = rel(file).match(/^content\/library\/([^/]+)\//)?.[1] ?? a.book;
  return { file: rel(file), kind, book, record, original: english ? readJson(english) : committed(file) };
}

function bookTargets(slug: string, chapter?: string): Target[] {
  const dir = path.join(ROOT, "content/library", slug);
  const book = readJson(path.join(dir, "book.json"));
  const out: Target[] = [];
  if (!chapter) out.push({ file: rel(path.join(dir, "book.json")), kind: "book", book: slug, record: book });
  for (const s of chapter ? [chapter] : (book.chapterOrder as string[])) out.push({ file: rel(path.join(dir, "chapters", `${s}.json`)), kind: "chapter", book: slug, record: readJson(path.join(dir, "chapters", `${s}.json`)) });
  return out;
}

/** Content files a pull request changes against a base ref, plus uncommitted ones (as test-translation-quality.ts does). */
function changedFiles(base: string): string[] {
  const git = (...cmd: string[]) => execFileSync("git", cmd, { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  let files: string[] = [];
  try {
    files = git("diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`);
  } catch {
    console.error(`Could not diff against ${base}; checking uncommitted changes only.`);
  }
  files.push(...git("diff", "--name-only", "--diff-filter=AM", "HEAD"), ...git("ls-files", "--others", "--exclude-standard", "content"));
  return [...new Set(files)].filter((f) => CONTENT_FILE.test(f) && fs.existsSync(path.join(ROOT, f)));
}

function targets(): Target[] {
  if (a.file) return [target(a.file, a.english)];
  if (a.changed) return changedFiles(a.changed === "true" ? "origin/main" : a.changed).map((f) => target(path.join(ROOT, f)));
  if (a.all) return fs.readdirSync(path.join(ROOT, "content/library")).filter((b) => fs.existsSync(path.join(ROOT, "content/library", b, "book.json"))).flatMap((b) => bookTargets(b));
  if (!a.book) throw new Error("Give --book=<slug>, --file=<record.json>, --changed or --all");
  return bookTargets(a.book, a.chapter);
}

const run = (ts: Target[], require: boolean): Issue[] =>
  ts.flatMap((t) => checkRecord(t.record, { file: t.file, book: t.book, original: t.original, kind: t.kind, langs, require, allowExperiment: !!a.candidate }));

const records = (ts: Target[]) => new Map(ts.map((t) => [t.file, t.record]));

function bookOf(slug: string): any {
  return readJson(path.join(ROOT, "content/library", slug, "book.json"));
}

function chapterFile(book: string, chapter: string): string {
  return a.file ? path.resolve(a.file) : path.join(ROOT, "content/library", book, "chapters", `${chapter}.json`);
}

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

function guardOrExit(): void {
  const why = ownerGuard();
  if (why) {
    console.error(`Owner approval ${why}`);
    process.exit(3);
  }
}

/** One line per rule, for the remediation report. */
const FIX: Record<string, string> = {
  "paragraph-parity": "re-split the translation to one paragraph per English paragraph",
  "devanagari-changed": "restore the Devanagari verse character for character (repair-verses does this from the English)",
  "devanagari-in-prose": "replace Devanagari letters (often ऽ) with the target script's own (ಽ / ఽ; Tamil drops it)",
  "script-leak": "replace the other script's letter",
  "untranslated-english": "translate the English left in the paragraph",
  "romanized-sanskrit": "write the romanised words in the target script",
  "missing-field": "translate the missing title, description or part title",
  "glossary-wrong-variant": "use the glossary form",
  "source-verse-layout": "owner: put the English verse in the §3.1 layout (Devanagari couplet, blank line, romanised couplet with | and ||), or confirm it is prose",
  "source-placeholder": "owner: replace the placeholder in the English",
  "source-needs-review": "owner: complete the editorial review of the English",
};

switch (command) {
  case "check": {
    const ts = targets();
    const issues = run(ts, !!a.require);
    const applied = applyBaseline(issues, records(ts), a["no-baseline"] ? null : loadBaseline());
    const warnings = issues.filter((i) => i.level === "warning");
    if (a.json) {
      process.stdout.write(JSON.stringify({ checked: ts.length, blocking: applied.blocking, known: applied.known, stale: applied.stale, warnings }, null, 2) + "\n");
    } else {
      for (const i of applied.blocking) console.log(formatIssue(i));
      for (const i of applied.known) console.log(formatIssue(i).replace(/^ERROR  /, "known  "));
      if (a.warnings) for (const i of warnings) console.log(formatIssue(i));
      for (const s of applied.stale) console.log(`stale   ${s.file} [${s.lang}] ${s.field}${s.paragraph ? ` ¶${s.paragraph}` : ""} ${s.rule}: fixed or changed; remove with \`baseline --prune\``);
      console.log(`\nChecked ${ts.length} record(s): ${applied.blocking.length} blocking, ${applied.known.length} known historical (baseline.json), ${applied.stale.length} stale baseline entr${applied.stale.length === 1 ? "y" : "ies"}, ${warnings.length} warning(s)${a.warnings ? "" : " (--warnings to list)"}.`);
    }
    process.exit(applied.blocking.length ? 1 : 0);
  }

  case "baseline": {
    const all = fs.readdirSync(path.join(ROOT, "content/library")).filter((b) => fs.existsSync(path.join(ROOT, "content/library", b, "book.json"))).flatMap((b) => bookTargets(b));
    const issues = run(all, false);
    if (a.init) {
      if (loadBaseline()) {
        console.error(`${rel(BASELINE_FILE)} exists. The baseline never grows; it is created once. Use --prune to remove fixed entries.`);
        process.exit(1);
      }
      const b = baselineFrom(issues, records(all));
      saveBaseline(b);
      console.log(`Created ${rel(BASELINE_FILE)} with ${b.entries.length} known historical error(s).`);
    } else if (a.prune) {
      const b = loadBaseline();
      if (!b) throw new Error("No baseline.json; run --init once");
      const { stale } = applyBaseline(issues, records(all), b);
      const drop = new Set(stale);
      b.entries = b.entries.filter((e) => !drop.has(e));
      saveBaseline(b);
      console.log(`Removed ${stale.length} fixed entr${stale.length === 1 ? "y" : "ies"}; ${b.entries.length} remain.`);
    } else throw new Error("Give --init or --prune");
    break;
  }

  case "remediation": {
    const b = loadBaseline();
    if (!b) throw new Error("No baseline.json; run `baseline --init` once");
    const byBook = new Map<string, typeof b.entries>();
    for (const e of b.entries) {
      const book = e.file.split("/")[2];
      byBook.set(book, [...(byBook.get(book) ?? []), e]);
    }
    const counts = new Map<string, number>();
    for (const e of b.entries) counts.set(e.rule, (counts.get(e.rule) ?? 0) + 1);
    const L = [
      "# Historical translation defects: remediation report",
      "",
      `Generated by \`node tools/translation-engine/cli.ts remediation\` from \`baseline.json\` (${b.created}). These defects were already in published content when the engine was introduced. They are excused only while the text they were found in is unchanged; editing that text means fixing them. Nothing here has been changed in content/. Each fix needs the owner's review like any translation change.`,
      "",
      "## By rule",
      "",
      "| Rule | Count | What fixing it means |",
      "|---|---|---|",
      ...[...counts].sort((x, y) => y[1] - x[1]).map(([r, n]) => `| \`${r}\` | ${n} | ${markdownCell(FIX[r] ?? "see the detail")} |`),
      "",
    ];
    for (const [book, entries] of [...byBook].sort()) {
      L.push(`## ${book} (${entries.length})`, "", "| File | Lang | Field | ¶ | Rule | Detail |", "|---|---|---|---|---|---|");
      for (const e of entries) L.push(`| ${e.file.split("/").pop()} | ${e.lang} | ${e.field} | ${e.paragraph ?? ""} | \`${e.rule}\` | ${markdownCell(e.detail).slice(0, 160)} |`);
      L.push("");
    }
    L.push("## Glossary decisions for the owner", "");
    for (const lang of langs) {
      const g = glossaryAudit(lang);
      for (const c of g.conflicts) L.push(`- ${lang}: ${c}`);
      if (g.unreviewed.length) L.push(`- ${lang}: ${g.unreviewed.length} line(s) in sections still headed "(new terms; review)" (${[...new Set(g.unreviewed.map((e) => e.line))].slice(0, 3).map((n) => `${lang}.md:${n}`).join(", ")}…): confirm or correct, then remove "review" from the header.`);
    }
    // Glossary drift: terms whose glossary form is often absent from approved translations.
    const drift = new Map<string, Map<string, Set<string>>>();
    for (const i of run(targets(), false)) {
      if (i.rule !== "glossary-missing") continue;
      const term = `${i.lang}: ${i.detail.slice(0, i.detail.indexOf(": expected"))} (glossary: ${i.detail.match(/expected (.*?) \(/)?.[1] ?? "?"})`;
      const book = i.file.split("/")[2];
      const m = drift.get(term) ?? new Map<string, Set<string>>();
      m.set(book, (m.get(book) ?? new Set()).add(`${i.file}#${i.paragraph}`));
      drift.set(term, m);
    }
    const big = [...drift].map(([t, m]) => [t, m, [...m.values()].reduce((n, x) => n + x.size, 0)] as const).filter(([, , n]) => n >= 10).sort((x, y) => y[2] - x[2]);
    L.push("", "## Glossary drift for the owner", "", "Glossary terms whose form is absent from 10 or more approved paragraphs. Either the glossary or the books need to change; the engine does not decide which (warnings only).", "");
    for (const [t, m, n] of big) L.push(`- ${t}: ${n} paragraphs (${[...m].map(([b, x]) => `${b} ${x.size}`).join(", ")})`);
    const out = path.join(path.dirname(BASELINE_FILE), "REMEDIATION.md");
    fs.writeFileSync(out, L.join("\n") + "\n");
    console.log(`Wrote ${rel(out)} (${b.entries.length} defects).`);
    break;
  }

  case "glossary": {
    for (const lang of langs) {
      const g = glossaryAudit(lang);
      console.log(`${lang}: ${g.conflicts.length} conflict(s), ${g.unreviewed.length} unreviewed line(s)`);
      for (const c of g.conflicts) console.log(`  ${c}`);
    }
    break;
  }

  case "terms": {
    if (!a.book) throw new Error("Give --book=<slug>");
    const pending = loadPending(a.book, a.experiment).filter((t) => t.status === "pending");
    if (!pending.length) console.log("No terms pending.");
    for (const t of pending) console.log(`${t.en} = ${Object.entries(t.forms).map(([l, f]) => `${l} ${f}`).join(" | ")} (batch ${t.batch}, ${t.proposedAt})`);
    break;
  }

  case "approve-terms": {
    if (!a.book) throw new Error("Give --book=<slug>");
    guardOrExit();
    const all = loadPending(a.book);
    const approved = [];
    for (const t of all.filter((x) => x.status === "pending")) {
      const ans = (await ask(`${t.en} = ${Object.entries(t.forms).map(([l, f]) => `${l} ${f}`).join(" | ")}\n  approve / reject / skip? `)).toLowerCase();
      if (ans === "approve") {
        t.status = "approved";
        approved.push(t);
      } else if (ans === "reject") t.status = "rejected";
    }
    savePending(a.book, all);
    console.log(approved.length ? `Glossaries updated: ${writeApproved(a.book, approved).join(", ")}` : "Nothing approved.");
    break;
  }

  case "repair-verses": {
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
    break;
  }

  case "certify": {
    if (!a.book || !a.chapter) throw new Error("Give --book=<slug> and --chapter=<slug>");
    const ts = bookTargets(a.book, a.chapter);
    const issues = run(ts, true);
    const errors = blocking(issues);
    if (errors.length) {
      for (const i of errors) console.log(formatIssue(i));
      console.log(`\nNot certified: ${errors.length} blocking error(s), known historical ones included. Fix them and run certify again.`);
      process.exit(1);
    }
    const ledger = loadLedger(a.book);
    for (const lang of langs) {
      const entry = (ledger[`${a.chapter}.${lang}`] ??= {});
      entry.mechanical = { passed: true, checkedAt: new Date().toISOString(), warnings: issues.filter((i) => i.lang === lang).length, textHash: chapterHash(ts[0].record, lang) };
    }
    saveLedger(a.book, ledger);
    console.log(`Mechanical gate passed for ${a.chapter} [${langs.join(", ")}]. Linguistic review and theological approval are separate (review-packet, record-review, approve-theology).`);
    break;
  }

  case "review-packet": {
    if (!a.book || !a.chapter || !a.lang) throw new Error("Give --book, --chapter and --lang");
    const lang = a.lang as LanguageCode;
    const file = chapterFile(a.book, a.chapter);
    const { markdown } = reviewPacket({ book: a.book, chapter: a.chapter, lang, record: readJson(file), file: rel(file), experiment: a.experiment });
    const out = a.out ?? path.join(workDir(a.book, a.experiment), "review", `${a.chapter}.${lang}.md`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, markdown);
    console.log(`Wrote ${rel(out)}. Give it to a reviewer who did not translate the chapter; record the JSON reply with record-review.`);
    break;
  }

  case "record-review": {
    if (!a.book || !a.reply) throw new Error("Give --book and --reply=<reply.json>");
    const raw = fs.readFileSync(a.reply, "utf8");
    const reply = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as ReviewReply;
    if (reply.book !== a.book) throw new Error(`The reply is for book ${reply.book}`);
    const ledger = loadLedger(a.book, a.experiment);
    const result = recordReview(reply, readJson(chapterFile(a.book, reply.chapter)), ledger, translatorsOf(a.book, reply.chapter, a.experiment), rel(a.reply));
    if (result.ok) saveLedger(a.book, ledger, a.experiment);
    console.log(result.message);
    process.exit(result.ok ? 0 : 1);
  }

  case "approve-theology": {
    if (!a.book || !a.chapter || !a.lang) throw new Error("Give --book, --chapter and --lang");
    guardOrExit();
    const lang = a.lang as LanguageCode;
    const record = readJson(chapterFile(a.book, a.chapter));
    const ledger = loadLedger(a.book);
    const entry = (ledger[`${a.chapter}.${lang}`] ??= {});
    const textHash = chapterHash(record, lang);
    if (entry.linguistic?.status !== "approved" || entry.linguistic.textHash !== textHash) {
      console.error("Theological approval follows an approved linguistic review of this exact text; there is none.");
      process.exit(1);
    }
    console.log(`${a.chapter} [${lang}] text ${textHash}; linguistic review approved by ${entry.linguistic.by}${entry.linguistic.note ? `; ${entry.linguistic.note}` : ""}`);
    const decision = await ask("Decision (approved / changes-requested / refer-to-scholar): ");
    if (!["approved", "changes-requested", "refer-to-scholar"].includes(decision)) throw new Error("Unknown decision");
    const confirm = await ask(`Type "${a.chapter} ${lang}" to confirm: `);
    if (confirm !== `${a.chapter} ${lang}`) throw new Error("Not confirmed; nothing recorded");
    const email = execFileSync("git", ["config", "user.email"], { cwd: ROOT, encoding: "utf8" }).trim();
    const owner = owners().find((o) => o.email.toLowerCase() === email.toLowerCase())!;
    entry.theological = { status: decision as "approved", by: owner.name, kind: "owner", at: new Date().toISOString(), textHash, note: (await ask("Note (optional): ")) || undefined };
    saveLedger(a.book, ledger);
    console.log(`Recorded: theological ${decision} by ${owner.name} for ${a.chapter} [${lang}] @ ${textHash}.`);
    break;
  }

  case "status": {
    if (!a.book) throw new Error("Give --book=<slug>");
    const bookRecord = bookOf(a.book);
    const ledger = loadLedger(a.book);
    const chapters = a.chapter ? [a.chapter] : (bookRecord.chapterOrder as string[]);
    let ready = 0;
    for (const chapter of chapters) {
      const file = path.join(ROOT, "content/library", a.book, "chapters", `${chapter}.json`);
      const record = readJson(file);
      for (const lang of langs) {
        if (!record.translations?.[lang]) continue;
        const r = readiness({ book: a.book, bookRecord, chapter, record, file: rel(file), lang, ledger });
        if (r.ready) ready++;
        console.log(`${r.ready ? "READY  " : "not yet"} ${chapter} [${lang}]${r.ready ? "" : `: ${r.reasons.join("; ")}`}`);
      }
    }
    console.log(`\n${ready} chapter-language pair(s) ready to publish.`);
    break;
  }

  default:
    console.error("Commands: check, baseline, remediation, glossary, terms, approve-terms, repair-verses, certify, review-packet, record-review, approve-theology, status (see the header of tools/translation-engine/cli.ts)");
    process.exit(2);
}
