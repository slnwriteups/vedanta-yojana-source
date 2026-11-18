import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A Sthala Puranam photo is placed after the line its anchor names
// (components/divya-desams/SthalaPuranamWithImages.tsx and its mobile
// twin match a whole trimmed line). An anchor that names no line drops
// the photo to the end of the page, away from its caption -- reported on
// Tirukurungudi, 18 Nov 2026. Each translated anchor must name a line of
// that language's text.

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/divya-desams");
const lines = (text: string) => new Set(text.split("\n").map((l) => l.trim()).filter(Boolean));

test("every Divya Desam image anchor names a whole line of its Sthala Puranam, in every language", () => {
  const problems: string[] = [];
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    const record = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
    for (const image of record.images ?? []) {
      if (image.placementAnchor && !lines(record.sthalaPuranam ?? "").has(image.placementAnchor.trim())) {
        problems.push(`${file} ${image.assetId} [en]: "${image.placementAnchor}"`);
      }
      for (const [lang, anchor] of Object.entries(image.placementAnchorTranslations ?? {})) {
        const text = record.translations?.[lang]?.sthalaPuranam ?? "";
        if (!lines(text).has(String(anchor).trim())) problems.push(`${file} ${image.assetId} [${lang}]: "${anchor}"`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("Tirukurungudi: each photo sits directly above its caption, in every language", () => {
  const record = JSON.parse(fs.readFileSync(path.join(DIR, "tirukurungudi.json"), "utf8"));
  const byId = Object.fromEntries(record.images.map((i: any) => [i.assetId, i]));
  for (const lang of ["en", "ta", "kn", "hi", "te"]) {
    const text: string = lang === "en" ? record.sthalaPuranam : record.translations[lang].sthalaPuranam;
    const l = text.split("\n").map((x) => x.trim()).filter(Boolean);
    const after = (id: string) => {
      const img = byId[id];
      const anchor = (lang !== "en" && img.placementAnchorTranslations?.[lang]) || img.placementAnchor;
      return l[l.indexOf(anchor) + 1];
    };
    const temple = l[l.findLastIndex((x) => x.endsWith("||")) + 1];
    assert.equal(after("tirukurungudi-3"), temple, `${lang}: temple photo above its caption`);
    assert.equal(after("tirukurungudi-4"), l[l.indexOf(temple) + 1], `${lang}: Kaisika Mandapam photo above its caption`);
    assert.equal(after("tirukurungudi-5"), l[l.length - 2], `${lang}: Mahendragiri photo above its caption`);
  }
});
