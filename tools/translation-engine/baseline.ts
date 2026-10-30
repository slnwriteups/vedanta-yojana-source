import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "../../scripts/translation/work.ts";
import { splitParagraphs } from "../../scripts/translation/mechanical.ts";
import type { Issue } from "./validate.ts";

/**
 * Known historical defects (baseline.json): blocking errors that were already
 * in published content when the engine arrived. They stay visible as
 * "known" findings and do not fail unrelated work. New errors always block.
 *
 * Each entry pins the exact file, language, field, paragraph and rule, plus a
 * fingerprint of the text it was found in (the paragraph, or the whole field
 * when the issue is about the field). Editing that text changes the
 * fingerprint, so the old excuse no longer applies: the edit must fix the
 * defect. A defect that has been fixed leaves a stale entry, reported until
 * someone removes it with `baseline --prune`. Nothing adds entries after
 * `baseline --init` created the file.
 */

export interface BaselineEntry {
  file: string;
  lang: string;
  field: string;
  paragraph?: number;
  rule: string;
  fingerprint: string;
  detail: string;
}

export interface Baseline {
  note: string;
  created: string;
  entries: BaselineEntry[];
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BASELINE_FILE = path.join(HERE, "baseline.json");

export function loadBaseline(file = BASELINE_FILE): Baseline | null {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Baseline) : null;
}

function fieldValue(record: any, lang: string, field: string): string | undefined {
  if (lang === "en") {
    const parts = field.match(/^parts\[(\d+)\]\.title$/);
    return parts ? record.parts?.[Number(parts[1])]?.title : typeof record[field] === "string" ? record[field] : JSON.stringify(record[field] ?? null);
  }
  const parts = field.match(/^parts\[(\d+)\]\.title$/);
  if (parts) return record.parts?.[Number(parts[1])]?.translations?.[lang]?.title ?? "";
  return record.translations?.[lang]?.[field] ?? (field === "translations" ? "" : undefined);
}

/** What the issue was found in: the paragraph when it has one (English numbering), else the whole field. */
export function fingerprint(issue: Issue, record: any): string {
  let text = fieldValue(record, issue.lang, issue.field) ?? "";
  if (issue.paragraph && issue.rule !== "paragraph-parity") {
    const paras = splitParagraphs(text);
    text = paras[issue.paragraph - 1] ?? text;
  }
  return hash(`${issue.rule}\u0000${text}`);
}

const key = (e: Pick<BaselineEntry, "file" | "lang" | "field" | "paragraph" | "rule" | "fingerprint">) =>
  `${e.file}|${e.lang}|${e.field}|${e.paragraph ?? ""}|${e.rule}|${e.fingerprint}`;

export interface Applied {
  /** Errors not in the baseline: these block. */
  blocking: Issue[];
  /** Errors excused by an unchanged baseline entry: reported, not blocking. */
  known: Issue[];
  /** Baseline entries for the checked files that no longer occur. */
  stale: BaselineEntry[];
}

/**
 * Splits errors into new and known. `records` maps each checked file to its
 * current record; only baseline entries for those files can be stale.
 */
export function applyBaseline(issues: Issue[], records: Map<string, any>, baseline: Baseline | null): Applied {
  const errors = issues.filter((i) => i.level === "error");
  if (!baseline) return { blocking: errors, known: [], stale: [] };
  const remaining = new Map<string, number>();
  for (const e of baseline.entries) remaining.set(key(e), (remaining.get(key(e)) ?? 0) + 1);
  const blocking: Issue[] = [];
  const known: Issue[] = [];
  for (const i of errors) {
    const k = key({ ...i, fingerprint: fingerprint(i, records.get(i.file)) });
    const left = remaining.get(k) ?? 0;
    if (left > 0) {
      remaining.set(k, left - 1);
      known.push(i);
    } else blocking.push(i);
  }
  const stale: BaselineEntry[] = [];
  for (const e of baseline.entries) {
    const left = remaining.get(key(e)) ?? 0;
    if (!records.has(e.file) || left === 0) continue;
    stale.push(e);
    remaining.set(key(e), left - 1);
  }
  return { blocking, known, stale };
}

export function baselineFrom(issues: Issue[], records: Map<string, any>): Baseline {
  return {
    note: "Known historical translation defects. Never add entries by hand or by tool; remove fixed ones with `node tools/translation-engine/cli.ts baseline --prune`. See REMEDIATION.md.",
    created: new Date().toISOString().slice(0, 10),
    entries: issues
      .filter((i) => i.level === "error")
      .map((i) => ({ file: i.file, lang: i.lang, field: i.field, ...(i.paragraph ? { paragraph: i.paragraph } : {}), rule: i.rule, fingerprint: fingerprint(i, records.get(i.file)), detail: i.detail })),
  };
}

export function saveBaseline(b: Baseline, file = BASELINE_FILE): void {
  fs.writeFileSync(file, JSON.stringify(b, null, 2) + "\n");
}
