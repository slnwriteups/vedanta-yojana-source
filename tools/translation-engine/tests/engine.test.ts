import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { LanguageCode } from "../../../content-lib/schemas/language.ts";
import { blocking, checkBook, checkRecord, englishDrift, latinFindings, untransliterable, type Issue } from "../validate.ts";
import { repairVerses } from "../verses.ts";

/**
 * The approved Sudarshana Ashtakam (nityasuri-vaibhavam) is the test case:
 * every test breaks a copy in memory and checks that the engine catches it.
 * The file itself is never written (asserted at the end).
 *
 *   node --test tools/translation-engine/tests/*.test.ts
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MODEL_REL = "content/library/nityasuri-vaibhavam/chapters/the-sudarsana-ashtakam.json";
const MODEL = path.join(ROOT, MODEL_REL);
const modelBytes = fs.readFileSync(MODEL);
const modelHash = crypto.createHash("sha256").update(modelBytes).digest("hex");
const model = () => JSON.parse(modelBytes.toString("utf8"));
const LANGS: LanguageCode[] = ["ta", "kn", "hi", "te"];
const opts = { file: MODEL_REL, book: "nityasuri-vaibhavam", kind: "chapter" as const };

const paras = (body: string) => body.split(/\n\s*\n/);
const setPara = (r: any, lang: LanguageCode, n: number, text: string) => {
  const p = paras(r.translations[lang].body);
  p[n - 1] = text;
  r.translations[lang].body = p.join("\n\n");
};
const errors = (issues: Issue[]) => blocking(issues).map((i) => `${i.lang} ${i.field} ¶${i.paragraph ?? "-"} ${i.rule}`);

/** Defects already in the live file, found by this engine; they are reported, not fixed, here. */
const KNOWN = ["ta body ¶22 devanagari-in-prose", "kn body ¶21 devanagari-changed"];

test("the approved chapter passes in hi and te, and only its two known live defects block ta and kn", () => {
  const issues = checkRecord(model(), { ...opts, original: model(), require: true });
  assert.deepEqual(errors(issues).sort(), [...KNOWN].sort());
  // Hand-spaced live Tamil verses differ from the generated form: reported for review, never blocking.
  assert.ok(issues.some((i) => i.lang === "ta" && i.rule === "verse-drift" && i.level === "warning"));
});

for (const lang of LANGS) {
  test(`[${lang}] English left in a prose paragraph is reported at that paragraph`, () => {
    const r = model();
    const p = paras(r.translations[lang].body);
    setPara(r, lang, 2, `${p[1]} The Ashtakam is recited daily for protection.`);
    const found = blocking(checkRecord(r, opts)).filter((i) => !KNOWN.includes(`${i.lang} ${i.field} ¶${i.paragraph} ${i.rule}`));
    assert.equal(found.length, 1);
    assert.deepEqual([found[0].lang, found[0].field, found[0].paragraph, found[0].rule], [lang, "body", 2, "untranslated-english"]);
    assert.match(found[0].detail, /Ashtakam, is, recited/);
    assert.equal(found[0].file, MODEL_REL);
  });

  test(`[${lang}] a romanised verse left in Latin blocks, and repair converts it with the existing transliterator`, () => {
    const r = model();
    const romanised = paras(r.body)[3]; // ¶4: "shrīmān veṅkaṭanāthāryaḥ … ||", under the Devanagari taniyan in ¶3
    setPara(r, lang, 4, romanised);
    assert.ok(errors(checkRecord(r, opts)).includes(`${lang} body ¶4 romanized-sanskrit`));

    const fixed = repairVerses(r.body, r.translations[lang].body, lang);
    // Kannada ¶21 is the live defect where ಽ replaced ऽ in the kept Devanagari; repair restores it from the English.
    const restored = lang === "kn" ? [21] : [];
    assert.deepEqual(fixed.changed.map((c) => c.paragraph), [4, ...restored]);
    assert.deepEqual(fixed.unresolved, []);
    const verse = paras(fixed.body)[3];
    assert.doesNotMatch(verse, /\p{Script=Latin}/u);
    assert.equal(verse.split("\n").length, 2, "two lines, each under its Devanagari line");
    const want = {
      ta: "ஸ்ரீமான் வேங்கடனாதார்யஃ கவிதார்கிககேஸரீ |\nவேதாந்தாசார்யவர்யோ மே ஸந்நிதத்தாம் ஸதா ஹ்ருதி ||",
      kn: "ಶ್ರೀಮಾನ್ ವೇಂಕಟನಾಥಾರ್ಯಃ ಕವಿತಾರ್ಕಿಕಕೇಸರೀ |\nವೇದಾಂತಾಚಾರ್ಯವರ್ಯೋ ಮೇ ಸನ್ನಿಧತ್ತಾಂ ಸದಾ ಹೃದಿ ||",
      hi: "श्रीमान् वेङ्कटनाथार्यः कवितार्किककेसरी |\nवेदान्ताचार्यवर्यो मे सन्निधत्तां सदा हृदि ||",
      te: "శ్రీమాన్ వేంకటనాథార్యః కవితార్కికకేసరీ |\nవేదాంతాచార్యవర్యో మే సన్నిధత్తాం సదా హృది ||",
    }[lang];
    assert.equal(verse, want);
    // Every other paragraph, prose included, is untouched.
    paras(fixed.body).forEach((p, i) => i !== 3 && !restored.includes(i + 1) && assert.equal(p, paras(r.translations[lang].body)[i]));
    r.translations[lang].body = fixed.body;
    assert.deepEqual(errors(checkRecord(r, opts)).sort(), KNOWN.filter((k) => !(lang === "kn" && k.startsWith("kn"))).sort());
  });

  test(`[${lang}] dropping or altering the Devanagari verse blocks`, () => {
    const dropped = model();
    const p = paras(dropped.translations[lang].body);
    p.splice(4, 1); // ¶5 is the Devanagari of verse 1
    dropped.translations[lang].body = p.join("\n\n");
    const e1 = errors(checkRecord(dropped, opts));
    assert.ok(e1.includes(`${lang} body ¶- paragraph-parity`));
    assert.ok(e1.includes(`${lang} body ¶5 devanagari-changed`));

    const altered = model();
    setPara(altered, lang, 3, paras(altered.body)[2].replace("सदा", "सदाः"));
    assert.ok(errors(checkRecord(altered, opts)).includes(`${lang} body ¶3 devanagari-changed`));
  });

  test(`[${lang}] an English title, or a missing one, blocks`, () => {
    const r = model();
    r.translations[lang].title = r.title;
    assert.ok(errors(checkRecord(r, opts)).includes(`${lang} title ¶- untranslated-english`));
    delete r.translations[lang].title;
    assert.ok(errors(checkRecord(r, opts)).includes(`${lang} title ¶- missing-field`));
  });
}

test("[ta] ś written ச (iastToScript's Sankalpam mode) breaks the Tamil Grantha rule", () => {
  const r = model();
  const verse1 = paras(r.translations.ta.body)[5]; // ¶6: ப்ரதிபடஶ்ரேணிபீஷண …
  assert.match(verse1, /ஶ/);
  setPara(r, "ta", 6, verse1.replace(/ஶ/g, "ச"));
  assert.ok(errors(checkRecord(r, opts)).includes("ta body ¶6 tamil-grantha"));
});

test("[hi] the repeated verse keeps ASCII bars; । and ॥ are flagged for review", () => {
  const r = model();
  setPara(r, "hi", 4, paras(r.body)[2]);
  const issues = checkRecord(r, opts).filter((i) => i.lang === "hi" && i.paragraph === 4);
  assert.deepEqual(issues.map((i) => `${i.level} ${i.rule}`), ["warning verse-bars"]);
});

test("merging two paragraphs blocks, and English is still found after the shift", () => {
  const r = model();
  const p = paras(r.translations.te.body);
  p.splice(0, 2, `${p[0]} ${p[1]}`, ...[]);
  p[20] = `${p[20]} Recite this with devotion.`;
  r.translations.te.body = p.join("\n\n");
  const e = errors(checkRecord(r, opts)).filter((x) => x.startsWith("te"));
  assert.ok(e.includes("te body ¶- paragraph-parity"));
  assert.ok(e.includes("te body ¶21 untranslated-english"));
});

test("permitted Latin: markers, URLs and acronyms pass only when the English has them", () => {
  const en = "The Ashtakam is on prapatti.com in IAST:\n(i) the taniyan\nii) the verses";
  const ok = "அஷ்டகம் prapatti.com தளத்தில் IAST எழுத்தில் உள்ளது:\n(i) தனியன்\nii) ஶ்லோகங்கள்";
  assert.deepEqual(latinFindings(en, ok), []);
  const notInEnglish = latinFindings("The Ashtakam is online.", "அஷ்டகம் prapatti.com தளத்தில் (i) IAST");
  assert.equal(notInEnglish.length, 1);
  assert.equal(notInEnglish[0].rule, "untranslated-english");
  assert.match(notInEnglish[0].detail, /3 English word\(s\)/);
  // A word that merely happens to be in the English is still English.
  assert.equal(latinFindings("the verses", "the ஶ்லோகங்கள்")[0].rule, "untranslated-english");
  // Romanised Sanskrit in prose is told apart from English.
  assert.equal(latinFindings("Say śrīmān.", "சொல்லுங்கள் śrīmān.")[0].rule, "romanized-sanskrit");
});

test("a romanised-only verse in the Library 'sh' spelling is never guessed at", () => {
  const body = "Recite:\n\nshrīmān veṅkaṭanāthāryaḥ |\nvedāntācāryavaryo me ||";
  const tr = "சொல்லுங்கள்:\n\nshrīmān veṅkaṭanāthāryaḥ |\nvedāntācāryavaryo me ||";
  const r = repairVerses(body, tr, "kn");
  assert.equal(r.changed.length, 0);
  assert.equal(r.unresolved[0].paragraph, 2);
  assert.match(r.unresolved[0].reason, /ś or ṣ/);
  const issues = checkRecord({ title: "T", body, translations: { kn: { title: "ಟ", body: tr } } }, { file: "x.json", kind: "chapter", langs: ["kn"] });
  assert.ok(errors(issues).includes("kn body ¶2 romanized-sanskrit"));
  assert.ok(issues.some((i) => i.rule === "verse-unverifiable"));

  // The same verse in full IAST converts without guessing.
  const iast = "Recite:\n\nśrīmān veṅkaṭanāthāryaḥ |\nvedāntācāryavaryo me ||";
  const fixed = repairVerses(iast, tr.replace("shrī", "śrī"), "kn");
  assert.equal(paras(fixed.body)[1], "ಶ್ರೀಮಾನ್ ವೇಂಕಟನಾಥಾರ್ಯಃ |\nವೇದಾಂತಾಚಾರ್ಯವರ್ಯೋ ಮೇ ||");
});

test("Sahasranaama name lines and mantras are generated in every script (Standard §5)", () => {
  const body = "1. viśvam · विश्वम्\n\nHe who is the universe.\n\n(oṃ) viśvāya namaḥ";
  const want: Record<LanguageCode, [string, string]> = {
    ta: ["1. விஶ்வம் · विश्वम्", "(ஓம்) விஶ்வாய நமஃ"],
    kn: ["1. ವಿಶ್ವಮ್ · विश्वम्", "(ಓಂ) ವಿಶ್ವಾಯ ನಮಃ"],
    hi: ["1. विश्वम्", "(ॐ) विश्वाय नमः"],
    te: ["1. విశ్వమ్ · विश्वम्", "(ఓం) విశ్వాయ నమః"],
  };
  for (const lang of LANGS) {
    const fixed = repairVerses(body, `1. viśvam · विश्वम्\n\nMEANING\n\n(oṃ) viśvāya namaḥ`, lang);
    const p = paras(fixed.body);
    assert.deepEqual([p[0], p[2]], want[lang], lang);
    assert.equal(p[1], "MEANING", "prose is never touched");
  }
});

test("changing an English field is caught; translations alone are not", () => {
  const original = model();
  const r = model();
  r.translations.ta.title = "வேறு";
  assert.deepEqual(englishDrift(original, r, MODEL_REL), []);
  r.title = "Sudarshana Ashtakam (revised)";
  r.images = [...(r.images ?? []), { src: "x.jpg" }];
  const drift = englishDrift(original, r, MODEL_REL);
  assert.equal(drift[0].rule, "english-changed");
  assert.match(drift[0].field, /title/);
  assert.match(drift[0].field, /images/);
});

test("book metadata: every part title and the description are required once a language starts", () => {
  const book = { title: "Nityasuri Vaibhavam", description: "Stories.", parts: [{ title: "Part One", translations: { ta: { title: "பகுதி ஒன்று" } } }, { title: "Part Two" }], translations: { ta: { title: "நித்யஸூரி வைபவம்" } } };
  const e = errors(checkBook(book, "ta", { file: "book.json" }));
  assert.deepEqual(e.sort(), ["ta description ¶- missing-field", "ta parts[1].title ¶- missing-field"]);
  assert.deepEqual(checkBook(book, "kn", { file: "book.json" }), [], "a language not started is not an error");
});

test("the gate: check exits 1 on a blocking error, certify refuses and records nothing", () => {
  const cli = path.join(ROOT, "tools/translation-engine/cli.ts");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vyte-"));
  const bad = model();
  setPara(bad, "hi", 2, `${paras(bad.translations.hi.body)[1]} This line was never translated.`);
  fs.writeFileSync(path.join(dir, "bad.json"), JSON.stringify(bad, null, 2));
  const run = (...a: string[]) => spawnSync(process.execPath, [cli, ...a], { cwd: ROOT, encoding: "utf8" });

  const failed = run("check", `--file=${path.join(dir, "bad.json")}`, `--english=${MODEL}`, "--langs=hi,te");
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout, /\[hi\] body ¶2 untranslated-english/);

  const passed = run("check", `--file=${MODEL}`, `--english=${MODEL}`, "--langs=hi,te");
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);

  const ledger = path.join(ROOT, "translation-work/nityasuri-vaibhavam/certification.json");
  const existed = fs.existsSync(ledger);
  const refused = run("certify", "--book=nityasuri-vaibhavam", "--chapter=the-sudarsana-ashtakam");
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /Not certified: 2 blocking error/);
  assert.equal(fs.existsSync(ledger), existed, "no ledger written on refusal");
  fs.rmSync(dir, { recursive: true });
});

test("the approved chapter on disk was not modified", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(MODEL)).digest("hex"), modelHash);
});

test("a verse the Tamil rules cannot write (vocalic ḷ) is held for Tamil only, never guessed", () => {
  const body = "Intro.\n\nमालाकॢप्तासनस्थः ।\n\nmālākḷptāsanasthaḥ |";
  const found = untransliterable({ body }, "x.json");
  assert.deepEqual(found.map((i) => `${i.lang} ¶${i.paragraph} ${i.rule}`), ["ta ¶3 source-untransliterable"]);
  assert.match(found[0].detail, /ॢ/);
  // Names keep their Devanagari after "·" by design: not reported.
  assert.deepEqual(untransliterable({ body: "1. viśvam · विश्वम्\n\nMeaning.\n\n(oṃ) viśvāya namaḥ" }, "y.json"), []);
});

test("the list-marker check runs in linear time on hostile tokens (CodeQL js/redos)", () => {
  const hostile = "a" + ".c".repeat(60) + "-z";
  const start = Date.now();
  latinFindings("x", `அ ${hostile} ஆ`);
  assert.ok(Date.now() - start < 1000, "no exponential backtracking");
  // Markers still work: roman numerals, single letters, digits, dotted sections.
  assert.deepEqual(latinFindings("(i) a) iii.ii) 2.", "(i) அ a) ஆ iii.ii) இ 2. ஈ"), []);
});
