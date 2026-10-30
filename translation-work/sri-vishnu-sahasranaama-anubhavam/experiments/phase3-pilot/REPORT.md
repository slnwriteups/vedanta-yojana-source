# Phase 3 pilot: three Sri Vishnu Sahasranāma Anubhavam chapters in ta, kn, hi, te

Experiment `phase3-pilot`, 2026-10-30/31. Branch `codex/vyte-rulebook-engine`, uncommitted.

**Nothing in `content/` was written.** Candidates are in `candidates/` and carry an `_experiment` marker. **No theological approval was recorded.** All AI work ran in Claude Code subagents on the owner's subscription, with no billed API.

## 1. Chapters and why

| Chapter | Pattern tested |
|---|---|
| `naama-129-138` | The standard name pattern (name line, meaning, mantra, commentary), with the shloka block mid-chapter. It has a repeated name (130 and 133, both *vēdavit*), IAST quoted inside prose, and ṅ / kṣ / ṛ conjuncts. No translations existed. |
| `naama-12-17` | Names without a shloka. It has a multi-word name and mantra (*muktānāṃ paramā gatiḥ*, *paramāyai gatayē*), numbered lists inside prose, `jñ`, and dense theology of the released souls. Approved **Hindi** exists and served as a blind benchmark; ta/kn/te did not exist. |
| `dhyana-shlokam` | A verse-heavy layout: 8 Devanagari/romanised pairs (four-pāda verses printed as two lines), an `ॐ` mantra, and long devotional prose. It also contains vocalic **ḷ** (मालाकॢप्तासन). No translations existed. |

## 2. Final status of all 12 chapter-languages

See `status-table.md`, generated from the files.

- **11 of 12** pass mechanical validation with **0 blocking** errors.
- Each of the 11 has an **approved** round-2 independent AI review, recorded in `certification.json`. Every recorded review's text hash matches the final candidate text, and every review's independence from its translator is verified.
- **`dhyana-shlokam` [ta] is held, by design.** ¶3 contains vocalic ḷ (ॢ), and Standard §3.2 gives no Tamil letter for it. This is its only occurrence in the whole corpus, and no approved Tamil sets a precedent. Prep refuses to send that chapter-language (`source-untransliterable`) rather than guess. So it was never translated and has no ledger record: there is nothing to certify yet. It waits for the owner's convention.
- **No chapter is publication-ready.** Theological approval is the owner's, and none exists.

## 3. Mechanical validation

| Item | Result |
|---|---|
| Paragraphs generated (no AI) | 164 paragraph-languages: 16 name lines, 16 mantras, 9 verse pairs. All are clean except Tamil ḷ, which is held. |
| Generated Hindi vs the approved `naama-12-17` Hindi | **12/12 identical** (6 name lines, 6 mantras) |
| Merge gates, first drafts | 192 paragraph-translations, **0 rejected** |
| Merge gates, corrected drafts | 192, **0 rejected** |
| Final candidates | 0 blocking in all 11. 4 warnings remain: 1 Tamil "Vedas" form and 3 advisory "Lord" preferences. |

## 4. Independent review and corrections

There were three translators (one per chapter, blind: each saw only its packet) and eight reviewers (one per language per round, none of them a translator).

- **Round 1** found **14 blocking** points and **78 minor** ones. One blocking point (kn `dhyana-shlokam` ¶4, "the holy garland, Mukunda") was an English-source fault, which the translation correctly followed, so it was sent to the owner rather than "fixed".
- The real defects, corrected by the original translators:
  - **ta `naama-12-17`:** the Lord was அவன் with singular verbs throughout, including the title. Now அவர் / -ார், which matches the Divya Desam benchmark (110 honorific vs 3 singular).
  - **ta `naama-12-17` ¶5:** an added "only" (பக்தி யோகத்தையே) that implicitly excluded prapatti; removed.
  - **ta `naama-12-17` ¶6:** the Nityasūri form went against the glossary; corrected.
  - **ta `naama-12-17` ¶13:** the Yama Smriti line made the Lord "become fit for immortality". The soul is now the subject.
  - **hi, two chapters:** श्री भट्टर (10×) is now श्री भट्ट, as the approved Hindi chapters write it 53×.
  - **te `naama-12-17` ¶17, ¶29:** అతడు for the Lord inside quotations is now ఆయన (benchmark 272×). ¶17's "His own bliss" is now the souls' enjoyment of Him. The remaining అతడు in ¶13 is the released soul, which is correct.
  - **`dhyana-shlokam` ¶8, kn / hi / te:** "creates such a beautiful vision of Himself for me to view" had become "creates His form" (kn, te: a doctrinal error, since the divine form is eternal) and "for my darshan" (hi: reversed sense). It now reads "grants such a vision", and the duplicated object is gone.
  - **kn `dhyana-shlokam`:** ಆತನು (18×) is now ಅವನು, consistent with the approved examples.
- **Round 2** confirmed every real blocking point fixed, found **no new blocking faults**, and approved all 11.
- **Not applied:** 9 optional minor points remain (te 129 ¶4, ¶8; kn 12-17 ¶13, ¶17; te 12-17 ¶9, ¶17; te dhyana ¶4, ¶7, ¶13). Applying them would void the approvals just recorded. Only te dhyana ¶13, a dangling purpose clause, was introduced by the corrections.

Files: `review/round1/` (round-1 replies), `corrections/` (briefs sent to translators), `batches/*.reply.v2.json` (corrected replies), `review/reply.*.json` (round 2).

## 5. Comparison with established quality

**Blind Hindi benchmark** (`compare/hi-naama-12-17.*`), 18 prose items, new vs approved, randomised X/Y:

| | Count |
|---|---|
| New better | **6** |
| Approved better | **1** |
| Equal | **11** |

- **Faults the comparer found in the approved Hindi:**
  - ¶9: ambiguous pronouns, so it is unclear who serves whom, plus gender drift;
  - ¶17: singular वह with an honorific plural verb, and महात्मा reads as "a saint";
  - ¶29: drops the visarga of अक्षरः and uses ASCII bars.
  - ¶27 (scored equal): it drops "is said to", stating a reported claim as fact.
- **The new version's one loss:** ¶23 copies the English third person where natural Hindi says अपने स्वरूप.
- Recorded as observations only; the approved text is unchanged.

This agrees with the earlier experiment, `exp-2026-10-30`: 20 new vs 7 approved, 33 equal.

## 6. Problems that recur (measured)

| Problem | Where it appeared | Prevention for the 113 chapters |
|---|---|---|
| The Lord's pronoun and verb register | ta (`naama-12-17`), kn (`dhyana`), te (`naama-12-17` quotations) | Add to the prompt card, from the benchmark: ta honorific அவர் / -ார்; kn singular ಅವನು; te singular verbs with ఆయన; hi honorific. **Owner to approve.** |
| Sri Bhattar spelling | hi (2 chapters), te (2 spellings) | Glossary lines `Sri Bhattar = ஸ்ரீ பட்டர் / ಶ್ರೀ ಭಟ್ಟರ್ / श्री भट्ट / శ్రీ భట్టర్`. **Owner to approve** (pending-terms). |
| Emphasis added that the English lacks (ஏ / ಏ / ही) | kn (3 chapters), hi (2), ta (1) | A prompt-card line. **Owner to approve.** |
| Sages' honorifics in Telugu (the glossary's plain వేదవ్యాసుడు, అగస్త్యుడు vs honorific) | te, 2 chapters | **Owner decision.** |
| Hindi oblique plural flagged as "missing" (आत्माएँ → आत्माओं) | hi (4 false warnings) | **Fixed in the engine** (Hindi plural stem), with a test |
| English-source faults copied faithfully | all four languages | The concerns channel worked: 15 passages recorded, and translators did not "fix" the English |

## 7. Unresolved questions for the owner

- **Theological (from the English).** Reviewers raised these independently in several languages:
  - "the Vedas, which He Himself created" (129 ¶12; 4 of 4 languages), against the Vedas as apauruṣeya;
  - moksha "earned" (12-17 ¶7; 4/4);
  - bhakti yoga named as the only means, with no prapatti (12-17 ¶5; 3/4);
  - "the holy garland, Mukunda" (dhyana ¶4; 3/3; in the verse Mukunda is the Lord);
  - Sri Vaikuntham "in the centre of the milky ocean" (dhyana ¶4; 3/3; conflates Paramapadam with the Kṣīrābdhi);
  - dhyana ¶8: "creates" is now rendered "grants" (a vision). Please confirm.
- **English wording (`source-concerns.json`, 15).** Name glosses that disagree with their own commentary:
  - 135 and 136: "presents Himself to" vs "presides over";
  - 134 *kavi*;
  - 15 "as if they were His children";
  - 16 *kṣetrajña*.

  Also, in `dhyana-shlokam`: "gross" and "cosmic" appear swapped (¶13), there are fragments (¶18), "explained above" (¶7), and "circumstances" for "forms" (¶27). Then "bound" in eternal service (12-17 ¶6), and an English quotation longer than its Sanskrit (12-17 ¶25).
- **Transliteration.** Tamil for vocalic ḷ (dhyana ¶3).
- **For a Sanskrit scholar.** The mantra *muktānāṃ paramāyai gatayē namaḥ* (12-17 ¶3, Kannada reviewer).
- **Terms.** 28 proposed terms are pending in `pending-terms.json`, none in the glossaries. They include Sri Bhattar, Ksheerabdhi, Adisesha, Kaustubha, Pradyumna, Vedangams/Upangams, shloka and bhakti yogam.

## 8. Scaling to the remaining book (actual repository counts)

| Measure | Count |
|---|---|
| Chapter-languages remaining | **428** of 464 (Hindi has 15 chapters, ta/kn/te 7 each) |
| Prose items needing AI translation | **2,452** items, 9,589 item-languages, about **434k** English characters |
| Generated mechanically (no AI) | **2,528** paragraphs (1,000 names, 1,000 mantras, 264 verse pairs); 9,880 paragraph-languages |
| Translation batches at current settings (≤ 3 chapters, ≤ 6,000 chars, 4 languages per reply) | about **78** (69 four-language, 8 ta/kn/te, 1 hi) |
| Linguistic reviews | 428 chapter-languages (about 4 per batch per language) |
| Theological approvals (owner, per chapter-language) | 428 |
| Held for a decision today | 1 (Tamil ḷ) |

**Usage.** The pilot's correction round stopped once on the 5-hour subscription limit. The work was saved, and resuming lost nothing. Per chapter, the pilot used about 1 translator run, 4 reviewer runs, 1 correction run and 4 confirmation runs, and the reviews dominate. At that intensity the full book is several hundred subagent runs, spread over many limit windows. That is feasible, but it is not a single sitting, and no completion date is promised.

**Recommended process.**
1. **Settle first:** the conventions in §6, the 28 + 33 pending terms, the English concerns and the ḷ rule. Doing this first removes most round-1 defects at the source.
2. **Translate:** batches of up to 3 chapters, one translator run per batch for all four languages.
3. **Review:** one reviewer per language per batch, for consistency across chapters.
4. **Correct:** blocking corrections by the same translator.
5. **Confirm:** a short round 2 on the changed text only.
6. **Owner:** theological approval in bulk per chapter via `status` / `approve-theology`.

## 9. Recommendation

**Do not start bulk translation yet. Start after one short owner decision round.** The system did what it was built to do:
- it generated every Sanskrit element deterministically;
- it held the one ambiguous verse rather than guessing;
- it caught every structural fault mechanically;
- its independent reviewers found the real meaning, honorific and terminology errors, which the corrections fixed;
- the result beat the approved Hindi in a blind comparison.

The round-1 defects were mostly convention gaps (the Lord's register, the Bhattar spelling, added emphasis) that will recur in every chapter until they are written into the prompt card and glossary. Once the owner settles those and the English concerns, the next step is a batch of 3 name chapters at full scale (one batch, all four languages), then steady batches.
