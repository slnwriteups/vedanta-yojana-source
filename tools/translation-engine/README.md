# Vedanta Yojana Translation Engine — phase 1

This directory begins a **rulebook-led, read-only audit**, not a finished automatic translation platform.

## Run on macOS

From the repository root:

```sh
python3 tools/translation-engine/audit.py --book sri-vishnu-sahasranaama-anubhavam
python3 tools/translation-engine/audit.py --json > translation-audit.json
```

No dependencies or API keys are required. The audit **does not change content**.

## Governing standard

The owner's *Vedanta Yojana Translation Standard* (30 October 2026) is authoritative. Relevant repository references: `docs/TRANSLATION-GUIDE.md`, `docs/translation-glossaries/{ta,kn,hi,te}.md`, and `content-lib/sanskrit-script.ts`.

Core rules: preserve English, one paragraph per paragraph, preserve original Devanagari, transliterate verses rather than translate them, honor glossary forms, and translate all reader-visible metadata. New terminology must be approved and added to the glossary. Do not publish without owner approval.

**Audit limitations:** Script and structure checks cannot certify translation meaning, theological accuracy, or natural grammar. The source PDF's Sanskrit verse-layout requirements need integration with existing repository-specific verse scripts before automatic imports are safe. The audit flags existing missing translations; a nonzero exit code is expected until completion.

## Planned next phases

1. Freeze check and deterministic Sanskrit generation using existing scripts.
2. Translation memory built only from approved content.
3. Resumable Claude/Gemini job exchange through supported subscription interfaces; no paid API assumed.
4. Independent AI review, glossary change approval, full quality checks.
5. Three-chapter commits (per rulebook), completed-batch PRs with owner approval.
6. Mac-hosted dashboard accessible from iPad on a trusted network.

**No translation, commit to main, PR, OTA deployment, or production publication is performed by this audit.**
