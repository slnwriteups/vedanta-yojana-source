/**
 * Search over the bundled place list (panchangam-places-data.ts), so a
 * reader can see the Panchangam for a city of their choice instead of
 * their own location. Everything is on the device: typing a city name
 * sends nothing anywhere.
 *
 * The data module is about 570 KB, so callers load this module with a
 * dynamic import() when the reader opens the city search, keeping it out
 * of the Home screen's startup path.
 */
import type { ChosenPlace } from "./panchangam-place.ts";
import { PLACE_COUNTRIES, PLACE_REGIONS, PLACE_ROWS, PLACE_TIME_ZONES } from "./panchangam-places-data.ts";

interface IndexedPlace {
  place: ChosenPlace;
  /** Normalized searchable names: the place name first, then its aliases. */
  keys: string[];
  /** Normalized words of every key, for matching "rio" in "Rio de Janeiro"'s second word too. */
  words: string[];
}

let index: IndexedPlace[] | null = null;

/** Lowercase, no diacritics, punctuation as spaces: "Srīperumbūdūr" and "sriperumbudur" match. */
export function normalizePlaceText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildIndex(): IndexedPlace[] {
  return PLACE_ROWS.split("\n").map((line) => {
    const [name, aliases, region, country, latitude, longitude, timeZone] = line.split("|");
    const keys = [name, ...(aliases ? aliases.split(";") : [])].map(normalizePlaceText);
    return {
      place: {
        name,
        region: PLACE_REGIONS[Number(region)],
        country: PLACE_COUNTRIES[Number(country)],
        latitude: Number(latitude),
        longitude: Number(longitude),
        timeZone: PLACE_TIME_ZONES[Number(timeZone)],
      },
      keys,
      words: keys.flatMap((k) => k.split(" ")),
    };
  });
}

/** How well `query` matches a place: 0 = exact name, 1 = name starts with it, 2 = a word does; -1 = no match. */
function matchRank(entry: IndexedPlace, query: string): number {
  if (entry.keys.includes(query)) return 0;
  if (entry.keys.some((k) => k.startsWith(query))) return 1;
  if (!query.includes(" ") && entry.words.some((w) => w.startsWith(query))) return 2;
  return -1;
}

/**
 * Places matching what the reader has typed, best first: an exact name,
 * then names starting with it, then names with a word starting with it;
 * within each, Indian places first, then larger places first. A second part after a comma narrows
 * by region or country ("Springfield, Illinois").
 */
export function searchPlaces(text: string, limit = 20): ChosenPlace[] {
  const [namePart, ...rest] = text.split(",");
  const query = normalizePlaceText(namePart);
  if (query.length < 2) return [];
  const within = normalizePlaceText(rest.join(" "));
  index ??= buildIndex();

  const ranked: Array<{ rank: number; order: number; place: ChosenPlace }> = [];
  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    const rank = matchRank(entry, query);
    if (rank === -1) continue;
    if (within) {
      const where = normalizePlaceText(`${entry.place.region} ${entry.place.country}`);
      if (!within.split(" ").every((w) => where.split(" ").some((x) => x.startsWith(w)))) continue;
    }
    ranked.push({ rank, order: i, place: entry.place });
  }
  // Most readers are in India, so among equally good matches Indian places come first.
  const abroad = (p: ChosenPlace) => (p.country === "India" ? 0 : 1);
  ranked.sort((a, b) => a.rank - b.rank || abroad(a.place) - abroad(b.place) || a.order - b.order);
  return ranked.slice(0, limit).map((r) => r.place);
}
