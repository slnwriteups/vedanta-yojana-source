/**
 * ITRANS → Devanagari, for Sanskrit typed in plain ASCII (ITRANS 5.3, the
 * scheme sanskritdocuments.org and many stotra collections publish in).
 * The engine then converts the Devanagari to each language with its own
 * rules (mechanical.ts devaToScript), so a verse pasted in ITRANS is never
 * re-typed by hand.
 *
 * ITRANS is case-sensitive: `t` त, `T` ट, `n` न, `N` ण, `sh` श, `Sh` ष.
 * Accepted spellings (the common alternatives are all in):
 *
 *   vowels      a  aa/A  i  ii/I/ee  u  uu/U/oo  RRi/R^i  RRI/R^I  LLi/L^i  LLI/L^I  e  ai  o  au
 *   velar       k  kh  g  gh  ~N/N^
 *   palatal     ch/c  Ch/chh  j  jh  ~n/JN
 *   retroflex   T  Th  D  Dh  N
 *   dental      t  th  d  dh  n
 *   labial      p  ph  b  bh  m
 *   others      y  r  l  L/ld  v/w  sh/S  Sh/shh  s  h  x/kSh/ksh (क्ष)  GY/j~n/dny (ज्ञ)
 *   marks       M/.n/.m anusvara   H visarga   .N candrabindu   .a avagraha   OM/AUM ॐ
 *               .h, _ and {} break a word without adding anything; | or . ।  || or .. ॥; digits → ०-९
 *
 * Any other letter (IAST diacritics, other scripts) is an error: nothing is
 * passed through silently. Spaces, punctuation and line breaks are kept.
 */

export class ItransError extends Error {}

const DEVA = 0x0900;
const ch = (offset: number) => String.fromCharCode(DEVA + offset);
const VIRAMA = ch(0x4d);

// [ITRANS, Devanagari consonant (or conjunct, without a final virama)]
const CONSONANTS: Array<[string, string]> = [
  ["kSh", "क्ष"], ["ksh", "क्ष"], ["x", "क्ष"], ["j~n", "ज्ञ"], ["dny", "ज्ञ"], ["GY", "ज्ञ"],
  ["chh", ch(0x1b)], ["shh", ch(0x37)],
  ["kh", ch(0x16)], ["gh", ch(0x18)], ["~N", ch(0x19)], ["N^", ch(0x19)],
  ["ch", ch(0x1a)], ["Ch", ch(0x1b)], ["jh", ch(0x1d)], ["~n", ch(0x1e)], ["JN", ch(0x1e)],
  ["Th", ch(0x20)], ["Dh", ch(0x22)], ["th", ch(0x25)], ["dh", ch(0x27)],
  ["ph", ch(0x2b)], ["bh", ch(0x2d)], ["ld", ch(0x33)], ["sh", ch(0x36)], ["Sh", ch(0x37)],
  ["k", ch(0x15)], ["g", ch(0x17)], ["c", ch(0x1a)], ["j", ch(0x1c)],
  ["T", ch(0x1f)], ["D", ch(0x21)], ["N", ch(0x23)], ["t", ch(0x24)], ["d", ch(0x26)], ["n", ch(0x28)],
  ["p", ch(0x2a)], ["b", ch(0x2c)], ["m", ch(0x2e)], ["y", ch(0x2f)], ["r", ch(0x30)], ["l", ch(0x32)],
  ["L", ch(0x33)], ["v", ch(0x35)], ["w", ch(0x35)], ["S", ch(0x36)], ["s", ch(0x38)], ["h", ch(0x39)],
];

// [ITRANS, independent vowel, sign after a consonant ("" = inherent a)]
const VOWELS: Array<[string, string, string]> = [
  ["RRi", ch(0x0b), ch(0x43)], ["R^i", ch(0x0b), ch(0x43)], ["RRI", ch(0x60), ch(0x44)], ["R^I", ch(0x60), ch(0x44)],
  ["LLi", ch(0x0c), ch(0x62)], ["L^i", ch(0x0c), ch(0x62)], ["LLI", ch(0x61), ch(0x63)], ["L^I", ch(0x61), ch(0x63)],
  ["aa", ch(0x06), ch(0x3e)], ["ai", ch(0x10), ch(0x48)], ["au", ch(0x14), ch(0x4c)],
  ["ii", ch(0x08), ch(0x40)], ["ee", ch(0x08), ch(0x40)], ["uu", ch(0x0a), ch(0x42)], ["oo", ch(0x0a), ch(0x42)],
  ["A", ch(0x06), ch(0x3e)], ["I", ch(0x08), ch(0x40)], ["U", ch(0x0a), ch(0x42)],
  ["a", ch(0x05), ""], ["i", ch(0x07), ch(0x3f)], ["u", ch(0x09), ch(0x41)], ["e", ch(0x0f), ch(0x47)], ["o", ch(0x13), ch(0x4b)],
];

// Marks and punctuation, matched before letters.
const MARKS: Array<[string, string]> = [
  ["AUM", "ॐ"], ["OM", "ॐ"],
  [".n", ch(0x02)], [".m", ch(0x02)], ["M", ch(0x02)], ["H", ch(0x03)], [".N", ch(0x01)], [".a", ch(0x3d)],
  ["||", "॥"], ["..", "॥"], ["|", "।"], [".h", ""], ["{}", ""], ["_", ""], [".", "।"],
];

const byLength = <T extends [string, ...unknown[]]>(rows: T[]) => [...rows].sort((x, y) => y[0].length - x[0].length);
const CONSONANT_ROWS = byLength(CONSONANTS);
const VOWEL_ROWS = byLength(VOWELS);
const MARK_ROWS = byLength(MARKS);

function matchAt<T extends [string, ...unknown[]]>(text: string, i: number, rows: T[]): T | undefined {
  return rows.find(([key]) => text.startsWith(key, i));
}

/** ITRANS Sanskrit in Devanagari. Throws ItransError on a letter ITRANS does not define. */
export function itransToDeva(itrans: string): string {
  const text = itrans.normalize("NFC");
  let out = "";
  let i = 0;
  while (i < text.length) {
    const mark = matchAt(text, i, MARK_ROWS);
    if (mark) {
      out += mark[1];
      i += mark[0].length;
      continue;
    }
    const consonant = matchAt(text, i, CONSONANT_ROWS);
    if (consonant) {
      i += consonant[0].length;
      out += consonant[1];
      const vowel = matchAt(text, i, VOWEL_ROWS);
      if (vowel) {
        out += vowel[2];
        i += vowel[0].length;
      } else out += VIRAMA;
      continue;
    }
    const vowel = matchAt(text, i, VOWEL_ROWS);
    if (vowel) {
      out += vowel[1];
      i += vowel[0].length;
      continue;
    }
    const c = text[i];
    if (/[0-9]/.test(c)) out += String.fromCharCode(0x0966 + Number(c));
    else if (/[\p{L}\p{M}^~]/u.test(c)) {
      const hint = /[āīūṛṝḷḹṅñṭḍṇśṣṃṁḥēō]/iu.test(text) ? " (this looks like IAST: use --from=iast)" : "";
      throw new ItransError(`not an ITRANS letter at ${i + 1}: "${text.slice(i, i + 8)}"${hint}`);
    }
    else out += c;
    i += 1;
  }
  return out;
}
