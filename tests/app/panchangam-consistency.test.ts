import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The web and mobile apps compute the Panchangam with the same shared
 * content-lib engine and observance layer; what each keeps its own copy
 * of -- the labels and the UI strings -- must say the same thing.
 */

/** The code of a labels file, without its imports and comments, which may differ. */
function code(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8")
    .split("\n")
    .filter((line) => !/^import /.test(line) && !/^\s*(\/\*\*|\*|\/\/)/.test(line))
    .join("\n");
}

test("the web and mobile Panchangam labels are the same code", () => {
  assert.equal(code("../../lib/panchangam-labels.ts"), code("../../mobile/panchangam-labels.ts"));
});

/** Each top-level entry of a UI strings file, by key, whitespace collapsed (the modules import React, so are read as text). */
function uiStrings(path: string): Map<string, string> {
  const text = readFileSync(new URL(path, import.meta.url), "utf8");
  const entries = new Map<string, string>();
  for (const match of text.matchAll(/^  (\w+): (\{[^}]*\}),$/gm)) entries.set(match[1], match[2].replace(/\s+/g, " "));
  return entries;
}

test("every Panchangam UI string reads the same on web and mobile, in every language", () => {
  const web = uiStrings("../../lib/ui-strings.ts");
  const mobile = uiStrings("../../mobile/ui-strings.ts");
  const keys = [...web.keys()].filter((key) => /^(homeCalendar|observance|homeSankalpam|panchangam(Change|Choose)Place)/.test(key));
  assert.ok(keys.length >= 15, `${keys.length} keys`);
  for (const key of keys) assert.equal(mobile.get(key), web.get(key), key);
});

/**
 * The Panchangam shows the day's observances by name only. A source line
 * under them ("Sri Ranganātha Pādukā · * Calculated") and a "*" after the
 * calculated ones were removed as redundant; this keeps them from coming
 * back on either app, in any language.
 */
test("the Panchangam shows no observance source labels or \"*\" markers", () => {
  const files = [
    "../../components/home/PanchangamCalendar.tsx",
    "../../mobile/components/PanchangamCalendar.tsx",
    "../../lib/ui-strings.ts",
    "../../mobile/ui-strings.ts",
    "../../content-lib/panchangam-observances.ts",
  ];
  const labels = [
    /observanceSource/,
    /ObservanceSourceNote/,
    /observanceSrirangamDates/,
    /Ranganātha Pādukā|Ranganatha Paduka|ரங்கநாத பாதுகா|ರಂಗನಾಥ ಪಾದುಕಾ|रङ्गनाथ पादुका|రంగనాథ పాదుకా/,
    /"Calculated"|கணக்கிடப்பட்டது|ಲೆಕ್ಕಹಾಕಲಾಗಿದೆ|गणना से|లెక్కించబడింది/,
    /["'`] \*["'`]/,
  ];
  for (const file of files) {
    const source = code(file);
    for (const label of labels) assert.doesNotMatch(source, label, `${file} shows ${label}`);
  }
});
