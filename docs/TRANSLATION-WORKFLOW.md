# Translating a book in Claude chat sessions

How to translate a Library book into Tamil, Kannada, Hindi and Telugu using an ordinary Claude plan, with no API key and no paid service. The rules are unchanged (`docs/TRANSLATION-GUIDE.md`); this is the cheap way to apply them.

Scripts do everything that needs no judgement: verses, Sahasranaama name lines and mantras are generated letter for letter, and every reply is checked before it touches `content/`. A chat session only ever sees prose, with the one-page prompt card and the glossary terms that prose uses, and translates all four languages in one pass.

For *Sri Vishnu Sahasranaama Anubhavam*, 2,528 of the 4,915 paragraphs are generated (264 Devanagari verses, 264 romanised verses, 1,000 names, 1,000 mantras). The 2,387 prose paragraphs go to Claude.

## The loop

```bash
# 1. Prepare the next batch: prints one block to paste into Claude.
npm run translate:prep -- --book=sri-vishnu-sahasranaama-anubhavam

# 2. Paste the block into a Claude chat. Save Claude's reply (the JSON) as
#    translation-work/<book>/batches/batch-NNN.reply.json

# 3. Merge: checks each paragraph, stores it, and writes finished chapters.
#    --translator names who produced the reply (a person or a chat session);
#    the linguistic review must come from someone else.
npm run translate:merge -- --book=sri-vishnu-sahasranaama-anubhavam --batch=N --translator=claude-chat-2026-10-30a

# 4. Check, commit, open a pull request.
node tools/translation-engine/cli.ts check --changed && npm run test:translations && npm run test:content
```

Prep first freeze-checks the English (Standard §6.3). A chapter with placeholder text, `migration.needsReview`, or a verse block that cannot be generated without guessing (for example a romanised verse not in the Devanagari-couplet layout) is not prepared; prep prints why, for the owner to settle in the English.

After a chapter is written, it still needs an independent linguistic review and the owner's theological approval before it is ready to publish: see `tools/translation-engine/README.md` (`review-packet`, `record-review`, `approve-theology`, `status`).

Repeat until prep says nothing is left. Commit after every few batches; the `translation-work/<book>/store.json` file holds translated prose for chapters that are not finished yet, so commit it too.

## Options

`translation-prep.ts`

| Option | Default | Meaning |
| --- | --- | --- |
| `--book=<slug>` | `sri-vishnu-sahasranaama-anubhavam` | any folder under `content/library/` |
| `--size=N` | 3 | most chapters in one batch |
| `--max-chars=N` | 6000 | most English characters in one batch; long chapters are split |
| `--langs=ta,kn` | every missing language | ask for some languages only |
| `--no-card` | off | leave out the prompt card when it is already in the chat |
| `--batch=N` | | print batch N again |

The prompt card (`prompts/translation-prompt-card.md`) only needs pasting once per chat. From the second batch in the same chat, use `--no-card`.

**Batch size.** One reply carries every requested language, so it is about four times the English in length. 6,000 English characters fits comfortably in one reply. If replies get cut off, lower `--max-chars`.

`translation-merge.ts` takes `--reply=<file>` (or `--reply=-` to read standard input) when the reply is saved somewhere else.

## What merge checks

Each translated paragraph is **rejected** (not stored, and asked for again by the next prep) when it:

- contains a blank line;
- has no text in the target script;
- leaks another script (Telugu in Kannada, Kannada in Telugu, and so on);
- uses native digits;
- repeats a word in its own gloss ("word (word)").

It is also **rejected** when it:

- leaves English or romanised Sanskrit in it (list markers, URLs and acronyms that are in the English are allowed; `tools/translation-engine/latin-allowlist.json` holds reviewed exceptions);
- uses a form the glossary forbids (a `not …` / `never …` annotation).

It is stored with a **warning** for:

- missing or extra final punctuation;
- a line-count difference;
- a glossary term whose form (or an inflection of it) is not found, for the reviewer to check;
- Perso-Arabic words in Hindi.

Merge refuses the whole reply if a language array has the wrong number of strings, so a skipped or merged paragraph can never shift the rest out of place.

A chapter is written to `content/` only when its title and all its prose exist for that language. Its verses, name lines and mantras are generated at that moment, and the whole chapter is checked by the translation engine first: if anything new blocks (a lost `*` note marker, for example), it is not written, the prose stays in the store, and merge exits 1. Only missing fields are filled: an existing translated title or body is never overwritten, and English fields are never written.

New terms Claude reports under `"terms"` go to `translation-work/<book>/pending-terms.json`, never into the glossaries. Later batches see them marked "(pending owner approval)" so the book stays consistent. The owner approves them into the glossaries with `node tools/translation-engine/cli.ts approve-terms --book=<slug>` (interactive; it refuses to run in an agent session or CI).

Passages the translator found ambiguous in the English (reported under `"concerns"`) are recorded in `translation-work/<book>/source-concerns.json` for the owner to settle in the English; the translation follows the English as written until then.

`--experiment=<name> --chapter=<slug>` on both prep and merge re-translates one chapter in `translation-work/<book>/experiments/<name>/`, ignoring its live translations and writing candidates there instead of `content/`.

## Previewing the generated parts

```bash
npm run translate:scaffold -- --book=sri-vishnu-sahasranaama-anubhavam --check
```

This writes `translation-work/<book>/skeleton/` (not tracked) with the generated paragraphs for every chapter and `null` where prose goes. `--check` compares them with any translation already live. On the 14 Hindi chapters of the Sahasranaama, all 202 generated paragraphs match the live text exactly.

Generation follows the live conventions:

- Verses are derived from the Devanagari already in the English, never from the romanisation.
- Kannada and Telugu write a class nasal before its own class as anusvara (ವೇಂಕಟ, వేంకట).
- Tamil uses the Grantha rules of the guide (§5.2): ś → ஶ, dental n is ந at the start of a word and before த/ந, and ன elsewhere.
- Hindi repeats the Devanagari, with ASCII bars and Western digits.

Hand-placed word breaks inside compounds, as in some older Tamil verses, cannot be generated. Polish them by hand if wanted; merge never overwrites them.

## The pull-request check

`.github/workflows/translation-check.yml` runs `scripts/test-translation-quality.ts` on the content files a pull request changes:

- paragraph parity with the English;
- script leaks;
- native digits;
- gloss echo.

It is free on a public repository and needs no install. Run it over everything with `node scripts/test-translation-quality.ts --all`. Older chapters predate the parity rule, so expect findings there.

The same workflow then runs the translation engine's tests and `cli.ts check --changed`. Defects recorded in `tools/translation-engine/baseline.json` are listed as "known" and do not fail the check (until the text they were found in is edited); every new error does.
