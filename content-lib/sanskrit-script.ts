import type { LanguageCode } from "./schemas/language.ts";

/**
 * Writes romanized (IAST) Sanskrit in the reader's script, so the daily
 * Sankalpam formula ("Parābhava nāma saṁvatsare, …"), which the
 * Panchangam engine composes in IAST, reads in Tamil, Kannada, Hindi or
 * Telugu script like the Tarpaṇa Saṅkalpams the app already carries.
 *
 * Kannada, Devanagari and Telugu are letter for letter: the three Unicode
 * blocks share one layout, so each IAST letter maps to the same offset in
 * each. Tamil follows the Grantha-assisted spelling of the hand-written
 * Tamil Tarpaṇa Saṅkalpams (content-lib/paduka-panchangam.ts): aspirates
 * fold into the plain letter, voiced into unvoiced (dh → த), ś is ச, ṣ s j
 * h stay ஷ ஸ ஜ ஹ, ṛ is ரு, dental n is ந, and ṁ is ம்.
 */

const BRAHMIC_BASE: Record<Exclude<LanguageCode, "ta">, number> = { hi: 0x0900, kn: 0x0c80, te: 0x0c00 };

// Consonants, longest first so "kh" wins over "k". Values are offsets within the Brahmic block.
const CONSONANTS: Array<[string, number]> = [
  ["kh", 0x16], ["gh", 0x18], ["ch", 0x1b], ["jh", 0x1d], ["ṭh", 0x20], ["ḍh", 0x22],
  ["th", 0x25], ["dh", 0x27], ["ph", 0x2b], ["bh", 0x2d],
  ["k", 0x15], ["g", 0x17], ["ṅ", 0x19], ["c", 0x1a], ["j", 0x1c], ["ñ", 0x1e],
  ["ṭ", 0x1f], ["ḍ", 0x21], ["ṇ", 0x23], ["t", 0x24], ["d", 0x26], ["n", 0x28],
  ["p", 0x2a], ["b", 0x2c], ["m", 0x2e], ["y", 0x2f], ["r", 0x30], ["l", 0x32],
  ["ḷ", 0x33], ["v", 0x35], ["ś", 0x36], ["ṣ", 0x37], ["s", 0x38], ["h", 0x39],
];

// Vowels, longest first: [IAST, independent letter offset, sign offset after a consonant (null = inherent a)].
const VOWELS: Array<[string, number, number | null]> = [
  ["ai", 0x10, 0x48], ["au", 0x14, 0x4c],
  ["ā", 0x06, 0x3e], ["ī", 0x08, 0x40], ["ū", 0x0a, 0x42], ["ṝ", 0x60, 0x44], ["ṛ", 0x0b, 0x43],
  ["a", 0x05, null], ["i", 0x07, 0x3f], ["u", 0x09, 0x41], ["e", 0x0f, 0x47], ["o", 0x13, 0x4b],
];

const VIRAMA = 0x4d;
const ANUSVARA = 0x02;
const VISARGA = 0x03;

const TAMIL_CONSONANTS: Record<string, string> = {
  kh: "க", gh: "க", ch: "ச", jh: "ஜ", ṭh: "ட", ḍh: "ட", th: "த", dh: "த", ph: "ப", bh: "ப",
  k: "க", g: "க", ṅ: "ங", c: "ச", j: "ஜ", ñ: "ஞ", ṭ: "ட", ḍ: "ட", ṇ: "ண", t: "த", d: "த", n: "ந",
  p: "ப", b: "ப", m: "ம", y: "ய", r: "ர", l: "ல", ḷ: "ள", v: "வ", ś: "ச", ṣ: "ஷ", s: "ஸ", h: "ஹ",
};
const TAMIL_VOWELS: Record<string, [string, string]> = {
  ai: ["ஐ", "ை"], au: ["ஔ", "ௌ"], ā: ["ஆ", "ா"], ī: ["ஈ", "ீ"], ū: ["ஊ", "ூ"], ṝ: ["ரூ", "்ரூ"], ṛ: ["ரு", "்ரு"],
  a: ["அ", ""], i: ["இ", "ி"], u: ["உ", "ு"], e: ["ஏ", "ே"], o: ["ஓ", "ோ"],
};
const TAMIL_VIRAMA = "்";

function matchAt(text: string, i: number, keys: string[]): string | null {
  for (const key of keys) if (text.startsWith(key, i)) return key;
  return null;
}

const CONSONANT_KEYS = CONSONANTS.map(([k]) => k);
const VOWEL_KEYS = VOWELS.map(([k]) => k);

/** IAST Sanskrit in the script of `language` (unchanged for English). Non-letters pass through. */
export function iastToScript(iast: string, language: LanguageCode | null): string {
  if (!language) return iast;
  const text = iast.normalize("NFC").toLowerCase();
  const tamil = language === "ta";
  const base = tamil ? 0 : BRAHMIC_BASE[language];
  const ch = (offset: number) => String.fromCharCode(base + offset);
  let out = "";
  let i = 0;
  while (i < text.length) {
    const consonant = matchAt(text, i, CONSONANT_KEYS);
    if (consonant) {
      i += consonant.length;
      out += tamil ? TAMIL_CONSONANTS[consonant] : ch(CONSONANTS.find(([k]) => k === consonant)![1]);
      const vowel = matchAt(text, i, VOWEL_KEYS);
      if (vowel) {
        i += vowel.length;
        if (tamil) out += TAMIL_VOWELS[vowel][1];
        else {
          const sign = VOWELS.find(([k]) => k === vowel)![2];
          if (sign !== null) out += ch(sign);
        }
      } else {
        out += tamil ? TAMIL_VIRAMA : ch(VIRAMA);
      }
      continue;
    }
    const vowel = matchAt(text, i, VOWEL_KEYS);
    if (vowel) {
      i += vowel.length;
      out += tamil ? TAMIL_VOWELS[vowel][0] : ch(VOWELS.find(([k]) => k === vowel)![1]);
      continue;
    }
    const letter = text[i];
    if (letter === "ṁ" || letter === "ṃ") out += tamil ? "ம்" : ch(ANUSVARA);
    else if (letter === "ḥ") out += tamil ? "ஃ" : ch(VISARGA);
    else out += letter;
    i += 1;
  }
  return out;
}
