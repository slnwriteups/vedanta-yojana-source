"use client";

import { useThemeControls, type ColorScheme } from "@/lib/theme";
import { useReadingPreferences } from "@/lib/reading-preferences-context";
import { useLanguage } from "@/lib/language-context";
import { FONT_SCALE_STEPS, SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/preferences";
import { settingChangedAnnouncement, translateUi, useT, type UiStringKey } from "@/lib/ui-strings";
import { useAnnounce } from "@/components/shared/LiveAnnouncer";

/**
 * Web port of mobile/components/SettingsControls.tsx. The Appearance
 * (theme override), Text size, and Language controls -- shared as-is by
 * both /settings and OnboardingGate.tsx (shown once, on first visit),
 * the same reuse mobile gets from sharing this between its Settings tab
 * and OnboardingScreen.tsx.
 */
export function SettingsControls() {
  const { override, setOverride } = useThemeControls();
  const { preferences, setFontScale } = useReadingPreferences();
  const { language, setLanguage } = useLanguage();
  const t = useT();

  const themeOptions = THEME_OPTION_KEYS.map((o) => ({ label: t(o.key), value: o.value }));
  const fontScaleOptions = FONT_SCALE_STEPS.map((step) => ({
    label: translateUi(FONT_SCALE_LABEL_KEYS[step.label], language),
    value: step.value,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PillGroup label={t("settingsLanguageLabel")} options={LANGUAGE_OPTIONS} selectedValue={language} onChange={setLanguage} />
      <PillGroup label={t("settingsAppearanceLabel")} options={themeOptions} selectedValue={override} onChange={setOverride} />
      <PillGroup label={t("settingsTextSizeLabel")} options={fontScaleOptions} selectedValue={preferences.fontScale} onChange={setFontScale} />
    </div>
  );
}

const THEME_OPTION_KEYS: { key: UiStringKey; value: ColorScheme | null }[] = [
  { key: "themeSystem", value: null },
  { key: "themeLight", value: "light" },
  { key: "themeDark", value: "dark" },
];

const FONT_SCALE_LABEL_KEYS: Record<string, UiStringKey> = {
  Small: "fontScaleSmall",
  Medium: "fontScaleMedium",
  Large: "fontScaleLarge",
  "Extra Large": "fontScaleExtraLarge",
};

/**
 * Each language option always shows its own name in its own script
 * (English/தமிழ்/ಕನ್ನಡ/हिन्दी), regardless of the currently active UI
 * language -- the standard convention for a language picker, so a
 * reader can always find their language even if the app is currently
 * showing one they don't read.
 */
const LANGUAGE_OPTIONS: { label: string; value: LanguageCode | null }[] = [
  { label: "English", value: null },
  ...SUPPORTED_LANGUAGES.map((l) => ({ label: l.nativeLabel, value: l.code })),
];

/**
 * A labeled row of mutually-exclusive pill buttons -- shared by the
 * language, theme, and font-size controls so all three look and behave
 * identically rather than duplicating the same markup three times.
 */
function PillGroup<T>({
  label,
  options,
  selectedValue,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  selectedValue: T;
  onChange: (value: T) => void;
}) {
  const { language } = useLanguage();
  const announce = useAnnounce();

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = selectedValue === option.value;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                onChange(option.value);
                announce(settingChangedAnnouncement(language, label, option.label));
              }}
              className={`min-h-11 rounded-md border px-3 py-1.5 text-sm font-semibold ${
                selected
                  ? "border-[var(--accent)] bg-[var(--surface-alt)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
