#!/usr/bin/env python3
"""Compare Aksharamukha with the existing iastToScript implementation.

Read-only. Requires local Python aksharamukha and Node >=24.
Usage: python scripts/compare-sanskrit-converters.py
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = [
    "viśvam", "viṣṇuḥ", "bhūtabhṛt", "bhūtātmā",
    "pūtātmā", "paramātmā", "śrī", "kṣētrajñaḥ",
    "ōṃ viśvāya namaḥ", "ōṃ bhūtabhṛtē namaḥ",
]
LANGS = ("hi", "kn", "te", "ta")


def main():
    sys.path.insert(0, str(ROOT / "scripts"))
    import importlib.util
    spec = importlib.util.spec_from_file_location("aksharamukha_pilot", ROOT / "scripts/aksharamukha-pilot.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    payload = json.dumps({"samples": SAMPLES, "langs": LANGS}, ensure_ascii=False)
    node = r"""
import { iastToScript } from './content-lib/sanskrit-script.ts';
const {samples, langs} = JSON.parse(process.argv[1]);
console.log(JSON.stringify(Object.fromEntries(langs.map(lang =>
  [lang, samples.map(text => iastToScript(text, lang))]))));
"""
    try:
        process = subprocess.run(
            ["node", "--experimental-strip-types", "--input-type=module", "-e", node, payload],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        existing = json.loads(process.stdout)
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        print(f"Cannot run existing converter: {exc}", file=sys.stderr)
        return 2
    differences = []
    for lang in LANGS:
        for i, source in enumerate(SAMPLES):
            try:
                candidate = module.convert(source, lang)
            except Exception as exc:
                print(f"Aksharamukha failed: {exc}", file=sys.stderr)
                return 2
            baseline = existing[lang][i]
            if candidate != baseline:
                differences.append({"lang": lang, "source": source,
                                    "existing": baseline, "aksharamukha": candidate})
    print(json.dumps({"samples": len(SAMPLES), "languages": len(LANGS),
                      "differences": differences,
                      "note": "Differences require editorial review; Tamil requires Grantha-assisted checks even when outputs agree."},
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
