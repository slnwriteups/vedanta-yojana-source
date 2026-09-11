"use client";

import { useLanguage } from "@/lib/language-context";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/preferences";

/**
 * Compact header control for the reader's content-language preference
 * -- the same SUPPORTED_LANGUAGES list and native-script labels
 * SettingsControls.tsx's fuller language pill group uses, just a single
 * <select> here since header space is tight. Each language always
 * shows its own name in its own script (English/தமிழ்/ಕನ್ನಡ/हिन्दी),
 * regardless of the currently active UI language.
 */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <label className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
      <span className="sr-only">Language</span>
      <select
        value={language ?? ""}
        onChange={(event) => setLanguage((event.target.value || null) as LanguageCode | null)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)]"
      >
        <option value="">English</option>
        {SUPPORTED_LANGUAGES.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
