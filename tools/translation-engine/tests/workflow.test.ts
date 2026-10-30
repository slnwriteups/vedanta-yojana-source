import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The real translation-prep.ts and translation-merge.ts, run against a small
 * fixture repository (VY_TRANSLATION_ROOT), never against content/.
 * One flow, in order: freeze check, prep, a merge with deliberate faults,
 * re-prep of rejected work, fill-only writes, pending terms, an experiment.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), "vy-workflow-"));
const BOOK = "demo-book";
const lib = path.join(FIX, "content/library", BOOK);
const write = (f: string, v: unknown) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n");
};
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));

const DEVA = "श्रीमान् वेङ्कटनाथार्यः कवितार्किककेसरी ।\nवेदान्ताचार्यवर्यो मे सन्निधत्तां सदा हृदि ॥";
const ROMAN = "shrīmān veṅkaṭanāthāryaḥ kavitārkikakesarī |\nvedāntācāryavaryo me sannidhattāṁ sadā hṛdi ||";

// English item → [ta, kn, hi, te]: plain, correct translations.
const T: Record<string, [string, string, string, string]> = {
  "The Forest Journey": ["வனப் பயணம்", "ವನ ಪಯಣ", "वन यात्रा", "వన యాత్ర"],
  "A short test book.": ["ஒரு சிறிய சோதனை நூல்.", "ಒಂದು ಚಿಕ್ಕ ಪರೀಕ್ಷಾ ಗ್ರಂಥ.", "एक छोटी परीक्षण पुस्तक।", "ఒక చిన్న పరీక్షా గ్రంథం."],
  "Part One": ["முதல் பகுதி", "ಮೊದಲ ಭಾಗ", "पहला भाग", "మొదటి భాగం"],
  "The Forest": ["வனம்", "ವನ", "वन", "వనం"],
  "Sri Rāma went to the forest.": ["ஸ்ரீ ராமன் வனத்திற்குச் சென்றார்.", "ಶ್ರೀ ರಾಮನು ವನಕ್ಕೆ ಹೋದನು.", "श्री राम वन को गए।", "శ్రీ రాముడు వనానికి వెళ్ళాడు."],
  "Sītā followed him.": ["சீதை அவரைப் பின்தொடர்ந்தாள்.", "ಸೀತೆ ಅವನನ್ನು ಹಿಂಬಾಲಿಸಿದಳು.", "सीता उनके पीछे गईं।", "సీత అతనిని అనుసరించింది."],
  "*Did you know? The forest was vast.": ["*உங்களுக்குத் தெரியுமா? அந்த வனம் பரந்தது.", "*ನಿಮಗೆ ಗೊತ್ತೇ? ಆ ವನವು ವಿಶಾಲವಾಗಿತ್ತು.", "*क्या आप जानते हैं? वह वन विशाल था।", "*మీకు తెలుసా? ఆ వనం విశాలమైనది."],
  "The Return": ["திரும்புதல்", "ಹಿಂದಿರುಗುವಿಕೆ", "वापसी", "తిరుగు ప్రయాణం"],
  "They returned home.": ["அவர்கள் வீடு திரும்பினர்.", "ಅವರು ಮನೆಗೆ ಹಿಂದಿರುಗಿದರು.", "वे घर लौटे।", "వారు ఇంటికి తిరిగి వచ్చారు."],
};
const LANGS = ["ta", "kn", "hi", "te"] as const;
const LIVE_TA_BODY = "அவர்கள் வீடு திரும்பினர்.";

write(path.join(lib, "book.json"), {
  slug: BOOK, kind: "book", title: "The Forest Journey", description: "A short test book.",
  chapterOrder: ["arrival", "draft", "return"], parts: [{ title: "Part One", chapters: ["arrival", "draft", "return"] }],
});
write(path.join(lib, "chapters/arrival.json"), {
  slug: "arrival", title: "The Forest", order: 1, status: "published",
  body: ["Sri Rāma went to the forest.", DEVA, ROMAN, "Sītā followed him.", "*Did you know? The forest was vast."].join("\n\n"),
});
write(path.join(lib, "chapters/draft.json"), { slug: "draft", title: "Draft", order: 2, status: "draft", body: "Lorem ipsum dolor sit amet." });
// An approved Tamil body with its title still missing: merge may add the title, never touch the body.
write(path.join(lib, "chapters/return.json"), {
  slug: "return", title: "The Return", order: 3, status: "published", body: "They returned home.",
  translations: { ta: { body: LIVE_TA_BODY } },
});
const GLOSS: Record<string, string> = {
  ta: "# Tamil (ta) glossary\nSri Rāma = ஸ்ரீ ராமன்\nSītā = சீதை\n",
  kn: "# Kannada (kn) glossary\nSri Rāma = ಶ್ರೀ ರಾಮ\nSītā = ಸೀತೆ\n",
  hi: "# Hindi (hi) glossary\nSri Rāma = श्री राम\nSītā = सीता (never सीताजी)\n",
  te: "# Telugu (te) glossary\nSri Rāma = శ్రీ రాముడు\nSītā = సీత\n",
};
for (const l of LANGS) write(path.join(FIX, "docs/translation-glossaries", `${l}.md`), GLOSS[l]);
fs.mkdirSync(path.join(FIX, "prompts"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "prompts/translation-prompt-card.md"), path.join(FIX, "prompts/translation-prompt-card.md"));

const run = (script: string, ...a: string[]) =>
  spawnSync(process.execPath, [path.join(ROOT, "scripts", script), `--book=${BOOK}`, ...a], { cwd: ROOT, encoding: "utf8", env: { ...process.env, VY_TRANSLATION_ROOT: FIX } });
const work = path.join(FIX, "translation-work", BOOK);
const manifest = (n: number, exp?: string) => read(path.join(exp ? path.join(work, "experiments", exp) : work, `batches/batch-00${n}.json`));
const englishOf = (id: string): string => {
  const [group, idx] = id.split(".");
  if (id === "@book.title") return "The Forest Journey";
  if (id === "@book.description") return "A short test book.";
  if (id.startsWith("@part.")) return "Part One";
  const r = read(path.join(lib, "chapters", `${group}.json`));
  return idx === "title" ? r.title : r.body.split("\n\n")[Number(idx)];
};
/** A reply for a manifest, with per-item overrides { "<id>": { hi: "…" } }. */
function replyFor(m: any, over: Record<string, Partial<Record<string, string>>> = {}, extra: object = {}) {
  const out: Record<string, unknown> = { ...extra };
  for (const l of m.langs) out[l] = m.items.map((i: any) => over[i.id]?.[l] ?? T[englishOf(i.id)][LANGS.indexOf(l)]);
  return out;
}
const glossBefore = Object.fromEntries(LANGS.map((l) => [l, fs.readFileSync(path.join(FIX, "docs/translation-glossaries", `${l}.md`), "utf8")]));
const returnBefore = fs.readFileSync(path.join(lib, "chapters/return.json"), "utf8");

test("prep holds a chapter whose English is not frozen, and sends only prose", () => {
  const r = run("translation-prep.ts", "--no-card");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /draft: .*source-placeholder/);
  const m = manifest(1);
  const ids = m.items.map((i: any) => i.id);
  assert.ok(!ids.some((id: string) => id.startsWith("draft.")), "held chapter not prepared");
  assert.ok(ids.includes("arrival.0") && ids.includes("arrival.3") && !ids.includes("arrival.1") && !ids.includes("arrival.2"), "verses are not sent to a translator");
  assert.match(r.stdout, /Sītā = .*hi सीता/);
});

test("merge without --translator refuses and stores nothing", () => {
  const r = run("translation-merge.ts", "--batch=1");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--translator/);
  assert.equal(fs.existsSync(path.join(work, "store.json")), false);
});

test("merge rejects faulty paragraphs, keeps them out of content/, writes only clean finished chapters", () => {
  const m = manifest(1);
  const reply = replyFor(m, {
    "arrival.3": { hi: "सीताजी उनके पीछे गईं।" }, // glossary: never सीताजी
    "arrival.0": { te: "శ్రీ రాముడు forest కి వెళ్ళాడు." }, // English left
    "arrival.4": { kn: "ನಿಮಗೆ ಗೊತ್ತೇ? ಆ ವನವು ವಿಶಾಲವಾಗಿತ್ತು." }, // note marker * lost: only the chapter check sees it
  }, { terms: [{ en: "Ayodhyā", ta: "அயோத்தி", kn: "ಅಯೋಧ್ಯೆ", hi: "अयोध्या", te: "అయోధ్య" }], concerns: [{ item: m.items.findIndex((i: any) => i.id === "arrival.3"), note: "who is 'him'?" }] });
  write(path.join(work, "batches/batch-001.reply.json"), reply);
  const r = run("translation-merge.ts", "--batch=1", "--translator=chat-session-a");
  assert.equal(r.status, 1, "exit 1: a finished chapter was held back");
  assert.match(r.stdout, /arrival\.3 \[hi\] REJECTED glossary-wrong-variant/);
  assert.match(r.stdout, /arrival\.0 \[te\] REJECTED untranslated-english/);
  assert.match(r.stdout, /NOT written[\s\S]*arrival \[kn\][\s\S]*note-marker/);

  const arrival = read(path.join(lib, "chapters/arrival.json"));
  assert.deepEqual(Object.keys(arrival.translations), ["ta"], "only Tamil was complete and clean");
  const ta = arrival.translations.ta.body.split("\n\n");
  assert.equal(ta[1], DEVA, "Devanagari kept");
  assert.equal(ta[2], "ஸ்ரீமான் வேங்கடனாதார்யஃ கவிதார்கிககேஸரீ |\nவேதாந்தாசார்யவர்யோ மே ஸந்நிதத்தாம் ஸதா ஹ்ருதி ||", "verse generated, Grantha Tamil");
  assert.equal(arrival.title, "The Forest");
  assert.equal(arrival.body.split("\n\n")[2], ROMAN, "English untouched");

  const store = read(path.join(work, "store.json")).items;
  assert.equal(store["arrival.3"].hi, undefined, "rejected paragraph not stored");
  assert.ok(store["arrival.4"].kn, "the kn note is stored: work is kept while the chapter is held");

  const book = read(path.join(lib, "book.json"));
  assert.deepEqual(Object.keys(book.translations), ["ta", "kn", "hi", "te"]);
  assert.equal(book.parts[0].translations.te.title, "మొదటి భాగం");

  const ret = read(path.join(lib, "chapters/return.json"));
  assert.equal(ret.translations.ta.body, LIVE_TA_BODY, "an approved body is never replaced");
  assert.equal(ret.translations.ta.title, "திரும்புதல்", "the missing title is filled");
  assert.equal(JSON.stringify({ ...ret, translations: undefined }), JSON.stringify({ ...JSON.parse(returnBefore), translations: undefined }));

  for (const l of LANGS) assert.equal(fs.readFileSync(path.join(FIX, "docs/translation-glossaries", `${l}.md`), "utf8"), glossBefore[l], `${l} glossary untouched`);
  const pending = read(path.join(work, "pending-terms.json")).terms;
  assert.deepEqual(pending.map((t: any) => [t.en, t.status]), [["Ayodhyā", "pending"]]);
  assert.equal(manifest(1).translator, "chat-session-a");
  const concerns = read(path.join(work, "source-concerns.json")).concerns;
  assert.deepEqual(concerns.map((c: any) => [c.id, c.english, c.status]), [["arrival.3", "Sītā followed him.", "open"]]);
});

test("the next prep asks again for exactly the rejected and unfinished work", () => {
  const r = run("translation-prep.ts", "--no-card");
  assert.equal(r.status, 0, r.stderr);
  const m = manifest(2);
  const ids = m.items.map((i: any) => i.id);
  assert.ok(ids.includes("return.0") || ids.includes("arrival.3") || ids.includes("arrival.0"), JSON.stringify(ids));
  assert.ok(!ids.includes("arrival.title"), "stored work is not asked for twice");
});

test("an experiment re-translates a finished chapter in its own folder and never touches content/", () => {
  const before = fs.readFileSync(path.join(lib, "chapters/arrival.json"), "utf8");
  const p = run("translation-prep.ts", "--no-card", "--chapter=arrival", "--experiment=e1");
  assert.equal(p.status, 0, p.stderr);
  const m = manifest(1, "e1");
  assert.deepEqual(m.langs, ["ta", "kn", "hi", "te"], "the live Tamil is ignored, so Tamil is asked for again");
  assert.doesNotMatch(p.stdout, /வனத்திற்குச்/, "the live translation is not in the packet");
  write(path.join(work, "experiments/e1/batches/batch-001.reply.json"), replyFor(m));
  const r = run("translation-merge.ts", "--batch=1", "--experiment=e1", "--translator=chat-session-b");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cand = read(path.join(work, "experiments/e1/candidates/arrival.json"));
  assert.deepEqual(Object.keys(cand.translations), ["ta", "kn", "hi", "te"]);
  assert.equal(fs.readFileSync(path.join(lib, "chapters/arrival.json"), "utf8"), before, "content/ unchanged");
  assert.equal(cand._experiment.name, "e1", "candidates are marked as experimental");
});

test("experiment work cannot reach content/: wrong-mode merges refuse, and a copied candidate fails the check", async () => {
  // An experiment manifest copied among the real batches is refused, not merged into content/.
  fs.copyFileSync(path.join(work, "experiments/e1/batches/batch-001.json"), path.join(work, "batches/batch-009.json"));
  fs.copyFileSync(path.join(work, "experiments/e1/batches/batch-001.reply.json"), path.join(work, "batches/batch-009.reply.json"));
  const noFlag = run("translation-merge.ts", "--batch=9", "--translator=x");
  assert.notEqual(noFlag.status, 0);
  assert.match(noFlag.stderr, /belongs to experiment "e1"/);
  fs.copyFileSync(path.join(work, "batches/batch-002.json"), path.join(work, "experiments/e1/batches/batch-002.json"));
  const normal = run("translation-merge.ts", "--batch=2", "--experiment=e1", "--translator=x", "--reply=-");
  assert.notEqual(normal.status, 0);
  assert.match(normal.stderr, /not an experiment batch/);
  const { checkRecord } = await import("../validate.ts");
  const cand = read(path.join(work, "experiments/e1/candidates/arrival.json"));
  const issues = checkRecord(cand, { file: "content/library/demo-book/chapters/arrival.json", kind: "chapter", langs: ["ta"] });
  assert.ok(issues.some((i) => i.level === "error" && i.rule === "experimental-candidate"));
  assert.ok(!checkRecord(cand, { file: "x", kind: "chapter", langs: ["ta"], allowExperiment: true }).some((i) => i.rule === "experimental-candidate"));
});
