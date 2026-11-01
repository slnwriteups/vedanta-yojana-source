# Kannada source validation and independent-review handoff

Date: 2026-11-01. Starting revision: `98132b3`.

## Result and limits

The seven concerns raised during the Kannada translation have been resolved: six source-based editorial corrections and one A/B-label localization check. The six corrections were made in English first and synchronized in Kannada, Tamil and Hindi. Two introductory Kannada chapters also received the glossary's preferred ಉಪದೇಶ register. This is the translator's source-validation and correction pass; it is **not an independent linguistic review or owner theological approval**.

The Kannada translation remains complete: 116/116 chapters, 4,915 parallel body paragraphs, book title/description and 4/4 part titles. Mechanical certification has passed for all 116 Kannada chapters against their current text hashes. No linguistic or theological approval was created.

## Supplied sources

All eight supplied PDFs are accessible and recorded with their Library identifiers, SHA-256 checksums, page counts and validation purposes in `validation-sources.json`:

- Sri Vishnu Sahasranama_English_1.pdf
- Sri Vishnu Sahasranama_English_2.pdf
- Sri Vishnu Sahasranama_English_3.pdf
- Sri Vishnu Sahasranama_English_4.pdf
- Sri Vishnu Sahasranama_English_5.pdf
- Sri Vishnu Sahasranama_English_Commentary.pdf
- vishnusahasranaamam tamil.pdf
- **vishnusahasranaamam_kan.pdf**, supplied during this review; 26 pages.

Availability and extraction do not imply that every page of every volume has received an independent review. Source citations below identify the passages actually used for the corrections.

## Corrections made

Paragraph numbers here are 1-based; concern IDs in the JSON ledger are 0-based.

| Chapter / paragraph | Defect | Correction | Supplied evidence |
|---|---|---|---|
| naama-12-17 ¶5 | Bound souls were defined as necessarily relying on bhakti yoga. | Defined them as souls remaining bound in samsara; removed the unsupported requirement. | English vol. 1, naama 12, printed pp. 47–48 / PDF pp. 53–54; naama 65, printed p. 102 / PDF p. 108, distinguishes bound, released and ever-free souls. |
| naama-18-20 ¶6 | A bhakti-yoga requirement displaced the cited Bhattar explanation of the Lord as means. | Replaced it with Bhattar's explanation of the Lord as the natural and independent means, as well as the goal. | English vol. 1, naama 18, printed pp. 54–55 / PDF pp. 60–61. |
| naama-21-64 ¶64 | The gloss placed incarnation greatness above Para-Swaroopam without support in the cited name explanation. | Restored the supplied definition of Isvara as having supreme control over all beings. | English vol. 1, naama 36, printed pp. 70–71 / PDF pp. 76–77. |
| naama-87-122 ¶136 | The draft said attained souls were no longer distinct entities. | Restored the supplied explanation: He unites His devotees with Himself. | English vol. 1, naama 118, printed pp. 133–134 / PDF pp. 139–140. |
| naama-211-225 ¶20 | The nimiṣaḥ gloss reversed its source and contradicted the following paragraph. | His gracious glance does not fall on the enemies of His devotees. | English vol. 1, naama 215, printed p. 210 / PDF p. 216; page visually checked. |
| naama-362-385 ¶38 | Six-month absorption was attributed to Ramanuja. | Corrected the subject to Nammazhwar and described loss of awareness of the external world; retained the quoted pasuram. | English vol. 2, naama 370, printed p. 35 / PDF p. 39; vol. 3, naama 626, printed pp. 34–35 / PDF pp. 38–39; vol. 4, naama 823, printed pp. 105–106 / PDF pp. 109–110. Vol. 3 PDF p. 38 visually checked. |

The A/B labels in naama-18-20 ¶4 were verified as consistent ಅ/ಬ localization. They require no source alteration. `source-concerns.json` records each resolution and its evidence; none of these resolutions is represented as an independent review.

## Kannada PDF comparison

The 26-page Sunder Kidambi Kannada edition is now part of validation. Its text extraction loses some ligatures and produces spurious Latin characters, so no claim of an exact automated character match is made. Rendered pages were used to collate the 107 name-bearing verses (PDF pp. 7–17), the closing verse (PDF p. 17), the 22 Phala Shruti verses (PDF pp. 17–19), and the 11 Uttara Bhagam verses (PDF pp. 19–21). The Dhyana page (PDF p. 6) was also inspected, including the vocalic-ḷ form in mālākḷpta.

The main verse sequence is present through 107, with the closing verse following it. Word division, conjunct presentation, class nasals and sandhi presentation differ in places from the book's mechanically generated text. The PDF also contains ritual preliminaries, repeated liturgical endings and separate supplementary stotras outside the book's English source; these were not added to the book.

Two substantive reading differences were checked against the supplied commentary and retained as supported edition differences:

| Verse | Book reading | Kannada PDF reading | Evidence and treatment |
|---|---|---|---|
| 19 | mahādridhṛt / ಮಹಾದ್ರಿಧೃತ್ | mahādridhṛk / ಮಹಾದ್ರಿಧೃಕ್ | English vol. 1, naama 182, printed p. 180 / PDF p. 186 explicitly discusses both. Retain the book's supplied-commentary reading. |
| 44 | praṇamaḥ / ಪ್ರಣಮಃ | praṇavaḥ / ಪ್ರಣವಃ | English vol. 2, naama 410, printed p. 75 / PDF p. 81 explicitly gives praṇamaḥ and praṇavaḥ as alternatives. Retain the book's commentary reading. |

The book's Devanagari, Sanskrit name lines and mantras were not changed to force agreement with a different edition.

## Advisory findings and independent review

The current full-book Kannada check has 0 blocking errors and 221 advisories: 147 glossary-missing, 69 glossary-preference, 4 existing translation-key-order notices and 1 existing Vandana verse-spacing drift. The complete findings are retained in `KANNADA-REVIEW-WARNINGS.md`. None was suppressed or excused through a new baseline.

Common advisory patterns include compounds/inflections, pronouns, Vāsudeva (Lord) versus Vasudeva (father), Sanskrit mayā versus māyā, Tamil thāi (mother) versus the month Thai, and parāyaṇam (goal/refuge) versus pārāyaṇam (chanting). These patterns justify contextual review, not global replacement or blanket approval. The actual advice/teaching register misses in the introductory chapters were corrected.

All 116 current Kannada review packets were generated in `review/<chapter>.kn.md`; `kn-independent-review-index.json` records their current text hashes. A separate reviewer must assess every prose paragraph and the mandatory **Traditional Brahminical and Sri Vaishnava Register: Pass / Needs Revision** criterion. No register pass has been fabricated by the translator.

The broader ledger still has 74 open entries inherited from earlier Hindi/Tamil passes, mostly quotation-verification requests. They are not silently closed by resolving the seven Kannada-session entries. Existing Tamil source-review findings remain in `TAMIL-SOURCE-REVIEW.md`; this pass does not represent those older requests as independently approved.

## Verification and delivery

- Protection audit against `98132b3`: exactly six English prose paragraphs changed, each synchronized in kn/ta/hi; three additional Kannada prose paragraphs polished in two introductory chapters. All other fields, Sanskrit text, metadata and translations protected.
- All 4,915 paragraphs retain parity; updated prose and English fingerprints match the store.
- Full-book Kannada engine: 117 records, 0 blocking errors, 221 advisories.
- Changed-record engine: 111 records, 0 blocking errors, 365 advisories across all languages in those records.
- Translation-quality check: 0 errors; 1 existing Hindi advisory (`हजार`) becomes visible because its introductory chapter now has a Kannada edit.
- Content tests: 457 passed. Translation-engine tests: 66 passed. TypeScript passed. All were rerun after this review; no engine code changed.
- Mobile catalog and downloadable payload regenerated after source corrections.
- Changes remain local. No push, merge, announcement, deployment or OTA was performed.
