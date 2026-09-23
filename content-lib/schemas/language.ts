import { z } from "zod";

/**
 * The reader-facing language toggle: English is always the base language
 * every record already has (untouched, unmoved -- the plain top-level
 * fields this schema always validated); these three are the only
 * additional languages this app offers. Not a general i18n locale list.
 *
 * Split out of shared.ts (which re-exports it) into its own module so
 * that lib/preferences.ts -- imported by "use client" components
 * site-wide (LanguageSwitcher.tsx, SettingsControls.tsx) for
 * SUPPORTED_LANGUAGES/LanguageCode -- can import it without also pulling
 * in shared.ts's MigrationMetadataSchema/ImageEntrySchema, which would
 * otherwise ship their internal field names into every page's client JS
 * bundle. Language codes/labels are ordinary public content (rendered
 * directly in the language picker), so this standalone module carries no
 * such exposure.
 */
export const LanguageCodeSchema = z.enum(["ta", "kn", "hi", "te"]);
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

export interface LanguageOption {
  code: LanguageCode;
  /** English name, used in the language picker alongside the native name. */
  label: string;
  /** The language's own name, in its own script. */
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
];
