import assert from "node:assert/strict";
import { test } from "node:test";
import { checkTerms, glossaryAudit, glossaryFindings, loadGlossaryRules, parseGlossary, stem, termsIn, unglossedTerms } from "../glossary.ts";

/**
 * Glossary enforcement against the real glossaries (docs/translation-glossaries)
 * and small inline ones. Only an explicit wrong form blocks; a missing form
 * is a warning; inflected forms pass.
 */

const rules = (findings: Array<{ level: string; rule: string }>) => findings.map((f) => `${f.level} ${f.rule}`);

test("all four glossaries parse into rules, with annotations read", () => {
  for (const lang of ["ta", "kn", "hi", "te"] as const) assert.ok(loadGlossaryRules(lang).length > 300, lang);
  const kanchi = loadGlossaryRules("ta").find((e) => e.english === "Kanchi")!;
  assert.deepEqual([kanchi.forms, kanchi.verseForms], [["காஞ்சி"], ["கச்சி"]]);
  const perumal = loadGlossaryRules("hi").find((e) => e.line === 200)!;
  assert.deepEqual(perumal.wrong, ["पेरुमाळ्"]);
  const pasuram = loadGlossaryRules("kn").find((e) => e.english === "Pāsuram")!;
  assert.ok(pasuram.forms.includes("ಪಾಸುರಗಳು"), "plural from (pl. …) is an accepted form");
  // Free text after a bracket is not a form (te.md:302).
  const kula = loadGlossaryRules("te").find((e) => e.english === "Kulasekharan")!;
  assert.ok(kula.forms.every((f) => !/[;"a-z]/.test(f)), JSON.stringify(kula.forms));
});

test("book sections are scoped, and lines still headed '(new terms; review)' are marked unreviewed", () => {
  const g = parseGlossary(
    "# Test glossary\nGaruḍa = கருடன்\n# --- jaya\nBhima = பீமன்\n# --- some-book, batch 1 (new terms; review)\nYudhishthira = யுதிஷ்டிரன்\n",
    "ta",
    [["jaya", ["jaya"]]],
  );
  assert.deepEqual(g.map((e) => [e.english, e.book ?? null, e.unreviewed]), [["Garuḍa", null, false], ["Bhima", "jaya", false], ["Yudhishthira", null, true]]);
});

test("longest match wins: 'Garuḍa Vāhanam' is one term, not Garuḍa plus Vāhanam", () => {
  const found = [...termsIn("On the third day the Garuḍa Vāhanam was taken out.", loadGlossaryRules("ta")).keys()];
  assert.ok(found.includes("garuda vahanam"));
  assert.ok(!found.includes("garuda"));
});

test("inflected forms pass in every language (stems)", () => {
  assert.equal(stem("భీష్ముడు", "te"), "భీష్మ");
  assert.equal(stem("ಭೀಷ್ಮನು", "kn"), "ಭೀಷ್ಮ");
  assert.equal(stem("ஸ்ரீமன் நாராயணன்", "ta"), "ஸ்ரீமன் நாராயண");
  assert.equal(stem("मोक्षम्", "hi"), "मोक्ष");
  const cases: Array<["ta" | "kn" | "hi" | "te", string, string]> = [
    ["te", "Bhishma spoke.", "భీష్ముని మాటలు విన్నారు."],
    ["kn", "Bhishma spoke.", "ಭೀಷ್ಮನ ಮಾತುಗಳನ್ನು ಕೇಳಿದರು."],
    ["ta", "Sriman Nārāyaṇa is the refuge.", "ஸ்ரீமன் நாராயணனே புகலிடம்."],
    ["hi", "Moksham is the goal.", "मोक्ष ही लक्ष्य है।"],
  ];
  for (const [lang, en, tr] of cases) {
    const c = checkTerms(en, tr, lang);
    assert.ok(c.length >= 1, `${lang}: term found in English`);
    assert.ok(c.every((x) => x.status === "ok"), `${lang}: ${JSON.stringify(c.map((x) => [x.english, x.status]))}`);
  }
});

test("a form the glossary forbids blocks (hi पेरुमाळ्)", () => {
  const f = glossaryFindings("The Perumāḷ of this temple.", "इस मंदिर के पेरुमाळ्।", "hi");
  assert.deepEqual(rules(f), ["error glossary-wrong-variant"]);
  assert.match(f[0].detail, /पेरुमाल/);
  assert.deepEqual(rules(glossaryFindings("The Perumāḷ of this temple.", "इस मंदिर के पेरुमाल।", "hi")), []);
});

test("a missing glossary form is a warning for review, never a rejection", () => {
  for (const [lang, tr] of [["ta", "அவர் வந்தார்."], ["kn", "ಅವರು ಬಂದರು."], ["hi", "वे आए।"], ["te", "ఆయన వచ్చారు."]] as const) {
    assert.deepEqual(rules(glossaryFindings("Garuḍa came.", tr, lang)), ["warning glossary-missing"], lang);
  }
});

test("a conflicting glossary is never resolved silently: no rejection, reported as an owner decision", () => {
  // ta.md:53 accepts ஹனுமான், ta.md:419 says "not ஹனுமான்".
  assert.deepEqual(rules(glossaryFindings("Hanumān leapt.", "ஹனுமான் தாவினார்.", "ta")), []);
  assert.ok(glossaryAudit("ta").conflicts.some((c) => c.startsWith("Hanumān")));
});

test("an unreviewed glossary line cannot block on its own", () => {
  const g = parseGlossary("# --- x (new terms; review)\nTest Term = சோதனை (not சோதனா)\n", "ta");
  assert.equal(g[0].unreviewed, true);
  assert.deepEqual(g[0].wrong, ["சோதனா"]);
});

test("reviewer-preference and advisory lines ('the Lord') are preferences, not terms", () => {
  assert.deepEqual(rules(glossaryFindings("The Lord came.", "பெருமாள் வந்தார்.", "ta")), []);
  assert.deepEqual(rules(glossaryFindings("The Lord came.", "అతను వచ్చాడు.", "te")), ["warning glossary-preference"]);
});

test("words that look like terms and are in no glossary are listed as candidates", () => {
  const found = unglossedTerms("Garuḍa met Ūrdhvapuṇḍra and Kāḷiyan.", "ta");
  assert.ok(found.includes("Ūrdhvapuṇḍra"));
  assert.ok(!found.includes("Garuḍa"));
});

test("compounds written as one word and sandhi forms count as the glossary form", () => {
  assert.deepEqual(rules(glossaryFindings("A Sri Vaishṇava lives so.", "ஸ்ரீவைஷ்ணவர்கள் அவ்வாறு வாழ்கின்றனர்.", "ta")), []);
  assert.deepEqual(rules(glossaryFindings("Sriman Nārāyaṇa alone.", "ஸ்ரீமந் நாராயணனே.", "ta")), []);
});

test("a forbidden form is caught by its stem too (पेरुमाळ for 'never पेरुमाळ्'), while the right form passes", () => {
  assert.deepEqual(rules(glossaryFindings("The Perumāḷ of this temple.", "इस मंदिर के पेरुमाळ की कथा।", "hi")), ["error glossary-wrong-variant"]);
  assert.deepEqual(rules(glossaryFindings("The Perumāḷ of this temple.", "इस मंदिर के पेरुमाल की कथा।", "hi")), []);
});

test("Tamil மோட்சம் is accepted (Standard §3) and only noted as the non-preferred form", () => {
  assert.deepEqual(rules(glossaryFindings("Moksham is the goal.", "மோட்சமே குறிக்கோள்.", "ta")), ["warning glossary-preferred-form"]);
  assert.deepEqual(rules(glossaryFindings("Moksham is the goal.", "மோக்ஷமே குறிக்கோள்.", "ta")), []);
});

test("a term joined to 'Sri' (श्रीकृष्ण) is found", () => {
  assert.deepEqual(rules(glossaryFindings("Bhishma praised Krishna.", "भीष्म ने श्रीकृष्ण की स्तुति की।", "hi")).filter((r) => r.includes("glossary-missing")), []);
});
