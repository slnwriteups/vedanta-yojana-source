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
