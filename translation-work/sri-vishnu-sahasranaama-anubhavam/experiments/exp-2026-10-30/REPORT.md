# Controlled translation experiment: exp-2026-10-30

**Chapter:** `sri-vishnu-sahasranaama-anubhavam / composition-of-the-stotram`. It is approved in ta, kn, hi and te and has no baseline defects. It has 17 paragraphs: 15 prose, plus one Devanagari verse and its romanised couplet. No Sahasranāma name-line chapter is yet approved in all four languages.

**Isolation.** The live translations were never shown to any AI, and nothing was written to `content/`.
- **Prep.** It ran with `--experiment` (live translations ignored). The packet held only the prompt card, the English and the glossary lines it uses.
- **Translator.** A fresh subagent ("subagent-translator-a") read only that packet: no other file, no shell, no web.
- **Merge.** Merge with `--experiment` generated the verses, ran every gate and wrote `candidates/`.
- **Reviewers.** Two further fresh subagents (B: ta+kn; C: hi+te) read only their review packets. The packets give examples from other approved chapters and never this one.
- **Blind comparison.** A fifth subagent compared approved and new paragraphs blind (X/Y, randomised per paragraph; key in `compare/key.json`).

All of it ran within the Claude Code subscription, with no API key or billed service.

## Reproducing it

The reply (`batches/batch-001.reply.json`), manifest, store, recorded reviews and comparison files are committed. The packets are regenerated rather than committed:

```sh
node scripts/translation-prep.ts --book=sri-vishnu-sahasranaama-anubhavam --chapter=composition-of-the-stotram --batch=1 --experiment=exp-2026-10-30   # translator packet
node scripts/translation-merge.ts --book=sri-vishnu-sahasranaama-anubhavam --batch=1 --experiment=exp-2026-10-30 --translator=subagent-translator-a
node tools/translation-engine/cli.ts check --candidate --file=translation-work/sri-vishnu-sahasranaama-anubhavam/experiments/exp-2026-10-30/candidates/composition-of-the-stotram.json --english=content/library/sri-vishnu-sahasranaama-anubhavam/chapters/composition-of-the-stotram.json
node tools/translation-engine/cli.ts review-packet --book=sri-vishnu-sahasranaama-anubhavam --chapter=composition-of-the-stotram --lang=ta --experiment=exp-2026-10-30 --file=translation-work/sri-vishnu-sahasranaama-anubhavam/experiments/exp-2026-10-30/candidates/composition-of-the-stotram.json
```

A regenerated translator packet also lists the six terms this run proposed, marked "(pending owner approval)". The original packet did not have them, because they did not exist yet. Re-running the merge reproduces the candidate translations exactly; the recorded reviews' text hashes still match. The candidate carries an `_experiment` marker: the engine's check, and so CI, block it as `experimental-candidate` if it is ever copied into `content/`. The reviewers' original replies (`review/reply.<lang>.json`) used guessed field names, because their packets predated the documented paragraph shape. The recorded copies (`reply.<lang>.fields-renamed.json`) only rename `paragraph`→`n` and `issue`→`comment`; the verdicts are unchanged.

## Results

**Mechanical (deterministic, `compare/metrics.txt`)**

| | ta | kn | hi | te |
|---|---|---|---|---|
| paragraph parity (17 = 17) | ✓ | ✓ | ✓ | ✓ |
| merge rejections | 0 | 0 | 0 | 0 |
| blocking errors (new / approved) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| verse paragraphs identical to approved | 2/2 | 2/2 | 2/2 | 2/2 |
| glossary terms found (new / approved) | 42 / 38 of 42 | 39 / 37 of 41 | 50 / 52 of 52 | 37 / 31 of 38 |
| prose length, new ÷ approved | 1.03 | 1.00 | 1.04 | 1.02 |

**Independent linguistic review (blind to the approved text).** All four languages were approved, with no blocking paragraph and only minor style notes. The reviews are recorded in this experiment's `certification.json` as AI-advisory, independence verified. **No theological approval was recorded.**

**Blind comparison (`compare/judgement.json`, unblinded in `compare/unblinded.txt`)**, 15 prose paragraphs per language:

| | new better | approved better | equal |
|---|---|---|---|
| ta | 7 | 1 | 7 |
| kn | 4 | 1 | 10 |
| hi | 5 | 2 | 8 |
| te | 4 | 3 | 8 |

## Meaningful differences

- **¶7, all four languages: the new version is wrong, and the cause is the English.** The English says "Of all the commentaries Sri Sankara wrote…, Sri Vishnu Sahasranama Stotram was the foremost one". Read literally, that makes the stotram one of his commentaries. The approved translators silently corrected it to "his commentary on it". The new translator followed the English literally and flagged it as ambiguous. The reviewers listed it as a concern for the owner. Under Standard §1 rule 1 the English should be fixed first, with the owner's agreement. The workflow now has a channel for this: `"concerns"` in the reply, recorded in `source-concerns.json`.
- **Errors in the approved text** that the blind comparer found:
  - ta ¶4: அசைகள் (a Tamil prosody unit) for "syllables", which misstates the Anushtup rule.
  - ta ¶13: the sandhi typo "எல்லாக் தளைகளிலிருந்தும்".
  - te ¶11: "నారదుడు వంటి" (should be నారదుని).
  - hi ¶17: उद्घाटन ("inauguration") for "revelation".
  - hi ¶4: adds that Vyasa strung the names *while* Bhishma spoke.
  - Several paragraphs use the everyday "advice" words (அறிவுரை / ಸಲಹೆ / सलाह / సలహా) where the glossary has *upadesa*.
  
  These are reported, not changed.
- **Weaker points in the new text:**
  - hi ¶6: a misplaced relative clause.
  - te ¶4 and ¶6: awkward forms (పరమాత్మే, మహర్షి అయిన వేదవ్యాసుడు).
  - Some passive calques.
- **Glossary warnings:**
  - A "Brahmā" warning on te ¶7 is a false positive: the paragraph means the Brahma Sutras.
  - The "Krishna" warnings at merge time were also false positives, caused by the joined श्रीकृष्ण form. The engine now accepts a term joined to Sri. With that fix, the re-run merge gives 1 warning, where the first run gave 5.
- **Pending terms:** six proposed terms are waiting in `pending-terms.json`. "Alwars" duplicates the glossary's Āzhwār under another English spelling, and "Vedas (te)" has a malformed key. Both show why terms need owner approval.

## Suitability for the remaining Sahasranāma chapters

The approach is suitable for scaling, on these conditions:

1. **Settle the English first.** The one real meaning fault came from the English. Run prep's freeze check and act on `source-concerns.json` before each batch.
2. **Keep the deterministic parts deterministic.** Verses matched the approved text exactly. The 1,000 name lines and 1,000 mantras use the same generator, which `translate:scaffold --check` has verified against the 14 Hindi chapters.
3. **Keep human review.** Independent AI review plus the owner's theological approval stays mandatory. In this experiment the AI reviewers approved a translation that the blind comparison judged mostly better than the approved one, but they did not block ¶7. They only flagged it. A human must read the concerns.
4. **Not yet tested:** this experiment did not cover name-line chapters, which are mostly generated and need little prose, or Tamil pāsurams quoted in prose (§3.3).
