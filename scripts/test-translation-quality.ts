import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LanguageCode } from "../content-lib/schemas/language.ts";
import { paragraphCount, scriptFindings, type Finding } from "./translation/checks.ts";
import { LANGS } from "./translation/mechanical.ts";
import { args, readJson, ROOT } from "./translation/work.ts";

/**
 * Quality gate for translations (docs/TRANSLATION-GUIDE.md §3, §4, §9).
 * Exits 1 if any error is found.
 *
 *   node scripts/test-translation-quality.ts [--changed[=<base ref>]] [--all] [--files=a.json,b.json]
 *
 * --changed  content files changed against a base ref (default origin/main),
 *            plus uncommitted changes. This is what the pull-request check runs.
 * --all      every content file (older chapters predate some rules; expect
 *            a few findings).
 * --files    an explicit list.
 *
 * Errors: paragraph-count parity with the English body, Kannada/Telugu (and
 * other) script leaks, native digits outside verse lines, gloss echo
 * ("word (word)", with a whitelist in scripts/translation/checks.ts).
 * Warnings: possible Perso-Arabic words in Hindi.
 */

const a = args();

function listFiles(): string[] {
  const contentFile = (f: string) => /^content\/(library\/[^/]+\/(book\.json|chapters\/[^/]+\.json)|divya-desams\/[^/]+\.json|knowledge\/[^/]+\.json)$/.test(f);
  if (a.files) return a.files.split(",").map((f) => f.trim()).filter(Boolean);
  if (a.all) {
    const walk = (d: string): string[] =>
      fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : [],
      );
    return walk("content").filter(contentFile);
  }
  const base = a.changed && a.changed !== "true" ? a.changed : "origin/main";
  const git = (cmd: string) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  let files: string[] = [];
  try {
    files = git(`git diff --name-only --diff-filter=AM ${base}...HEAD`);
  } catch {
    console.error(`Could not diff against ${base}; checking uncommitted changes only.`);
  }
  files.push(...git("git diff --name-only --diff-filter=AM HEAD"), ...git("git ls-files --others --exclude-standard content"));
  return [...new Set(files)].filter(contentFile);
}

interface Result {
  file: string;
  lang: LanguageCode;
  finding: Finding;
}

const results: Result[] = [];
const files = listFiles();

for (const file of files) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  const r = readJson(abs);
  for (const lang of LANGS) {
    const t = r.translations?.[lang];
    const texts: string[] = [];
    const strings = (v: unknown): string[] =>
      typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
    if (t) texts.push(...strings(t));
    for (const p of r.parts ?? []) if (p.translations?.[lang]) texts.push(p.translations[lang].title);
    for (const img of r.images ?? []) if (img.placementAnchorTranslations?.[lang]) texts.push(img.placementAnchorTranslations[lang]);
    if (!texts.length) continue;
    for (const text of texts) for (const f of scriptFindings(text, lang)) results.push({ file, lang, finding: f });
    if (typeof r.body === "string" && typeof t?.body === "string") {
      const en = paragraphCount(r.body);
      const tr = paragraphCount(t.body);
      if (en !== tr) results.push({ file, lang, finding: { level: "error", rule: "paragraph-parity", detail: `${en} English paragraphs, ${tr} in ${lang}` } });
    }
    if (typeof r.sthalaPuranam === "string" && typeof t?.sthalaPuranam === "string") {
      const en = paragraphCount(r.sthalaPuranam);
      const tr = paragraphCount(t.sthalaPuranam);
      if (en !== tr) results.push({ file, lang, finding: { level: "warning", rule: "paragraph-parity", detail: `sthalaPuranam: ${en} English paragraphs, ${tr} in ${lang}` } });
    }
    if (lang === "hi" && typeof t?.body === "string") {
      const words = ["हजार", "हज़ार", "दुनिया", "इंसान", "किताब", "शुरू", "इस्तेमाल", "कोशिश", "सिर्फ"].filter((w) => t.body.includes(w));
      if (words.length) results.push({ file, lang, finding: { level: "warning", rule: "perso-arabic", detail: `consider Tatsama forms for: ${words.join(", ")}` } });
    }
  }
}

const errors = results.filter((r) => r.finding.level === "error");
const warnings = results.length - errors.length;
for (const r of results) console.log(`${r.finding.level === "error" ? "ERROR  " : "warning"} ${r.file} [${r.lang}] ${r.finding.rule}: ${r.finding.detail}`);
console.log(`\nChecked ${files.length} content file(s): ${errors.length} error(s), ${warnings} warning(s).`);
if (errors.length) process.exit(1);
