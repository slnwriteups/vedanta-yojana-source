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

The tool performs script conversion, **not meaning translation**. Feed it only verified Sanskrit IAST; do not feed whole English chapter bodies. Keep the original Devanagari verse block untouched. Tamil requires a dedicated Grantha-assisted validation/postprocessing pass, notably ś → ஶ, and cannot be approved automatically. Tamil pāsurams must start from authoritative Tamil text, not Sanskrit IAST.

## Pilot acceptance criteria

1. Inventory the 116 English chapters and existing translations from `book.json` and chapter JSON; report actual counts instead of assuming the October 30 snapshot is current.
2. Compare `iastToScript` and Aksharamukha on representative nāmas, dative mantras, Sanskrit verses, and difficult conjuncts. Record discrepancies; never silently replace a verified form.
3. Translate **three representative chapters** into all four languages, using AI only for prose and qualified editorial review for theological fidelity.
4. Preserve one-to-one paragraphs, source Devanagari, existing translations, and English metadata; translate book/part/chapter titles.
5. Run `npm run test:content`, `npm run typecheck`, and the language quality checks. Flag rather than auto-fix uncertain verses or dative forms.
6. Open a separate reviewable PR for pilot translations; no deployment or What's New entry without owner approval.

## Licensing and operations

Aksharamukha is a separate optional local build-time dependency. Review its GPL-3.0 license before vendoring or distributing it within MIT-licensed code. Do not call the public API in bulk. ChatGPT Plus does not provide unlimited unattended API translation credits.
