import { iastToScript } from "../../content-lib/sanskrit-script.ts";
import type { LanguageCode } from "../../content-lib/schemas/language.ts";

/**
 * The zero-AI half of a translation: every paragraph whose target-language
 * form follows mechanically from the English record (docs/TRANSLATION-GUIDE.md
 * §5 and §10). Only "prose" paragraphs ever go to a translator.
 *
 * Paragraph kinds, as they occur in the English body:
 *
 * - "deva"   A Devanagari verse block (no Latin letters). Kept as-is in every
 *            language.
 * - "roman"  The romanised couplet printed under a Devanagari block. Replaced
 *            by the verse in the target script, derived from the Devanagari
 *            above it (exact, no IAST guesswork). Hindi repeats the Devanagari.
 * - "roman-alone" A romanised verse with no Devanagari above it. Converted
 *            from IAST.
 * - "name"   A Sahasranaama name line, `N. <IAST> · <Devanagari>`.
 * - "mantra" `(oṃ) <dative> namaḥ`.
 * - "prose"  Everything else. Translated by hand.
 *
 * The output style follows the live translations: kn/te write a class nasal
 * before a consonant of its own class as anusvara (वेङ्कट → ವೇಂಕಟ / వేంకట),
 * verse bars are ASCII ` |` / ` ||`, and numbers are Western digits.
 */

export type ParagraphKind = "deva" | "roman" | "roman-alone" | "name" | "mantra" | "prose";
export const LANGS: LanguageCode[] = ["ta", "kn", "hi", "te"];

const DEVA = /[ऀ-ॿ]/;
const LATIN = /[A-Za-z]/;

export function splitParagraphs(body: string): string[] {
  return body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
}

export function classify(paragraphs: string[]): ParagraphKind[] {
  const kinds: ParagraphKind[] = [];
  paragraphs.forEach((p, i) => {
    const lines = p.split("\n");
    const last = lines[lines.length - 1].trim();
    if (DEVA.test(p) && !LATIN.test(p)) kinds.push("deva");
    else if (/^\d+\.\s+\S.*\s·\s[ऀ-ॿ]/.test(p)) kinds.push("name");
    else if (/^\((?:o|ō)[ṃṁm]\)\s/.test(p)) kinds.push("mantra");
    else if (!DEVA.test(p) && /\|\s*$/.test(last) && !/[.?!:;,"']\s*\|/.test(last)) {
      kinds.push(i > 0 && kinds[i - 1] === "deva" ? "roman" : "roman-alone");
    } else kinds.push("prose");
  });
  return kinds;
}

// ---------------------------------------------------------------- Devanagari helpers

const VIRAMA_DEVA = "्";
const NASAL_CLASS: Record<string, RegExp> = {
  "ङ": /[क-घ]/, // k-class
  "ञ": /[च-झ]/, // c-class
  "ण": /[ट-ढ]/, // ṭ-class
  "न": /[त-ध]/, // t-class
  "म": /[प-भ]/, // p-class
};

function verseMarks(text: string): string {
  return text
    .replace(/\s*॥\s*([०-९0-9]+)\s*॥/g, (_m, n: string) => ` || ${westernDigits(n)} ||`)
    .replace(/\s*॥/g, " ||")
    .replace(/\s*।/g, " |");
}

export function westernDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

/** Devanagari → Kannada or Telugu, letter for letter, with the live anusvara style. */
export function devaToBrahmic(deva: string, lang: "kn" | "te"): string {
  const base = lang === "kn" ? 0x0c80 : 0x0c00;
  const om = lang === "kn" ? "ಓಂ" : "ఓం";
  // Class nasal + virama + same-class consonant → anusvara + consonant.
  let text = deva.replace(/([ङञणनम])्(?=([क-ह]))/g, (m, nasal: string, next: string) =>
    NASAL_CLASS[nasal].test(next) ? "ं" : m,
  );
  text = text.replace(/ॐ/g, "");
  let out = "";
  for (const c of text) {
    const code = c.charCodeAt(0);
    if (c === "") out += om;
    else if (code >= 0x0900 && code <= 0x0963) out += String.fromCharCode(base + (code - 0x0900));
    else if (code >= 0x0966 && code <= 0x096f) out += String(code - 0x0966);
    else out += c; // । ॥ spaces, punctuation
  }
  return out;
}

const TA_CONS: Record<string, string> = {
  "क": "க", "ख": "க", "ग": "க", "घ": "க", "ङ": "ங",
  "च": "ச", "छ": "ச", "ज": "ஜ", "झ": "ஜ", "ञ": "ஞ",
  "ट": "ட", "ठ": "ட", "ड": "ட", "ढ": "ட", "ण": "ண",
  "त": "த", "थ": "த", "द": "த", "ध": "த", "न": "ந",
  "प": "ப", "फ": "ப", "ब": "ப", "भ": "ப", "म": "ம",
  "य": "ய", "र": "ர", "ल": "ல", "ळ": "ள", "व": "வ",
  "श": "ஶ", "ष": "ஷ", "स": "ஸ", "ह": "ஹ",
};
const TA_VOWEL: Record<string, string> = {
  "अ": "அ", "आ": "ஆ", "इ": "இ", "ई": "ஈ", "उ": "உ", "ऊ": "ஊ", "ऋ": "ரு", "ॠ": "ரூ", "ऌ": "லு", "ॡ": "லூ",
  "ए": "ஏ", "ऐ": "ஐ", "ओ": "ஓ", "औ": "ஔ",
};
const TA_SIGN: Record<string, string> = {
  "ा": "ா", "ि": "ி", "ी": "ீ", "ु": "ு", "ू": "ூ", "ृ": "்ரு", "ॄ": "்ரூ", "ॢ": "்லு", "ॣ": "்லூ",
  "े": "ே", "ै": "ை", "ो": "ோ", "ौ": "ௌ",
};
const TA_CLASS_NASAL: Array<[RegExp, string]> = [
  [/[क-घ]/, "ங்"], [/[च-झ]/, "ஞ்"], [/[ट-ढ]/, "ண்"], [/[त-ध]/, "ந்"], [/[प-भ]/, "ம்"],
];

/**
 * Live Tamil verses write dental न as ந at the start of a word, before
 * த/ந (वेदान्त → வேதாந்த, सन्निधत्ताम् → ஸந்நிதத்தாம்) and after ந், and as
 * ன everywhere else (जनि → ஜனி, श्रीमान् → ஸ்ரீமான்).
 */
function tamilDentalN(chars: string[], i: number): string {
  const before = chars[i - 1] ?? " ";
  const wordStart = !/[ऀ-ॿ]/.test(before);
  const afterNasal = before === VIRAMA_DEVA && chars[i - 2] === "न";
  const beforeDental = chars[i + 1] === VIRAMA_DEVA && /[तथदधन]/.test(chars[i + 2] ?? "");
  return wordStart || afterNasal || beforeDental ? "ந" : "ன";
}

/**
 * Devanagari → Tamil, Grantha-assisted (TRANSLATION-GUIDE §5.2): aspirates and
 * voiced stops fold into the plain letter, ś → ஶ, ṣ s j h → ஷ ஸ ஜ ஹ, ṛ → ரு, ḷ → லு,
 * anusvara → the nasal of the next consonant's class (ம் otherwise),
 * visarga → ஃ, श्री → ஸ்ரீ, ॐ → ஓம்.
 */
export function devaToTamil(deva: string): string {
  const text = deva.replace(/श्री/g, "").replace(/ॐ/g, "");
  const chars = [...text];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1] ?? "";
    if (c === "") out += "ஓம்";
    else if (c === "") out += "ஸ்ரீ";
    else if (TA_CONS[c]) {
      out += c === "न" ? tamilDentalN(chars, i) : TA_CONS[c];
      const sign = TA_SIGN[next];
      if (sign) { out += sign; i++; }
      else if (next === VIRAMA_DEVA) { out += "்"; i++; }
    } else if (TA_VOWEL[c]) out += TA_VOWEL[c];
    else if (c === "ं") {
      const following = chars[i + 1] ?? "";
      const cls = TA_CLASS_NASAL.find(([re]) => re.test(following));
      out += cls ? cls[1] : "ம்";
    } else if (c === "ः") out += "ஃ";
    else if (c === "ँ") out += "ம்";
    else if (c === "ऽ") out += "'";
    else if (c === "़") continue; // nukta
    else if (c >= "०" && c <= "९") out += String(c.charCodeAt(0) - 0x0966);
    else out += c;
  }
  return out;
}

/** Devanagari → the target script (Hindi: unchanged). */
export function devaToScript(deva: string, lang: LanguageCode): string {
  if (lang === "hi") return deva;
  if (lang === "ta") return devaToTamil(deva);
  return devaToBrahmic(deva, lang);
}

// ---------------------------------------------------------------- IAST helpers

/** IAST (with this corpus's ē/ō long vowels) → Devanagari. */
export function iastToDeva(iast: string): string {
  const normal = iast
    .normalize("NFC")
    .replace(/ē/g, "e").replace(/ō/g, "o").replace(/Ē/g, "E").replace(/Ō/g, "O")
    .replace(/ṁ/g, "ṃ")
    .replace(/ḻ/g, "ḷ").replace(/Ḻ/g, "Ḷ");
  return iastToScript(normal, "hi")
    .replace(/'/g, "ऽ")
    .replace(/न्(?=क|ख|ग|घ)/g, "ङ्"); // n before k-class
}

// ---------------------------------------------------------------- generators

const OM: Record<LanguageCode, string> = { ta: "(ஓம்)", kn: "(ಓಂ)", hi: "(ॐ)", te: "(ఓం)" };

export class MechanicalError extends Error {}

/**
 * The target-language form of a mechanical paragraph, or null for prose.
 * `prev` is the paragraph before it (the Devanagari block for a "roman" one).
 */
export function generate(kind: ParagraphKind, english: string, prev: string | undefined, lang: LanguageCode): string | null {
  switch (kind) {
    case "prose":
      return null;
    case "deva":
      return english;
    case "roman": {
      if (!prev) throw new MechanicalError("romanised verse without a Devanagari block above it");
      return verseMarks(devaToScript(prev, lang));
    }
    case "roman-alone": {
      const lines = english.split("\n").map((line) => {
        const m = line.match(/^(.*?)(\s*\|\|?\s*(?:\d+\s*\|\|)?\s*)$/);
        const words = m ? m[1] : line;
        const tail = m ? m[2] : "";
        return devaToScript(iastToDeva(words), lang) + tail;
      });
      return lines.join("\n");
    }
    case "name": {
      const m = english.match(/^(\d+)\.\s+.*?\s·\s([ऀ-ॿ\s]+?)\s*$/);
      if (!m) throw new MechanicalError(`unrecognised name line: ${english}`);
      const [, n, deva] = m;
      return lang === "hi" ? `${n}. ${deva}` : `${n}. ${devaToScript(deva, lang)} · ${deva}`;
    }
    case "mantra": {
      const m = english.match(/^\((?:o|ō)[ṃṁm]\)\s+(.+)$/);
      if (!m) throw new MechanicalError(`unrecognised mantra: ${english}`);
      return `${OM[lang]} ${devaToScript(iastToDeva(m[1]), lang)}`;
    }
  }
}

/** Mechanical paragraphs never contain Latin letters; anything left over is a converter gap. */
export function assertConverted(text: string, context: string): void {
  if (LATIN.test(text.replace(/\|/g, ""))) throw new MechanicalError(`Latin letters left after conversion (${context}): ${text}`);
}
