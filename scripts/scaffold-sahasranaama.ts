import path from "node:path";
import { assertConverted, generate } from "./translation/mechanical.ts";
import { args, loadBook, parseLangs, WORK_DIR, writeJson } from "./translation/work.ts";

/**
 * Pre-generates every mechanical paragraph of a book in ta/kn/hi/te with
 * no AI: verse blocks, Sahasranaama name lines and mantras
 * (docs/TRANSLATION-GUIDE.md §5, §10). Prose slots are left as null.
 *
 *   node scripts/scaffold-sahasranaama.ts [--book=<slug>] [--langs=ta,kn] [--check]
 *
 * Writes translation-work/<book>/skeleton/<chapter>.json (not tracked;
 * a preview of exactly what translation-merge.ts will put around the
 * translated prose). It never writes to content/.
 *
 * --check compares the generated paragraphs with any translations already
 * live, and prints every difference.
 */

const a = args();
const book = loadBook(a.book ?? "sri-vishnu-sahasranaama-anubhavam");
const langs = parseLangs(a.langs);
const counts: Record<string, number> = { deva: 0, roman: 0, "roman-alone": 0, name: 0, mantra: 0, prose: 0 };
let same = 0;
const diffs: string[] = [];

for (const ch of book.chapters) {
  const skeleton: Record<string, Array<string | null>> = {};
  ch.kinds.forEach((k) => counts[k]++);
  for (const lang of langs) {
    skeleton[lang] = ch.paragraphs.map((p, i) => {
      const g = generate(ch.kinds[i], p, ch.paragraphs[i - 1], lang);
      if (g !== null) assertConverted(g, `${ch.slug} ¶${i} ${lang}`);
      return g;
    });
    if (a.check) {
      const live = ch.record.translations?.[lang]?.body?.split(/\n\s*\n/);
      if (!live || live.length !== ch.paragraphs.length) continue;
      skeleton[lang].forEach((g, i) => {
        if (g === null) return;
        if (g === live[i]) same++;
        else diffs.push(`${lang} ${ch.slug} ¶${i} (${ch.kinds[i]})\n  generated: ${g.replace(/\n/g, " / ")}\n  live:      ${live[i].replace(/\n/g, " / ")}`);
      });
    }
  }
  writeJson(path.join(WORK_DIR, book.slug, "skeleton", `${ch.slug}.json`), { chapter: ch.slug, kinds: ch.kinds, ...skeleton });
}

const mechanical = counts.deva + counts.roman + counts["roman-alone"] + counts.name + counts.mantra;
console.log(`${book.slug}: ${book.chapters.length} chapters, ${mechanical + counts.prose} paragraphs`);
console.log(`  mechanical (0 tokens): ${mechanical}  [verses ${counts.deva}+${counts.roman + counts["roman-alone"]}, names ${counts.name}, mantras ${counts.mantra}]`);
console.log(`  prose (to translate):  ${counts.prose}`);
console.log(`  skeletons: translation-work/${book.slug}/skeleton/ (${langs.join(", ")})`);
if (a.check) {
  console.log(`\n--check: ${same} generated paragraphs match the live translation, ${diffs.length} differ`);
  for (const d of diffs) console.log(d);
}
