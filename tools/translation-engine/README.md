# Vedanta Yojana Translation Engine

A rulebook-governed **mechanical gate** for translations, under the owner's *Vedanta Yojana Translation Standard* (30 October 2026), with `docs/TRANSLATION-GUIDE.md` and the glossaries in `docs/translation-glossaries/`. No dependencies, network or API keys.

It reuses the existing converters and checks rather than re-implementing them: `scripts/translation/mechanical.ts` (verse, name-line and mantra generation from the Devanagari, Tamil Grantha rules), `scripts/translation/checks.ts` (script leaks, digits, gloss echo, punctuation) and `content-lib/sanskrit-script.ts` (`iastToScript`).

## Commands

From the repository root (Node 24):

```sh
# Read-only check; exit 1 on any blocking error
node tools/translation-engine/cli.ts check --book=<slug> [--chapter=<slug>] [--langs=ta,kn] [--require] [--warnings] [--json]

# Check a candidate file; English compared with --english, or the committed version of the same path
node tools/translation-engine/cli.ts check --file=<record.json> [--english=<record.json>]

# Convert every romanised verse / name line / mantra to the target script; writes only to --out
node tools/translation-engine/cli.ts repair-verses --file=<chapter.json> --out=<path>

# Record a passed mechanical gate in translation-work/<book>/certification.json; refuses on any error
node tools/translation-engine/cli.ts certify --book=<slug> --chapter=<slug>

npm run test:translation-engine
python3 tools/translation-engine/audit.py --book <slug>   # quick, dependency-free overview
```

## What blocks (errors)

| Rule | Standard | Meaning |
|---|---|---|
| `romanized-sanskrit` | §1.3, §3.1 | Latin/IAST left in a verse paragraph, or IAST words left in prose |
| `untranslated-english` | §1.1 | English left in a title, description, part title or paragraph |
| `devanagari-changed` | §3.1.1, §3.4 | the Devanagari verse block altered or dropped |
| `verse-script`, `verse-shape` | §3.1.2–4 | the transliterated verse not in the target script, or not line-for-line under its Devanagari |
| `tamil-grantha` | §3.2 | ś written ச (iastToScript's Sankalpam mode) instead of ஶ |
| `paragraph-parity` | §1.5, §4.1 | paragraphs merged or split |
| `note-marker` | §4.1 | the leading `*` of a highlighted note added or lost |
| `missing-field`, `missing-translation` | §2, §5 | title, description, part title or body missing once a language is started (`--require`: the language must exist) |
| `english-changed` | §1.2 | an English field, slug, order, status, images or resources changed |
| from `checks.ts` | §3 | script leaks, Devanagari inside target text, native digits, broken glyphs, gloss echo |

**Permitted Latin** (the only exceptions): list and section markers in marker shape (`(i)`, `a)`, `iii.ii)`), URLs (`prapatti.com`) and acronyms (`IAST`), each only if the same token is in the English being translated; and tokens reviewed into `latin-allowlist.json` (per book, or `"*"`). Every finding gives file, language, field and paragraph number (1-based, English numbering).

**Warnings** (to the human reviewer): `verse-drift` (a clean verse differs from the generated form, e.g. hand-spaced live Tamil), `verse-bars`, `verse-unverifiable`, `verse-layout` (English romanised verse not in the §3.1 layout, so it would be treated as prose: a freeze issue), `list-markers`, `line-count`, punctuation, Perso-Arabic Hindi, key order.

## Verse repair

`repair-verses` restores changed Devanagari from the English and replaces any romanised couplet, name line or mantra that is still in Latin letters with its generated form. It never touches prose, nor a verse already in the target script. A romanised-only verse in the Library "sh" spelling (§6.1) is **not** converted: "sh" may be ś or ṣ, and `iastToScript` would read it as स्ह. It is reported as unresolved, and stays blocked until the Devanagari or full IAST is supplied.

## Mechanical gate vs. review

`certify` records only that the mechanical gate passed. The ledger entry's `review.linguistic` and `review.theological` stay `"pending"` until a reviewer sets them. The tool never sets them, and resets them when the translated text changes. Script and structure checks cannot judge meaning, grammar, register, honorifics, glossary choice in context, or theology.

**No translation, commit to main, PR, OTA deployment or publication is performed by this engine.**
