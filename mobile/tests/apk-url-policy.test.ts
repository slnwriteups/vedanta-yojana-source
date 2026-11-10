import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTrustedApkUrl } from "../services/apkUrlPolicy.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("accepts an APK from the official releases repository", () => {
  assert.equal(
    isTrustedApkUrl("https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk"),
    true
  );
});

test("the published app-version.json URL is trusted", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "public/app-version.json"), "utf8"));
  assert.equal(isTrustedApkUrl(manifest.android.url), true);
});

test("rejects anything that is not the official releases repository", () => {
  for (const url of [
    "http://github.com/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk",
    "https://github.com/someone-else/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk",
    "https://github.com/slnwriteups/vedanta-yojana-releases-evil/releases/download/android-v18/vedanta-yojana.apk",
    "https://github.com.evil.example/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk",
    "https://evil.example/https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/a/b.apk",
    "https://user@github.com/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk",
    "https://github.com:444/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk",
    "https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/../../../other/repo/x.apk",
    "https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/%2e%2e/x.apk",
    "https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.exe",
    "https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/a/b.apk",
    "https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk?x=1",
    "https://github.com/slnwriteups/vedanta-yojana-releases/releases/download/android-v18/vedanta-yojana.apk#x",
    "javascript:alert(1)",
    "",
    "not a url",
  ]) {
    assert.equal(isTrustedApkUrl(url), false, url);
  }
});
