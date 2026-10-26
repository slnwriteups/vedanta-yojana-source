import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Appends one SEO health check result to stats/seo-health.json, the
 * history the private analytics dashboard charts ("is the site staying
 * healthy for search engines, and since when").
 *
 *   node scripts/record-seo-health.ts <summary.json> <trigger>
 *
 * <summary.json> is what `scripts/seo-audit.ts --json` wrote; <trigger> is
 * why the check ran: "deploy" (after a deploy), "weekly" (the Monday
 * schedule) or "manual". .github/workflows/seo-health.yml runs this on
 * main and commits the file, the same way apk-download-stats.yml keeps
 * stats/apk-downloads.json.
 *
 * Only counts are stored -- pages checked, errors and warnings, per check
 * -- never page content. The file is public like the rest of this
 * repository, and holds nothing the live site doesn't already show.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = path.join(REPO_ROOT, "stats", "seo-health.json");
const SCHEMA_VERSION = 1;
/** About two years at one check per deploy plus one a week. */
export const MAX_RUNS = 500;

export interface CheckCounts {
  errors: number;
  warnings: number;
}

export interface SeoHealthRun {
  checkedAt: string;
  trigger: "deploy" | "weekly" | "manual";
  pages: number;
  errors: number;
  warnings: number;
  byCheck: Record<string, CheckCounts>;
}

export interface SeoHealthHistory {
  schemaVersion: number;
  runs: SeoHealthRun[];
}

const TRIGGERS = new Set(["deploy", "weekly", "manual"]);

function count(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Validates seo-audit.ts's --json output into a run; throws on anything malformed. */
export function toRun(summary: unknown, trigger: string): SeoHealthRun {
  if (typeof summary !== "object" || summary === null) throw new Error("summary is not an object");
  const s = summary as Record<string, unknown>;
  if (typeof s.checkedAt !== "string" || Number.isNaN(Date.parse(s.checkedAt))) throw new Error("summary has no valid checkedAt");
  if (!TRIGGERS.has(trigger)) throw new Error(`unknown trigger "${trigger}"`);
  const byCheck: Record<string, CheckCounts> = {};
  if (typeof s.byCheck === "object" && s.byCheck !== null) {
    for (const [name, raw] of Object.entries(s.byCheck as Record<string, unknown>)) {
      const r = (raw ?? {}) as Record<string, unknown>;
      byCheck[name] = { errors: count(r.errors), warnings: count(r.warnings) };
    }
  }
  return {
    checkedAt: s.checkedAt,
    trigger: trigger as SeoHealthRun["trigger"],
    pages: count(s.pages),
    errors: count(s.errors),
    warnings: count(s.warnings),
    byCheck,
  };
}

/** Oldest first, one entry per check time, capped at MAX_RUNS. */
export function appendRun(history: SeoHealthHistory | null, run: SeoHealthRun): SeoHealthHistory {
  const runs = (history?.runs ?? []).filter((r) => r.checkedAt !== run.checkedAt);
  runs.push(run);
  runs.sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  return { schemaVersion: SCHEMA_VERSION, runs: runs.slice(-MAX_RUNS) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [summaryPath, trigger] = process.argv.slice(2);
  if (!summaryPath || !trigger) {
    console.error("Usage: node scripts/record-seo-health.ts <summary.json> <deploy|weekly|manual>");
    process.exit(2);
  }
  const run = toRun(JSON.parse(fs.readFileSync(summaryPath, "utf8")), trigger);
  const existing: SeoHealthHistory | null = fs.existsSync(OUTPUT_PATH) ? JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) : null;
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(appendRun(existing, run), null, 2)}\n`);
  console.log(`Recorded ${run.trigger} check of ${run.checkedAt}: ${run.pages} pages, ${run.errors} error(s), ${run.warnings} warning(s).`);
}
