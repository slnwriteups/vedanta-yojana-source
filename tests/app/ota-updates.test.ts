import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Covers over-the-air delivery of mobile JS changes (EAS Update), in
 * the structural style of tests/app/ci.test.ts: a node test cannot
 * publish an update or run an Android build, but it can hold in place
 * the properties that make OTA safe here, each of which fails silently
 * rather than loudly if it regresses.
 *
 * An update reaches every installed app with no review step in front of
 * it, so the safeguards are the point: updates must be tied to a
 * compatible native build, must not be publishable without passing the
 * mobile suite, and must not break the separate prompt that covers what
 * an update cannot deliver.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(read(relPath)) as Record<string, unknown>;
}

function expoConfig(): Record<string, unknown> {
  return (readJson("mobile/app.json") as { expo: Record<string, unknown> }).expo;
}

const WORKFLOW_PATH = ".github/workflows/eas-update.yml";

test("the app ships an update client, pinned to the Expo SDK it is built against", () => {
  const deps = (readJson("mobile/package.json") as { dependencies: Record<string, string> }).dependencies;
  assert.ok(deps["expo-updates"], "without expo-updates in the app, no published update can ever be received");
  assert.ok(deps["expo-application"], "updateCheckService needs the installed binary's own versionCode");

  const lock = readJson("mobile/package-lock.json") as { packages: Record<string, { version: string }> };
  for (const name of ["expo-updates", "expo-application"]) {
    assert.ok(
      lock.packages[`node_modules/${name}`],
      `${name} is in package.json but not the lockfile -- npm ci in the publish workflow would fail`,
    );
  }
});

test("updates are tied to a compatible native build by fingerprint, not by app version", () => {
  const runtimeVersion = expoConfig().runtimeVersion as { policy?: string } | undefined;
  // Every build since versionCode 10 has carried version "1.0.0", so
  // the "appVersion" policy would put all of them on one runtime and
  // happily offer a post-native-change bundle to a binary that cannot
  // run it. The fingerprint policy derives the runtime from the native
  // project itself.
  assert.equal(
    runtimeVersion?.policy,
    "fingerprint",
    "a non-fingerprint runtime policy can deliver an update to a binary missing the native code it needs",
  );
});

test("the update endpoint points at this project, and never blocks app startup", () => {
  const updates = expoConfig().updates as { url?: string; fallbackToCacheTimeout?: number } | undefined;
  const projectId = ((readJson("mobile/app.json") as { expo: { extra: { eas: { projectId: string } } } }).expo.extra.eas
    .projectId);

  assert.equal(updates?.url, `https://u.expo.dev/${projectId}`);
  assert.equal(
    updates?.fallbackToCacheTimeout,
    0,
    "a non-zero timeout makes launch wait on the network for an update",
  );
});

/** The file's executable lines, with comment lines dropped -- so a comment explaining why an API is NOT used doesn't read as a use of it. */
function codeLines(relPath: string): string {
  return read(relPath)
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

test("the update check compares against the installed binary, not the bundle's own config", () => {
  const source = codeLines("mobile/services/updateCheckService.ts");
  // The regression OTA introduces: an over-the-air bundle carries its
  // own app.json, so expoConfig reports the versionCode of whatever was
  // published -- not of the APK actually installed. Comparing against
  // it makes a device that took an update believe it is already on the
  // newer build, and the real binary update is never offered again.
  assert.ok(
    source.includes("Application.nativeBuildVersion"),
    "the check must read the installed APK's own versionCode",
  );
  assert.ok(
    !source.includes("expoConfig"),
    "reading expoConfig's versionCode silently disables the binary-update prompt on any device running an update",
  );
});

test("the publish workflow runs the mobile suite before publishing, not after", () => {
  const source = read(WORKFLOW_PATH);
  const testsIdx = source.indexOf("--test mobile/tests/");
  const publishIdx = source.indexOf("eas-cli");
  assert.ok(testsIdx > -1, "the workflow publishes without running the mobile tests at all");
  assert.ok(publishIdx > -1);
  assert.ok(testsIdx < publishIdx, "tests must gate the publish -- an update has no staged rollout in front of it");
});

test("production builds subscribe to the channel the workflow publishes to", () => {
  const easJson = readJson("mobile/eas.json") as {
    build: Record<string, { channel?: string }>;
  };
  const channel = easJson.build.production?.channel;
  // A build receives updates only from the branch its channel points
  // at. With no channel on the profile, `eas update --branch production`
  // publishes into a branch no installed build is subscribed to: the
  // workflow goes green, the update history fills up, and not one phone
  // ever receives anything.
  assert.ok(channel, "the production build profile declares no update channel");
  assert.ok(
    read(WORKFLOW_PATH).includes(`--branch ${channel}`),
    `the workflow publishes to a different branch than the production profile's channel (${channel})`,
  );
});

test("mobile dependencies are installed before the suite that needs them runs", () => {
  const source = read(WORKFLOW_PATH);
  // Part of the mobile suite resolves real packages out of
  // mobile/node_modules (the image-size fixture, the Pasuram archive
  // tests). Running it first fails every publish for a reason that has
  // nothing to do with the change being published.
  assert.ok(source.indexOf("npm ci") < source.indexOf("--test mobile/tests/"));
});

test("the publish workflow is scoped to mobile changes and writes nothing back to the repository", () => {
  const source = read(WORKFLOW_PATH);
  assert.ok(source.includes('- "mobile/**"'), "an unscoped workflow republishes on every website commit");
  assert.ok(source.includes("permissions:\n  contents: read"));
  assert.ok(!source.includes("contents: write"));
  assert.ok(source.includes("npm ci"));
  assert.ok(!/\bnpm install\b/.test(source));
});

test("a missing publish credential is an honest skip, not a silent success or a permanent red X", () => {
  const source = read(WORKFLOW_PATH);
  assert.ok(source.includes('if [ -z "$EXPO_TOKEN" ]'));
  assert.ok(source.includes("::warning::"), "the skip must be visible in the run summary");
  // Same shape as the Worker deploy's own credential guard.
  assert.ok(source.includes("exit 0"));
});
