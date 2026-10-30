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
npm run translate:merge -- --book=sri-vishnu-sahasranaama-anubhavam --batch=N

# 4. Check, commit, open a pull request.
npm run test:translations && npm run test:content
```

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

It is stored with a **warning** for:

- missing or extra final punctuation;
- a line-count difference;
- leftover English;
- Perso-Arabic words in Hindi.

Merge refuses the whole reply if a language array has the wrong number of strings, so a skipped or merged paragraph can never shift the rest out of place.

A chapter is written to `content/` only when its title and all its prose exist for that language. Its verses, name lines and mantras are generated at that moment. Existing translations are never overwritten, and English fields are never written.

New terms Claude reports under `"terms"` are appended to each glossary under a `# --- <book>, batch N (new terms; review)` header, so later batches reuse them. Review those lines in the pull request.

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
