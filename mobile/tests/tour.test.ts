import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TOUR_STEPS } from "../tour/tourSteps.ts";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => fs.readFileSync(path.join(mobileRoot, file), "utf8");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(mobileRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

test("every tour step's title and text exist in all five languages", () => {
  const strings = read("ui-strings.ts");
  for (const step of TOUR_STEPS) {
    for (const key of [step.title, step.body]) {
      const start = strings.indexOf(`  ${key}: {`);
      assert.ok(start !== -1, `${step.id}: missing string ${key}`);
      const entry = strings.slice(start, strings.indexOf("}", start));
      for (const language of ["en", "ta", "kn", "hi", "te"]) {
        assert.match(entry, new RegExp(`\\b${language}: "[^"]+"`), `${key} has no ${language}`);
      }
    }
  }
});

test("every tour step points at an element the app marks for the tour", () => {
  const marked = new Set<string>();
  for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
    for (const match of read(file).matchAll(/(?:TourTarget id|tourId)="([^"]+)"/g)) marked.add(match[1]);
  }
  for (const step of TOUR_STEPS) {
    assert.ok(marked.has(step.target), `${step.id}: nothing is marked "${step.target}"`);
  }
  assert.equal(new Set(TOUR_STEPS.map((s) => s.id)).size, TOUR_STEPS.length, "step ids repeat");
});

test("the tour ends on the Settings button that replays it, and lets readers try the settings", () => {
  const last = TOUR_STEPS[TOUR_STEPS.length - 1];
  assert.equal(last.target, "settings-tour");
  const interactive = TOUR_STEPS.filter((s) => s.interactive).map((s) => s.target);
  assert.deepEqual(interactive, ["settings-language", "settings-appearance", "settings-text-size"]);
});
