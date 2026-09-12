import { Platform, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
import { useT } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";
import { localizeSankalpamText } from "../panchangam-labels.ts";
import type { PanchangamData } from "../services/panchangamService.ts";

/**
 * The full SAM Sankalpam declaration (services/panchangamService.ts) for
 * right now -- distinct from HomeHeader's compact Ekadasi/tithi pill,
 * this renders the whole, unabridged sentence, since a Sankalpam is
 * recited in full. Renders nothing while `panchangam` is still loading
 * (null) or once loaded with no usable Sankalpam text (offline
 * fallback) -- never a placeholder card with empty content.
 *
 * The fixed English wrapper phrasing ("Sankalpam for X on Y At Z...")
 * is re-templated per language via localizeSankalpamText
 * (panchangam-labels.ts); the Sanskrit declaration itself stays
 * untranslated.
 */
export function SankalpamCard({ panchangam }: { panchangam: PanchangamData | null }) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();

  if (!panchangam || !panchangam.sankalpamText) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("homeSankalpamLabel")}</Text>
      <View
        style={[styles.card, shadows.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        <Text
          style={[
            styles.text,
            {
              color: theme.colors.foreground,
              fontFamily: Platform.select(typography.readingFontFamily),
            },
          ]}
        >
          {localizeSankalpamText(panchangam.sankalpamText, language)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: layout.screenPadding,
  },
  card: {
    marginHorizontal: layout.screenPadding,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Same reading-comfort treatment as chapter body text (Section.tsx):
  // the serif reading face, full body size, and a taller line-height --
  // a Sankalpam is dense, comma-separated Sanskrit, and read at
  // typography.small with the default UI line-height it collapsed into
  // one hard-to-parse block.
  text: {
    fontSize: typography.body,
    lineHeight: typography.body * typography.readingLineHeight,
    letterSpacing: 0.2,
  },
});
