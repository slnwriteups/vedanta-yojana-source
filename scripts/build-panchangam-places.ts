/**
 * Builds content-lib/panchangam-places-data.ts -- the bundled list of
 * places a reader can choose for the Panchangam instead of their own
 * location -- from the GeoNames dump files.
 *
 *   node scripts/build-panchangam-places.ts <dir with GeoNames files>
 *
 * The directory must hold, unzipped, from https://download.geonames.org/export/dump/:
 * cities15000.txt, cities5000.txt, IN.txt (from IN.zip), admin1CodesASCII.txt,
 * countryInfo.txt.
 *
 * Kept: every Indian town of 5,000+ people, and places of 50,000+
 * elsewhere -- the readership is mostly in India, and abroad mostly in
 * cities. Neighbourhoods and historical/abandoned places (PPLX, PPLH,
 * PPLQ, PPLW) are dropped. Rows are sorted by population, so a row's
 * index is its search rank.
 *
 * GeoNames data is CC BY 4.0: the generated file and the app's
 * attribution credit it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/build-panchangam-places.ts <geonames dir>");
  process.exit(1);
}

const INDIA_MIN_POPULATION = 5000;
const WORLD_MIN_POPULATION = 50000;
const EXCLUDED_FEATURES = new Set(["PPLX", "PPLH", "PPLQ", "PPLW"]);

/**
 * Former or common English names readers still type, mapped to the
 * GeoNames name of the same city. Only well-established renamings: a
 * name here must be the same place, never a nearby one.
 */
const ALIASES: Record<string, string[]> = {
  Bengaluru: ["Bangalore"],
  Chennai: ["Madras"],
  Mumbai: ["Bombay"],
  Kolkata: ["Calcutta"],
  Tiruchirappalli: ["Trichy", "Tiruchi", "Trichinopoly"],
  Thiruvananthapuram: ["Trivandrum"],
  Mysuru: ["Mysore"],
  Puducherry: ["Pondicherry"],
  Varanasi: ["Benares", "Banaras", "Kashi"],
  Gurugram: ["Gurgaon"],
  Kanchipuram: ["Kancheepuram", "Conjeevaram"],
  Thanjavur: ["Tanjore"],
  Vadodara: ["Baroda"],
  Pune: ["Poona"],
  Kochi: ["Cochin"],
  Mangaluru: ["Mangalore"],
  Hubballi: ["Hubli"],
  Belagavi: ["Belgaum"],
  Visakhapatnam: ["Vizag"],
  Prayagraj: ["Allahabad"],
  Kozhikode: ["Calicut"],
  Thrissur: ["Trichur"],
};

/**
 * Sri Vaishnava pilgrimage towns too small for the city lists, taken from
 * GeoNames' full India file by ID (not name, which other villages share),
 * with the spellings readers search for.
 */
const PILGRIMAGE_TOWNS: Record<string, string[]> = {
  "1255624": [], // Srirangam
  "1263152": ["Melkote"], // Melukote
  "1259985": ["Ahobilam"], // Pedda Ahobilam
  "1262126": ["Naimisharanya"], // Naimishāranya
  "1254379": [], // Tirukkannapuram
  "11663103": ["Thirukoshtiyur"], // Tirukkoshtiyūr
};

type Row = {
  id: string;
  name: string;
  country: string;
  admin1: string;
  feature: string;
  latitude: number;
  longitude: number;
  population: number;
  timeZone: string;
};

function readTsv(file: string): string[][] {
  return readFileSync(join(dir, file), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

function toRow(f: string[]): Row {
  return {
    id: f[0],
    name: f[1],
    feature: f[7],
    country: f[8],
    admin1: f[10],
    latitude: Number(f[4]),
    longitude: Number(f[5]),
    population: Number(f[14]),
    timeZone: f[17],
  };
}

const byId = new Map<string, Row>();
for (const f of readTsv("cities5000.txt")) {
  const row = toRow(f);
  if (row.country === "IN" && row.population >= INDIA_MIN_POPULATION) byId.set(row.id, row);
}
for (const f of readTsv("cities15000.txt")) {
  const row = toRow(f);
  if (row.country !== "IN" && row.population >= WORLD_MIN_POPULATION) byId.set(row.id, row);
}

const extraAliases = new Map<string, string[]>();
for (const f of readTsv("IN.txt")) {
  if (!(f[0] in PILGRIMAGE_TOWNS)) continue;
  byId.set(f[0], toRow(f));
  extraAliases.set(f[0], PILGRIMAGE_TOWNS[f[0]]);
}
if (extraAliases.size !== Object.keys(PILGRIMAGE_TOWNS).length) throw new Error("a pilgrimage town ID was not found in IN.txt");

// Same name in the same region of the same country: keep the larger.
const byKey = new Map<string, Row>();
for (const row of byId.values()) {
  if (EXCLUDED_FEATURES.has(row.feature) || !row.timeZone || !Number.isFinite(row.latitude)) continue;
  const key = `${row.name}|${row.admin1}|${row.country}`;
  const existing = byKey.get(key);
  if (!existing || existing.population < row.population) byKey.set(key, row);
}
const rows = [...byKey.values()].sort((a, b) => b.population - a.population || a.name.localeCompare(b.name));

const regionNames = new Map<string, string>();
for (const f of readTsv("admin1CodesASCII.txt")) regionNames.set(f[0], f[1]);
const countryNames = new Map<string, string>();
for (const f of readTsv("countryInfo.txt")) countryNames.set(f[0], f[4]);

const timeZones: string[] = [];
const regions: string[] = [];
const countries: string[] = [];
function indexOf(list: string[], value: string): number {
  let i = list.indexOf(value);
  if (i === -1) i = list.push(value) - 1;
  return i;
}

for (const name of Object.keys(ALIASES)) {
  if (!rows.some((r) => r.name === name && r.country === "IN")) throw new Error(`alias target not found: ${name}`);
}

const lines = rows.map((r) => {
  const region = regionNames.get(`${r.country}.${r.admin1}`) ?? "";
  const country = countryNames.get(r.country) ?? r.country;
  const aliases = (extraAliases.get(r.id) ?? (r.country === "IN" ? ALIASES[r.name] : undefined) ?? []).join(";");
  for (const field of [r.name, region, country, aliases]) {
    if (/[|\n]/.test(field)) throw new Error(`separator in field: ${field}`);
  }
  return [
    r.name,
    aliases,
    indexOf(regions, region),
    indexOf(countries, country),
    r.latitude.toFixed(2),
    r.longitude.toFixed(2),
    indexOf(timeZones, r.timeZone),
  ].join("|");
});

const header = `/**
 * GENERATED by scripts/build-panchangam-places.ts -- do not edit by hand.
 *
 * Places a reader can choose for the Panchangam: ${rows.length} in all
 * (every Indian town of ${INDIA_MIN_POPULATION}+ people, places of ${WORLD_MIN_POPULATION}+ elsewhere,
 * and ${Object.keys(PILGRIMAGE_TOWNS).length} smaller Sri Vaishnava pilgrimage towns).
 * One row per line, largest population first:
 *   name|aliases (;-separated)|region index|country index|latitude|longitude|time zone index
 *
 * Contains data from GeoNames (https://www.geonames.org), licensed under
 * CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
 */
`;

const body = `${header}
export const PLACE_TIME_ZONES: readonly string[] = ${JSON.stringify(timeZones)};

export const PLACE_REGIONS: readonly string[] = ${JSON.stringify(regions)};

export const PLACE_COUNTRIES: readonly string[] = ${JSON.stringify(countries)};

export const PLACE_ROWS = ${JSON.stringify(lines.join("\n"))};
`;

writeFileSync(new URL("../content-lib/panchangam-places-data.ts", import.meta.url), body);
console.log(`${rows.length} places, ${timeZones.length} time zones, ${(body.length / 1024).toFixed(0)} KB`);
