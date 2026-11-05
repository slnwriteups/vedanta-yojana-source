# Website fonts

The website's fonts are stored here and loaded with `next/font/local` in
`app/layout.tsx`. The build used to download them from Google Fonts
(`next/font/google`), and that download failed intermittently in CI
(`TypeError: Cannot read properties of null (reading '1')` in
`@next/font/dist/google/loader.js`), failing builds that had nothing to do
with fonts. With the files in the repository the build makes no font
requests at all.

All seven are Noto fonts under the SIL Open Font License 1.1 (`OFL.txt`; every
family's licence has the same text, only the copyright line names its own
notofonts project). They are variable fonts, so one file serves every
weight the site uses.

| File | Family, version | Characters (`unicode-range` in `layout.tsx`) | Source |
|---|---|---|---|
| `noto-serif-latin.woff2` | Noto Serif 2.015 | Google's `latin`, `latin-ext` and `math` subsets, merged | Built from the full font, see below |
| `noto-serif-tamil.woff2` | Noto Serif Tamil 2.004 | Google's `tamil` subset | The file Google Fonts serves |
| `noto-serif-kannada.woff2` | Noto Serif Kannada 2.005 | Google's `kannada` subset | The file Google Fonts serves |
| `noto-serif-telugu.woff2` | Noto Serif Telugu 2.005 | Google's `telugu` subset | The file Google Fonts serves |
| `noto-serif-devanagari.woff2` | Noto Serif Devanagari 2.006 | Google's `devanagari` subset | The file Google Fonts serves |
| `noto-sans-devanagari.woff2` | Noto Sans Devanagari 2.007 | Google's `devanagari` subset | The file Google Fonts serves |
| `noto-sans-telugu.woff2` | Noto Sans Telugu 2.005 | Google's `telugu` subset | The file Google Fonts serves |

## Why Noto Serif is one merged file

Each `next/font/local` call gives all of its files the same
`unicode-range`, so a family that Google splits into several subset files
can't keep that split. For the script fonts only the script's own subset
matters: Latin text in the reading stack is always set by Noto Serif,
which comes first, and the UI stack puts system fonts before Noto Sans
Devanagari. Noto Serif itself needs Latin, Latin Extended (the IAST
diacritics: ā ī ū ṛ ṣ ṭ ḍ ṇ ṃ ḥ ś) and math (the → arrow). Those three are
merged into one file. It has weights 400–700, the only ones the site uses,
and comes to 167 KB. Before, the site preloaded 224 KB for Latin and Latin
Extended.

`app/layout.tsx` declares every file at the fixed weights Google's CSS
used (400 and 700, plus 600 for Noto Sans Devanagari), not as a weight
range. That way, text styled between them (`font-medium`, 500) snaps
to the same weight it did before; a range would render a true 500.

Screenshots of the built site before and after this change, in all five
languages, are pixel-identical except for English text with IAST. There
the merged Noto Serif can kern ā/ī/ū against the letters beside them,
which the separate Google files couldn't, so some macrons sit up to a
pixel differently.

The Greek, Cyrillic and Vietnamese subsets are left out: no content
uses them, so those characters now fall back to Georgia/serif.

## Regenerating

```bash
pip install fonttools brotli
curl -L -o NotoSerif.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserif/NotoSerif%5Bwdth%2Cwght%5D.ttf"
python3 -m fontTools.varLib.instancer NotoSerif.ttf wdth=100 wght=400:700 -o inst.ttf
python3 -m fontTools.subset inst.ttf --unicodes="<latin>,<latin-ext>,<math>" \
  --layout-features='*' --flavor=woff2 --no-hinting --desubroutinize \
  --output-file=noto-serif-latin.woff2
```

The three ranges are the `unicode-range` values of the `latin`,
`latin-ext` and `math` blocks in
`https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&display=swap`.
They are also the `unicode-range` written for Noto Serif in
`app/layout.tsx`. Fetch that CSS with a current Chrome user agent, so
Google returns woff2 files.

Each script font is the `src` file of its script's block in the same
kind of CSS response, for example
`https://fonts.googleapis.com/css2?family=Noto+Serif+Tamil:wght@400;700&display=swap`.
When you update a file, also update its `unicode-range` in
`app/layout.tsx` and the version in the table above.
