# Editorial decisions

Status as of 2026-10-30, Phase 3. Approved published translations and the English source are unchanged. Usage counts come from the live `translations.<lang>` text in `content/`, inflected forms included.

## A. Decided by the owner and applied to the glossaries

| Decision | Glossary change | Effect on content |
|---|---|---|
| ta Hanumān = **அனுமன்** | `ta.md` deleted the old `Hanumān = ஹனுமான்`; kept `Hanumān = அனுமன் (not ஹனுமான்)` | none: live Tamil already uses அனுமன் 120×, ஹனுமான் 0× |
| ta Vinatā = **வினதை** | deleted the old `Vinatā = விநதை` | none: வினதை 33×, விநதை 0× |
| ta rākshasas = **அரக்கர் / அரக்கர்கள்**; **ராக்ஷசன்** only where the Sanskrit term itself is discussed | `rākshasas = அரக்கர் / அரக்கர்கள்`; `rākshasa (the Sanskrit term itself) = ராக்ஷசன் (pl. ராக்ஷசர்கள்)` | none |
| ta brāhmaṇas (people) = **பிராமணர்**, **அந்தணர்** where suitable; Vedic texts are distinct | `Brāhmaṇas / Āraṇyakas (Vedic texts) = பிராமணங்கள் / ஆரண்யகங்கள்`; `brāhmaṇa(s) (people) = பிராமணர் / பிராமணர்கள் (also where the context suits: அந்தணர் / அந்தணர்கள்)`; deleted the duplicate `brāhmaṇas = அந்தணர்கள்`; the Principle line updated | none: both forms are accepted |
| te Sītā = **సీత** and its inflections; **సీతాదేవి** honorific | `Sri Rāma / Lakshmaṇa = శ్రీరాముడు / లక్ష్మణుడు`; `Sītā = సీత (oblique సీతను / సీతకు / సీతతో / సీతపై; honorific సీతాదేవి)` | none: the 213 paragraphs now conform |
| Āzhwār naming: no "Alwars" term | the experiment's "Alwars" term marked `rejected`; its malformed `Vedas (te)` key corrected to `Vedas` (still pending) | none |

After these changes `cli.ts glossary` reports **0 conflicts** in all four languages, and the library check still reports 0 blocking errors with the same 152 known historical defects.

## B. The 33 pending lines (36 terms) under "(new terms; review)": still pending

These sit at `ta.md:435–445`, `kn.md:399–409` and `te.md:324–334`. They stay non-binding. Translator packets now mark these forms with `*` (pending owner review) instead of presenting them as binding glossary.

The "approved usage" column is evidence from published paragraphs whose English contains the term. Hindi has the same terms under its own headers (`hi.md:386` onward), which are not marked for review, and its usage agrees.

| English | ta | kn | te | Approved usage (ta / kn / te) | Assessment |
|---|---|---|---|---|---|
| Bhishma | பீஷ்மர் | ಭೀಷ್ಮ | భీష్ముడు | 34/34 · 34/34 · 34/34 | **Supported.** The honorific differs by language (ta honorific; kn/te plain), as in the approved JAYA and Bhāgavatam. |
| Yudhishthira | யுதிஷ்டிரன் | ಯುಧಿಷ್ಠಿರ | యుధిష్ఠిరుడు | 37/37 · 37/37 · 37/37 | **Supported** |
| Vedavyasa | வேதவியாசர் | ವೇದವ್ಯಾಸ | వేదవ్యాసుడు | 5/5 · 5/5 · 3/5 | **Supported.** te also uses the compound form వ్యాస (వ్యాస మహర్షి), a grammatical variant. |
| Vyasa | வியாசர் | ವ್ಯಾಸ | వ్యాసుడు | 14/20 · 20/20 · 17/20 | **Supported.** The misses are paraphrases or compounds, not a rival spelling. |
| Sri Parasara Bhattar | ஸ்ரீ பராசர பட்டர் | ಶ್ರೀ ಪರಾಶರ ಭಟ್ಟರ್ | శ్రీ పరాశర భట్టర్ | 1/1 each | Supported, but thin evidence. Note that hi writes श्री पराशर भट्ट (no -र्), and the English writes both "Bhatta" and "Bhattar": **decide the English form**. |
| Sri Adi Sankara | ஸ்ரீ ஆதி சங்கரர் | ಶ್ರೀ ಆದಿ ಶಂಕರ | శ్రీ ఆది శంకరులు | 1/1 each | Supported, thin evidence |
| stotram | ஸ்தோத்திரம் | ಸ್ತೋತ್ರ | స్తోత్రం | 22/22 · 22/22 · 23/23 | **Supported** |
| Phala Shruti | **பலஸ்ருதி** | ಫಲಶ್ರುತಿ | ఫలశ్రుతి | **2/6** · 6/6 · 6/6 | **Decision needed (ta).** The approved Sahasranāma Tamil writes **பலஶ்ருதி** (with ஶ) in all 9 occurrences; the pending line has ஸ. |
| Narayaneeyam | நாராயணீயம் | ನಾರಾಯಣೀಯಂ | నారాయణీయం | 1/1 each | Supported, thin evidence |
| Bhaja Govindam | பஜ கோவிந்தம் | ಭಜ ಗೋವಿಂದಂ | భజ గోవిందం | 1/1 each | Supported, thin evidence |
| anushtup | அனுஷ்டுப் | ಅನುಷ್ಟುಪ್ | అనుష్టుప్ | 2/2 each | Supported |
| pārāyaṇam (chanting) | பாராயணம் | ಪಾರಾಯಣ | పారాయణం | 0 uses | **No evidence yet.** These are the standard forms; approve on judgement, or wait for usage. |

**Recommendation.** Approve the nine supported terms. Decide Tamil Phala Shruti (பலஶ்ருதி recommended, to match the approved text) and the Bhatta/Bhattar English form. pārāyaṇam is your call.

## C. Terms proposed by the controlled experiment (exp-2026-10-30): pending

| English | ta | kn | hi | te | Note |
|---|---|---|---|---|---|
| meter (chandas) | சந்தஸ் | ಛಂದಸ್ಸು | छंद | ఛందస్సు | New. For ta, சந்தஸ் versus யாப்பு / சந்தம் is the owner's choice. |
| Dvaita school | த்வைத சம்பிரதாயம் | ದ್ವೈತ ಸಂಪ್ರದಾಯ | द्वैत संप्रदाय | ద్వైత సంప్రదాయం | hi already has `Dvaita = द्वैत` |
| composers (vaggeyakaras) | வாக்கேயக்காரர்கள் | ವಾಗ್ಗೇಯಕಾರರು | वाग्गेयकार | వాగ్గేయకారులు | The blind comparison preferred these to the generic "composers" |
| Mother Ganga | அன்னை கங்கை | ಗಂಗಾ ಮಾತೆ | माता गंगा | గంగా మాత | Check against the Divya Desam river names |
| Vedas | | | | వేదాలు | te only; key corrected |
| ~~Alwars~~ | | | | | **Rejected** (owner decision): use the existing Āzhwār / Āzhwārs |

## D. English source: proposed corrections awaiting the owner's final wording

`content/library/sri-vishnu-sahasranaama-anubhavam/chapters/composition-of-the-stotram.json`. **Not modified.**

### ¶7

| | Text |
|---|---|
| **Original** | Of all the commentaries Sri Sankara wrote for our religious scriptures (the Bhagavad Gita, the Brahma Sutras, etc.), Sri Vishnu Sahasranama Stotram was the foremost one. Sri Sankara emphasises the importance of reciting the Vishnu Sahasranama Stotram in his Bhaja Govindam (gēyaṃ gītā nāmasahasram). |
| **Proposed** | Of all the commentaries Sri Sankara wrote for our religious scriptures (the Bhagavad Gita, the Brahma Sutras, etc.), **his commentary on the** Sri Vishnu Sahasranama Stotram was the foremost one. Sri Sankara emphasises the importance of reciting the Vishnu Sahasranama Stotram in his Bhaja Govindam (gēyaṃ gītā nāmasahasram). |
| **Why** | The subject of "was the foremost one" is the stotram itself, which makes it one of Sankara's commentaries. ¶5 ("Sri Adi Sankara's commentary is the earliest of them") shows the chapter is about his commentary on the stotram. The change adds four words and keeps "foremost" (not "first", which would be a different historical claim). The second sentence is unchanged. The approved ta/kn/hi/te translations already read it this way, so they would need no change. |

### ¶13 (item 4 of the list in ¶9–¶14, "These are:")

| | Text |
|---|---|
| **Original** | 4. Bhishma considers it the best and most accessible of all dharmas or the means to attain relief from all bondage. |
| **Proposed (owner's wording)** | 4. Bhishma considers it the best and most accessible of all dharmas, and the means to attain release from all bondage. |
| **Minimal alternative** | 4. Bhishma considers it the best and most accessible of all dharmas, and the means to attain relief from all bondage. |
| **Why** | The book's prologue gives these as two separate answers of Bhishma. One is which dharma is highest (prologue ¶11: "of all the dharmas … is the best"). The other answers question 5, by reciting which mantra one is "released from the bondage of the cycle of birth and death" (prologue ¶7). "or" lets the clause read as an alternative or as a gloss of "dharmas"; ", and" states both answers. "release" matches the prologue's "released from the bondage". The minimal alternative keeps the chapter's word "relief", also used in ¶14 ("relief from all sorrows"). The four approved translations kept the ambiguity, and would need the conjunction adjusted once the English is settled. |

### Other source concerns (separate; not proposed for change in this phase)

- **¶11 of the same chapter: "Sages such as Narada, the Alwars, and composers…"** This uses "Alwars" against the settled Āzhwār / Āzhwārs convention (Standard §6.1). A minimal correction is "the Āzhwārs". It awaits the owner's approval like ¶7 and ¶13.
- **`dhyana-shlokam` ¶3, Tamil verse.** मालाकॢप्तासन contains vocalic ḷ (ॢ). The Standard's §3.2 Tamil rules have no letter for it, and no approved Tamil in the corpus writes it (this is its only occurrence in all content). Tamil for this chapter is held until the owner sets the convention. One common reading writes ḷ as லு (மாலாக்லுப்தாஸன); the engine will not choose. This is an owner or scholar decision. Once it is decided, the rule goes into `scripts/translation/mechanical.ts` and the Standard's §3.2.
- **Pilot chapters:** source concerns raised by the pilot translators and reviewers are listed in the pilot report (`translation-work/sri-vishnu-sahasranaama-anubhavam/experiments/phase3-pilot/REPORT.md`).

## E. Decisions raised by the Phase 3 pilot (pending)

Details and evidence: `translation-work/sri-vishnu-sahasranaama-anubhavam/experiments/phase3-pilot/REPORT.md` §6 and §7.

| # | Decision | Evidence | Proposal |
|---|---|---|---|
| E1 | The Lord's pronoun and verb register | Round-1 defects in ta, kn and te; Divya Desam benchmark | **Decided 2026-10-31 for ta (அவர், honorific), te (ఆయన, singular verbs) and hi (honorific); in the prompt card.** **kn decided 2026-10-31:** retain the established singular ಅವನು / ಭಗವಂತನು of approved Kannada devotional prose, with honorific forms allowed contextually; no global pronoun substitution and no Tamil/Telugu conventions imposed. |
| E2 | `Sri Bhattar` glossary lines | hi भट्टर 10× in the pilot vs approved श्री भट्ट 53×; te used two spellings | ஸ்ரீ பட்டர் / ಶ್ರೀ ಭಟ್ಟರ್ / श्री भट्ट / శ్రీ భట్టర్ (pilot `pending-terms.json`) |
| E3 | No restrictive or emphatic particles beyond the English | Added ஏ / ಏ / ही in 6 places across 3 chapters | **Decided 2026-10-31; in the prompt card's DOCTRINE section** |
| E4 | Telugu sages: plain glossary forms or honorific | వేదవ్యాసుడు / అగస్త్యుడు plain vs honorific in the drafts | Owner's choice |
| E5 | Tamil vocalic ḷ (`dhyana-shlokam` ¶3) | Only occurrence in the corpus; no precedent | Owner or scholar convention, then a rule in `mechanical.ts` and Standard §3.2 |
| E6 | 28 terms proposed by the pilot | `phase3-pilot/pending-terms.json` | Review with section B |
| E7 | 15 English-source concerns and 6 theological concerns | `phase3-pilot/source-concerns.json`; REPORT §7 | Owner settles the English; translations follow it |

## F. Standard §4 wording: reconciled (2026-10-31)

The owner directed that §4's "neither ornate nor literary" means not ornamented. Translations are dignified, traditional, scholarly, devotional, natural and accessible, with no unnecessary ornamentation, artificial archaism, colloquialism or embellishment, and fidelity always comes first. This is applied in `docs/TRANSLATION-GUIDE.md` §1.6, the prompt card's FIDELITY section and the reviewer packet. The PDF itself is outside the repository; the owner may want its §4 updated to match.

## G. Deferred: `content/README.md` correction

The stale `content/README.md` ("intentionally empty") was corrected in commit `aa88f50`. That correction is held back from the merge to `main`: any change under `content/` triggers `publish-ota-update.yml`, which publishes a production OTA update unconditionally. Ship the corrected text (in `aa88f50`) together with the next real content change, which publishes an update anyway.

