import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => fs.readFileSync(path.join(mobileRoot, file), "utf8");

// Onboarding's Continue button awaits autoEnableNotifications before the app
// opens. Push registration talks to the network (our push service and Expo's
// token service, which has no timeout), so awaiting it there left readers on a
// slow or blocked connection stuck on the text-size/language screen.
test("autoEnableNotifications does not wait for network registration", () => {
  const source = read("services/pushNotifications.ts");
  const start = source.indexOf("export function autoEnableNotifications");
  assert.ok(start !== -1);
  const body = source.slice(start, source.indexOf("\n}\n", start));
  assert.doesNotMatch(body, /await\s+registerPush\(/);
  assert.match(body, /registerPush\(/, "it still registers, just without blocking");
});

// The setup screen holds the notification notes plus the language,
// appearance and text-size choices. On most phones (more so in Tamil or
// with large system text) that is taller than the screen, and without a
// ScrollView the Continue button sat below the edge, out of reach.
test("the setup screen scrolls, so Continue is always reachable", () => {
  const source = read("components/OnboardingScreen.tsx");
  assert.match(source, /<ScrollView[\s>]/);
  const scrollBody = source.slice(source.indexOf("<ScrollView"), source.indexOf("</ScrollView>"));
  assert.match(scrollBody, /<SettingsControls \/>/);
  assert.match(scrollBody, /onboardingContinue/);
});
