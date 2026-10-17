import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 5O -- structural validation of the CI workflow file. Not a YAML
 * parser (no new dependency introduced solely for that) -- plain
 * substring/line checks are sufficient to confirm the workflow contains
 * the required steps in the required order and nothing it shouldn't.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const WORKFLOW_PATH = ".github/workflows/ci.yml";

test("the CI workflow file exists", () => {
  assert.ok(fs.existsSync(path.join(REPO_ROOT, WORKFLOW_PATH)));
});

test("the CI workflow checks out the repository and sets up Node", () => {
  const source = read(WORKFLOW_PATH);
  assert.ok(source.includes("actions/checkout@"));
  assert.ok(source.includes("actions/setup-node@"));
});

test("the CI workflow installs dependencies reproducibly via npm ci, not npm install", () => {
  const source = read(WORKFLOW_PATH);
  assert.ok(source.includes("npm ci"));
  assert.ok(!/\bnpm install\b/.test(source));
});

test("the CI workflow runs content tests, app tests, TypeScript, and the production build, in that order", () => {
  const source = read(WORKFLOW_PATH);
  const contentIdx = source.indexOf("npm run test:content");
  const appIdx = source.indexOf("npm run test:app");
  const typecheckIdx = source.indexOf("npm run typecheck");
  const buildIdx = source.indexOf("npm run build");

  for (const idx of [contentIdx, appIdx, typecheckIdx, buildIdx]) {
    assert.ok(idx !== -1, "expected all four validation steps to be present");
  }
  assert.ok(contentIdx < appIdx && appIdx < typecheckIdx && typecheckIdx < buildIdx);
});

test("the CI workflow runs the mobile app's tests and type check after the build that generates their book payloads", () => {
  const source = read(WORKFLOW_PATH);
  const buildIdx = source.indexOf("npm run build");
  const mobileInstallIdx = source.indexOf("working-directory: mobile");
  const mobileTestIdx = source.indexOf("npm run test:mobile");
  const mobileTypecheckIdx = source.indexOf("npm run typecheck:mobile");
  for (const idx of [mobileInstallIdx, mobileTestIdx, mobileTypecheckIdx]) {
    assert.ok(idx !== -1, "expected the mobile install, test and typecheck steps to be present");
  }
  assert.ok(buildIdx < mobileInstallIdx && mobileInstallIdx < mobileTestIdx && mobileTestIdx < mobileTypecheckIdx);
});

test("the CI workflow pins Node via .nvmrc rather than a hard-coded version number", () => {
  const source = read(WORKFLOW_PATH);
  assert.ok(source.includes("node-version-file"));
  assert.ok(source.includes(".nvmrc"));
});

test("the CI workflow has no deployment, Vercel, secrets, or external-service step", () => {
  // Strip the leading comment block first -- it legitimately explains,
  // in prose, that there is no deployment step, which would otherwise
  // trip a naive substring check on the word itself.
  const source = read(WORKFLOW_PATH)
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .toLowerCase();
  for (const forbidden of ["vercel", "deploy", "secrets.", "aws", "docker push", "release"]) {
    assert.ok(!source.includes(forbidden), `found unexpected reference: ${forbidden}`);
  }
});

test(".nvmrc and package.json engines agree on the Node major version", () => {
  const nvmrc = read(".nvmrc").trim();
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.engines?.node.includes(nvmrc));
});

test("package.json's ci script runs the same four checks in the same order as the workflow", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(
    pkg.scripts.ci,
    "npm run test:content && npm run test:app && npm run typecheck && npm run build"
  );
});

test(".gitignore still excludes generated artifacts and still does NOT exclude content/content-extraction/images", () => {
  const source = read(".gitignore");
  assert.ok(source.includes("/node_modules"));
  assert.ok(source.includes("/.next/"));
  assert.ok(!/^\/?content\/?\s*$/m.test(source));
  assert.ok(!/^\/?content-extraction\/?\s*$/m.test(source));
  assert.ok(!/^\/?images\/?\s*$/m.test(source));
});
