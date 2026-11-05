# Aksharamukha translation pilot — Sri Vishnu Sahasranaama Anubhavam

This is an **opt-in, non-destructive first step** toward the four-language workflow. It does **not** translate prose, modify chapter JSON, change English, or publish anything.

## Existing infrastructure to reuse

- `docs/TRANSLATION-GUIDE.md` and `docs/translation-glossaries/{ta,kn,hi,te}.md` are authoritative.
- `content-lib/sanskrit-script.ts` already implements `iastToScript`; compare its output before adopting Aksharamukha.
- `npm run translate:prep`, `translate:merge`, `translate:scaffold`, and `test:translations` already exist. Extend them instead of creating a competing content writer.
- Follow `docs/TRANSLATION-WORKFLOW.md` for existing batch handling.

## Local use

```bash
python -m pip install aksharamukha
python scripts/aksharamukha-pilot.py --text 'viśvam' --lang kn --json
python scripts/aksharamukha-pilot.py --text 'viśvam' --lang te --json
```

The tool performs script conversion, **not meaning translation**. Feed it only verified Sanskrit (IAST, or the Devanagari block with `--source deva`, which is the better source); do not feed whole English chapter bodies. Keep the original Devanagari verse block untouched. Aksharamukha's Tamil already writes ś as ஶ, but our house rules (ஸ்ரீ, ந/ன by position, class nasals, ஃ) still differ, so Tamil output cannot be approved automatically. Tamil pāsurams must start from authoritative Tamil text, not Sanskrit IAST.

The script maps the corpus's ē/ō to e/o (Aksharamukha's `IAST` scheme otherwise leaves them unconverted: `kṣētrajñaḥ` → `क्ष्ēत्रज्ञः`), passes `nativize=False` so word-final म् stays a consonant, and applies the Tamil post-options `TamilRemoveApostrophe`, `TamilRemoveNumbers` and `TamilOmDisable`.

## Cross-checking published verses

```bash
python scripts/aksharamukha-crosscheck.py                 # every book
python scripts/aksharamukha-crosscheck.py --book=nityasuri-vaibhavam --langs=ta
```

Read-only. It converts every Devanagari verse with Aksharamukha and compares it with the shipped script line, after normalising our documented conventions, and reports letter differences, missing verse lines and word-break-only differences. On 5 November 2026 it found 0 letter differences in the Sahasranaama book and 7 letter errors plus 1 paragraph shift elsewhere; all are fixed, and the check is now clean (details in `replica/recon.md`).

For ITRANS input, use the engine's own `node tools/translation-engine/cli.ts transliterate` (no Aksharamukha needed; see `tools/translation-engine/README.md`). The full recon of the API is also in `replica/recon.md`.

## Pilot acceptance criteria

1. Inventory the 116 English chapters and existing translations from `book.json` and chapter JSON; report actual counts instead of assuming the October 30 snapshot is current.
2. Compare `iastToScript` and Aksharamukha on representative nāmas, dative mantras, Sanskrit verses, and difficult conjuncts. Record discrepancies; never silently replace a verified form.
3. Translate **three representative chapters** into all four languages, using AI only for prose and qualified editorial review for theological fidelity.
4. Preserve one-to-one paragraphs, source Devanagari, existing translations, and English metadata; translate book/part/chapter titles.
5. Run `npm run test:content`, `npm run typecheck`, and the language quality checks. Flag rather than auto-fix uncertain verses or dative forms.
6. Open a separate reviewable PR for pilot translations; no deployment or What's New entry without owner approval.

## Licensing and operations

Aksharamukha is a separate optional local build-time dependency. Its Python package (2.3) is licensed **AGPL-3.0**: do not vendor it, bundle it into the app or website, or run it as a service. Do not call the public API (`https://aksharamukha-plugin.appspot.com/api/public?source=&target=&text=`) in bulk; it also ignores `nativize` and post-options, so it cannot produce house-style output. ChatGPT Plus does not provide unlimited unattended API translation credits.
