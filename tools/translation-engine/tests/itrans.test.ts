import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ItransError, itransToDeva } from "../../../scripts/translation/itrans.ts";

/**
 * ITRANS input. The fixture holds real verses from content/library written as
 * ITRANS by an independent converter (Aksharamukha); each must come back as
 * exactly the Devanagari we publish.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/translation-engine/tests/fixtures/itrans-verses.json"), "utf8"));

test("published verses round-trip from ITRANS to the exact Devanagari", () => {
  assert.ok(fixture.verses.length >= 30);
  for (const { itrans, deva } of fixture.verses) assert.equal(itransToDeva(itrans), deva, itrans);
});

test("alternative ITRANS spellings give the same letters", () => {
  const same: Array<[string, string]> = [
    ["rAmA", "raamaa"], ["shrI", "SrI"], ["viShNu", "vishhNu"], ["kR^iShNa", "kRRiShNa"],
    ["a~Nga", "aN^ga"], ["Chandas", "chhandas"], ["cha", "ca"], ["j~nAna", "GYAna"], ["dnyAna", "j~nAna"],
    ["xetra", "kShetra"], ["kshetra", "kShetra"], ["vAyu", "wAyu"], ["sItA", "seetA"], ["pUjA", "poojA"],
    ["raM", "ra.n"], ["raM", "ra.m"], ["pa~ncha", "paJNcha"],
  ];
  for (const [x, y] of same) assert.equal(itransToDeva(x), itransToDeva(y), `${x} / ${y}`);
});

test("case carries meaning, as the standard says", () => {
  assert.equal(itransToDeva("tata"), "तत");
  assert.equal(itransToDeva("TaTa"), "टट");
  assert.equal(itransToDeva("na"), "न");
  assert.equal(itransToDeva("Na"), "ण");
  assert.equal(itransToDeva("sha Sha sa"), "श ष स");
});

test("marks, conjuncts and word breaks", () => {
  assert.equal(itransToDeva("namaH"), "नमः");
  assert.equal(itransToDeva("vande.aham"), "वन्देऽहम्");
  assert.equal(itransToDeva("cha.Nd"), "चँद्");
  assert.equal(itransToDeva("OM"), "ॐ");
  assert.equal(itransToDeva("oM"), "ओं"); // the standard: ॐ is OM
  assert.equal(itransToDeva("bhartR^i"), "भर्तृ");
  assert.equal(itransToDeva("r_R^iddha"), "र्ऋद्ध"); // _ keeps the vowel independent
  assert.equal(itransToDeva("s_h"), "स्ह्");
  assert.equal(itransToDeva("rAma | rAma || 12 ||"), "राम । राम ॥ १२ ॥");
  assert.equal(itransToDeva("rAma . rAma .. 12 .."), "राम । राम ॥ १२ ॥");
});

test("a letter ITRANS does not define is refused, never passed through", () => {
  assert.throws(() => itransToDeva("viShNuq"), ItransError);
  assert.throws(() => itransToDeva("viśvam"), ItransError);
});

test("transliterate command gives the Devanagari block and each language's line", () => {
  const cli = path.join(ROOT, "tools/translation-engine/cli.ts");
  const r = spawnSync(process.execPath, [...process.execArgv, cli, "transliterate", "--text=OM namo nArAyaNAya |\nshrIvatsA~Nkam ||"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ॐ नमो नारायणाय ।\nश्रीवत्साङ्कम् ॥/);
  assert.match(r.stdout, /\[ta\]\nஓம் நமோ நாராயணாய \|\nஸ்ரீவத்ஸாங்கம் \|\|/);
  assert.match(r.stdout, /\[kn\]\nಓಂ ನಮೋ ನಾರಾಯಣಾಯ \|\nಶ್ರೀವತ್ಸಾಂಕಮ್ \|\|/);
  const bad = spawnSync(process.execPath, [...process.execArgv, cli, "transliterate", "--text=viśvam"], { cwd: ROOT, encoding: "utf8" });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /not an ITRANS letter/);
});
