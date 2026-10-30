# Editorial decisions pending the owner

Prepared 2026-10-30 for the owner's review. **Nothing here has been applied.** The glossaries, the English and every published translation are unchanged. Usage counts come from the live `translations.ta` / `translations.te` text in `content/`, inflected forms included.

## 1. Tamil glossary conflicts

`ta.md:423` already records the author's direction:

> Principle (author's direction): Tamil follows the Tamil roots (அனுமன், வினதை, அரக்கர், அந்தணர்).

Lines 419–422 implement it. The earlier lines it supersedes were never removed, so the glossary contradicts itself:

| Term | Older line | Later line (author's principle) | Live Tamil usage | Recommendation |
|---|---|---|---|---|
| Hanumān | `ta.md:53` ஹனுமான் | `ta.md:419` அனுமன் ("book form; not ஹனுமான்") | அனுமன் **120** (Sri Rāma Charithram 116, three Divya Desam records, Temples and Festivals 1); அனுமான் 4 (JAYA 2, Visishtadvaita book 2); ஹனுமான் **0** | Canonical **அனுமன்**. Remove or annotate line 53. The 4 அனுமான் are older variants: leave them, or list them for remediation. |
| Vinatā | `ta.md:122` விநதை | `ta.md:420` வினதை | வினதை **33** (Divya Desam records 23, Nityasūri Vaibhavam 10); விநதை **0** | Canonical **வினதை**. Remove line 122. |
| rākshasas | `ta.md:417` ராக்ஷசர்கள் | `ta.md:421` அரக்கர்கள் | அரக்க- **162** (Divya Desams, Sri Rāma Charithram 93, JAYA 15, Bhāgavatam 16); ராட்சச- 19 and ராக்ஷச- 9 (Sri Rāma Charithram, in names and singular ராட்சசன்/ராக்ஷசி) | Canonical **அரக்கர்(கள்)** for the people in general. Decide whether the singular ராக்ஷசன் / ராக்ஷசி stays acceptable where the English names one. |
| Brāhmaṇas | `ta.md:177` "Brāhmaṇas / Āraṇyakas = பிராமணங்கள் / ஆரண்யகங்கள்" (**the Vedic texts**) | `ta.md:284` and `ta.md:422` அந்தணர் / அந்தணர்கள் (**the people**) | Texts: பிராமணங்கள் (1). People: பிராமணர்- about **60** (JAYA, Bhāgavatam, Visishtadvaita book, Divya Desams); அந்தணர்- **10** (Āzhwār Vaibhavam) | **Not a real conflict.** Line 177 is the texts and line 422 the people; the engine merged them because matching ignores case. Proposed: add "(texts)" to line 177 and "(people)" to line 422. For the people, the principle says அந்தணர், yet most live text uses பிராமணர். Decide whether the principle governs new work only (recommended: existing text unchanged) or calls for remediation. |

## 2. Lines still headed "(new terms; review)"

These were appended automatically by the old merge step during Sahasranāma batch 1. There are 33 lines (11 each in ta, kn and te), which split into 36 terms because "Vedavyasa / Vyasa" is two. They remain pending: the engine treats them as non-binding and they can never block on their own. They are listed in the same order in each file:

| English | ta (`ta.md:438–448`) | kn (`kn.md:399–409`) | te (`te.md:323–333`) |
|---|---|---|---|
| Bhishma | பீஷ்மர் | ಭೀಷ್ಮ | భీష్ముడు |
| Yudhishthira | யுதிஷ்டிரன் | ಯುಧಿಷ್ಠಿರ | యుధిష్ఠిరుడు |
| Vedavyasa / Vyasa | வேதவியாசர் / வியாசர் | ವೇದವ್ಯಾಸ / ವ್ಯಾಸ | వేదవ్యాసుడు / వ్యాసుడు |
| Sri Parasara Bhattar | ஸ்ரீ பராசர பட்டர் | ಶ್ರೀ ಪರಾಶರ ಭಟ್ಟರ್ | శ్రీ పరాశర భట్టర్ |
| Sri Adi Sankara | ஸ்ரீ ஆதி சங்கரர் | ಶ್ರೀ ಆದಿ ಶಂಕರ | శ్రీ ఆది శంకరులు |
| stotram | ஸ்தோத்திரம் | ಸ್ತೋತ್ರ | స్తోత్రం |
| Phala Shruti | பலஸ்ருதி | ಫಲಶ್ರುತಿ | ఫలశ్రుతి |
| Narayaneeyam | நாராயணீயம் | ನಾರಾಯಣೀಯಂ | నారాయణీయం |
| Bhaja Govindam | பஜ கோவிந்தம் | ಭಜ ಗೋವಿಂದಂ | భజ గోవిందం |
| anushtup | அனுஷ்டுப் | ಅನುಷ್ಟುಪ್ | అనుష్టుప్ |
| pārāyaṇam (chanting) | பாராயணம் | ಪಾರಾಯಣ | పారాయణం |

Points to check before approving:
- **Honorifics.** ta has பீஷ்மர் honorific but யுதிஷ்டிரன் plain, and kn has ಭೀಷ್ಮ but ವ್ಯಾಸರು in the prompt card. The independent reviewers of the experiment found this consistent with approved chapters.
- **Hindi.** These terms are not in this section because Hindi's Sahasranāma terms were added under its own headers (`hi.md:386` onward), which are not marked for review.

To approve: change each header from "(new terms; review)" to "(owner-approved <date>)". The engine then treats the lines as binding.

## 3. Telugu Sītā (`te.md:305`)

The glossary line `Sri Rāma / Lakshmaṇa / Sītā = శ్రీరాముడు / లక్ష్మణుడు / సీతాదేవి` gives only the honorific compound.

**Usage (Telugu, all content).**
- Plain base and inflections: సీత 219, సీతను 85, సీతకు 15, సీతపై 7, సీతతో 2, and so on.
- సీతాదేవి and its inflections: **7**.
- Compounds such as సీతాపహరణం and సీతారాములు: 4.
- 337 of the occurrences are in Sri Rāma Charithram.

**Grammar.** సీత is the nominative. Its oblique forms (సీతను, సీతకు, సీతతో, సీతపై) follow the regular -అ feminine declension. సీతాదేవి is an honorific compound, used in reverent address and in the Divya Desam records.

**Other languages.** The narrative base is plain in all of them: ta சீதை, kn ಸೀತೆ, hi सीता.

**Recommendation.** The 213 paragraphs follow settled, grammatical usage. The glossary line is narrower than the books. Make the glossary support both forms, for example:

```
Sītā = సీత (oblique సీతను / సీతకు; honorific సీతాదేవి)
```

The engine already reads annotation forms as accepted, so this would make both forms approved and clear the 213 drift warnings. No translation would change.

## 4. English source concerns: `sri-vishnu-sahasranaama-anubhavam / composition-of-the-stotram`

| ¶ | Original | Proposed correction | Reasoning |
|---|---|---|---|
| 7 | "Of all the commentaries Sri Sankara wrote for our religious scriptures (the Bhagavad Gita, the Brahma Sutras, etc.), Sri Vishnu Sahasranama Stotram was the foremost one." | **Option A:** "Of all the commentaries Sri Sankara wrote on our religious scriptures (the Bhagavad Gita, the Brahma Sutras, etc.), his commentary on the Sri Vishnu Sahasranama Stotram was the foremost one." **Option B:** "…, his commentary on the Sri Vishnu Sahasranama Stotram was the first." | As written, the sentence makes the stotram one of Sankara's commentaries. The approved translations silently read it as "his commentary on it". The experiment's translator followed it literally and flagged it, and both reviewers raised it. ¶5 of the same chapter says Sankara's commentary "is the earliest" of the stotram's commentaries. Whether ¶7 means *foremost* (A) or *first among his own commentaries* (B) is the author's claim to settle; the engine does not guess. |
| 13 | "4. Bhishma considers it the best and most accessible of all dharmas or the means to attain relief from all bondage." | "4. Bhishma considers it the best and most accessible of all dharmas, and the means to attain release from all bondage." | The book's prologue gives these as separate questions. One asks which dharma is highest (prologue ¶11: "of all the dharmas … is the best"). Question 5 (prologue ¶7) asks by reciting which mantra man is released from the bondage of birth and death. "Or" lets readers take them as alternatives or as one gloss, and the four translations kept the ambiguity. "And" states both answers. "Release" matches the prologue's wording. |

The same chapter's experiment raised one more point, which is not a defect: ¶12 calls Vedavyasa an incarnation of Vishnu. The reviewers listed it for the owner's note, and it is rendered faithfully.

## 5. Terms proposed in the controlled experiment (pending, not in any glossary)

These are from `translation-work/sri-vishnu-sahasranaama-anubhavam/experiments/exp-2026-10-30/pending-terms.json`. They stay pending. Because they came from an experiment, they are not in the book's real pending list either.

| English (as proposed) | ta | kn | hi | te | Note |
|---|---|---|---|---|---|
| meter (chandas) | சந்தஸ் | ಛಂದಸ್ಸು | छंद | ఛందస్సు | New. ta சந்தஸ் versus the more usual யாப்பு / சந்தம்: owner choice. |
| Dvaita school | த்வைத சம்பிரதாயம் | ದ್ವೈತ ಸಂಪ್ರದಾಯ | द्वैत संप्रदाय | ద్వైత సంప్రదాయం | hi has `Dvaita = द्वैत` already. "school" as சம்பிரதாயம் / संप्रदाय is consistent. |
| Alwars | ஆழ்வார்கள் | ಆಳ್ವಾರರು | आळ्वार | ఆళ్వారులు | **Duplicate**: the glossaries already have Āzhwār / Āzhwārs. The English here spells it "Alwars". Reject as a term; consider whether the Sahasranāma English should use the settled "Āzhwārs" (Standard §6.1). |
| composers (vaggeyakaras) | வாக்கேயக்காரர்கள் | ವಾಗ್ಗೇಯಕಾರರು | वाग्गेयकार | వాగ్గేయకారులు | New. The blind comparison preferred these to the approved generic "composers" (இசையமைப்பாளர்கள், रचनाकार). |
| Mother Ganga | அன்னை கங்கை | ಗಂಗಾ ಮಾತೆ | माता गंगा | గంగా మాత | New. Check against the Divya Desam records' river names. |
| Vedas (te) | | | | వేదాలు | Te only, filling a gap (ta/kn/hi have Vedas). The key is malformed: "(te)" belongs on the target side. If approved, write `Vedas = వేదాలు`. |
