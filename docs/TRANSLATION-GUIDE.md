# Translation and transliteration guide

The rules for translating Vedanta Yojana content into **Tamil (`ta`), Kannada (`kn`), Hindi (`hi`) and Telugu (`te`)**. Everything here is taken from the translations that are already live (all Divya Desams, every Library book and blog, the app interface), so any person or AI tool that follows it produces work that matches them.

Read the whole guide before starting. Then read, for your language, `docs/translation-glossaries/<lang>.md`, and the [model files](#11-model-files-to-imitate) listed at the end.

---

## 1. Non-negotiables

1. **English is the source of truth.** Translate what the English says: nothing added, nothing dropped, nothing summarised, nothing "improved". If the English has a real defect (garbled text, placeholder text, a broken sentence), stop and report it. Fix the English against the original source, with the owner's agreement, before translating. Never translate the defect, and never paper over it.
2. **Never edit the English fields while translating.** Translations live only under `translations.<lang>`. Slugs, `chapterOrder`, `order`, `migration`, `images` and `resources` are never changed by a translation.
3. **Verses are transliterated, never translated.** This covers Sanskrit shlokas, mantras, Upanishad passages and Tamil pasurams. Only the English prose that explains a verse is translated (see [§5](#5-verses-shlokas-pasurams-mantras)).
4. **The glossaries are binding.** A term that is in `docs/translation-glossaries/<lang>.md` is always written exactly that way. New terms are added to the glossary in the same commit that first uses them.
5. **Keep the structure one-for-one.** Each English paragraph becomes exactly one translated paragraph, in the same order, with the same blank lines between them (see [§4](#4-structure-and-formatting)).
6. **Natural, plain prose.** The benchmark is the Divya Desam translations: faithful, clear and readable, neither ornate nor "literary", with no invented explanations.
7. **Announcements need the owner's approval.** Finishing a translation is a change readers notice. Follow `CLAUDE.md`: propose the exact What's New title and body and wait for approval. Never add one on your own.

---

## 2. Where translations live

Every record keeps its English in the plain fields. Each language goes in `translations.<lang>`. Each field there is optional and falls back to English on its own (`content-lib/i18n.ts`), so a record can be translated in stages.

| Content | File | Translated fields |
|---|---|---|
| Library book or blog | `content/library/<book>/book.json` | `translations.<lang>.title`, `.description`; each part's `parts[i].translations.<lang>.title` |
| Chapter or post | `content/library/<book>/chapters/<slug>.json` | `translations.<lang>.title`, `.body` |
| Divya Desam | `content/divya-desams/<slug>.json` | `translations.<lang>.displayName`, `.templeInformation` (moolavar, thayaar, vimanam, theertham, travelNote), `.sthalaPuranam`, `.azhwarPasuram`, and `.shrines["<index>"]` (keyed by the shrine's position in `shrines[]`) |
| Knowledge | `content/knowledge/<slug>.json` | `translations.<lang>.title`, `.body` |
| Inline image | inside `images[]` | `placementAnchorTranslations.<lang>`: the closing words of the translated paragraph the photo follows, copied verbatim from the translated body |
| What's New | `content/announcements.json` | `translations.<lang>.title`, `.body`, `.linkLabel` (owner approval first) |
| App and site interface | `lib/ui-strings.ts` **and** `mobile/ui-strings.ts` | every key carries `en`, `ta`, `kn`, `hi`, `te`; add a key to **both** files |

Shape of a translated chapter:

```json
{
  "title": "English title",
  "body": "English body…",
  "translations": {
    "ta": { "title": "…", "body": "…" },
    "kn": { "title": "…", "body": "…" },
    "hi": { "title": "…", "body": "…" },
    "te": { "title": "…", "body": "…" }
  }
}
```

Keep the JSON valid UTF-8, written with real characters (no `\u` escapes) and two-space indentation, like the existing files.

---

## 3. Languages and spelling families

Each language follows the author's spelling rule. These were settled in the blog translation work (`docs/BLOG-TRANSLATION-PROGRESS.md`).

| Language | Rule for names and terms in prose | Notes |
|---|---|---|
| Tamil (`ta`) | **Tamil roots**: the forms a Tamil Sri Vaishnava reader uses (பெருமாள், ஆழ்வார், தாயார், சுதர்சனம்) | Both மோக்ஷம் and மோட்சம் occur in live content; the owner accepts both. Prefer the glossary form for new work. |
| Kannada (`kn`) | **Sanskrit forms** (ಭಗವಂತ, ಆಚಾರ್ಯ, ಮೋಕ್ಷ) | Tamil-origin letters: ழ = ೞ, ற = ಱ, ள = ಳ, ன = ನ |
| Hindi (`hi`) | **Sanskrit-rooted forms** (भगवान, आचार्य, मोक्षम्) | Technical terms keep the -म् ending (वाहनम्, उत्सवम्, विग्रहम्, श्री वैकुण्ठम्). Prose names use long े/ो; short ॆ/ॊ appear only inside transliterated Tamil verse. पेरुमाल (never पेरुमाळ्). |
| Telugu (`te`) | **Sanskrit roots** (మోక్షం, ఆచార్యులు) | "Lord" = స్వామి with **singular** verbs, as in existing te content |

**Script purity.** Kannada (U+0C80–0CFF) and Telugu (U+0C00–0C7F) look alike, and a letter from one has leaked into the other before (§9.1 of `DOCUMENTATION.md`). A Kannada body must contain no Telugu-block characters, and a Telugu body no Kannada ones. Run the check in [§9](#9-checks-before-every-commit).

**Numerals.** Use Western digits (0–9) in prose and in verse numbers, in every language. That is the live convention (over 250 digits per language against a handful of native ones).

---

## 4. Structure and formatting

The app and website draw a body paragraph by paragraph (`content-lib/text-format.ts`). The translated body must keep the English layout exactly:

- **Paragraphs.** One translated paragraph for each English paragraph, separated by a blank line (`\n\n`). Lines within a verse are separated by a single newline (`\n`). Don't merge or split paragraphs. The Telugu translations match the English paragraph count in every chapter; aim for the same.
- **Sub-headings.** A short English line with no final punctuation is shown in bold as a sub-heading. Translate it as a short line with no final punctuation.
- **Prose ends with punctuation.** A short sentence that is *not* a heading must keep its full stop. Otherwise it renders bold as if it were a heading.
- **Lists.** Keep the markers exactly: `1.`, `2)`, `(i)`, `a)`, `•`.
- **Special notes.** A paragraph that starts with `*` is a highlighted "did you know" note. Keep the single leading `*`.
- **Glosses.** Write an English pattern of "word (Sanskrit term)" as *translated word (Sanskrit term in your script)*. Never repeat the translated word inside the brackets. The checker regex for that mistake is `(\S+)\s*\(\s*\1\s*\)`.
- **Typography** (enforced by `tests/content/typography.test.ts` in every language):
  - a space after every comma and semicolon;
  - no space just inside brackets, so `(text)`, not `( text )`;
  - a space before an opening bracket that follows a word;
  - no space before a comma or full stop.
- **Quotation marks.** Use straight double quotes `"…"`, as the English does.
- **Titles.** Translate chapter titles. A title like "Naama 1-5: …" keeps its numbers and the dash.

---

## 5. Verses: shlokas, pasurams, mantras

### 5.1 The verse block

In the English, a Sanskrit verse is printed as a **Devanagari couplet, a blank line, then its romanised couplet**. Do this in every translation:

- **Keep the Devanagari lines exactly as they are**, character for character, with `।` and `॥ १ ॥`.
- **Replace the romanised lines with the same verse written in your script.** End the first half with ` |` and the end of the verse with ` ||` or ` || 1 ||` (ASCII bars and Western digits, as in the live content).
- **Hindi:** Devanagari is already Hindi's script, so the live content repeats the Devanagari couplet in place of the romanised one, using ASCII ` |` and ` ||` and Western digits. Follow that.
- **Keep the line layout.** Each transliterated line sits exactly two lines below its Devanagari line. The app recognises a verse by that shape. A four-pada verse printed as two lines stays two lines.

Example, from `the-sudarsana-ashtakam.json`, Tamil:

```
श्रीमान् वेङ्कटनाथार्यः कवितार्किककेसरी ।
वेदान्ताचार्यवर्यो मे सन्निधत्तां सदा हृदि ॥

ஸ்ரீமான் வேங்கடநாதார்யஃ கவிதார்க்கிக கேஸரீ |
வேதாந்தாசார்ய வர்யோ மே ஸந்நிதத்தாம் ஸதா ஹ்ருதி ||
```

The same verse in Kannada and Telugu is letter for letter: `ಶ್ರೀಮಾನ್ ವೇಂಕಟನಾಥಾರ್ಯಃ …` and `శ్రీమాన్ వేంకటనాథార్యః …`.

A verse given **only** in romanised form (no Devanagari above it) is written in your script on its own, with the same line breaks.

### 5.2 Writing Sanskrit in each script

- **Kannada, Telugu, Hindi:** convert letter for letter. These three Unicode blocks share one layout. `content-lib/sanskrit-script.ts` (`iastToScript`) does this exactly for IAST input; prefer it to hand transliteration for long passages. Anusvara is `ಂ`/`ం`/`ं`, and visarga is `ಃ`/`ః`/`ः`.
- **Tamil:** use the Grantha-assisted spelling of the live verses:
  - ś → ஶ (e.g. ஸுதர்ஶன); ṣ → ஷ; s → ஸ; j → ஜ; h → ஹ;
  - aspirates fold into the plain letter (bh → ப, dh → த);
  - ṛ → ரு; dental n → ந; ṃ → ம் (or the nasal of the following consonant, as in வேங்கட); visarga → ஃ.

  In **prose**, the Tamil glossary forms win (சுதர்சனம், not ஸுதர்ஶனம்). `iastToScript`'s Tamil mode follows the Sankalpam convention (ś → ச), so check its Tamil output against these rules.

### 5.3 Tamil pasurams

- **Tamil:** the pasuram in native Tamil script, from the authoritative text. Check doubtful lines against the Sunder Kidāmbi editions on prapatti.com, as the blog work did.
- **Kannada, Hindi, Telugu:** transliterate **from the Tamil-script text** (not from the English romanisation), using each glossary's header mapping:
  - **Kannada:** ழ = ೞ, ற = ಱ, ள = ಳ, ன = ನ, final ம் = ಂ.
  - **Hindi:**
    - letters: ழ = ऴ, ற = ऱ, ள = ळ, ன = न;
    - vowel signs: ெ = ॆ, ொ = ॊ, ே = े, ோ = ो;
    - voicing as pronounced: ந்த = न्द, ண்ட = ण्ड, ங்க = ङ्ग, intervocalic த = द and ட = ड;
    - ஃ = ः.
  - **Telugu:**
    - letters: ழ = ళ, ள = ళ, ற = ఱ (ற்ற = ట్ర), ன = న, ச = శ, final ம் = మ్;
    - voicing as pronounced: intervocalic க = గ, த = ద, ட = డ; ந்த = ంద, ண்ட = ండ.

### 5.4 Never

- Translate a verse line by line, or replace it with a prose paraphrase.
- Invent a missing verse or verse line, or "correct" a verse from memory. Check it against the source text.
- Drop the Devanagari lines.

---

## 6. Register and honorifics

- **The Lord** (Bhagavān, Perumāḷ): Tamil பெருமாள் / எம்பெருமான் as in the glossary; Kannada ಭಗವಂತ / ಭಗವಾನ್; Hindi भगवान; Telugu స్వామి / పరమాత్మ.
- **Āzhwārs, Āchāryas, Thāyār, Garuḍa, Sudarshana / Chakrattāzhwār** take honorific plural verbs and pronouns in every language. Āṇḍāl takes the feminine honorific.
- The glossaries record the exceptions, for example:
  - Nam Āzhwār as a newborn takes plain forms;
  - Nīlan takes plain forms until he becomes Tirumangai Āzhwār;
  - the Lord's direct speech to a devotee keeps plain forms in Telugu.

  Read your language's notes.
- In Telugu the Lord (స్వామి) takes singular verbs.

---

## 7. Names and terms

- **Temple and place names:** use the form in that temple's own `content/divya-desams/<slug>.json` translation. The Divya Desams are the reference.
- **People, deities, texts and festivals:** use the glossary. If a term is missing, search the live translations for an existing rendering (`grep` the `translations.<lang>` text) before inventing one. Then add it to the glossary.
- **"Sri":** ஸ்ரீ / ಶ್ರೀ / श्री / శ్రీ.
- **Book titles:** translate the meaning while keeping the Sanskrit title recognisable. For example, JAYA is ஜெயா: மகாபாரதப் பயணம் / ಜಯ: ಮಹಾಭಾರತದ ಒಂದು ಪಯಣ / जया: महाभारत की एक यात्रा / జయ: మహాభారత యాత్ర.

---

## 8. Workflow

1. **Set up.** Create a branch. Read this guide, your glossary and one model chapter in your language.
2. **Translate in batches of 3 chapters.** Run the checks in §9, then commit and push. Never leave more than 3 translated chapters uncommitted.
3. **Run the 13-point check for each chapter:**
   1. complete, with nothing omitted;
   2. faithful to the source;
   3. grammar;
   4. spelling;
   5. punctuation;
   6. consistent terminology (glossary);
   7. correct transliteration;
   8. verse handling (§5);
   9. formatting and paragraph parity (§4);
   10. natural readability;
   11. no placeholder or garbled text;
   12. correct file and field;
   13. valid JSON.
4. **Translate the titles.** Add the book's `title` and `description`, and every part title.
5. **Anchor the images.** For each inline image, add `placementAnchorTranslations.<lang>` and confirm that the photo lands after the right paragraph.
6. **Review the whole book** after the last chapter:
   - repeated passages between chapters;
   - leftover English;
   - the gloss-duplication pattern;
   - script purity;
   - glossary drift.
7. **Record progress** in a ledger under `docs/`, as `BLOG-TRANSLATION-PROGRESS.md` does.
8. **Announce.** Propose the What's New entry to the owner (`CLAUDE.md`). Merging to `main` publishes the website, and the app receives the change by over-the-air update.

---

## 9. Checks before every commit

```bash
npm run test:content      # schemas, typography, sections, verse layout, file counts
npm run typecheck
```

Quick content checks for one language (`LANG=ta|kn|hi|te`). Run them on the chapters you changed:

```bash
LANG_CODE=te node --input-type=module -e '
import fs from "node:fs"; import path from "node:path";
const lang = process.env.LANG_CODE;
const dirs = ["content/library", "content/divya-desams", "content/knowledge"];
const files = dirs.flatMap(function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : []); });
const paras = s => s.split(/\n\s*\n/).filter(p => p.trim()).length;
const foreign = { kn: /[ఀ-౿]/, te: /[ಀ-೿]/ }[lang];
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, "utf8")); const t = r.translations?.[lang]; if (!t) continue;
  const text = JSON.stringify(t);
  if (/(\S+)\s*\(\s*\1\s*\)/u.test(text)) console.log("gloss duplication:", f);
  if (foreign && foreign.test(text)) console.log("script leak:", f);
  if (r.body && t.body && paras(r.body) !== paras(t.body)) console.log(`paragraphs ${paras(r.body)} -> ${paras(t.body)}:`, f);
}'
```

Fix every line it prints, or explain it in the commit message. Some older chapters predate the paragraph rule.

---

## 10. Book-specific notes

### Sri Vishnu Sahasranaama Anubhavam (`sri-vishnu-sahasranaama-anubhavam`)

- **The English keeps Sunder Kidāmbi's IAST** (ē, ō, ś, ṣ, ṃ, ḥ), at the author's request. This is an exception to the Library's English "sh / e / o" convention. Don't "normalise" the English.
- **Each name is three paragraphs:**
  - `N. <IAST name> · <Devanagari name>`
  - the one-line meaning
  - `(oṃ) <dative> namaḥ`

  Translate them as follows:
  - **Name line:** `N. <name in your script> · <Devanagari unchanged>`. In Hindi, write the Devanagari name once: `N. विश्वम्`.
  - **Meaning:** translate it, keeping the final full stop.
  - **Mantra:** write it in your script (Tamil `(ஓம்) விஶ்வாய நமஃ`, per §5.2; Kannada `(ಓಂ) ವಿಶ್ವಾಯ ನಮಃ`; Hindi `(ॐ) विश्वाय नमः`; Telugu `(ఓం) విశ్వాయ నమః`).
- **Generate the mechanical parts by program, not by hand:** the 1000 name lines, 1000 mantras, 107 shlokas, the dhyāna and vandana verses, the Phala Shruti and the Uttara Bhagam verses. Use `iastToScript` for kn/hi/te, plus the §5.2 Tamil rules, then translate only the prose. This removes most of the cost and every transliteration slip.
- **Chapter titles** "Naama X-Y: <theme>": translate the theme and keep `X-Y` (e.g. `நாமம் 1-5: …`, `ನಾಮ 1-5: …`, `नाम 1-5: …`, `నామ 1-5: …`).
- **Quoted Tamil pasurams** in the explanations are romanised in English. Render them in native Tamil script for `ta`, and transliterate them from that Tamil for kn/hi/te (§5.3).
- The stotram PDFs on the book page (`resources`) are not translated.

---

## 11. Model files to imitate

- **Prose quality:** any `content/divya-desams/*.json`, the benchmark.
- **Sanskrit verse blocks in all four languages:** `content/library/nityasuri-vaibhavam/chapters/the-sudarsana-ashtakam.json`.
- **Tamil verse transliterated into kn/hi/te:** `content/library/untitled-recovered-book-pending-editorial-title/chapters/the-moksha-virodhi.json`, and the `azhwar-vaibhavam` posts.
- **Book and part titles:** `content/library/azhwar-vaibhavam/book.json`.
- **Terms:** `docs/translation-glossaries/{ta,kn,hi,te}.md`.
- **History and past decisions:** `DOCUMENTATION.md` §9 and `docs/BLOG-TRANSLATION-PROGRESS.md`.
