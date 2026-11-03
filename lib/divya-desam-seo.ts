/** Search summaries use existing facts; the scholarly text stays untouched. */
type TempleRecord = {
  slug: string;
  displayName: string;
  region?: string;
  templeInformation: { moolavar?: string; travelNote?: string };
  sthalaPuranam?: string;
  azhwarPasuram?: string;
  shrines: { sthalaPuranam?: string; azhwarPasuram?: string }[];
};

export function plainTempleName(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "");
}

export function templeSearchName(record: Pick<TempleRecord, "slug" | "displayName">): string {
  // Common joined spelling; keep Sri Raṅgam as the visible primary name.
  return record.slug === "sri-rangam" ? "Srirangam" : plainTempleName(record.displayName);
}

export function templeSeo(record: TempleRecord) {
  const name = templeSearchName(record);
  const celestial = record.region === "Viṇṇulaga Tiruppatigaḷ";
  const title = `${name} ${celestial ? "Divya Desam" : "Temple"}: Sthala Puranam`;
  const deity = record.templeInformation.moolavar;
  const identity = `${name}${name !== record.displayName ? ` (${record.displayName})` : ""}${deity ? ` — ${deity}` : ""}.`;
  const sections = [
    record.sthalaPuranam || record.shrines.some(s => s.sthalaPuranam) ? "sthala puranam" : null,
    record.azhwarPasuram || record.shrines.some(s => s.azhwarPasuram) ? "Azhwar pasurams" : null,
    record.templeInformation.travelNote ? "how to reach" : null,
  ].filter(Boolean);
  const summary = `${identity} Explore this Divya Desam${sections.length ? `: ${sections.join(", ")}` : ""}.`;
  return { name, title, summary, celestial };
}
