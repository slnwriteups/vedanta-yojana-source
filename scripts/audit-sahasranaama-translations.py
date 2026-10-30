#!/usr/bin/env python3
"""Read-only inventory of Sri Vishnu Sahasranaama Anubhavam translation coverage.

Usage: python scripts/audit-sahasranaama-translations.py
       python scripts/audit-sahasranaama-translations.py --json
No dependencies beyond Python 3.9+. Never writes to content/.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / "content/library/sri-vishnu-sahasranaama-anubhavam"
LANGS = ("ta", "kn", "hi", "te")


def filled(record, language, field):
    value = record.get("translations", {}).get(language, {}).get(field)
    return isinstance(value, str) and bool(value.strip())


def inventory():
    book = json.loads((BOOK / "book.json").read_text(encoding="utf-8"))
    slugs = book["chapterOrder"]
    if len(slugs) != len(set(slugs)):
        raise ValueError("Duplicate slugs in chapterOrder")
    chapters = {}
    for slug in slugs:
        p = BOOK / "chapters" / (slug + ".json")
        if not p.is_file():
            raise FileNotFoundError(p)
        chapters[slug] = json.loads(p.read_text(encoding="utf-8"))
    result = {"book": book["slug"], "total_chapters": len(slugs), "languages": {}}
    for lang in LANGS:
        complete = [s for s in slugs if filled(chapters[s], lang, "title") and filled(chapters[s], lang, "body")]
        partial = [s for s in slugs if (filled(chapters[s], lang, "title") or filled(chapters[s], lang, "body")) and s not in complete]
        missing = [s for s in slugs if s not in complete and s not in partial]
        parts = [p for p in book.get("parts", []) if filled(p, lang, "title")]
        result["languages"][lang] = {
            "complete_chapters": len(complete),
            "partial_chapters": len(partial),
            "missing_chapters": len(missing),
            "completion_percent": round(100 * len(complete) / len(slugs), 2) if slugs else 0,
            "book_title": filled(book, lang, "title"),
            "book_description": filled(book, lang, "description"),
            "part_titles": len(parts),
            "total_parts": len(book.get("parts", [])),
            "next_missing": (partial + missing)[:3],
        }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    result = inventory()
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"{result['book']}: {result['total_chapters']} English chapters")
        for lang, r in result["languages"].items():
            print(f"{lang}: {r['complete_chapters']} complete, {r['partial_chapters']} partial, "
                  f"{r['missing_chapters']} missing ({r['completion_percent']}%); "
                  f"book title={r['book_title']}, description={r['book_description']}, "
                  f"part titles={r['part_titles']}/{r['total_parts']}; next={r['next_missing']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
