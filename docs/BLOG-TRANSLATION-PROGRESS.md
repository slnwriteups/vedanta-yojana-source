# Blog completion ledger: the five authorized subjects

Scope: 60 chapters in three Library blogs. No other archived post is in scope.

| Subject | Book / part | Chapters |
|---|---|---|
| Garuḍa Vaibhavam | `nityasuri-vaibhavam` / Garuḍa Vaibhavam | 6 |
| Sudarshana Mahima | `nityasuri-vaibhavam` / Sudarshana Vaibhavam | 5 |
| Tirumala Navarātri Brahmotsavam | `temples-and-festivals` / Tirumala Navarātri Brahmotsavam | 11 |
| Guruvāyūr | `temples-and-festivals` / Guruvāyūr | 4 |
| Āzhwār Vaibhavam | `azhwar-vaibhavam` (7 parts + introduction) | 34 |

## Phase A: English conventions (done)

Applied the documented Library rules (`scripts/apply-transliteration*.ts`, round 3 and rule 4):
- ś/ṣ are written "sh" everywhere, verses included (Sudarshana, Shiva, Deshikan).
- In prose Sanskrit words, ē/ō become e/o (Deva, Govinda, Gajendra) and vocalic ṛ becomes "ri" (Krishna, Brihaspati, Amritam, Prishni).
- Tamil words and Tamil verse lines keep ē/ō (Kōvil, Kōdhai, Tirukkōvalūr). Sanskrit verse keeps ṛ, ṁ and ḥ.
- Book and Divya Desam precedent: Āzhwār (not Āḻvār), Nam Āzhwār, Āṇḍāl, Chera/Chola/Pandya, Sri Rangam, Swami, Mahālakshmī, Venkateshvara, Kashyapa, Kadrū, Tiruvāymoḻi.
- The Tirunāngūr list was rewritten as "Lord of Place".
- Slugs are unchanged; titles were updated where the rules require it.

## Phase B: translations (ta / kn / hi / te)

Status per book is recorded below as batches are merged.

| Language | temples-and-festivals (15) | nityasuri-vaibhavam (11) | azhwar-vaibhavam (34) | Book and part titles |
|---|---|---|---|---|
| Tamil (ta) | done | done | done | done (all 3 books) |
| Kannada (kn) | done | done | done | done (all 3 books) |
| Hindi (hi) | done | done | done | done (all 3 books) |
| Telugu (te) | done | done | done | done (all 3 books) |

Phase C: all 30 photos are placed inline in English. Each merged translation gets `placementAnchorTranslations`, derived from the matching paragraph and checked to place the photo inline.

Term glossaries for reuse across batches: `docs/translation-glossaries/<lang>.md`.

Open questions for the author (Tamil Āzhwār batch):
- Two quotations could not be checked against a Prabandham edition: the Perumpuliyūr verse (இக்குறும்பை) and the Bhaktisārar phrase (பேணிலும் வரம் தர மிடுக்கில்லாத தேவர்).
- Three English verse transliterations were corrected to the standard text, matching the Tamil: thuṇivuḍaiya in the first Kaṇikaṇṇan verse, "Orumagaḷ thannai uḍaiyēn", and "koḍuvinaiyēn".
- Shivavākyar's verse (`sivavakyar`): the English reads "venkaṭkariyānai"; the Tamil, Kannada and Hindi follow the reading செங்கட் கரியானை ("sengaṭ kariyānai"). Confirm which reading is intended.

## Status: all 240 chapter translations merged

60 chapters × 4 languages, plus 12 book titles/descriptions and 44 part titles. All 30 photos have anchors in all five languages.

Next, one step at a time:
1. Align spellings with the existing books and Divya Desams, one language at a time.
2. Side-by-side review of the three batches without a full re-read: Tamil Āzhwār (34), Hindi Temples and Festivals + Nityasūri (26), Telugu Temples and Festivals + Nityasūri (21).

## Status: complete

- Step 1, spelling, applied per the author's rule for each language: Tamil follows the Tamil roots, Kannada the Sanskrit forms, Hindi the Sanskrit-rooted forms (the Hindi-book alignment was reverted), and Telugu the Sanskrit roots.
- Step 2, side-by-side reviews, done: Tamil Āzhwār Vaibhavam (26 of 34 chapters fixed), Hindi Temples and Festivals + Nityasūri (7 fixed) and Telugu Temples and Festivals + Nityasūri (13 fixed). Every other batch was re-read side by side by its translator.
- Still for the author to check against a Prabandham text: the Perumpuliyūr verse (இக்குறும்பை), the Bhaktisārar phrase, Shivavākyar's "sengaṭ / venkaṭ kariyānai", and "என் செயப் பெற்றது" in Kulasekhara's verse.
