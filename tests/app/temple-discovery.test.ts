import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { templeSeo } from "../../lib/divya-desam-seo.ts";
import { isHomeEntry } from "../../lib/entry-experience.ts";

test("all temple summaries describe only available sections and preserve stored names", () => {
  const titles = new Set<string>();
  for (const file of fs.readdirSync("content/divya-desams")) {
    if (!file.endsWith(".json")) continue;
    const record = JSON.parse(fs.readFileSync(`content/divya-desams/${file}`, "utf8"));
    const before = JSON.stringify(record);
    const seo = templeSeo(record);
    assert.ok(seo.summary.includes(record.displayName));
    assert.equal(JSON.stringify(record), before);
    assert.ok(!titles.has(seo.title), seo.title);
    titles.add(seo.title);
    if (!record.templeInformation.travelNote) assert.ok(!seo.summary.includes("how to reach"));
    if (seo.celestial) assert.ok(!seo.title.includes("Temple"));
    if (record.slug === "sri-rangam") {
      assert.equal(seo.name, "Srirangam");
      assert.match(seo.summary, /Sri Raṅgam/);
    }
  }
  assert.equal(titles.size, 107);
});

test("direct content entry bypasses gates, including deployments under a base path", () => {
  for (const pathname of ["/", ""]) assert.equal(isHomeEntry(pathname, ""), true);
  for (const pathname of ["/divya-desams/", "/divya-desams/sri-rangam/", "/library/jaya/", "/settings/"]) {
    assert.equal(isHomeEntry(pathname, ""), false);
  }
  assert.equal(isHomeEntry("/preview/", "/preview"), true);
  assert.equal(isHomeEntry("/preview/divya-desams/", "/preview"), false);
});
