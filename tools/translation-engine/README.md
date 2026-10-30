# Vedanta Yojana Translation Engine

The rulebook gate for translations into Tamil, Kannada, Hindi and Telugu, under the owner's *Vedanta Yojana Translation Standard* (30 October 2026), `docs/TRANSLATION-GUIDE.md` and the glossaries in `docs/translation-glossaries/`. No dependencies, network, API keys or paid services.

It builds on the existing workflow rather than replacing it: `scripts/translation-prep.ts` and `scripts/translation-merge.ts` (`docs/TRANSLATION-WORKFLOW.md`) call it, and it reuses `scripts/translation/mechanical.ts` (verse, name-line and mantra generation), `scripts/translation/checks.ts` (script checks) and `content-lib/sanskrit-script.ts` (`iastToScript`).

## The process

```
English frozen ─▶ prep ─▶ chat translates prose ─▶ merge ─▶ content/ ─▶ review packet ─▶ independent review ─▶ owner theological approval ─▶ READY
 (checkEnglish)    │        (verses never sent)      │  rejects faulty paragraphs,        (record-review)        (approve-theology,
                   │                                 │  checks the whole chapter,                                  owner at a terminal)
                   └ holds chapters with             │  fills only missing fields,
                     unsettled English               └  new terms → pending-terms.json
```

1. **Freeze check.** Prep refuses chapters whose English has placeholder text, `migration.needsReview`, or verse blocks that cannot be generated without guessing (Standard §6.3).
2. **Prep and merge**, in batches of up to 3 chapters (`docs/TRANSLATION-WORKFLOW.md`). Merge requires `--translator=<label>`.
3. **Mechanical gate**: `check` (and CI) run every rule below.
4. **Linguistic review** by someone other than the translator: `review-packet`, then `record-review`.
5. **Theological approval** by the owner: `approve-theology`.
6. **Status**: `status` shows READY, or exactly what is missing.

## Commands

From the repository root. In VS Code, use the integrated terminal (Terminal ▸ New Terminal). Node 24, as `.nvmrc`.

```sh
node tools/translation-engine/cli.ts check --book=<slug> [--chapter=<slug>] [--langs=ta,kn] [--warnings]
node tools/translation-engine/cli.ts check --changed            # what CI runs on a pull request
node tools/translation-engine/cli.ts check --file=<candidate.json> --english=<record.json>   # --candidate to check an experiment candidate
node tools/translation-engine/cli.ts repair-verses --file=<chapter.json> --out=<path>
node tools/translation-engine/cli.ts glossary                   # glossary conflicts awaiting the owner
node tools/translation-engine/cli.ts terms --book=<slug>        # proposed terms pending approval
node tools/translation-engine/cli.ts review-packet --book=<slug> --chapter=<slug> --lang=te
node tools/translation-engine/cli.ts record-review --book=<slug> --reply=<reply.json>
node tools/translation-engine/cli.ts status --book=<slug> [--chapter=<slug>]
node tools/translation-engine/cli.ts certify --book=<slug> --chapter=<slug>
node tools/translation-engine/cli.ts remediation                # rewrites REMEDIATION.md
npm run test:translation-engine

# Owner only, at their own terminal (refused in agent sessions, CI and non-interactive shells):
node tools/translation-engine/cli.ts approve-theology --book=<slug> --chapter=<slug> --lang=te
node tools/translation-engine/cli.ts approve-terms --book=<slug>
```

## What blocks

| Rule | Standard | Meaning |
|---|---|---|
| `romanized-sanskrit` | §1.3, §3.1 | Latin/IAST left in a verse paragraph, or IAST words left in prose |
| `untranslated-english` | §1.1 | English left in a title, description, part title or paragraph |
| `devanagari-changed` | §3.1, §3.4 | the Devanagari verse block altered or dropped |
| `verse-script`, `verse-shape`, `tamil-grantha` | §3.1–3.2 | verse not in the target script, not line-for-line under its Devanagari, or ś as ச in Tamil |
| `paragraph-parity`, `note-marker` | §1.5, §4.1 | paragraphs merged or split; the `*` of a note added or lost |
| `missing-field`, `missing-translation` | §2, §5 | a title, description, part title or body missing |
| `english-changed` | §1.2 | an English field, slug, order, status, images or resources changed |
| `glossary-wrong-variant` | §1.4 | a form the glossary forbids (`not …` / `never …`) |
| `source-*` | §6.3 | English placeholder, `needsReview`, verse block that cannot be generated, romanised verse not in the §3.1 layout |
| from `checks.ts` | §3 | script leaks, Devanagari inside target text, native digits, broken glyphs, gloss echo |

**Permitted Latin**: list and section markers in marker shape (`(i)`, `a)`, `iii.ii)`), URLs and acronyms, each only when the same token is in the English; plus tokens reviewed into `latin-allowlist.json`. Every finding names file, language, field and paragraph (1-based, English numbering).

**Warnings** go to the reviewer: verse drift from the generated form (hand-spaced live verses), glossary terms not found, list markers, punctuation, Perso-Arabic Hindi.

## Glossary enforcement (`glossary.ts`)

Each glossary line becomes a rule: accepted forms (including `pl.`, `oblique`, `vocative`, `gen.`, `address:` and `record form` annotations), verse forms (`verse: …`), and wrong forms (`not …`, `never …`). A book's own `# --- <book>` section adds forms for that book.

- **Inflection.** A form matches if it, or its stem, starts a word in the translation (`భీష్ముడు` → `భీష్ముని`, `ಭೀಷ್ಮ` → `ಭೀಷ್ಮನ`, `மோக்ஷம்` / `मोक्षम्` → `मोक्ष`).
- **Severity.** Only an explicit wrong form blocks. A missing form is a warning, because a pronoun or paraphrase may stand for the term. Lines under "reviewer's preferences", and the senses in `glossary-config.json` ("Lord"), are preferences.
- **Not settled here.** Conflicting lines (e.g. Tamil Hanumān at `ta.md:53` vs `ta.md:419`) never block; `glossary` and `REMEDIATION.md` list them as owner decisions. Lines under headers still marked "(new terms; review)" cannot block on their own.
- **New terms.** Proposed terms go to `translation-work/<book>/pending-terms.json`, and only `approve-terms` (owner) writes them into a glossary.

## Historical defects (`baseline.json`)

`baseline.json` records the blocking errors that were already in published content: 142 when it was created. Each entry pins file, language, field, paragraph, rule and a fingerprint of the text it was found in.

- **What it excuses.** Those errors are listed as `known` and do not fail unrelated work. Every new error blocks.
- **Editing ends the excuse.** Editing the text an entry was found in voids that entry, so the edit must fix the defect.
- **Fixed entries.** A fixed defect leaves a `stale` entry. `baseline --prune` removes stale entries, and nothing adds entries after `baseline --init`, which refuses once the file exists.
- **Remediation.** `REMEDIATION.md` lists every entry by book.

A chapter with a known defect is never READY.

## Review and certification (`review.ts`)

`translation-work/<book>/certification.json` holds, per `<chapter>.<lang>`:
- `mechanical`: written by `certify`;
- `linguistic`: written by `record-review`, with any `advisory` AI reviews alongside;
- `theological`: written by `approve-theology`.

Each record stores the text hash it saw. Any change to the English or the translation voids it.

- **Review packets.** A packet gives each paragraph's English and translation, the glossary terms it uses, the mechanical findings, and up to two approved examples of the same terms from other chapters (cached in `translation-work/.cache/`). It never includes the chapter's own translations.
- **Recording a review.** A review is refused if it was written for other text, if it is incomplete, or if the reviewer's label matches the translator's. A blocking paragraph or a failed check records "changes-requested".
- **AI reviews.** An AI review is advisory input. It can stand as the linguistic review, but it never records theological approval, and it never displaces a human decision on the same text.
- **Theological approval** needs all of the following:
  - an approved linguistic review of the exact text;
  - an interactive terminal with no agent or CI environment;
  - a git identity listed as owner in `reviewers.json`;
  - a typed confirmation.
  
  This prevents accidental or agent approval. It is not a security boundary against hand-editing the ledger, so the ledger is committed and reviewed in pull requests like everything else.

**READY** means: no blocking error at all; linguistic review approved; theological approval by an owner; book title, description and part titles present in that language. All of these must apply to the current text.

## Experiments

`--experiment=<name> --chapter=<slug>` on prep and merge re-translates one chapter in `translation-work/<book>/experiments/<name>/`, without showing its live translations.
- Candidates are written to `candidates/` with an `_experiment` marker, never to `content/`.
- Merge refuses a batch whose experiment mode doesn't match its manifest.
- A marked record fails `check` (`experimental-candidate`) unless `--candidate` is given.

The first controlled experiment and its findings are in `translation-work/sri-vishnu-sahasranaama-anubhavam/experiments/exp-2026-10-30/REPORT.md`. Owner decisions still pending are in `EDITORIAL-REVIEW.md`.

## Limits

- **No judgement of meaning.** Script and structure checks cannot judge meaning, register or theology. That is the review's job.
- **Glossary misses are only a signal.** A missing glossary form may be a correct paraphrase.
- **Tamil pāsurams (§3.3):** generating pāsuram text into kn/hi/te from the Tamil is not implemented; their mappings are partly undocumented ("per model file").
- **Library only.** Divya Desams, Knowledge, What's New and interface strings are not checked by this engine.
