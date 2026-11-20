/**
 * Applies the Library's English conventions (docs/BLOG-TRANSLATION-PROGRESS.md,
 * "Phase A: English conventions"; docs/TRANSLATION-GUIDE.md §7 and the
 * glossaries' English forms) to the Mārgazhi Thingalil Tiruppāvai sources:
 *
 *   - the text of each source-material/margazhi-thingalil-tiruppavai/day-NN.md
 *     above its "## Notes" (Notes keep the slides' spellings they quote);
 *   - the romanised lines of verses.json.
 *
 * Rules: ś/ṣ are written "sh" everywhere, verses included; vocalic ṛ and the
 * anusvāra ṁ are written "ri" and "m" in prose (Sanskrit verse keeps ṛ ṃ ḥ);
 * Tamil words and Tamil verse keep ē/ō, ḷ, ḻ, ṟ; names take the glossary /
 * book precedent form (Āṇḍāl, Āchārya, Yashodā, Sri Vaishṇava, …).
 *
 *   node scripts/margazhi/apply-house-style.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../source-material/margazhi-thingalil-tiruppavai");

/** Names and terms with a settled Library form (glossary English side, book and Divya Desam precedent, owner's choices). */
const NAMES: [RegExp, string][] = [
  [/Āṇḍāḷ/g, "Āṇḍāl"],
  [/Śrīvaiṣṇava/g, "Sri Vaishṇava"],
  [/Śrīvilliputtūr/g, "Srivilliputtūr"],
  [/Śrīman/g, "Sriman"],
  [/Śrī(?!\p{L})/gu, "Sri"],
  [/Shrī(?!\p{L})/gu, "Sri"],
  [/Parashara Bhattar/g, "Parāshara Bhaṭṭar"],
  [/Kēśava/g, "Keshava"],
  [/Lakṣmī|Lakshmi\b/g, "Lakshmī"],
  [/Kaṁsa/g, "Kaṃsa"],
  [/Narasiṁha/g, "Narasimha"],
  [/Dāmōdara/g, "Dāmodara"],
  [/Gōdā/g, "Godā"],
  [/Kōdai\b/g, "Kōdhai"],
  [/Periyāḻvār/g, "Periyāzhwār"],
  [/Kaḷḷaḻagar/g, "Kallazhagar"],
  [/Aḻagar Kōyil/g, "Azhagar Kōyil"],
  [/Attuḻāy/g, "Attuzhāy"],
  [/Śīrgāḻi/g, "Sīrgāzhi"],
  [/\bTamil\b/g, "Tamizh"],
  [/\bVishnu\b/g, "Vishṇu"],
  [/\bMargazhi\b/g, "Mārgazhi"],
  [/iḻam siṅgam/g, "iḷam siṅgam"],
  [/Aṣṭākṣarī/g, "Ashṭākshari"],
  [/ācāry/g, "āchāry"],
  [/Ācāry/g, "Āchāry"],
];

/** Prose only: ṛ → ri, ṁ → m (Sanskrit verse keeps them). */
const PROSE: [RegExp, string][] = [
  [/ṛ/g, "ri"],
  [/ṁ/g, "m"],
];

/** Everywhere, verses included: ś/ṣ → sh. */
const SH: [RegExp, string][] = [
  [/Ś/g, "Sh"],
  [/Ṣ/g, "Sh"],
  [/ś/g, "sh"],
  [/ṣ/g, "sh"],
];

const apply = (text: string, rules: [RegExp, string][]) => rules.reduce((t, [re, to]) => t.replace(re, to), text);

/** A quoted Sanskrit verse in prose ('māsānāṁ mārgaśīrṣo 'ham') keeps ṛ/ṁ: only ś/ṣ change inside it. */
function prose(text: string): string {
  const keep = /māsānāṁ mārga(?:śīrṣ|shīrsh)o 'ham/g;
  const parts = text.split(keep);
  const verses = text.match(keep) ?? [];
  return parts.map((p, i) => apply(apply(apply(p, NAMES), PROSE), SH) + (verses[i] ? apply(verses[i], SH) : "")).join("");
}

let changed = 0;
for (const file of fs.readdirSync(DIR).filter((f) => /^day-\d\d(-[a-z]+)?\.md$/.test(f)).sort()) {
  const p = path.join(DIR, file);
  const raw = fs.readFileSync(p, "utf8");
  // Front matter lines (the "# Day" title is prose; "Source:" lines are notes) and
  // everything from "## Notes" on keep their spelling.
  const at = raw.search(/\n## (Notes|Corrections)/);
  const head = at === -1 ? raw : raw.slice(0, at);
  const tail = at === -1 ? "" : raw.slice(at);
  const next = head.split(/(\n\n)/).map((block) => (/^(Source:|Day 1 —)/.test(block) ? block : prose(block))).join("") + tail;
  if (next !== raw) {
    fs.writeFileSync(p, next);
    changed += 1;
  }
}

const versesPath = path.join(DIR, "verses.json");
const verses = JSON.parse(fs.readFileSync(versesPath, "utf8"));
const romanOf = (block: { roman?: string[]; iast?: string[] }) => {
  if (block.roman) block.roman = block.roman.map((l) => apply(l, SH));
  if (block.iast) block.iast = block.iast.map((l) => apply(l, SH));
};
romanOf(verses.taniyans.sanskrit);
romanOf(verses.taniyans.annavayal);
romanOf(verses.taniyans.sudikkodutta);
for (const n of Object.keys(verses.pasurams)) romanOf(verses.pasurams[n]);
fs.writeFileSync(versesPath, `${JSON.stringify(verses, null, 1)}\n`);

console.log(`house style applied: ${changed} day file(s) changed; verses.json romanisation updated`);
