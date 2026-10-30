import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyBaseline, baselineFrom, loadBaseline } from "../baseline.ts";
import { chapterHash, ownerGuard, readiness, recordReview, reviewPacket, type Ledger, type ReviewReply } from "../review.ts";
import { checkRecord } from "../validate.ts";

/**
 * Historical baseline, review recording, approvals tied to the exact text,
 * and the owner-only guard. Nothing here writes content/ or the real ledger.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BOOK = "nityasuri-vaibhavam";
const CHAPTER = "the-sudarsana-ashtakam";
const FILE = `content/library/${BOOK}/chapters/${CHAPTER}.json`;
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const record = () => load(FILE);
const bookRecord = () => load(`content/library/${BOOK}/book.json`);
const paras = (s: string) => s.split(/\n\s*\n/);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------- baseline

test("historical defects are known, new ones block, and editing the text un-excuses them", () => {
  const r = record();
  const issues = checkRecord(r, { file: FILE, book: BOOK, kind: "chapter" });
  const records = new Map([[FILE, r]]);
  const base = baselineFrom(issues, records);
  assert.equal(base.entries.length, 2, "the two live defects (ta ¶22, kn ¶21)");
  assert.deepEqual(applyBaseline(issues, records, base).blocking, []);

  // A new defect elsewhere is not excused.
  const edited = record();
  const te = paras(edited.translations.te.body);
  te[1] += " This sentence is new.";
  edited.translations.te.body = te.join("\n\n");
  const after = applyBaseline(checkRecord(edited, { file: FILE, book: BOOK, kind: "chapter" }), new Map([[FILE, edited]]), base);
  assert.deepEqual(after.blocking.map((i) => `${i.lang} ¶${i.paragraph} ${i.rule}`), ["te ¶2 untranslated-english"]);
  assert.equal(after.known.length, 2);

  // Editing the defective Kannada paragraph without fixing it: no longer excused.
  const touched = record();
  const kn = paras(touched.translations.kn.body);
  kn[20] = kn[20].replace("॥", " ॥");
  touched.translations.kn.body = kn.join("\n\n");
  const t2 = applyBaseline(checkRecord(touched, { file: FILE, book: BOOK, kind: "chapter" }), new Map([[FILE, touched]]), base);
  assert.deepEqual(t2.blocking.map((i) => `${i.lang} ¶${i.paragraph} ${i.rule}`), ["kn ¶21 devanagari-changed"]);
  assert.equal(t2.stale.length, 1, "the old entry no longer matches: reported stale, not silently dropped");

  // Fixing it: no error, and the entry is stale until pruned.
  const fixed = record();
  const kn2 = paras(fixed.translations.kn.body);
  kn2[20] = paras(fixed.body)[20];
  fixed.translations.kn.body = kn2.join("\n\n");
  const t3 = applyBaseline(checkRecord(fixed, { file: FILE, book: BOOK, kind: "chapter" }), new Map([[FILE, fixed]]), base);
  assert.deepEqual(t3.blocking, []);
  assert.deepEqual(t3.stale.map((e) => `${e.lang} ${e.rule}`), ["kn devanagari-changed"]);
});

test("the committed baseline pins file, language, field and rule, and refuses to be recreated", () => {
  const b = loadBaseline()!;
  assert.ok(b.entries.length > 0);
  for (const e of b.entries) {
    assert.match(e.file, /^content\/library\//);
    assert.ok(e.lang && e.field && e.rule && e.fingerprint, JSON.stringify(e));
  }
  assert.ok(b.entries.some((e) => e.file === FILE && e.lang === "kn" && e.paragraph === 21 && e.rule === "devanagari-changed"));
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/translation-engine/cli.ts"), "baseline", "--init"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /never grows/);
});

// ---------------------------------------------------------------- reviews

function reply(over: Partial<ReviewReply> = {}): ReviewReply {
  return {
    book: BOOK,
    chapter: CHAPTER,
    lang: "te",
    textHash: chapterHash(record(), "te"),
    reviewer: { name: "reviewer-session-b", kind: "ai" },
    checks: { faithfulness: "pass", completeness: "pass", grammar: "pass", naturalness: "pass", honorifics: "pass", terminology: "pass", doctrine: "pass", transliteration: "pass", structure: "pass", consistency: "pass", theology: "pass", readability: "pass" },
    register: "pass",
    paragraphs: [],
    theologicalConcerns: [],
    overall: "approve",
    ...over,
  };
}

test("a review is recorded only for the exact current text, from an independent reviewer", () => {
  const ledger: Ledger = {};
  assert.equal(recordReview(reply({ textHash: "0000000000" }), record(), ledger, []).ok, false);
  const same = recordReview(reply({ reviewer: { name: "Claude-Chat-A", kind: "ai" } }), record(), ledger, ["claude-chat-a"]);
  assert.equal(same.ok, false);
  assert.match(same.message, /independent/);
  assert.equal(recordReview({ ...reply(), checks: {} as any }, record(), ledger, []).ok, false);
  const ok = recordReview(reply(), record(), ledger, ["claude-chat-a"]);
  assert.equal(ok.ok, true);
  assert.equal(ledger[`${CHAPTER}.te`].linguistic!.status, "approved");
  assert.equal(ledger[`${CHAPTER}.te`].linguistic!.independence, "verified");
  assert.equal(ledger[`${CHAPTER}.te`].theological, undefined, "a review never records theological approval");
});

test("a blocking paragraph or a failed check means changes requested; an AI reply never displaces a human decision", () => {
  const ledger: Ledger = {};
  recordReview(reply({ paragraphs: [{ n: 2, severity: "blocking", category: "faithfulness", comment: "omits a clause" }] }), record(), ledger, []);
  assert.equal(ledger[`${CHAPTER}.te`].linguistic!.status, "changes-requested");
  recordReview(reply({ reviewer: { name: "A Scholar", kind: "human" }, overall: "revise" }), record(), ledger, []);
  recordReview(reply(), record(), ledger, []);
  assert.equal(ledger[`${CHAPTER}.te`].linguistic!.by, "A Scholar");
  assert.equal(ledger[`${CHAPTER}.te`].advisory!.length, 2);
});

test("READY needs mechanical pass, linguistic and owner theological approval of the same text, and book metadata", () => {
  const ledger: Ledger = {};
  const r = record();
  const base = { book: BOOK, bookRecord: bookRecord(), chapter: CHAPTER, record: r, file: FILE, lang: "te" as const, ledger };
  assert.equal(readiness(base).ready, false);
  recordReview(reply(), r, ledger, []);
  const h = chapterHash(r, "te");
  // Something that is not the owner cannot stand in for theological approval.
  ledger[`${CHAPTER}.te`].theological = { status: "approved", by: "claude", kind: "ai" as any, at: "", textHash: h };
  assert.equal(readiness(base).ready, false);
  ledger[`${CHAPTER}.te`].theological = { status: "approved", by: "Vishnu Sreenivas", kind: "owner", at: "", textHash: h };
  const ready = readiness(base);
  assert.equal(ready.ready, true, ready.reasons.join("; "));
  // Any change to the text voids both approvals.
  const changed = record();
  changed.translations.te.title += " ";
  const after = readiness({ ...base, record: changed });
  assert.equal(after.ready, false);
  assert.match(after.linguistic, /void/);
  assert.match(after.theological, /void/);
  // The Tamil and Kannada of this chapter carry known defects: never ready while they remain.
  const ta = readiness({ ...base, lang: "ta" });
  assert.equal(ta.mechanical, "fail");
});

test("an agent session, CI or a non-terminal cannot record owner approval", () => {
  assert.match(ownerGuard({ CLAUDECODE: "1" }, true)!, /agent session/);
  assert.match(ownerGuard({ AI_AGENT: "x" }, true)!, /agent session/);
  assert.match(ownerGuard({ CI: "true" }, true)!, /automated/);
  assert.match(ownerGuard({}, false)!, /interactive terminal/);
  for (const cmd of [["approve-theology", `--book=${BOOK}`, `--chapter=${CHAPTER}`, "--lang=te"], ["approve-terms", `--book=${BOOK}`]]) {
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools/translation-engine/cli.ts"), ...cmd], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CLAUDECODE: "1" } });
    assert.equal(r.status, 3, r.stderr);
    assert.match(r.stderr, /refused/);
  }
});

test("a review packet carries the text hash, every prose paragraph, glossary terms and no example from the chapter itself", () => {
  const { markdown, template } = reviewPacket({ book: BOOK, chapter: CHAPTER, lang: "te", record: record(), file: FILE });
  assert.equal(template.textHash, chapterHash(record(), "te"));
  assert.match(markdown, /### ¶1\n/);
  assert.match(markdown, /Glossary: .*Chakrattāzhwār/);
  assert.doesNotMatch(markdown, new RegExp(`Approved example \\(${escapeRegExp(FILE)}`));
  assert.match(markdown, /final theological approval/);
});

test("review paragraph entries must use the documented shape", () => {
  const bad = recordReview({ ...reply(), paragraphs: [{ paragraph: 2, severity: "minor", issue: "x" } as any] }, record(), {}, []);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /"n" \(number\)/);
});

test("the Traditional Brahminical and Sri Vaishnava Register criterion is mandatory and gates approval", () => {
  const { register, ...noRegister } = reply();
  const missing = recordReview(noRegister as any, record(), {}, []);
  assert.equal(missing.ok, false);
  assert.match(missing.message, /register/);
  const ledger: Ledger = {};
  recordReview(reply({ register: "needs-revision", paragraphs: [{ n: 4, severity: "minor", category: "register", comment: "colloquial verb" }] }), record(), ledger, []);
  assert.equal(ledger[`${CHAPTER}.te`].linguistic!.status, "changes-requested", "a minor register point still blocks approval");
});

test("the review packet carries the register criterion, the doctrine rules and the self-review warning", () => {
  const { markdown, template } = reviewPacket({ book: BOOK, chapter: CHAPTER, lang: "ta", record: record(), file: FILE });
  assert.match(markdown, /Traditional Brahminical and Sri Vaishnava Register — Pass \/ Needs Revision/);
  assert.match(markdown, /DOCTRINE/);
  assert.match(markdown, /self-review/);
  assert.equal(template.register, "pass");
  assert.ok("doctrine" in template.checks && "transliteration" in template.checks && "structure" in template.checks);
});

test("the translator card states the owner's register, doctrine and pronoun rules", () => {
  const card = fs.readFileSync(path.join(ROOT, "prompts/translation-prompt-card.md"), "utf8");
  for (const rule of [/Vadakalai Sri Vaishnava/, /Viśiṣṭādvaita/, /never add a restrictive or emphatic particle/i, /ta அவர்/, /te ఆయన/, /kn the established singular forms .*ಅವನು \/ ಭಗವಂತನು.*honorific forms allowed/, /never apply Tamil or Telugu pronoun conventions to Kannada/, /Register never overrides fidelity/, /one language at a time/i, /record it under "concerns"/]) assert.match(card, rule);
  // Standard §4 reconciled in the guide; the fidelity non-negotiables are still there.
  const guide = fs.readFileSync(path.join(ROOT, "docs/TRANSLATION-GUIDE.md"), "utf8");
  assert.match(guide, /Dignified, natural prose/);
  assert.match(guide, /The fidelity rules above are unchanged/);
  assert.match(guide, /English is the source of truth/);
});

test("Markdown table cells escape backslashes before pipes (CodeQL js/incomplete-sanitization)", async () => {
  const { markdownCell } = await import("../baseline.ts");
  assert.equal(markdownCell("a|b"), "a\\|b");
  assert.equal(markdownCell("a\\|b"), "a\\\\\\|b", "an existing backslash cannot un-escape the pipe");
  assert.equal(markdownCell("line\nnext"), "line next");
});
