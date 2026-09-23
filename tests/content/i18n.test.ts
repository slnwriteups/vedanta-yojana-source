import test from "node:test";
import assert from "node:assert/strict";
import { localizeBook, localizeChapter, localizeDivyaDesam, localizeKnowledge } from "../../content-lib/i18n.ts";
import { loadDivyaDesam, loadBook, loadChapter, loadKnowledgeRecord } from "../../content-lib/loader/index.ts";
import type { Book, Chapter, DivyaDesam, Knowledge } from "../../content-lib/schemas/index.ts";

function makeDivyaDesam(overrides: Partial<DivyaDesam> = {}): DivyaDesam {
  return {
    slug: "example-temple",
    displayName: "Example Temple",
    status: "published",
    migration: { sourcePageId: "page.Page1", extractionConfidence: "high", needsReview: false },
    templeInformation: { moolavar: "Example Moolavar", travelNote: "Example travel note." },
    sthalaPuranam: "Example sthala puranam.",
    azhwarPasuram: "Example azhwar pasuram.",
    shrines: [{ label: null, mapsLink: "https://maps.example/1" }],
    images: [],
    resources: [],
    relatedContent: [],
    ...overrides,
  };
}

test("A: language=null returns the record completely untouched", () => {
  const record = makeDivyaDesam();
  assert.deepEqual(localizeDivyaDesam(record, null), record);
});

test("B: a record with no translations object returns untouched for any language", () => {
  const record = makeDivyaDesam();
  assert.deepEqual(localizeDivyaDesam(record, "ta"), record);
});

test("C: a full translation replaces every translated field, English fields elsewhere untouched", () => {
  const record = makeDivyaDesam({
    translations: {
      ta: {
        displayName: "தமிழ் கோயில்",
        templeInformation: { moolavar: "தமிழ் மூலவர்", travelNote: "தமிழ் பயண குறிப்பு." },
        sthalaPuranam: "தமிழ் ஸ்தல புராணம்.",
        azhwarPasuram: "தமிழ் ஆழ்வார் பாசுரம்.",
      },
    },
  });
  const localized = localizeDivyaDesam(record, "ta");
  assert.equal(localized.displayName, "தமிழ் கோயில்");
  assert.equal(localized.templeInformation.moolavar, "தமிழ் மூலவர்");
  assert.equal(localized.sthalaPuranam, "தமிழ் ஸ்தல புராணம்.");
  // Original English record is never mutated.
  assert.equal(record.displayName, "Example Temple");
});

test("D: a PARTIAL translation (only templeInformation) falls back to English per-field for everything else", () => {
  const record = makeDivyaDesam({
    translations: { hi: { templeInformation: { travelNote: "हिंदी यात्रा नोट।" } } },
  });
  const localized = localizeDivyaDesam(record, "hi");
  assert.equal(localized.templeInformation.travelNote, "हिंदी यात्रा नोट।");
  assert.equal(localized.templeInformation.moolavar, "Example Moolavar", "untranslated sub-field falls back to English");
  assert.equal(localized.sthalaPuranam, "Example sthala puranam.", "untranslated field falls back to English");
  assert.equal(localized.displayName, "Example Temple");
});

test("E: a language the record has no entry for (even though translations exists for others) falls back entirely", () => {
  const record = makeDivyaDesam({ translations: { ta: { displayName: "தமிழ்" } } });
  assert.deepEqual(localizeDivyaDesam(record, "kn"), record);
});

test("F: shrine translations are keyed by index and merge per-shrine, field by field", () => {
  const record = makeDivyaDesam({
    shrines: [
      { label: "Shrine A", mapsLink: "https://maps.example/a", name: "Shrine A Name", sthalaPuranam: "Shrine A English text." },
      { label: "Shrine B", mapsLink: "https://maps.example/b", name: "Shrine B Name" },
    ],
    translations: {
      kn: {
        shrines: {
          "0": { sthalaPuranam: "ಶ್ರೀ ಎ ಕನ್ನಡ ಪಠ್ಯ." },
        },
      },
    },
  });
  const localized = localizeDivyaDesam(record, "kn");
  assert.equal(localized.shrines[0].sthalaPuranam, "ಶ್ರೀ ಎ ಕನ್ನಡ ಪಠ್ಯ.");
  assert.equal(localized.shrines[0].name, "Shrine A Name", "untranslated shrine field falls back to English");
  assert.equal(localized.shrines[1].name, "Shrine B Name", "shrine with no translation entry at all is untouched");
});

test("G: localizeChapter applies title/body with the same per-field fallback", () => {
  const chapter: Chapter = {
    title: "Example Chapter",
    slug: "example-chapter",
    order: 1,
    status: "published",
    migration: { sourcePageId: "page.Page1", extractionConfidence: "medium", needsReview: false },
    body: "English body.",
    images: [],
    translations: { ta: { body: "தமிழ் உரை." } },
  };
  const localized = localizeChapter(chapter, "ta");
  assert.equal(localized.body, "தமிழ் உரை.");
  assert.equal(localized.title, "Example Chapter", "title has no translation entry, falls back to English");
});

test("H: localizeKnowledge applies title/body with the same per-field fallback", () => {
  const record: Knowledge = {
    title: "Example Knowledge",
    slug: "example-knowledge",
    contentType: "educational",
    status: "published",
    migration: { sourcePageId: "page.Page1", extractionConfidence: "medium", needsReview: false },
    body: "English body.",
    images: [],
    relatedContent: [],
    translations: { hi: { title: "हिंदी शीर्षक", body: "हिंदी सामग्री।" } },
  };
  const localized = localizeKnowledge(record, "hi");
  assert.equal(localized.title, "हिंदी शीर्षक");
  assert.equal(localized.body, "हिंदी सामग्री।");
});

test("I: localizeBook applies title/description, never touches author", () => {
  const book: Book = {
    slug: "example-book",
    title: "Example Book",
    author: "Some Author",
    status: "published",
    migration: { sourcePageId: "aggregate:x", extractionConfidence: "medium", needsReview: false },
    parts: [],
    chapterOrder: [],
    translations: { kn: { title: "ಕನ್ನಡ ಪುಸ್ತಕ" } },
  };
  const localized = localizeBook(book, "kn");
  assert.equal(localized.title, "ಕನ್ನಡ ಪುಸ್ತಕ");
  assert.equal(localized.author, "Some Author");
});

test("J: localizeDivyaDesam and localizeChapter support Telugu (te)", () => {
  const record = makeDivyaDesam({
    translations: {
      te: {
        displayName: "తెలుగు దేవాలయం",
        templeInformation: { moolavar: "శ్రీ రంగనాథుడు" },
        sthalaPuranam: "స్థల పురాణం వివరాలు.",
      },
    },
  });
  const localized = localizeDivyaDesam(record, "te");
  assert.equal(localized.displayName, "తెలుగు దేవాలయం");
  assert.equal(localized.templeInformation.moolavar, "శ్రీ రంగనాథుడు");
  assert.equal(localized.sthalaPuranam, "స్థల పురాణం వివరాలు.");
  assert.equal(localized.templeInformation.travelNote, "Example travel note.");
});

test("K: real content records in Cohort 1 localize correctly in Telugu (te)", () => {
  const sriRangam = loadDivyaDesam("sri-rangam");
  assert.ok(sriRangam);
  const localizedSriRangam = localizeDivyaDesam(sriRangam, "te");
  assert.equal(localizedSriRangam.displayName, "శ్రీరంగం");
  assert.equal(localizedSriRangam.templeInformation.moolavar, "శ్రీ రంగనాథస్వామి");

  const tiruvenkatam = loadDivyaDesam("tiruvenkatam");
  assert.ok(tiruvenkatam);
  const localizedTiruvenkatam = localizeDivyaDesam(tiruvenkatam, "te");
  assert.equal(localizedTiruvenkatam.displayName, "తిరువేంకటం");
  assert.equal(localizedTiruvenkatam.templeInformation.moolavar, "శ్రీ వేంకటేశ్వర పెరుమాళ్");

  const ahobilam = loadDivyaDesam("singavelkundram-ahobilam");
  assert.ok(ahobilam);
  const localizedAhobilam = localizeDivyaDesam(ahobilam, "te");
  assert.equal(localizedAhobilam.displayName, "సింగవేళ్కుండ్రం (అహోబిలం)");
  assert.equal(localizedAhobilam.templeInformation.moolavar, "ప్రహ్లాదవరదన్");

  const tiruvallikkeni = loadDivyaDesam("tiruvallikkeni");
  assert.ok(tiruvallikkeni);
  const localizedTriplicane = localizeDivyaDesam(tiruvallikkeni, "te");
  assert.equal(localizedTriplicane.displayName, "తిరువల్లిక్కేణి");
  assert.equal(localizedTriplicane.templeInformation.moolavar, "వేంకటకృష్ణ పెరుమాళ్");

  const tiruvallur = loadDivyaDesam("tiru-evvellur-tiruvallur");
  assert.ok(tiruvallur);
  const localizedTiruvallur = localizeDivyaDesam(tiruvallur, "te");
  assert.equal(localizedTiruvallur.displayName, "తిరు ఎవ్వుళ్ (తిరువళ్లూరు)");
  assert.equal(localizedTiruvallur.templeInformation.moolavar, "శ్రీ వీరరాఘవ పెరుమాళ్");

  const intro = loadKnowledgeRecord("introduction");
  assert.ok(intro);
  const localizedIntro = localizeKnowledge(intro, "te");
  assert.equal(localizedIntro.title, "పరిచయం");

  const jaya = loadBook("jaya");
  assert.ok(jaya);
  const localizedJaya = localizeBook(jaya, "te");
  assert.equal(localizedJaya.title, "జయ: మహాభారత యాత్ర");

  const invocation = loadChapter("jaya", "invocation");
  assert.ok(invocation);
  const localizedInvocation = localizeChapter(invocation, "te");
  assert.equal(localizedInvocation.title, "మంగళాచరణం");
});

