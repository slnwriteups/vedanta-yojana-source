import test from "node:test";
import assert from "node:assert/strict";

import { iastToScript } from "../../content-lib/sanskrit-script.ts";
import { localizeEnglishDates } from "../../content-lib/panchangam-dates.ts";
import { PADUKA_PANCHANGAM_ISSUES } from "../../content-lib/paduka-panchangam.ts";
import { localizeSankalpamText, localizeUpcomingEkadashi } from "../../lib/panchangam-labels.ts";
import * as mobileLabels from "../../mobile/panchangam-labels.ts";

const LANGUAGES = ["ta", "kn", "hi", "te"] as const;

test("transliterating the Tarpana Sankalpams reproduces the hand-written versions word for word", () => {
  let checked = 0;
  for (const issue of PADUKA_PANCHANGAM_ISSUES) {
    for (const tarpanam of issue.tarpanams) {
      // A parenthesised note ("catuṣpāda till 09.05") is translated, not transliterated.
      const words = (text: string) => text.replace(/\([^)]*\)/g, "").split(/[\s,;.]+/).filter(Boolean);
      const source = words(tarpanam.sankalpam);
      for (const language of LANGUAGES) {
        const written = words(tarpanam.translations[language].sankalpam);
        assert.equal(written.length, source.length, `${language}: word count`);
        source.forEach((word, i) => {
          assert.equal(iastToScript(word, language), written[i], `${language}: ${word}`);
          checked += 1;
        });
      }
    }
  }
  assert.ok(checked > 300, `${checked} words checked`);
});

test("the daily Sankalpam reads in the reader's script, with its date in their language", () => {
  const sentence =
    "Sankalpam for Singapore on 15th Oct 2026 At 06:52 PM GMT+8 and valid through 07:10:02 PM: Parābhava nāma saṁvatsare, dakṣiṇāyane, śarad ṛtau, tulā māse, śukla pakṣe";
  for (const labels of [{ localizeSankalpamText }, mobileLabels]) {
    const kn = labels.localizeSankalpamText(sentence, "kn");
    assert.match(kn, /15 ಅಕ್ಟೋಬರ್ 2026/);
    assert.match(kn, /ಪರಾಭವ ನಾಮ ಸಂವತ್ಸರೇ, ದಕ್ಷಿಣಾಯನೇ, ಶರದ್ ಋತೌ, ತುಲಾ ಮಾಸೇ, ಶುಕ್ಲ ಪಕ್ಷೇ$/);
    assert.match(labels.localizeSankalpamText(sentence, "hi"), /पराभव नाम संवत्सरे, दक्षिणायने, शरद् ऋतौ/);
    assert.match(labels.localizeSankalpamText(sentence, "te"), /పరాభవ నామ సంవత్సరే/);
    assert.match(labels.localizeSankalpamText(sentence, "ta"), /பராபவ நாம ஸம்வத்ஸரே/);
    for (const language of LANGUAGES) {
      const text = labels.localizeSankalpamText(sentence, language);
      assert.doesNotMatch(text.slice(text.lastIndexOf(": ")), /[a-zāīūṛṝṁḥśṣṭḍṇñṅ]/i, language);
    }
    assert.equal(labels.localizeSankalpamText(sentence, null), sentence);
  }
});

test("engine dates are written in the reader's language", () => {
  assert.equal(localizeEnglishDates("Thursday, 22nd Oct 2026", "kn"), "ಗುರುವಾರ, 22 ಅಕ್ಟೋಬರ್ 2026");
  assert.equal(localizeEnglishDates("on 1st Jan 2027.", "ta"), "on 1 ஜனவரி 2027.");
  assert.equal(localizeEnglishDates("22nd Oct 2026", null), "22nd Oct 2026");
  assert.match(localizeUpcomingEkadashi("Next Ekadasi: Thursday, 22nd Oct 2026", "hi"), /गुरुवार, 22 अक्टूबर 2026$/);
});
