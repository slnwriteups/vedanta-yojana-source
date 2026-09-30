/**
 * The day's sunrise/sunset and inauspicious periods (Rahu Kaalam,
 * Yamagandam, Gulika Kaalam), read from the same findDailycal response
 * the tithi/nakshatram already come from -- no extra request. Kept free
 * of Expo imports so it can be unit-tested directly. A real response:
 *
 *   Sunrise: <i>06:12</i> Sunset: <i>18:07/29-46</i></br>RK: <i>12:08-13:37</i>
 *   YG: <i>07:41-09:10</i><br/></i> Gulikan: <i>10:39-12:08</i>
 *
 * Times are the endpoint's own 24-hour local times for the requested
 * place. A "/29-46" suffix (the same moment in ghatikas) is dropped.
 */
export interface PanchangamTimings {
  sunrise: string;
  sunset: string;
  rahuKaalam: string;
  yamagandam: string;
  gulikaKaalam: string;
}

function field(html: string, label: string): string {
  const match = html.match(new RegExp(`${label}:\\s*<i>([^<]*)</i>`, "i"));
  if (!match) return "";
  return match[1].split("/")[0].replace(/\*/g, "").trim();
}

/** Every field is "" when the response doesn't carry it -- never a guessed time. */
export function parsePanchangamTimings(html: string): PanchangamTimings {
  return {
    sunrise: field(html, "Sunrise"),
    sunset: field(html, "Sunset"),
    rahuKaalam: field(html, "RK"),
    yamagandam: field(html, "YG"),
    gulikaKaalam: field(html, "Gulikan"),
  };
}

const HH_MM = /^(\d{1,2}):(\d{2})$/;

function formatClock(value: string, locale: string): string | null {
  const match = value.trim().match(HH_MM);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/**
 * "12:08-13:37" -> "12:08 PM – 1:37 PM" (or a single "06:12" -> "6:12 AM"),
 * in the reader's locale. Anything not in the expected shape is shown
 * exactly as received rather than dropped or reinterpreted.
 */
export function formatPanchangamTime(value: string, locale: string): string {
  const parts = value.split("-");
  const formatted = parts.map((part) => formatClock(part, locale));
  if (formatted.some((part) => part === null)) return value;
  return formatted.join(" – ");
}
