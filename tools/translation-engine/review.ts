import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { classify, splitParagraphs } from "../../scripts/translation/mechanical.ts";
import { hash, readJson, ROOT, WORK_DIR, workDir, writeJson } from "../../scripts/translation/work.ts";
import { checkTerms, loadGlossaryRules, termsIn, unglossedTerms } from "./glossary.ts";
import { blocking, checkRecord, type Issue } from "./validate.ts";

/**
 * Review and certification, kept apart from mechanical validation
 * (Standard §7 step 4; owner's Phase 2 mandate §8–9).
 *
 * A chapter-language is READY only when, for the exact current text:
 * the mechanical gate passes with no error at all (known historical defects
 * included), an independent linguistic review approved it, the owner
 * approved it theologically, and the book's title, description and part
 * titles exist in that language. Every approval stores the text hash it saw;
 * any later change to the English or the translation voids it.
 *
 * AI review is advisory input to the linguistic review. Theological approval
 * is recorded only by an owner (reviewers.json) at an interactive terminal,
 * never from an agent session or CI. That guard stops accidental agent
 * approval; it is not a security boundary against someone editing the ledger,
 * which is why the ledger is committed and reviewed in pull requests.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- hashes and ledger

export function chapterHash(record: any, lang: LanguageCode): string {
  const t = record.translations?.[lang] ?? {};
  return hash(JSON.stringify([record.title, record.body, t.title ?? null, t.body ?? null]));
}

export function bookHash(record: any, lang: LanguageCode): string {
  const t = record.translations?.[lang] ?? {};
  return hash(JSON.stringify([record.title, record.description ?? null, t.title ?? null, t.description ?? null, (record.parts ?? []).map((p: any) => [p.title, p.translations?.[lang]?.title ?? null])]));
}

export interface Approval {
  status: "approved" | "changes-requested" | "refer-to-scholar";
  by: string;
  kind: "ai" | "human" | "owner";
  at: string;
  textHash: string;
  note?: string;
  file?: string;
  independence?: "verified" | "unverified";
}

export interface LedgerEntry {
  mechanical?: { passed: true; checkedAt: string; warnings: number; textHash: string };
  linguistic?: Approval;
  /** Advisory AI reviews, kept for the record even when a human review decides. */
  advisory?: Approval[];
  theological?: Approval;
}

export type Ledger = Record<string, LedgerEntry>;

export const ledgerPath = (book: string, experiment?: string) => path.join(workDir(book, experiment), "certification.json");

export function loadLedger(book: string, experiment?: string): Ledger {
  const f = ledgerPath(book, experiment);
  return fs.existsSync(f) ? readJson<Ledger>(f) : {};
}

export function saveLedger(book: string, ledger: Ledger, experiment?: string): void {
  writeJson(ledgerPath(book, experiment), ledger);
}

const current = (a: Approval | undefined, textHash: string) => !!a && a.status === "approved" && a.textHash === textHash;

// ---------------------------------------------------------------- translators (for independence)

/** Translator labels recorded by translation-merge.ts for the batches that carried this chapter. */
export function translatorsOf(book: string, chapter: string, experiment?: string): string[] {
  const dir = path.join(workDir(book, experiment), "batches");
  if (!fs.existsSync(dir)) return [];
  const out = new Set<string>();
  for (const f of fs.readdirSync(dir).filter((x) => /^batch-\d+\.json$/.test(x))) {
    const m = readJson(path.join(dir, f));
    if (m.translator && m.items?.some((i: any) => i.id.startsWith(`${chapter}.`))) out.add(String(m.translator).toLowerCase());
  }
  return [...out];
}

// ---------------------------------------------------------------- reference examples (cached)

interface Example {
  file: string;
  paragraph: number;
  en: string;
  tr: string;
}

const clip = (s: string, n = 320) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Approved prose paragraphs indexed by the glossary terms they use, so a
 * review packet can show how live translations render the same terms.
 * Built once per language and cached in translation-work/.cache, rebuilt
 * when any chapter file changes.
 */
export function referenceIndex(lang: LanguageCode): Record<string, Example[]> {
  const lib = path.join(ROOT, "content/library");
  const files = fs.readdirSync(lib).flatMap((b) => {
    const d = path.join(lib, b, "chapters");
    return fs.existsSync(d) ? fs.readdirSync(d).map((f) => path.join(d, f)) : [];
  });
  const signature = hash(files.map((f) => `${f}:${fs.statSync(f).size}:${fs.statSync(f).mtimeMs}`).join("|") + fs.statSync(path.join(ROOT, "docs/translation-glossaries", `${lang}.md`)).mtimeMs);
  const cacheFile = path.join(WORK_DIR, ".cache", `references-${lang}.json`);
  if (fs.existsSync(cacheFile)) {
    const c = readJson(cacheFile);
    if (c.signature === signature) return c.index;
  }
  const entries = loadGlossaryRules(lang);
  const index: Record<string, Example[]> = {};
  for (const f of files) {
    const r = readJson(f);
    const t = r.translations?.[lang]?.body;
    if (typeof t !== "string" || typeof r.body !== "string") continue;
    const en = splitParagraphs(r.body);
    const tr = splitParagraphs(t);
    if (en.length !== tr.length) continue; // structure defects make pairing unreliable
    const kinds = classify(en);
    en.forEach((p, i) => {
      if (kinds[i] !== "prose") return;
      for (const needle of termsIn(p, entries).keys()) {
        const list = (index[needle] ??= []);
        if (list.length < 6 && !list.some((x) => x.file === f)) list.push({ file: path.relative(ROOT, f), paragraph: i + 1, en: clip(p), tr: clip(tr[i]) });
      }
    });
  }
  writeJson(cacheFile, { signature, index });
  return index;
}

// ---------------------------------------------------------------- packets

export const REVIEW_CHECKS = ["faithfulness", "completeness", "grammar", "naturalness", "honorifics", "terminology", "consistency", "theology", "readability"] as const;

export interface ReviewReply {
  book: string;
  chapter: string;
  lang: LanguageCode;
  textHash: string;
  reviewer: { name: string; kind: "ai" | "human" };
  checks: Record<(typeof REVIEW_CHECKS)[number], "pass" | "concern" | "fail">;
  paragraphs: Array<{ n: number; severity: "blocking" | "minor"; category: string; comment: string; suggestion?: string }>;
  theologicalConcerns: string[];
  overall: "approve" | "revise";
}

function cardSections(names: string[]): string {
  const card = fs.readFileSync(path.join(ROOT, "prompts/translation-prompt-card.md"), "utf8");
  const blocks = card.split(/\n(?=[A-Z][A-Z ]+\n)/);
  return blocks.filter((b) => names.includes(b.split("\n")[0].trim())).join("\n").trim();
}

/**
 * A self-contained review packet for one chapter in one language: the rules
 * that matter for review, then every prose paragraph with its English, the
 * translation, the glossary terms it uses (and whether they were found),
 * mechanical findings, and how approved chapters render the same terms.
 * Examples never come from the chapter under review.
 */
export function reviewPacket(opts: { book: string; chapter: string; lang: LanguageCode; record: any; file: string; experiment?: string }): { markdown: string; template: ReviewReply } {
  const { book, chapter, lang, record } = opts;
  const t = record.translations?.[lang];
  if (!t?.body) throw new Error(`${chapter} has no ${lang} translation to review`);
  const textHash = chapterHash(record, lang);
  const issues = checkRecord(record, { file: opts.file, book, kind: "chapter", langs: [lang], allowExperiment: !!opts.experiment });
  const refs = referenceIndex(lang);
  const en = splitParagraphs(record.body);
  const tr = splitParagraphs(t.body);
  const kinds = classify(en);
  const glossaryRules = fs.readFileSync(path.join(ROOT, "docs/translation-glossaries", `${lang}.md`), "utf8").split("\n").filter((l) => /^# (?!---)/.test(l)).slice(1);
  const L: string[] = [];
  L.push(`# Review packet: ${book} / ${chapter} [${lang}]`, "");
  L.push(`textHash: \`${textHash}\` (your reply must carry it; any edit to the text voids the review)`);
  const translators = translatorsOf(book, chapter, opts.experiment);
  L.push(`Translated by: ${translators.length ? translators.join(", ") : "not recorded"}. The reviewer must be a different person or session.`, "");
  L.push("## What to judge", "");
  L.push("For every prose paragraph: faithfulness to the English (nothing added, dropped, summarised or improved), completeness, grammar, naturalness (plain, clear, not ornate), honorifics, Sri Vaishnava terminology and the glossary, consistency with approved chapters, theological sense, readability. Verses, name lines and mantras are generated by script and are listed only for completeness.");
  L.push("Your assessment is advisory. The owner gives the final theological approval; refer doubtful interpretations to a qualified scholar rather than deciding them.", "");
  L.push("## Rules for this language", "", "```", cardSections(["REGISTER", "CONSISTENCY", "LANGUAGES", "HONORIFICS"]), ...glossaryRules, "```", "");
  L.push("## Mechanical findings", "");
  const general = issues.filter((i) => !i.paragraph);
  L.push(general.length ? general.map((i) => `- ${i.level} ${i.field} ${i.rule}: ${i.detail}`).join("\n") : "- none outside paragraphs", "");
  L.push(`## Title`, "", `EN: ${record.title}`, `${lang.toUpperCase()}: ${t.title ?? "(missing)"}`, "");
  L.push("## Paragraphs", "");
  en.forEach((p, i) => {
    const n = i + 1;
    if (kinds[i] !== "prose") {
      L.push(`### ¶${n} (${kinds[i]}, generated)`, "", "```", tr[i] ?? "(missing)", "```", "");
      return;
    }
    L.push(`### ¶${n}`, "", `EN: ${p}`, "", `${lang.toUpperCase()}: ${tr[i] ?? "(missing)"}`, "");
    const terms = checkTerms(p, tr[i] ?? "", lang, book);
    if (terms.length) L.push(`Glossary: ${terms.map((x) => `${x.english} = ${x.expected.slice(0, 3).join(" / ")}${x.status === "ok" ? "" : ` [${x.status}]`}`).join("; ")}`);
    const fresh = unglossedTerms(p, lang);
    if (fresh.length) L.push(`Not in the glossary: ${fresh.join(", ")}`);
    const mine = issues.filter((x) => x.paragraph === n);
    if (mine.length) L.push(`Mechanical: ${mine.map((x) => `${x.level} ${x.rule}: ${x.detail}`).join(" | ")}`);
    const shown = new Set<string>();
    for (const term of termsIn(p, loadGlossaryRules(lang)).keys()) {
      const ex = (refs[term] ?? []).find((x) => !x.file.includes(`/chapters/${chapter}.json`) && !shown.has(`${x.file}#${x.paragraph}`));
      if (!ex || shown.size >= 2) continue;
      shown.add(`${ex.file}#${ex.paragraph}`);
      L.push(`Approved example (${ex.file} ¶${ex.paragraph}): EN "${ex.en}" → "${ex.tr}"`);
    }
    L.push("");
  });
  const template: ReviewReply = {
    book,
    chapter,
    lang,
    textHash,
    reviewer: { name: "", kind: "ai" },
    checks: Object.fromEntries(REVIEW_CHECKS.map((c) => [c, "pass"])) as ReviewReply["checks"],
    paragraphs: [],
    theologicalConcerns: [],
    overall: "approve",
  };
  const example = { ...template, paragraphs: [{ n: 3, severity: "minor", category: "naturalness", comment: "what is wrong, quoting the words", suggestion: "a better rendering (optional)" }] };
  L.push("## Reply", "", "Reply with this JSON only, filled in. `paragraphs` lists only paragraphs with a problem, each exactly in the shape shown; `severity` is `blocking` for a fault in meaning, omission, wrong term or wrong honorific, `minor` for style.", "", "```json", JSON.stringify(example, null, 2), "```", "");
  return { markdown: L.join("\n"), template };
}

// ---------------------------------------------------------------- recording reviews

export function validateReply(reply: any): string[] {
  const errs: string[] = [];
  for (const k of ["book", "chapter", "lang", "textHash", "overall"]) if (typeof reply?.[k] !== "string") errs.push(`missing "${k}"`);
  if (!reply?.reviewer?.name?.trim()) errs.push("reviewer.name is required");
  if (!["ai", "human"].includes(reply?.reviewer?.kind)) errs.push('reviewer.kind must be "ai" or "human"');
  for (const c of REVIEW_CHECKS) if (!["pass", "concern", "fail"].includes(reply?.checks?.[c])) errs.push(`checks.${c} must be pass, concern or fail`);
  if (!Array.isArray(reply?.paragraphs)) errs.push("paragraphs must be an array");
  else reply.paragraphs.forEach((p: any, i: number) => {
    if (!Number.isInteger(p?.n) || !["blocking", "minor"].includes(p?.severity) || typeof p?.comment !== "string") errs.push(`paragraphs[${i}] needs "n" (number), "severity" ("blocking" or "minor") and "comment"`);
  });
  if (!["approve", "revise"].includes(reply?.overall)) errs.push('overall must be "approve" or "revise"');
  return errs;
}

/**
 * Records a linguistic review reply. Refuses a reply for other text, an
 * incomplete reply, or a reviewer who translated the chapter. Approval needs
 * "approve", no blocking paragraph and no failed check. AI replies are kept
 * as advisory and also count as the linguistic review (the theological
 * decision stays with the owner).
 */
export function recordReview(reply: ReviewReply, record: any, ledger: Ledger, translators: string[], file?: string): { ok: boolean; message: string } {
  const errs = validateReply(reply);
  if (errs.length) return { ok: false, message: `Review not recorded: ${errs.join("; ")}` };
  const textHash = chapterHash(record, reply.lang);
  if (reply.textHash !== textHash) return { ok: false, message: `Review not recorded: it was written for text ${reply.textHash}, the current text is ${textHash}. Review the current text.` };
  if (translators.includes(reply.reviewer.name.trim().toLowerCase())) return { ok: false, message: `Review not recorded: "${reply.reviewer.name}" translated this chapter; the review must be independent.` };
  const approved = reply.overall === "approve" && !reply.paragraphs.some((p) => p.severity === "blocking") && !Object.values(reply.checks).includes("fail");
  const approval: Approval = {
    status: approved ? "approved" : "changes-requested",
    by: reply.reviewer.name.trim(),
    kind: reply.reviewer.kind,
    at: new Date().toISOString(),
    textHash,
    file,
    independence: translators.length ? "verified" : "unverified",
    ...(reply.theologicalConcerns?.length ? { note: `theological concerns for the owner: ${reply.theologicalConcerns.join(" | ")}` } : {}),
  };
  const key = `${reply.chapter}.${reply.lang}`;
  const entry = (ledger[key] ??= {});
  if (reply.reviewer.kind === "ai") entry.advisory = [...(entry.advisory ?? []).filter((a) => a.textHash === textHash), approval];
  // A human decision is not displaced by an AI one for the same text.
  if (!(entry.linguistic?.kind === "human" && entry.linguistic.textHash === textHash && reply.reviewer.kind === "ai")) entry.linguistic = approval;
  return { ok: true, message: `Linguistic review ${approval.status} by ${approval.by} (${approval.kind}${approval.kind === "ai" ? ", advisory" : ""}) for ${key} @ ${textHash}.` };
}

// ---------------------------------------------------------------- owner approval guard

const AGENT_MARKERS = ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "AI_AGENT", "CODEX_SANDBOX", "CODEX_HOME", "GEMINI_CLI", "CURSOR_AGENT", "CI", "GITHUB_ACTIONS"];

export function owners(): Array<{ name: string; email: string }> {
  return readJson(path.join(HERE, "reviewers.json")).owners;
}

/** Why an owner approval may not be recorded from this process, or null if it may. */
export function ownerGuard(env: Record<string, string | undefined> = process.env, tty = !!(process.stdin.isTTY && process.stdout.isTTY)): string | null {
  const marker = AGENT_MARKERS.find((m) => env[m]);
  if (marker) return `refused: this is an automated or agent session (${marker} is set). Owner approval is recorded only by the owner at their own terminal.`;
  if (!tty) return "refused: owner approval needs an interactive terminal.";
  let email = "";
  try {
    email = execFileSync("git", ["config", "user.email"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    /* no git identity */
  }
  if (!owners().some((o) => o.email.toLowerCase() === email.toLowerCase())) return `refused: git user.email "${email}" is not an owner in tools/translation-engine/reviewers.json.`;
  return null;
}

// ---------------------------------------------------------------- readiness

export interface Readiness {
  chapter: string;
  lang: LanguageCode;
  ready: boolean;
  textHash: string;
  mechanical: "pass" | "fail";
  linguistic: string;
  theological: string;
  metadata: "complete" | "incomplete";
  reasons: string[];
}

export function readiness(opts: { book: string; bookRecord: any; chapter: string; record: any; file: string; lang: LanguageCode; ledger: Ledger }): Readiness {
  const { record, lang, ledger } = opts;
  const textHash = chapterHash(record, lang);
  const entry = ledger[`${opts.chapter}.${lang}`] ?? {};
  const reasons: string[] = [];
  const errors: Issue[] = blocking(checkRecord(record, { file: opts.file, book: opts.book, kind: "chapter", langs: [lang], require: true }));
  if (errors.length) reasons.push(`${errors.length} blocking mechanical error(s), first: ${errors[0].field}${errors[0].paragraph ? ` ¶${errors[0].paragraph}` : ""} ${errors[0].rule}`);
  const meta = blocking(checkRecord(opts.bookRecord, { file: "book.json", book: opts.book, kind: "book", langs: [lang] }));
  const bookT = opts.bookRecord.translations?.[lang];
  const metaComplete = !!bookT?.title && (!opts.bookRecord.description || !!bookT.description) && (opts.bookRecord.parts ?? []).every((p: any) => p.translations?.[lang]?.title) && !meta.filter((i) => i.lang === lang).length;
  if (!metaComplete) reasons.push("book title, description or a part title is missing or failing in this language");
  const status = (a: Approval | undefined) => (!a ? "none" : a.textHash !== textHash ? `void (text changed since ${a.by} ${a.status})` : `${a.status} by ${a.by} (${a.kind})`);
  if (!current(entry.linguistic, textHash)) reasons.push(`linguistic review: ${status(entry.linguistic)}`);
  const theo = entry.theological;
  const theoOk = current(theo, textHash) && theo!.kind === "owner" && owners().some((o) => o.name === theo!.by || o.email === theo!.by);
  if (!theoOk) reasons.push(`theological approval: ${status(theo)}`);
  return {
    chapter: opts.chapter,
    lang,
    ready: !reasons.length,
    textHash,
    mechanical: errors.length ? "fail" : "pass",
    linguistic: status(entry.linguistic),
    theological: status(theo),
    metadata: metaComplete ? "complete" : "incomplete",
    reasons,
  };
}
