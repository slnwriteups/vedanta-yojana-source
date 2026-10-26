import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Until the Expo SDK 58 upgrade, two dependencies were patched with
 * patch-package for denial-of-service bugs (see docs/SECURITY.md):
 * `metro`'s nested `image-size` (an infinite loop on a crafted .icns or
 * .jxl file) and `decode-uri-component` (exponential decoding of
 * malformed input). Neither package is in the dependency tree any more,
 * so the patches were removed rather than ported.
 *
 * This keeps it that way: if either package returns, through any
 * dependency, this fails, and the fix (a patch, an override, or a
 * version known to be fixed) has to be re-established before release.
 */

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function lockedPackages(): string[] {
  const lock = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, "package-lock.json"), "utf8")) as {
    packages: Record<string, unknown>;
  };
  return Object.keys(lock.packages);
}

for (const name of ["image-size", "decode-uri-component"]) {
  test(`${name} is not in the app's dependency tree (it was patched for a denial-of-service bug)`, () => {
    const found = lockedPackages().filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert.deepEqual(found, [], `${name} is back via ${found.join(", ")} -- re-check it for the old vulnerability before release`);
  });
}
