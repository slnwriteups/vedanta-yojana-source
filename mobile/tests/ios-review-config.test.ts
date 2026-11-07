import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * App Store review rules that live in mobile/app.json's plugin options.
 * The plugins' defaults add Info.plist entries this app does not use, which
 * reviewers reject: a background mode with no background feature (Guideline
 * 2.5.4) and generic permission texts (Guideline 5.1.1).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const appJson = JSON.parse(fs.readFileSync(path.join(here, "../app.json"), "utf8"));
const plugins: unknown[] = appJson.expo.plugins;

function pluginOptions(name: string): Record<string, unknown> {
  const entry = plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);
  assert.ok(Array.isArray(entry), `${name} must be configured with options in app.json`);
  return entry[1] as Record<string, unknown>;
}

test("iOS: expo-audio does not declare background audio (the app plays none)", () => {
  assert.equal(pluginOptions("expo-audio").enableBackgroundPlayback, false);
});

test("iOS: expo-location leaves out motion activity (unused), so no motion permission text", () => {
  assert.equal(pluginOptions("expo-location").motionUsagePermission, false);
});

test("iOS: every location permission text is specific to this app, none is the library's generic default", () => {
  const options = pluginOptions("expo-location");
  for (const key of ["locationWhenInUsePermission", "locationAlwaysAndWhenInUsePermission", "locationAlwaysPermission", "locationFullAccuracyPermission"]) {
    const text = options[key];
    assert.equal(typeof text, "string", `${key} must be set`);
    assert.match(text as string, /Panchangam/, `${key} must say what the location is for`);
    assert.doesNotMatch(text as string, /PRODUCT_NAME/, `${key} must not be the generic default`);
  }
});
