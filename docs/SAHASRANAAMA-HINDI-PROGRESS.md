# Sri Vishnu Sahasranaama Anubhavam: Hindi translation

Governing standard: `docs/TRANSLATION-GUIDE.md`, the binding Hindi glossary,
and the guide's designated model files. English baseline: `6b4b5bc`.

## Batch 1 — 2026-10-30

Completed 3 of 88 chapters:

1. `how-did-sri-vishnu-sahasranaamam-come-to-be`
2. `composition-of-the-stotram`
3. `organisation-of-the-stotram`

Book title, description and all three part titles translated. Terms first
used by this batch recorded in `docs/translation-glossaries/hi.md`.

Reviewed all three translations against English for the guide's 13 points:
completeness, fidelity, grammar, spelling, punctuation, terminology,
transliteration, verse handling, paragraph parity, readability, absence of
placeholders, correct fields and valid JSON. The Sanskrit verse was copied
programmatically from the English Devanagari block for the Hindi repeat,
with ASCII bars as prescribed. Inline Sanskrit quotations are in Devanagari.
No English fields, chapter order, resources or source metadata changed.
There are no inline images in this batch.

Validation: 453 content tests passed; `npm run typecheck` passed;
`git diff --check` passed. Paragraph counts: 3, 17 and 4, respectively,
matching English exactly. No Latin prose or duplicate parenthetical glosses
in these chapter translations.

## Batch 2 — 2026-10-30

Completed another three chapters (6 of 88 total):

4. `the-prologue`
5. `the-thousand-names`
6. `the-benefits`

Hindi chapter titles and full bodies added. Sanskrit quotations generated
with `iastToScript`, normalizing Sunder Kidambi's long e/o notation in the
converter input only; the English source remains untouched. Checked the
output against the input Sanskrit. Paragraph counts match English exactly:
11, 5 and 6. Reviewed for the same 13 guide requirements as batch 1.

Validation: content tests and typecheck passed; `git diff --check` passed.
No English source fields changed, Latin prose left over, script leaks or
duplicate parenthetical glosses in these three chapter translations.

## Remaining

82 chapters, starting with `importance-of-chanting-the-stotram`, then the remaining chapters in
`book.json`'s `chapterOrder`. Translate in batches of three, validate and
commit each batch. Final whole-book review is still pending. Batch 1 was merged in PR #122. Batch 2 is on a separate branch; final
whole-book review is pending. No announcement has been added.
