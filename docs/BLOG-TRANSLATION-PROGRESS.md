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
- Checked against the prapatti.com texts (Sunder Kidāmbi editions):
  - Bhaktisārar: the phrase is Tiruchchanda Viruttam 69, "pēṇilum varam tara miḍukkilāda tēvarai". Corrected to மிடுக்கிலாத தேவரை in every language.
  - Kulashekhara's verse in `the-turning` is Perumāḷ Tirumozhi 7.6. The last line reads "ennai en śeyya ppeṭradem mōyē" (என் செய்யப் பெற்றது). Corrected "seya" to "seyya" in every language.
  - Amalanādipirān 1 and 10 match the text.
  - The Perumpuliyūr verse (இக்குறும்பை) and Shivavākyar's verse (சாக்கியம் கற்றோம்) are not in the Nālāyiram texts on prapatti.com. Both are verses from the Āzhwār's life, so they were checked against other published sources:
    - Perumpuliyūr: our text matches the published transliteration ("Akkarangal Akkarangal Enrum Aavadhu En Kolo / Ik Kurumbai Neekki…").
    - Shivavākyar: every source that prints the full veṇbā reads செங்கட் கரியானை (Dinakaran, Maalaimalar, and others). "Venkaṭ" appears only in shortened quotations, which also misspell the word. The English transliteration is now "sengaṭ kariyānaich", matching the other four languages and the English meaning ("eyes like red lotuses").

## Status: all 240 chapter translations merged

60 chapters × 4 languages, plus 12 book titles/descriptions and 44 part titles. All 30 photos have anchors in all five languages.

Next, one step at a time:
1. Align spellings with the existing books and Divya Desams, one language at a time.
2. Side-by-side review of the three batches without a full re-read: Tamil Āzhwār (34), Hindi Temples and Festivals + Nityasūri (26), Telugu Temples and Festivals + Nityasūri (21).

## Status: complete

- Step 1, spelling, applied per the author's rule for each language: Tamil follows the Tamil roots, Kannada the Sanskrit forms, Hindi the Sanskrit-rooted forms (the Hindi-book alignment was reverted), and Telugu the Sanskrit roots.
- Step 2, side-by-side reviews, done: Tamil Āzhwār Vaibhavam (26 of 34 chapters fixed), Hindi Temples and Festivals + Nityasūri (7 fixed) and Telugu Temples and Festivals + Nityasūri (13 fixed). Every other batch was re-read side by side by its translator.
- All the verse questions are now resolved.

## Owner correction, 5 November 2026: Āzhwār Vaibhavam chronology

Source: the owner's direction of 5 November 2026, giving Srimad Bhāgavatam 11.5.38–40 with its translation and the traditional dates of the twelve Āzhwārs (from the Divyasūri Charitam and the 6000-paḍi Guru Paramparā Prabhāvam, counted from the start of the Kali Yuga in 3102 BCE). Applied under the source-first editorial rule: English first, then ta / kn / hi / te.

- `an-introduction-to-the-azhwars`: added the three verses (Devanagari, with the owner's translation), the traditional date of each Āzhwār, the river of each Āzhwār's land, and the sampradāya's position on the seventh-to-ninth-century dating.
- `pey-azhwar`: "around the seventh century" → "at the close of the Dvāpara Yuga".
- `nilan-commander-of-the-cholas`: "around the eighth century" → "in the 398th year of the Kali Yuga".
- `before-the-kings-court`: "Around the ninth century" → "In those days".
- `the-chera-prince`: Kulasekhara Āzhwār's birth year Prabhava → Parābhava, the 27th year of the Kali Yuga.
- Verse 39 reads पयस्विनी (payasvinī), matching the owner's translation ("Payasvinī").
- Still open, waiting on the owner: the specific commentary passages for the named commentators (Śrīdhara Svāmin, Jīva Gosvāmī, Piḷḷai Lokācārya, Maṇavāḷa Māmuni). Until then the text says only that the Sri Vaishṇava Āchāryas identify the Āzhwārs in these verses.
