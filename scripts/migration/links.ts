import type { ResourceEntry, ResourceLanguage, Shrine } from "../../content-lib/schemas/index.ts";
import { UnsupportedResourceLabelError } from "./errors.ts";
import type { SourceExternalLink } from "./types.ts";

/**
 * Explicit, table-driven language normalization. No substring guessing,
 * no fuzzy matching — an unrecognized label is a hard error (see
 * UnsupportedResourceLabelError), never a silent best-guess.
 */
const LANGUAGE_LABEL_TABLE: Record<string, ResourceLanguage> = {
  "English Pasuram": "English",
  "English Pasurams": "English",
  "Tamizh Pasuram": "Tamil",
  "Tamizh Pasurams": "Tamil",
  "Kannada Pasuram": "Kannada",
  "Kannada Pasurams": "Kannada",
  "Sanskrit Pasuram": "Sanskrit",
  "Sanskrit Pasurams": "Sanskrit",
  "Devanagarii Pasuram": "Devanagari",
  "Telugu Pasuram": "Telugu",
  "Telugu Pasurams": "Telugu",
};

export function normalizeResourceLanguage(sourceLabel: string): ResourceLanguage {
  const normalized = LANGUAGE_LABEL_TABLE[sourceLabel];
  if (!normalized) {
    throw new UnsupportedResourceLabelError(sourceLabel);
  }
  return normalized;
}

/** `resourceType: "sloka_pdf_prapatti"` -> a destination `resources[]` entry. */
export function transformPdfResource(link: SourceExternalLink): ResourceEntry {
  const label = link.sourceComponentLabel ?? "";
  const language = normalizeResourceLanguage(label);
  return {
    language,
    type: "pasuram-pdf",
    url: link.url,
    sourceLabel: label,
  };
}

/**
 * Shrine-label normalization for Maps links:
 *   - "" / "Maps" (the generic label)      -> null
 *   - "Maps- Example Shrine"                -> "Example Shrine"
 *   - "Maps (Example)"                      -> "Example"
 *   - anything else (e.g. "Map 1", "Map 2") -> preserved as-is, distinguishable
 */
function normalizeShrineLabel(sourceLabel: string): string | null {
  const trimmed = sourceLabel.trim();
  if (trimmed === "" || trimmed === "Maps") return null;

  const dashMatch = trimmed.match(/^Maps-\s*(.+)$/);
  if (dashMatch) return dashMatch[1].trim();

  const parenMatch = trimmed.match(/^Maps\s*\((.+)\)$/);
  if (parenMatch) return parenMatch[1].trim();

  return trimmed;
}

/** `resourceType: "google_maps_location"` -> a destination `shrines[]` entry. */
export function transformMapsLink(link: SourceExternalLink): Shrine {
  const label = link.sourceComponentLabel ?? "";
  return {
    label: normalizeShrineLabel(label),
    mapsLink: link.url,
  };
}
