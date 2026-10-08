import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPanchangam } from "../../lib/panchangam-service.ts";
import { localizeSankalpamText } from "../../lib/panchangam-labels.ts";

/**
 * Covers naming the place a Panchangam/Sankalpam is valid for, rather
 * than showing the reader an unnamed "Your Location".
 *
 * The web service's own resolution path is exercised for real (stubbed
 * `navigator.geolocation`, `window.localStorage` and `fetch` -- none of
 * which node provides), because the part that must not regress is
 * behavioural: the resolved place name has to reach the Sankalpam
 * sentence the reader recites, and the only network request the
 * calendar ever makes is the reverse geocoder's. The mobile service and
 * both cards are held by structural source checks in the style of
 * tests/app/ci.test.ts: a node test cannot render React Native, but it
 * can hold the two platforms to the same contract.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const storage = new Map<string, string>();
let position: { latitude: number; longitude: number } | null = null;
let geocodeAnswer: { ok: boolean; body: unknown } = { ok: true, body: {} };
let requestedUrls: string[] = [];

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
  },
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    geolocation: {
      getCurrentPosition: (
        onSuccess: (p: { coords: { latitude: number; longitude: number } }) => void,
        onError: () => void
      ) => {
        if (position) onSuccess({ coords: position });
        else onError();
      },
    },
  },
});

globalThis.fetch = (async (input: string | URL) => {
  const url = String(input);
  requestedUrls.push(url);
  if (url.startsWith("https://api.bigdatacloud.net/")) {
    return { ok: geocodeAnswer.ok, json: async () => geocodeAnswer.body } as unknown as Response;
  }
  throw new Error(`unexpected request to ${url}`);
}) as typeof fetch;

function resetBrowserState() {
  storage.clear();
  requestedUrls = [];
  position = { latitude: 13.0827, longitude: 80.2707 };
  geocodeAnswer = { ok: true, body: { city: "Chennai", locality: "Chennai", principalSubdivision: "Tamil Nadu" } };
}

test("the resolved place name reaches the Sankalpam sentence and the data itself, computed with no calendar request", async () => {
  resetBrowserState();

  const data = await fetchPanchangam(new Date(2026, 8, 22, 19, 2));

  assert.equal(data.location, "Chennai");
  // The place is named in the sentence the reader actually recites.
  assert.match(data.sankalpamText, /^Sankalpam for Chennai on 22nd Sep 2026/);
  assert.ok(data.tithi && data.nakshatram && data.sunrise, "the Panchangam itself was not computed");
  assert.ok(
    requestedUrls.every((url) => url.startsWith("https://api.bigdatacloud.net/")),
    `the calendar made a network request: ${requestedUrls.join(", ")}`
  );
  // The Ekadashi banner keeps stripping its own city text: the place is
  // stated once, in its own row, not repeated inside every value.
  assert.match(data.upcomingEkadashiText, /^Next Ekadasi: /);
});

test("a place name falls back to `locality`, then to the wider subdivision, before giving up", async () => {
  for (const [body, expected] of [
    [{ city: "", locality: "Cupertino", principalSubdivision: "California" }, "Cupertino"],
    [{ city: "", locality: "", principalSubdivision: "California" }, "California"],
  ] as const) {
    resetBrowserState();
    geocodeAnswer = { ok: true, body };
    const data = await fetchPanchangam(new Date(2026, 8, 22, 19, 2));
    assert.equal(data.location, expected);
  }
});

test("a resolved place name is cached across days, so the geocoder is asked once per place", async () => {
  resetBrowserState();
  await fetchPanchangam(new Date(2026, 8, 22, 19, 2));

  requestedUrls = [];
  // A different day: its own Panchangam cache entry, but the same place.
  const data = await fetchPanchangam(new Date(2026, 8, 23, 19, 2));

  assert.equal(data.location, "Chennai");
  assert.deepEqual(requestedUrls, [], "the second day re-asked the geocoder for a place it had already resolved");
  assert.match(data.sankalpamText, /^Sankalpam for Chennai /);
});

test("an unresolvable place name yields no location rather than a placeholder one, and is not cached", async () => {
  for (const answer of [
    { ok: false, body: {} },
    // Real coordinates with no named place at all (mid-ocean).
    { ok: true, body: { city: "", locality: "", principalSubdivision: "" } },
  ]) {
    resetBrowserState();
    geocodeAnswer = answer;

    const data = await fetchPanchangam(new Date(2026, 8, 22, 19, 2));

    // Empty, never the "Your Location" placeholder the Sankalpam
    // sentence still has to name: the card omits the row rather than
    // naming a place the app does not actually know.
    assert.equal(data.location, "");
    assert.ok(data.tithi, "the Panchangam itself must still resolve from the coordinates");
    assert.match(data.sankalpamText, /^Sankalpam for Your Location /);
    assert.deepEqual(
      [...storage.keys()].filter((key) => key.startsWith("vy.calendar.place.")),
      [],
      "a failed lookup was cached, pinning the placeholder to this location"
    );
  }
});

test("a denied location permission still yields no place name and no network call", async () => {
  resetBrowserState();
  position = null;

  const data = await fetchPanchangam(new Date(2026, 8, 22, 19, 2));

  assert.equal(data.location, "");
  assert.equal(data.upcomingEkadashiText, "Enable location access for today's Panchangam");
  assert.deepEqual(requestedUrls, []);
});

test("a place name containing the word 'on' does not swallow the Sankalpam's date", () => {
  const sentence =
    "Sankalpam for Stratford on Avon on 22nd Sep 2026 At 07:02 PM IST and valid through 09:20:12 PM: parAbhava nAma saMvathsare";

  const localized = localizeSankalpamText(sentence, "hi");

  assert.match(localized, /^Stratford on Avon के लिए संकल्प — 22nd Sep 2026, /);

  const localizedTe = localizeSankalpamText(sentence, "te");
  assert.match(localizedTe, /^Stratford on Avon కొరకు సంకల్పం — 22nd Sep 2026, /);
});

test("both platforms label the location row, in all five languages", () => {
  for (const file of ["lib/ui-strings.ts", "mobile/ui-strings.ts"]) {
    const entry = read(file).match(/homeCalendarLocationLabel: \{[^}]*\}/);
    assert.ok(entry, `${file} defines no homeCalendarLocationLabel`);
    for (const language of ["en", "ta", "kn", "hi", "te"]) {
      assert.match(entry[0], new RegExp(`\\b${language}: "`), `${file} has no ${language} location label`);
    }
  }
});

test("both platforms' Panchangam cards render the location, and only when there is one", () => {
  for (const file of ["components/home/PanchangamCard.tsx", "mobile/components/PanchangamCard.tsx"]) {
    const source = read(file);
    assert.match(source, /\{panchangam\.location \? \(/, `${file} renders the location unconditionally or not at all`);
    assert.match(source, /homeCalendarLocationLabel/, `${file} renders the location without its label`);
  }
});

test("both platforms compute the Panchangam on the device and blank an unresolved place name", () => {
  for (const file of ["lib/panchangam-service.ts", "mobile/services/panchangamService.ts"]) {
    const source = read(file);
    assert.match(source, /computePanchangamForDate\(/, `${file} no longer computes the Panchangam itself`);
    assert.doesNotMatch(source, /appspot\.com|workers\.dev|ahobilamutt/i, `${file} depends on a third-party calendar service again`);
    assert.match(
      source,
      /location: location\.city === UNNAMED_LOCATION \? "" : location\.city/,
      `${file} can surface the placeholder as if it were a real place name`
    );
  }
});
