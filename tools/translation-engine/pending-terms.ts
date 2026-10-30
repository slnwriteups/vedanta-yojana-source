import fs from "node:fs";
import path from "node:path";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { LANGS } from "../../scripts/translation/mechanical.ts";
import { fold, readJson, ROOT, workDir, writeJson } from "../../scripts/translation/work.ts";
import { loadGlossaryRules } from "./glossary.ts";

/**
 * New terminology proposed by translators (Standard §1 rule 4, §4.3).
 * Terms wait in translation-work/<book>/pending-terms.json; prep shows them
 * to later batches as "pending" so the book stays consistent, and only an
 * owner's approve-terms run writes them into docs/translation-glossaries/.
 */

export interface PendingTerm {
  en: string;
  forms: Partial<Record<LanguageCode, string>>;
  batch: number;
  proposedAt: string;
  status: "pending" | "approved" | "rejected";
}

export const pendingPath = (book: string, experiment?: string) => path.join(workDir(book, experiment), "pending-terms.json");

export function loadPending(book: string, experiment?: string): PendingTerm[] {
  const f = pendingPath(book, experiment);
  return fs.existsSync(f) ? readJson<{ terms: PendingTerm[] }>(f).terms : [];
}

export function savePending(book: string, terms: PendingTerm[], experiment?: string): void {
  writeJson(pendingPath(book, experiment), { note: "Proposed terms awaiting owner approval. Not binding until approved into docs/translation-glossaries/.", terms });
}

const SCRIPT_OK: Record<LanguageCode, RegExp> = { ta: /^[஀-௿\s]+$/, kn: /^[ಀ-೿\s‌‍]+$/, hi: /^[ऀ-ॿ\s]+$/, te: /^[ఀ-౿\s‌‍]+$/ };

/**
 * Adds a reply's "terms" to the pending list: only terms not already in a
 * glossary or pending, and only forms written wholly in their own script.
 * Returns the terms added.
 */
export function proposeTerms(book: string, raw: unknown, batch: number, experiment?: string): PendingTerm[] {
  const list = Array.isArray(raw) ? (raw as Array<Record<string, string>>) : [];
  const pending = loadPending(book, experiment);
  const known = new Set([...LANGS.flatMap((l) => loadGlossaryRules(l).map((e) => e.needle)), ...pending.map((p) => fold(p.en).trim())]);
  const added: PendingTerm[] = [];
  for (const t of list) {
    const en = String(t?.en ?? "").trim();
    if (!en || known.has(fold(en).trim())) continue;
    const forms: PendingTerm["forms"] = {};
    for (const l of LANGS) if (typeof t[l] === "string" && SCRIPT_OK[l].test(t[l].trim())) forms[l] = t[l].trim();
    if (!Object.keys(forms).length) continue;
    const term: PendingTerm = { en, forms, batch, proposedAt: new Date().toISOString().slice(0, 10), status: "pending" };
    pending.push(term);
    added.push(term);
    known.add(fold(en).trim());
  }
  if (added.length) savePending(book, pending, experiment);
  return added;
}

/** Writes approved terms into each glossary under a `# --- <book> (owner-approved <date>)` header. */
export function writeApproved(book: string, terms: PendingTerm[]): string[] {
  const date = new Date().toISOString().slice(0, 10);
  const changed: string[] = [];
  for (const lang of LANGS) {
    const lines = terms.filter((t) => t.forms[lang]).map((t) => `${t.en} = ${t.forms[lang]}`);
    if (!lines.length) continue;
    const file = path.join(ROOT, "docs/translation-glossaries", `${lang}.md`);
    const text = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, `${text.replace(/\n*$/, "\n")}# --- ${book} (owner-approved ${date})\n${lines.join("\n")}\n`);
    changed.push(`${lang} +${lines.length}`);
  }
  return changed;
}
