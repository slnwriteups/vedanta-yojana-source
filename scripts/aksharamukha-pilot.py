#!/usr/bin/env python3
"""Offline Aksharamukha transliteration pilot; never edits repository content.

Install: python -m pip install aksharamukha
Usage: python scripts/aksharamukha-pilot.py --text 'viśvam' --lang kn
       python scripts/aksharamukha-pilot.py --text 'viśvam' --lang ta --json
       python scripts/aksharamukha-pilot.py --text 'विश्वम्' --source deva --lang te
Sanskrit script conversion only: do not use this tool for prose translation,
Tamil pasurams, dative derivation, or authoritative Devanagari verse correction.
"""
import argparse
import json
import sys

TARGETS = {"ta": "Tamil", "kn": "Kannada", "hi": "Devanagari", "te": "Telugu"}
SOURCES = {"iast": "IAST", "deva": "Devanagari"}
# Tamil output: drop the superscript aspiration numerals (பூ⁴த -> பூத) and
# apostrophes, write ॐ as ஓம். ś is already ஶ (Grantha-assisted) by default.
TAMIL_OPTIONS = ["TamilRemoveApostrophe", "TamilRemoveNumbers", "TamilOmDisable"]


def corpus_iast(text: str) -> str:
    """This corpus writes long ē/ō (ISO 15919) inside otherwise IAST text.
    Aksharamukha's IAST scheme leaves ē/ō unconverted and its ISO scheme reads
    ṛ differently, so map to plain IAST, where e/o are already long."""
    return text.replace("ē", "e").replace("ō", "o").replace("Ē", "E").replace("Ō", "O")


def convert(text: str, lang: str, source: str = "iast") -> str:
    try:
        from aksharamukha import transliterate
    except ImportError as exc:
        raise RuntimeError("Install optional dependency: python -m pip install aksharamukha") from exc
    if source == "iast":
        text = corpus_iast(text)
    # nativize=False keeps word-final म् as a consonant (ಪರಮ್, not ಪರಂ), as the corpus does.
    out = transliterate.process(SOURCES[source], TARGETS[lang], text, nativize=False,
                                post_options=TAMIL_OPTIONS if lang == "ta" else [])
    # House style still differs on documented points (TRANSLATION-GUIDE, mechanical.ts):
    # Tamil ஃ for visarga, ஸ்ரீ, ந/ன by position, class nasals for anusvara;
    # Kannada/Telugu anusvara for a homorganic nasal. Review before use.
    return out.replace("꞉", "ஃ") if lang == "ta" else out

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", required=True, help="Verified Sanskrit text (IAST, or Devanagari with --source deva)")
    parser.add_argument("--source", choices=SOURCES, default="iast")
    parser.add_argument("--lang", choices=TARGETS, required=True)
    parser.add_argument("--json", action="store_true", help="Print a JSON audit record")
    args = parser.parse_args()
    if not args.text.strip():
        parser.error("--text cannot be blank")
    try:
        output = convert(args.text, args.lang, args.source)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"source": args.text, "source_script": SOURCES[args.source],
                          "language": args.lang, "output": output,
                          "requires_review": args.lang == "ta"}, ensure_ascii=False))
    else:
        print(output)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
