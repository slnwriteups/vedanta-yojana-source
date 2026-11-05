# Recon: Aksharamukha web API

Recon date: 5 November 2026. The question is how Aksharamukha works and
whether it can improve the Vedanta Yojana translation engine
(`tools/translation-engine/`, `scripts/translation/mechanical.ts`). It is not
a plan to clone a product. Aksharamukha is a library and an API, so the
"screens" below are its interfaces, and the "flows" are the ways we would
call it.

## Scope

| | |
|---|---|
| Target | Aksharamukha script converter: web API, Python package `aksharamukha` 2.3 |
| Slice | Sanskrit conversion from Devanagari/IAST to Devanagari, Kannada, Telugu and Tamil (Grantha-assisted), the four languages we publish |
| For | the owner's translation pipeline: verse blocks, name lines, mantras |

## Sources

| source | URL | what it gave |
|---|---|---|
| Web API page | https://www.aksharamukha.com/web-api | client-rendered page, no readable text without JS; endpoint confirmed by calling it |
| Public endpoint | `https://aksharamukha-plugin.appspot.com/api/public` | live behaviour, 3 single requests |
| Python package | https://pypi.org/project/aksharamukha/ (v2.3) | `process()` signature, option names, licence (installed locally, not vendored) |
| Python docs | https://www.aksharamukha.com/python | client-rendered, same as above |
| Source | https://github.com/virtualvinodh/aksharamukha-python | home page and licence |
| Our pilot | `docs/AKSHARAMUKHA-TRANSLATION-PILOT.md`, `scripts/aksharamukha-pilot.py`, `scripts/compare-sanskrit-converters.py` | what was already tried |

## Interfaces (the "screens")

| ID | interface | how to reach it | purpose | notes |
|---|---|---|---|---|
| S01 | Public GET endpoint | `GET /api/public?source=<Script>&target=<Script>&text=<urlencoded>` | one-off conversion over HTTP | returns plain text. **Ignores `nativize` and `postOptions`**: `भूतभृत् ॐ` → `பூ⁴தப்⁴ருʼத் ௐ` with or without them. Shared free service, no published rate limit or SLA |
| S02 | Python `transliterate.process` | `process(src, tgt, txt, nativize=True, post_options=[], pre_options=[], param="default")` | full conversion with options, offline | `param` can be `script_code` / `lang_code` / `lang_name` to pass ISO codes instead of names |
| S03 | Python `auto_detect` | `auto_detect(text)` | guesses the source script | `विश्वम्`→Devanagari, `viśvam`→IAST, `விஶ்வம்`→Tamil |
| S04 | Web app | https://www.aksharamukha.com | interactive converter, all options as toggles | human use only |
| S05 | `getOptions(script)` | Python | meant to list the options for a script | **unimplemented in 2.3** (returns `None`); options are found from `PostProcess.py` / `PreProcess.py` function names |

## Flows

```
F01 Convert a verse for publication (what our engine does today)
    Devanagari verse block -> process("Devanagari", <target>, nativize=False, post_options) -> house-style fixes
    edge: avagraha, ॐ, word-final म्, homorganic nasals, Tamil ந/ன, श्री

F02 Convert from a romanised line
    corpus IAST (with ē/ō) -> map ē/ō to e/o -> process("IAST", ...)
    edge: source "ISO" would handle ē/ō but reads ṛ as a different letter; our text mixes both schemes

F03 Cross-check what is already published (the use that pays off)
    for every Devanagari verse: convert -> pair with the shipped script line -> normalise house conventions -> diff
```

## Options that matter for us

| option | kind | effect | use? |
|---|---|---|---|
| `nativize=False` | flag | keeps word-final म् as ಮ್/మ్ (default True turns it into anusvara ಪರಂ) | yes, matches our corpus |
| `TamilRemoveNumbers` | post | drops superscript aspiration numerals பூ⁴த → பூத | yes |
| `TamilRemoveApostrophe` | post | drops ʼ markers | yes |
| `TamilOmDisable` | post | ௐ → ஓம் | yes |
| `TamilpredictDentaNa` | post | guesses ந vs ன | no: its rule differs from ours (`tamilDentalN`) |
| `TamilGranthaVisarga` | post | visarga as Grantha 𑌃 | no: house style is ஃ (a plain replace of ꞉) |
| `TamilSHADisable`, `TamilDisableSHA` | post | write ś without ஶ | no: house style is ஶ |
| `KannadaNakaraPollu`, `TeluguNakaraPollu`, `TeluguReph`, `KannadaNotRepha` | post | regional orthography variants | not needed today |

Tamil output already writes ś as **ஶ** by default (`viśvam` → `விஶ்வம்`).
The earlier pilot note that "Aksharamukha's Tamil output is not compliant
with ś → ஶ" is wrong.

## Data model (inferred)

```
Conversion  source_script (name | ISO 15924 | language code), target_script, text,
            nativize: bool, pre_options: [name], post_options: [name]
            evidence: process() signature, transliterate.py; confidence: high
Script      name ("Devanagari", "Tamil", "TamilExtended", "Grantha", "IAST", "ISO", "HK", "ITRANS", …), ~120 scripts
            evidence: ScriptMap/ folder; confidence: high
Option      a function name in PreProcess.py / PostProcess.py, applied in list order
            evidence: source; confidence: high
```

## Measured against our content

`scripts/aksharamukha-crosscheck.py` converts every Devanagari verse in
`content/library` with Aksharamukha and compares it with the shipped Hindi,
Kannada, Telugu and Tamil lines, after normalising our documented house
conventions. Results on 5 November 2026:

| | verses | words | letter disagreements | word-break only | verse line missing |
|---|---|---|---|---|---|
| hi | 280 | 2381 | 0 | 2 | 1 |
| kn | 280 | 2385 | 1 | 4 | 1 |
| te | 287 | 2499 | 1 | 10 | 0 |
| ta | 280 | 2384 | 5 | 4 | 1 |

Sri Vishnu Sahasranaama Anubhavam (264 verses, generated by our
`mechanical.ts`) has **zero** letter disagreements in all four languages.
Our converter and Aksharamukha agree on every letter, and the only
differences are house conventions. Every letter disagreement is in content
translated before or outside that engine:

All of these were fixed on 5 November 2026 (see "Fixed" below).

| chapter | lang | shipped | Devanagari / expected | issue |
|---|---|---|---|---|
| nityasuri-vaibhavam/the-sudarsana-ashtakam ¶12 | ta | ஸத்**கு**ண | सद्**ग**ण → ஸத்கண | wrong vowel (guṇa for gaṇa) |
| same ¶14 | ta | ஜனிதமி**ஶ்**ரா | जनितमि**स्**रा → …மிஸ்ரா | ś for s |
| same ¶16 | ta | த்ரு**த**தயா | दृ**ढ**दया → த்ருடதயா | dental for retroflex |
| same ¶18 | ta | ஷடர**க**சக்ர, ஸகலதத்**வ** | षडरचक्र, सकलतत्**त्व** | extra க; lost த் |
| same ¶20 | ta, kn | ஶமிதவி**ஶ்**வக், ಶಮಿತವಿ**ಶ್**ವಗ್ | शमितवि**ष्**वग् | ś for ṣ (followed the loose romanisation "vishvag"; te and hi have ṣ) |
| untitled-recovered…/varaha-charama-shlokam ¶4 | hi, kn, ta | prose | the romanised verse line | romanised verse paragraph missing; the following prose moved up a slot |
| same ¶5 | te | మామ్ అజమ్ | मामजं | anusvara written as ಮ್ while splitting words |

Word-break-only findings (वस्तत्परं shown as वस्तत् परं, pada-split Telugu
in the invocations) are reported for information and do not fail the check.

## Fixed (5 November 2026)

- Sudarsana Ashtakam: the 7 letters above in Tamil and Kannada, plus the two
  defects the engine's baseline already listed in the same chapter (a Devanagari
  ऽ in Tamil ¶22, a Kannada ಽ in the kept Devanagari of Kannada ¶21). The space
  in நிகிலஶக்தே ஜகன்மய is restored to match the Devanagari.
- Varaha Charama Shlokam: the missing romanised verse paragraph restored in
  hi/kn/ta from the Devanagari with the engine's own `generate()`, the split
  prose paragraph rejoined (paragraph parity with the English), the Telugu
  verse line regenerated from the Devanagari (it had been typed from the
  hyphenated IAST, మామ్ అజమ్ for मामजं), and the Devanagari block that kn/ta/te
  had converted to their own scripts restored with `repair-verses`.
- `baseline.json` pruned of the 5 fixed entries; `REMEDIATION.md` updated.
  The cross-check now reports 0 letter differences and 0 missing verse lines.
- Not changed: the English ¶5 of the Varaha chapter still lacks `|` / `||`
  (`source-verse-layout`, an owner decision on the English), and the
  Sudarsana Ashtakam's English romanisation still writes `sh` for both ś and
  ṣ (vishvag for विष्वग्), which is how the Kannada and Tamil error crept in.

## ITRANS (added 5 November 2026)

Aksharamukha reads and writes ITRANS. Instead of depending on it, the engine
now has its own `scripts/translation/itrans.ts` (ITRANS → Devanagari, no
dependencies) and a `transliterate` command, so a verse copied from an ITRANS
source goes through the same rules as everything else. Aksharamukha served as
the oracle: it wrote all 176 Devanagari verse paragraphs in the Library as
ITRANS, and every one converts back to exactly the published Devanagari. Two
places where Aksharamukha's ITRANS departs from the standard are documented in
the fixture: ॐ written `oM` (the standard's `OM`; `oM` is ओं), and र्ऋ written
`rR^i` (which is रृ; the standard spelling is `r_R^i`).

## What it cannot do (skip)

| what | why |
|---|---|
| translate meaning | it is a script converter only; prose translation stays with the chat workflow and review |
| Tamil pāsurams | they start from authoritative Tamil, not Sanskrit |
| decide house style | ந/ன, ஸ்ரீ, class-nasal anusvara, gemination after ர் are our editorial choices |
| validate the Devanagari itself | garbage in, garbage out; the Devanagari block remains the authority |
| run in the app or website | AGPL-3.0, Python, and the public endpoint is a shared free service; keep it a local, optional, build-time tool |

## Size

No clone is needed. Our `mechanical.ts` already matches Aksharamukha
letter for letter on the scripts we publish, so rebuilding it would gain
nothing. Size of the useful part: **S**. That is one read-only cross-check
script (done) plus a decision on whether CI should run it.

## How it improves the translation engine

1. **Independent oracle (done).** `scripts/aksharamukha-crosscheck.py` is a
   differential test: two independent converters that agree are strong
   evidence that a verse is right. It already found 7 letter errors and 1
   paragraph shift in published translations that the existing rule gates
   (`tamil-grantha`, `verse-script`, `paragraph-parity`) could not catch,
   because those gates check the script and the shape, not the letters.
2. **Pilot script fixed (done).** `scripts/aksharamukha-pilot.py` declared
   `IAST` while our text writes ē/ō, so `kṣētrajñaḥ` came out `क्ष्ēत्रज्ञः`.
   It now maps ē/ō, uses `nativize=False` and the Tamil options, and
   accepts Devanagari (`--source deva`). Differences from `mechanical.ts` on
   the comparison set fell from 28 to 3, and all 3 are documented
   conventions.
3. **Next, if the owner wants:**
   - fix the 7 Sudarsana Ashtakam / Varaha errors (content change: goes
     through linguistic review);
   - run the cross-check in the `translate:merge` path or as an optional CI
     job (needs `pip install aksharamukha` in CI; AGPL is fine for a tool we
     run but do not distribute);
   - use `auto_detect` + `process(<script>, "Devanagari")` to bring
     owner-supplied Telugu/Kannada/Tamil-Grantha source texts into
     Devanagari for `source-material/`;
   - if a fifth language is ever added (Malayalam, Bengali, Gujarati, Odia,
     Grantha), Aksharamukha covers the verse conversion on day one.
