import { StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
import { useT } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";
import { localizeUpcomingEkadashi, nakshatramLabel, pakshaLabel, tithiLabel } from "../panchangam-labels.ts";
import type { PanchangamData } from "../services/panchangamService.ts";

/**
 * Home's full daily-calendar card -- the expanded counterpart to
 * HomeHeader's compact one-line pill. The pill exists for a
 * glanceable summary; this card is where every field
 * services/panchangamService.ts extracts (festival, the place it was
 * computed for, tithi/paksha, nakshatram, upcoming Ekadashi) actually
 * gets its own labeled row, the same way SankalpamCard is the expanded
 * counterpart for the Sankalpam text. Renders nothing while
 * `panchangam` is still loading (null).
 *
 * The location row comes first: every other row is only true FOR that
 * place (tithi/nakshatra transition times shift with longitude), so it
 * frames the rows beneath it rather than trailing them as a footnote.
 * It is omitted entirely when no place name resolved, never filled with
 * a placeholder.
 */
export function PanchangamCard({ panchangam }: { panchangam: PanchangamData | null }) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();

  if (!panchangam) return null;

  const hasData = panchangam.tithi || panchangam.nakshatram || panchangam.festival;
  const pakshaTithi = [pakshaLabel(panchangam.paksha, language), tithiLabel(panchangam.tithi, language)]
    .filter(Boolean)
    .join(" ");
  const nakshatram = nakshatramLabel(panchangam.nakshatram, language);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("homeCalendarLabel")}</Text>
      <View
        style={[styles.card, shadows.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        {hasData ? (
          <>
            {panchangam.festival ? (
              <Text style={[styles.festival, { color: theme.colors.accent }]}>{panchangam.festival}</Text>
            ) : null}
            {panchangam.location ? (
              <Row
                label={t("homeCalendarLocationLabel")}
                value={panchangam.location}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}
            {pakshaTithi ? (
              <Row label={t("homeCalendarTithiLabel")} value={pakshaTithi} muted={theme.colors.muted} fg={theme.colors.foreground} />
            ) : null}
            {nakshatram ? (
              <Row
                label={t("homeCalendarNakshatramLabel")}
                value={nakshatram}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}
            {panchangam.upcomingEkadashiText ? (
              <Row
                label={t("homeCalendarEkadashiLabel")}
                value={localizeUpcomingEkadashi(panchangam.upcomingEkadashiText, language)}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}
            {panchangam.location ? (
              <Row
                label={t("homeCalendarLocationLabel")}
                value={panchangam.location}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}
          </>
        ) : (
          <Text style={[styles.unavailable, { color: theme.colors.muted }]}>{t("homeLocationUnavailable")}</Text>
        )}
      </View>
    </View>
  );
}

function Row({ label, value, muted, fg }: { label: string; value: string; muted: string; fg: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: fg }]}>{value}</Text>
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
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  festival: {
    fontSize: typography.body,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: typography.small,
  },
  rowValue: {
    fontSize: typography.small,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  unavailable: {
    fontSize: typography.small,
  },
});
