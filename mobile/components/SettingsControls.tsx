import { PushNotificationSettings } from "./PushNotificationSettings";
import * as Haptics from "expo-haptics";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme, useThemeControls, type ColorScheme } from "../theme";
import { useReadingPreferences } from "../preferences-context.ts";
import { useLanguage } from "../language-context.ts";
import { TourTarget } from "../tour/Tour";
import { FONT_SCALE_STEPS, SUPPORTED_LANGUAGES, type LanguageCode } from "../content-lib/preferences.ts";
import { settingChangedAnnouncement, translateUi, useT, type UiStringKey } from "../ui-strings.ts";

/**
 * The Appearance (theme override), Text size, and Language controls --
 * Appearance/Text size originally inline on the Home tab (Phase 6C/6D),
 * extracted so the exact same UI can be reused by both
 * OnboardingScreen.tsx (shown once, on first launch) and
 * app/(tabs)/settings.tsx (reachable any time after that from its own
 * tab). Language joined them the same way, so the reader's content
 * language is chosen once up front and stays changeable later from the
 * same place -- no behavior change to the existing two: still the same
 * persisted ThemeProvider/ReadingPreferencesProvider/LanguageProvider
 * state.
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
    <View style={styles.container}>
      <PushNotificationSettings />
      <TourTarget id="settings-language">
        <PillGroup label={t("settingsLanguageLabel")} options={LANGUAGE_OPTIONS} selectedValue={language} onChange={setLanguage} />
      </TourTarget>
      <TourTarget id="settings-appearance">
        <PillGroup label={t("settingsAppearanceLabel")} options={themeOptions} selectedValue={override} onChange={setOverride} />
      </TourTarget>
      <TourTarget id="settings-text-size">
        <PillGroup label={t("settingsTextSizeLabel")} options={fontScaleOptions} selectedValue={preferences.fontScale} onChange={setFontScale} />
      </TourTarget>
    </View>
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
 * theme toggle and the font-size control so the two settings look and
 * behave identically rather than duplicating the same markup twice.
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
  const theme = useTheme();
  const { language } = useLanguage();
  return (
    <View style={styles.pillGroup}>
      <Text style={[styles.pillGroupLabel, { color: theme.colors.muted }]}>{label}</Text>
      <View style={styles.toggleRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = selectedValue === option.value;
          return (
            <Pressable
              key={option.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(option.value);
                AccessibilityInfo.announceForAccessibility(settingChangedAnnouncement(language, label, option.label));
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={[
                styles.toggleButton,
                {
                  borderColor: selected ? theme.colors.accent : theme.colors.borderStrong,
                  backgroundColor: selected ? theme.colors.surfaceAlt : "transparent",
                },
              ]}
            >
              <Text style={[styles.toggleLabel, { color: selected ? theme.colors.accent : theme.colors.muted }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  pillGroup: {
    gap: spacing.xs,
  },
  pillGroupLabel: {
    fontSize: typography.small,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: typography.small,
    fontWeight: "600",
  },
});
