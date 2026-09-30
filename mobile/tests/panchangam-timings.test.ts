import test from "node:test";
import assert from "node:assert/strict";
import { formatPanchangamTime, parsePanchangamTimings } from "../services/panchangamTimings.ts";

// Verbatim findDailycal response for Bengaluru, 30 Sep 2026.
const LIVE_RESPONSE =
  '"<b></b><br/><i>k.chaturthi 17:07/27-17  </br>bharani 10:21/10-22  </i><br/>Sunrise: <i>06:12</i> Sunset: <i>18:07/29-46</i></br>RK: <i>12:08-13:37</i> YG: <i>07:41-09:10</i><br/></i> Gulikan: <i>10:39-12:08</i><br/></i> Sraddha Thithi(s): <i>kanyA:k.chaturthi</i><br/></i> Yogam: <i> vasara-nakshatra ashubam & Na: 06:12-10:21; Si: 10:21-06:12*</i><br/></i> Karanam: <i>bAlavam: 06:12-17:07/27-17; koulavam: 17:07-04:02*/54-35; taitulai: 04:02*-06:12*/60-0</i><br/>For Bengaluru on <b>30th Sep 2026</b><br/>"';

test("parses sunrise, sunset and the three kaalams from a live daily-calendar response", () => {
  assert.deepEqual(parsePanchangamTimings(LIVE_RESPONSE), {
    sunrise: "06:12",
    sunset: "18:07",
    rahuKaalam: "12:08-13:37",
    yamagandam: "07:41-09:10",
    gulikaKaalam: "10:39-12:08",
  });
});

test("a response without timings yields empty fields, never guessed times", () => {
  assert.deepEqual(parsePanchangamTimings("<b></b><br/><i>k.chaturthi</br>bharani</i>"), {
    sunrise: "",
    sunset: "",
    rahuKaalam: "",
    yamagandam: "",
    gulikaKaalam: "",
  });
});

test("formats 24-hour ranges and single times in the reader's locale", () => {
  assert.equal(formatPanchangamTime("12:08-13:37", "en-US"), "12:08 PM – 1:37 PM");
  assert.equal(formatPanchangamTime("06:12", "en-US"), "6:12 AM");
});

test("anything not in HH:MM shape is shown exactly as received", () => {
  assert.equal(formatPanchangamTime("", "en-US"), "");
  assert.equal(formatPanchangamTime("around noon", "en-US"), "around noon");
  assert.equal(formatPanchangamTime("25:00-26:00", "en-US"), "25:00-26:00");
});
