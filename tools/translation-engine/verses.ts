import type { LanguageCode } from "../../content-lib/schemas/language.ts";
import { SCRIPT } from "../../scripts/translation/checks.ts";
import { assertConverted, classify, splitParagraphs } from "../../scripts/translation/mechanical.ts";
import { ambiguousRomanisation, expectedForm } from "./validate.ts";

/**
 * Puts every verse paragraph of a translated body into the shape the
 * Standard requires (§3.1), using the existing converters in
 * scripts/translation/mechanical.ts (Devanagari → kn/te letter for letter,
 * → Tamil Grantha-assisted per §3.2, Hindi repeats the Devanagari):
 *
 * - a Devanagari block that was changed or dropped is restored from the English;
 * - a romanised couplet, name line or mantra still in Latin letters, or not in
 *   the target script, is replaced by its generated form.
 *
 * Prose paragraphs, and verse paragraphs that are already clean (including
 * hand-spaced live verses), are left exactly as they are. A romanised-only
 * verse in the Library "sh" spelling is never guessed at: it is reported in
 * `unresolved` and the validator keeps blocking it.
 */

export interface VerseRepair {
  body: string;
  changed: Array<{ paragraph: number; kind: string; reason: string }>;
  unresolved: Array<{ paragraph: number; reason: string }>;
}

export function repairVerses(english: string, translated: string, lang: LanguageCode): VerseRepair {
  const en = splitParagraphs(english);
  const tr = splitParagraphs(translated);
  if (en.length !== tr.length) {
    // Pairing paragraphs by position is only safe when the structure matches.
    return { body: translated, changed: [], unresolved: [{ paragraph: 0, reason: `paragraph count ${tr.length} != ${en.length}; fix the structure first` }] };
  }
  const kinds = classify(en);
  const target = lang === "hi" ? /[ऀ-ॿ]/ : SCRIPT[lang];
  const changed: VerseRepair["changed"] = [];
  const unresolved: VerseRepair["unresolved"] = [];
  const out = tr.map((t, i) => {
    const kind = kinds[i];
    if (kind === "prose") return t;
    if (kind === "deva") {
      if (t !== en[i]) changed.push({ paragraph: i + 1, kind, reason: "Devanagari restored from the English" });
      return en[i];
    }
    const needsWork = /\p{Script=Latin}/u.test(t) || !target.test(t);
    if (!needsWork) return t;
    if (kind === "roman-alone" && ambiguousRomanisation(en[i])) {
      unresolved.push({ paragraph: i + 1, reason: ambiguousRomanisation(en[i])! });
      return t;
    }
    const generated = expectedForm(kind, en[i], en[i - 1], lang);
    if (!generated) {
      unresolved.push({ paragraph: i + 1, reason: `no mechanical form for this ${kind} paragraph` });
      return t;
    }
    assertConverted(generated, `${lang} paragraph ${i + 1}`);
    changed.push({ paragraph: i + 1, kind, reason: "romanised text replaced by the generated target-script form" });
    return generated;
  });
  return { body: out.join("\n\n"), changed, unresolved };
}
