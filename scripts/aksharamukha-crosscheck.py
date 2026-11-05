#!/usr/bin/env python3
"""Cross-check shipped verse transliterations against Aksharamukha. Read-only.

Our mechanical converter (scripts/translation/mechanical.ts) is hand-written.
Aksharamukha is an independent, widely used implementation of the same
Devanagari -> Kannada/Telugu/Tamil mappings, so agreement between the two is
strong evidence that a verse is converted correctly, and any letter-level
disagreement is worth a look.

For every chapter, each Devanagari verse paragraph in the English body is
followed (directly, or after a grouped verse) by its romanised line, and
translations keep paragraph parity, so the same paragraph in a translation is
the shipped script rendering of that verse. The Devanagari is converted with
Aksharamukha, paired with the closest of those paragraphs, and compared word by word,
after both sides are normalised for our documented house conventions
(docs/TRANSLATION-GUIDE.md, scripts/translation/mechanical.ts):

  all     dandas and avagraha are punctuation; digits ignored
  kn, te  homorganic nasal + virama before its class consonant == anusvara
          (we write ವಂದೇ, Aksharamukha ವನ್ದೇ); word-final ಮ್/మ్ is kept
  ta      visarga is ஃ; श्री is ஸ்ரீ; ॐ is ஓம்; no superscript numerals;
          anusvara takes the class nasal (ஸ்வயஞ்ஜாதோ); a stop after ர் may be
          doubled (கவிதார்க்கிக);
          dental न is ந or ன by position (tamilDentalN), so ந/ன are not compared

Install: python -m pip install aksharamukha   (AGPL-3.0; optional, local only)
Usage:   python scripts/aksharamukha-crosscheck.py [--book=<slug>] [--langs=kn,te] [--json]
Results are sorted into three kinds:
  letters    the letters differ: check against the Devanagari
  unmatched  no romanised paragraph near the verse resembles it: paragraphs
             dropped or shifted in that translation
  spacing    only word breaks differ (वस्तत्परं shown as वस्तत् परं); reported, never fails
Exit 1 when a letters or unmatched finding remains, 2 when it cannot run.
"""
import argparse
import collections
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "content/library"
TARGET = {"hi": "Devanagari", "kn": "Kannada", "te": "Telugu", "ta": "Tamil"}
TAMIL_OPTIONS = ["TamilRemoveApostrophe", "TamilRemoveNumbers", "TamilOmDisable"]
DEVA = re.compile(r"[ऀ-ॿ]")
LATIN = re.compile(r"[A-Za-z]")
PUNCT = re.compile(r"\(அ\)|[|।॥.,'’‘ऽಽఽ\"“”()!?;:–—\-\d०-९೦-೯౦-౯௦-௯]")

# Class nasal + virama + consonant of the same class -> anusvara + consonant.
def _nasal_rule(base: int):
    c = lambda off: chr(base + off)
    classes = [(0x19, range(0x15, 0x19)), (0x1E, range(0x1A, 0x1E)),
               (0x23, range(0x1F, 0x23)), (0x28, range(0x24, 0x28)),
               (0x2E, range(0x2A, 0x2E))]
    rules = [(re.compile(c(n) + c(0x4D) + "(?=[" + "".join(c(k) for k in ks) + "])"), c(0x02))
             for n, ks in classes]
    def apply(text: str) -> str:
        for pattern, anusvara in rules:
            text = pattern.sub(anusvara, text)
        return text
    return apply

NORMALISE = {
    "hi": lambda w: w,
    "kn": _nasal_rule(0x0C80),
    "te": _nasal_rule(0x0C00),
    "ta": lambda w: _tamil_anusvara(w.replace("ஶ்ரீ", "ஸ்ரீ")).replace("ந", "ன"),
}

# Tamil anusvara takes the nasal of the next consonant's class (स्वयंजातो ->
# ஸ்வயஞ்ஜாதோ); Aksharamukha writes ம் throughout.
_TA_CLASS = [("ம்(?=[க])", "ங்"), ("ம்(?=[சஜ])", "ஞ்"), ("ம்(?=[ட])", "ண்"), ("ம்(?=[த])", "ந்")]
def _tamil_anusvara(text: str) -> str:
    for pattern, nasal in _TA_CLASS:
        text = re.sub(pattern, nasal, text)
    # Tamil spelling may double a stop after ர் (கவிதார்க்கிக, ஸமர்ப்பயாமி; glossary: ஸ்வர்க்கம்).
    return re.sub(r"ர்([கசடதப])்\1", r"ர்\1", text)

# Joins a word split for readability back into its written form: virama, space,
# vowel -> vowel sign (కలావ్ ఇచ్ఛంతి -> కలావిచ్ఛంతి). Same layout in every block.
_BLOCK = {"hi": 0x0900, "kn": 0x0C80, "te": 0x0C00, "ta": 0x0B80}
def fused(words_: list[str], lang: str) -> str:
    base = _BLOCK[lang]
    virama, a = chr(base + 0x4D), chr(base + 0x05)
    text = " ".join(words_)
    text = re.sub(virama + " " + a, "", text)
    text = re.sub(virama + " ([" + chr(base + 0x06) + "-" + chr(base + 0x14) + "])",
                  lambda m: chr(ord(m.group(1)) + 0x38), text)
    if lang == "ta":  # Tamil independent vowels sit 0x38 below their signs too, except ஐ/ஒ/ஓ/ஔ
        text = text.replace("்ஐ", "ை")
    return text.replace(" ", "")


def convert(deva: str, lang: str, transliterate) -> str:
    out = transliterate.process("Devanagari", TARGET[lang], deva, nativize=False,
                                post_options=TAMIL_OPTIONS if lang == "ta" else [])
    return out.replace("꞉", "ஃ") if lang == "ta" else out


def words(text: str, lang: str) -> list[str]:
    return [NORMALISE[lang](w) for w in PUNCT.sub(" ", text).split()]


def verse_pairs(english: list[str]):
    """Devanagari verse paragraphs, each with the romanised paragraphs that may
    render it: the next few that are romanised only. Verses are sometimes
    grouped (two Devanagari blocks, then both romanised lines)."""
    for i, para in enumerate(english):
        if not DEVA.search(para) or LATIN.search(para):
            continue
        window = [j for j in range(i + 1, min(i + 4, len(english)))
                  if LATIN.search(english[j]) and not DEVA.search(english[j])]
        if window:
            yield i, para, window


def best_match(expected: str, translated: list[str], window: list[int], lang: str):
    scored = [(difflib.SequenceMatcher(None, fused(words(translated[j], lang), lang), expected).ratio(), j)
              for j in window]
    return max(scored)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--book", help="Book slug (default: every book)")
    parser.add_argument("--langs", default="hi,kn,te,ta")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    langs = [l for l in args.langs.split(",") if l]
    if any(l not in TARGET for l in langs):
        parser.error(f"--langs must be drawn from {','.join(TARGET)}")
    try:
        from aksharamukha import transliterate
    except ImportError:
        print("Install optional dependency: python -m pip install aksharamukha", file=sys.stderr)
        return 2

    books = [LIBRARY / args.book] if args.book else sorted(p for p in LIBRARY.iterdir() if p.is_dir())
    stats = {l: collections.Counter() for l in langs}
    findings = []
    for book in books:
        for chapter in sorted((book / "chapters").glob("*.json")):
            data = json.loads(chapter.read_text(encoding="utf-8"))
            english = re.split(r"\n\s*\n", data.get("body", ""))
            for lang in langs:
                body = data.get("translations", {}).get(lang, {}).get("body")
                if not body:
                    continue
                translated = re.split(r"\n\s*\n", body)
                if len(translated) != len(english):
                    stats[lang]["skipped_parity"] += 1
                    continue
                for i, deva, window in verse_pairs(english):
                    theirs = words(convert(deva, lang, transliterate), lang)
                    ratio, j = best_match(fused(theirs, lang), translated, window, lang)
                    ours = words(translated[j], lang)
                    stats[lang]["verses"] += 1
                    record = {"book": book.name, "chapter": chapter.stem, "lang": lang, "paragraph": j + 1}
                    if ratio < 0.6:
                        stats[lang]["unmatched"] += 1
                        findings.append({**record, "kind": "unmatched", "paragraph": i + 1,
                                         "differences": [(translated[window[0]].replace("\n", " / ")[:160],
                                                          " ".join(theirs))]})
                        continue
                    stats[lang]["words"] += len(ours)
                    if ours == theirs:
                        continue
                    if fused(ours, lang) == fused(theirs, lang):
                        stats[lang]["spacing_only"] += 1
                        findings.append({**record, "kind": "spacing", "differences": [(" ".join(ours), " ".join(theirs))]})
                        continue
                    if len(ours) == len(theirs):
                        bad = [(a, b) for a, b in zip(ours, theirs) if a != b]
                    else:
                        bad = [(" ".join(ours), " ".join(theirs))]
                    stats[lang]["disagreements"] += 1
                    findings.append({**record, "kind": "letters", "differences": bad})

    if args.json:
        print(json.dumps({"stats": stats, "findings": findings}, ensure_ascii=False, indent=1))
    else:
        for lang in langs:
            s = stats[lang]
            print(f"{lang}: {s['verses']} verses, {s['words']} words, "
                  f"{s['disagreements']} with different letters, {s['spacing_only']} with different word breaks, "
                  f"{s['unmatched']} with no matching romanised paragraph, "
                  f"{s['skipped_parity']} chapters skipped (paragraph parity)")
        order = {"letters": 0, "unmatched": 1, "spacing": 2}
        for f in sorted(findings, key=lambda f: order[f["kind"]]):
            print(f"\n[{f['kind']}] {f['book']}/{f['chapter']} [{f['lang']}] paragraph {f['paragraph']}")
            for ours, theirs in f["differences"]:
                print(f"  shipped:     {ours}\n  aksharamukha: {theirs}")
    return 1 if any(f["kind"] != "spacing" for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
