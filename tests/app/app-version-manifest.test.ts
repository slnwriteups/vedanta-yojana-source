import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guards public/app-version.json against drifting behind the app it
 * describes.
 *
 * Why this exists: the manifest is hand-maintained -- no build script
 * generates it -- and mobile/services/updateCheckService.ts offers an
 * update only when `manifest.versionCode > installedVersionCode`. So a
 * manifest left behind after a release does not fail loudly; it silently
 * tells every user they are already current. That is exactly what
 * happened between android-v10 and android-v13: the app shipped as
 * versionCode 13 while the manifest still advertised 10, and no user on
 * 10 was ever offered the upgrade. Nothing in the build, the tests, or
 * CI noticed, because a stale-but-well-formed manifest is
 * indistinguishable from a correct one unless something compares it to
 * the app.
 *
 * These assertions are that comparison. mobile/app.json is the source of
 * truth for what the app actually is; this file only ever has to agree
 * with it.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8"));
}

interface AndroidManifest {
  versionCode: number;
  version: string;
  url: string;
  notes?: string;
}

function publishedManifest(): AndroidManifest {
  const raw = readJson("public/app-version.json");
  return (raw as { android: AndroidManifest }).android;
}

function expoConfig(): { version: string; android: { versionCode: number } } {
  const raw = readJson("mobile/app.json");
  return (raw as { expo: { version: string; android: { versionCode: number } } }).expo;
}

test("the published manifest advertises the versionCode the app actually ships", () => {
  // The whole bug in one assertion: manifest 10 vs app 13 meant no user
  // on 10 was ever offered 13.
  assert.equal(
    publishedManifest().versionCode,
    expoConfig().android.versionCode,
    "public/app-version.json is behind mobile/app.json -- installed users will never be offered the newer build",
  );
});

test("updateCheckService BUILD_VERSION_CODE matches mobile/app.json versionCode", () => {
  const fileContent = fs.readFileSync(path.join(REPO_ROOT, "mobile/services/updateCheckService.ts"), "utf8");
  const match = fileContent.match(/export const BUILD_VERSION_CODE = (\d+);/);
  assert.ok(match, "BUILD_VERSION_CODE constant must exist in updateCheckService.ts");
  assert.equal(
    Number(match[1]),
    expoConfig().android.versionCode,
    "BUILD_VERSION_CODE in mobile/services/updateCheckService.ts must match mobile/app.json",
  );
});

test("the published manifest's version string matches the app's", () => {
  assert.ok(
    publishedManifest().version.startsWith(expoConfig().version),
    `manifest version "${publishedManifest().version}" must start with app version "${expoConfig().version}"`,
  );
});

test("the download URL points at the release tag for that exact versionCode", () => {
  const { url, versionCode } = publishedManifest();
  // The releases repo tags builds android-v<versionCode> (see the
  // releases repository). A manifest whose versionCode and URL disagree
  // would hand users the wrong APK -- worse than handing them none.
  assert.ok(
    url.includes(`/download/android-v${versionCode}/`),
    `URL does not reference android-v${versionCode}: ${url}`,
  );
  assert.ok(
    url.startsWith("https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/") ||
      url.startsWith("https://github.com/slnwriteups/vedanta-yojana-source/releases/download/"),
    `URL must start with an official GitHub Releases download URL: ${url}`,
  );
  assert.ok(url.endsWith(".apk"), "must point at the APK itself, not the checksum or the release page");
});

test("the manifest satisfies the validator the app actually applies to it", () => {
  // Mirrors isValidManifest() in mobile/services/updateCheckService.ts.
  // A manifest that fails this is discarded by the app as malformed,
  // which -- like a stale one -- surfaces as "no update available".
  const m = publishedManifest();
  assert.equal(typeof m.versionCode, "number");
  assert.equal(typeof m.version, "string");
  assert.equal(typeof m.url, "string");
});

test("release notes are present and are a short user-facing summary", () => {
  const notes = publishedManifest().notes;
  assert.equal(typeof notes, "string");
  assert.ok((notes ?? "").length > 0, "notes are shown in the update prompt");
  // Guards against someone pasting the full GitHub release body in
  // here: that text contains signing fingerprints, SHA-256 sums and
  // shell commands, none of which belong in an in-app prompt.
  assert.ok((notes ?? "").length < 400, "notes should summarise, not reproduce the release body");
  assert.ok(!/SHA-256|shasum|fingerprint/i.test(notes ?? ""), "verification detail belongs in the release, not the prompt");
});
