/**
 * Display formatting for the day's sunrise/sunset and inauspicious
 * periods (Rahu Kaalam, Yamagandam, Gulika Kaalam), which
 * content-lib/panchangam-engine.ts computes as 24-hour local "HH:MM"
 * times and "HH:MM-HH:MM" ranges. Kept free of platform imports so it
 * can be unit-tested directly.
 */

const HH_MM = /^(\d{1,2}):(\d{2})( \(\+1\))?$/;

function formatClock(value: string, locale: string): string | null {
  const match = value.trim().match(HH_MM);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const clock = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  return match[3] ? `${clock} (+1)` : clock;
}

/**
 * "12:08-13:37" -> "12:08 PM – 1:37 PM" (or a single "06:12" -> "6:12 AM"),
 * in the reader's locale. A time past midnight -- a summer sunset near
 * the poles -- keeps its "(+1)". Anything not in the expected shape is
 * shown exactly as received rather than dropped or reinterpreted.
 */
export function formatPanchangamTime(value: string, locale: string): string {
  const parts = value.split("-");
  const formatted = parts.map((part) => formatClock(part, locale));
  if (formatted.some((part) => part === null)) return value;
  return formatted.join(" – ");
}
