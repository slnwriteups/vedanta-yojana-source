#!/usr/bin/env python3
"""Read-only Vedanta Yojana translation audit. Python 3.10+, no dependencies.

Usage: python tools/translation-engine/audit.py [--book SLUG] [--json]
Exit 1 for blocking issues, 0 otherwise. Never modifies source content.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path

LANGS = ("ta", "kn", "hi", "te")
BLOCKS = {"ta": (0x0B80, 0x0BFF), "kn": (0x0C80, 0x0CFF),
          "hi": (0x0900, 0x097F), "te": (0x0C00, 0x0C7F)}
DIGITS = re.compile("[\\u0966-\\u096f\\u0be6-\\u0bef\\u0ce6-\\u0cef\\u0c66-\\u0c6f]")
PLACEHOLDERS = re.compile(r"lorem ipsum|\bTODO\b|\bTBD\b", re.I)


def blocks(text, lang):
    lo, hi = BLOCKS[lang]
    return any(lo <= ord(c) <= hi for c in text)


def verse_only(text):
    return bool(re.search("[\\u0900-\\u097f]", text) and
                not re.search("[A-Za-z]", text) and
                ("।" in text or "॥" in text))


def check_body(source, target, lang, path):
    issues = []
    if not isinstance(target, str) or not target.strip():
        return [(path, lang, "missing body")]
    originals, translated = re.split(r"\n\s*\n", source), re.split(r"\n\s*\n", target)
    if len(originals) != len(translated):
        issues.append((path, lang, f"paragraph count {len(translated)} != {len(originals)}"))
    for idx, (a, b) in enumerate(zip(originals, translated), 1):
        label = f"paragraph {idx}"
        if not b.strip():
            issues.append((path, lang, f"{label}: empty"))
        if verse_only(a):
            # Sanskrit original is immutable even when other lines are transliterated.
            if a not in b:
                issues.append((path, lang, f"{label}: Devanagari verse changed"))
            continue
        if a.strip() == b.strip() and re.search("[A-Za-z]", a):
            issues.append((path, lang, f"{label}: untranslated English"))
        if not blocks(b, lang) and re.search("[A-Za-z]", a):
            issues.append((path, lang, f"{label}: target script absent"))
        if lang in ("kn", "te"):
            other = "te" if lang == "kn" else "kn"
            if blocks(b, other):
                issues.append((path, lang, f"{label}: {other} script leak"))
        if DIGITS.search(b):
            issues.append((path, lang, f"{label}: non-Western digits"))
        if a.startswith("*") and not b.startswith("*"):
            issues.append((path, lang, f"{label}: highlighted-note marker missing"))
    return issues


def audit(root, book=None):
    library = root / "content" / "library"
    if not library.is_dir():
        raise ValueError(f"Missing content library: {library}")
    issues, counts = [], Counter()
    folders = [library / book] if book else sorted(library.iterdir())
    for folder in folders:
        if not folder.is_dir() or not (folder / "book.json").exists():
            continue
        meta_path = folder / "book.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        counts["books"] += 1
        for lang in LANGS:
            tr = meta.get("translations", {}).get(lang, {})
            for field in ("title", "description"):
                if isinstance(meta.get(field), str) and meta[field].strip() and not str(tr.get(field, "")).strip():
                    issues.append((str(meta_path.relative_to(root)), lang, f"missing book {field}"))
            for i, part in enumerate(meta.get("parts", [])):
                if part.get("title") and not part.get("translations", {}).get(lang, {}).get("title"):
                    issues.append((str(meta_path.relative_to(root)), lang, f"missing part {i} title"))
        for path in sorted((folder / "chapters").glob("*.json")) if (folder / "chapters").exists() else []:
            chapter = json.loads(path.read_text(encoding="utf-8"))
            rel = str(path.relative_to(root))
            counts["chapters"] += 1
            body = chapter.get("body", "")
            if not isinstance(body, str):
                issues.append((rel, "en", "source body not text"))
                continue
            if PLACEHOLDERS.search(body) or chapter.get("migration", {}).get("needsReview"):
                issues.append((rel, "en", "source requires editorial freeze review"))
            for lang in LANGS:
                counts["expected_translations"] += 1
                tr = chapter.get("translations", {}).get(lang)
                if not isinstance(tr, dict):
                    issues.append((rel, lang, "missing translation"))
                    continue
                if not tr.get("title"):
                    issues.append((rel, lang, "missing chapter title"))
                issues.extend(check_body(body, tr.get("body"), lang, rel))
                if not any(i[0] == rel and i[1] == lang for i in issues):
                    counts["passing_translations"] += 1
    return {"counts": dict(counts), "issues": [{"file": p, "language": l, "issue": m}
                                                for p, l, m in issues]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--book", help="Only audit this book/blog slug")
    parser.add_argument("--json", action="store_true", help="Machine-readable output")
    parser.add_argument("--max-issues", type=int, default=30)
    args = parser.parse_args()
    report = audit(Path(args.root).resolve(), args.book)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print("VYTE translation audit:", report["counts"])
        print(f"Flagged issues: {len(report['issues'])}")
        for issue in report["issues"][:args.max_issues]:
            print(f"  {issue['language']} {issue['file']}: {issue['issue']}")
        if len(report["issues"]) > args.max_issues:
            print(f"  ... {len(report['issues']) - args.max_issues} more; use --json")
    return 1 if report["issues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
