import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_RUNS, appendRun, toRun, type SeoHealthHistory } from "../../scripts/record-seo-health.ts";

/**
 * stats/seo-health.json is the SEO bot's history, read by the private
 * analytics dashboard. These keep the recorder's contract: validated
 * counts only, one entry per check, oldest first, capped.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const summary = (checkedAt: string, errors = 0) => ({
  checkedAt,
  target: "https://vedantayojana.org",
  pages: 424,
  errors,
  warnings: 3,
  byCheck: { title: { errors: 0, warnings: 3 }, sitemap: { errors, warnings: 0 } },
});

test("toRun keeps only validated counts and the trigger", () => {
  const run = toRun({ ...summary("2026-10-26T16:00:00Z", 2), extra: "dropped" }, "deploy");
  assert.deepEqual(run, {
    checkedAt: "2026-10-26T16:00:00Z",
    trigger: "deploy",
    pages: 424,
    errors: 2,
    warnings: 3,
    byCheck: { title: { errors: 0, warnings: 3 }, sitemap: { errors: 2, warnings: 0 } },
  });
  assert.equal(toRun({ ...summary("2026-10-26T16:00:00Z"), errors: -1, pages: "x" }, "weekly").errors, 0);
});

test("toRun rejects malformed input instead of recording it", () => {
  assert.throws(() => toRun(null, "deploy"));
  assert.throws(() => toRun({ checkedAt: "not a date" }, "deploy"));
  assert.throws(() => toRun(summary("2026-10-26T16:00:00Z"), "hourly"));
});

test("appendRun keeps runs oldest first, replaces a re-recorded check, and caps the history", () => {
  let history: SeoHealthHistory | null = null;
  history = appendRun(history, toRun(summary("2026-10-26T16:00:00Z"), "deploy"));
  history = appendRun(history, toRun(summary("2026-10-26T12:00:00Z", 845), "manual"));
  history = appendRun(history, toRun(summary("2026-10-26T16:00:00Z", 1), "deploy"));
  assert.deepEqual(history.runs.map((r) => [r.checkedAt, r.errors]), [["2026-10-26T12:00:00Z", 845], ["2026-10-26T16:00:00Z", 1]]);

  for (let i = 0; i < MAX_RUNS + 10; i++) {
    history = appendRun(history, toRun(summary(new Date(Date.UTC(2027, 0, 1) + i * 3_600_000).toISOString()), "weekly"));
  }
  assert.equal(history.runs.length, MAX_RUNS);
  assert.equal(history.runs.at(-1)?.checkedAt, new Date(Date.UTC(2027, 0, 1) + (MAX_RUNS + 9) * 3_600_000).toISOString());
});

test("the committed stats/seo-health.json is a valid, ordered history", () => {
  const stored: SeoHealthHistory = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "stats", "seo-health.json"), "utf8"));
  assert.equal(stored.schemaVersion, 1);
  assert.ok(stored.runs.length > 0);
  const times = stored.runs.map((r) => r.checkedAt);
  assert.deepEqual(times, [...times].sort());
  for (const r of stored.runs) assert.deepEqual(toRun(r, r.trigger), r);
});

test("seo-health.yml records each check on main, before the step that fails the run", () => {
  const workflow = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "seo-health.yml"), "utf8");
  assert.match(workflow, /--json seo-summary\.json/);
  assert.match(workflow, /node scripts\/record-seo-health\.ts seo-summary\.json "\$TRIGGER"/);
  assert.ok(workflow.indexOf("record-seo-health") < workflow.indexOf("Open or update the issue"));
  assert.match(workflow, /contents: write/);
});

test("the stats commit skips CI, so recording a check can't start a deploy and another check in a loop", () => {
  const workflow = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "seo-health.yml"), "utf8");
  assert.match(workflow, /git commit -m "chore\(stats\): record SEO health check \[skip ci\]"/);
});
