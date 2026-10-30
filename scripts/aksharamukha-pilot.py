#!/usr/bin/env python3
"""Offline Aksharamukha transliteration pilot; never edits repository content.

Install: python -m pip install aksharamukha
Usage: python scripts/aksharamukha-pilot.py --text 'viśvam' --lang kn
       python scripts/aksharamukha-pilot.py --text 'viśvam' --lang ta --json
Sanskrit script conversion only: do not use this tool for prose translation,
Tamil pasurams, dative derivation, or authoritative Devanagari verse correction.
"""
import argparse
import json
import sys

TARGETS = {"ta": "Tamil", "kn": "Kannada", "hi": "Devanagari", "te": "Telugu"}

def convert(text: str, lang: str) -> str:
    try:
        from aksharamukha import transliterate
    except ImportError as exc:
        raise RuntimeError("Install optional dependency: python -m pip install aksharamukha") from exc
    # Aksharamukha's Tamil output is NOT automatically compliant with the
    # project's Grantha-assisted ś→ஶ convention; manual review is mandatory.
    return transliterate.process("IAST", TARGETS[lang], text)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", required=True, help="Verified Sanskrit IAST text")
    parser.add_argument("--lang", choices=TARGETS, required=True)
    parser.add_argument("--json", action="store_true", help="Print a JSON audit record")
    args = parser.parse_args()
    if not args.text.strip():
        parser.error("--text cannot be blank")
    try:
        output = convert(args.text, args.lang)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"source": args.text, "source_script": "IAST",
                          "language": args.lang, "output": output,
                          "requires_review": args.lang == "ta"}, ensure_ascii=False))
    else:
        print(output)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
