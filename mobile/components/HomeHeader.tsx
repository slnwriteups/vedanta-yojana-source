import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { useT, type UiStringKey } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";
import { localizeUpcomingEkadashi, pakshaLabel, tithiLabel } from "../panchangam-labels.ts";
import type { PanchangamData } from "../services/panchangamService.ts";

/**
 * Home's greeting + Panchangam banner. `panchangam` is owned by
 * HomeScreen (a single fetchAhobilaPanchangam() call shared with
 * SankalpamCard, so this never triggers its own network request) --
 * `null` means "still loading", never "no data", so the skeleton and
 * the empty/offline state are visually distinct.
 */
function greetingKeyForHour(hour: number): UiStringKey {
  if (hour < 12) return "homeGreetingMorning";
  if (hour < 17) return "homeGreetingAfternoon";
  if (hour < 21) return "homeGreetingEvening";
  return "homeGreetingNight";
}

/** A subtle opacity pulse (Animated, no extra dependency) standing in for the Panchangam pill while it loads. */
function PillSkeleton() {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.pill, styles.skeleton, { backgroundColor: theme.colors.border, opacity }]} />;
}

export function HomeHeader({ panchangam }: { panchangam: PanchangamData | null }) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const greeting = t(greetingKeyForHour(new Date().getHours()));

  const pakshaTithi = panchangam
    ? [pakshaLabel(panchangam.paksha, language), tithiLabel(panchangam.tithi, language)].filter(Boolean).join(" ")
    : "";
  const bannerText = panchangam
    ? [localizeUpcomingEkadashi(panchangam.upcomingEkadashiText, language), pakshaTithi].filter(Boolean).join(" • ")
    : "";

  return (
    <View style={styles.container}>
      <Text style={[styles.greeting, { color: theme.colors.foreground }]}>{greeting}</Text>
      <Text style={[styles.subtitle, { color: theme.colors.muted }]}>{t("homeGreetingSubtitle")}</Text>
      {panchangam === null ? (
        <PillSkeleton />
      ) : bannerText ? (
        <View
          style={[styles.pill, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.pillText, { color: theme.colors.foreground }]}>{`📅 ${bannerText}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const PILL_HEIGHT = 36;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  greeting: {
    fontSize: typography.title + 4,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: typography.body * typography.readingLineHeight,
    marginBottom: spacing.sm,
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  pillText: {
    fontSize: typography.small,
    fontWeight: "600",
  },
  skeleton: {
    width: 220,
    borderWidth: 0,
  },
});
