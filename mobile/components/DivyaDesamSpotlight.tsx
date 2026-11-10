import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { AppState, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { loadDivyaDesams, type DivyaDesam } from "../content-lib/loader.ts";
import { divyaDesamNumberLabels } from "../content-lib/ordering.ts";
import { imagesByUuid } from "../content-lib/image-manifest.generated.ts";
import { localizeDivyaDesam } from "../../content-lib/i18n.ts";
import { daysSinceEpoch, msUntilNextLocalMidnight, pickSpotlightRecord } from "../../content-lib/divya-desam-spotlight.ts";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { sectionTint } from "../section-tints.ts";
import { regionLabel } from "../divya-desam-region-labels.ts";
import { useLanguage } from "../language-context.ts";
import { useT } from "../ui-strings.ts";

/** Same lookup as divya-desams/index.tsx's own firstImageAsset -- first resolvable image, or null, never a fabricated placeholder. */
function firstImageAsset(images: DivyaDesam["images"]): number | null {
  for (const image of images) {
    const asset = imagesByUuid[image.sourceAssetUuid.toLowerCase()];
    if (asset !== undefined) return asset;
  }
  return null;
}

/**
 * Today's date, refreshed at local midnight and whenever the app returns
 * to the foreground -- so an app left open (or suspended) overnight
 * never keeps showing yesterday's temple. Timers pause while the app is
 * in the background; the AppState check covers that. Only changes state
 * when the calendar day actually changes.
 */
function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const now = new Date();
      setToday((prev) => (daysSinceEpoch(prev) === daysSinceEpoch(now) ? prev : now));
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilNextLocalMidnight(now) + 1000);
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  return today;
}

/**
 * Home's full-width Divya Desam spotlight -- one record from the real
 * 107-record corpus (content-lib/loader.ts's loadDivyaDesams(), the
 * same dataset and traditional pilgrimage ordering the Divya Desams tab
 * itself uses -- each record's own `sourceOrder`, see
 * content-lib/mobile-content.ts), rotated one-per-calendar-day through a
 * fixed shuffled order (content-lib/divya-desam-spotlight.ts, shared with the website) rather than walked in
 * sequence or picked independently at random each day, and pushing to
 * the exact detail route (/divya-desams/[slug]) the Divya Desams tab's
 * own list uses.
 */
export function DivyaDesamSpotlight() {
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();

  const today = useToday();

  const sortedRecords = useMemo(() => [...loadDivyaDesams()].sort((a, b) => a.sourceOrder - b.sourceOrder), []);
  const picked = pickSpotlightRecord(sortedRecords, today);

  if (!picked) return null;

  const numberLabels = divyaDesamNumberLabels(sortedRecords.map((r) => r.slug));
  const record = localizeDivyaDesam(picked, language);
  const tint = sectionTint("divya-desams", theme.scheme);
  const image = firstImageAsset(record.images);
  const numberLabel = numberLabels.get(record.slug) ?? "";
  const region = record.region ? regionLabel(record.region, language) : "";
  const deity = record.templeInformation.moolavar ?? "";
  const titleLine = `${numberLabel}. ${record.displayName}`;

  // The photograph is shown whole and large, with its caption beneath it
  // rather than laid over it, so the deity is never covered.
  return (
    <Pressable
      onPress={() => router.push(`/divya-desams/${record.slug}` as never)}
      accessibilityRole="button"
      accessibilityLabel={[titleLine, region, deity].filter(Boolean).join(". ")}
      style={({ pressed }) => [styles.section, { opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={[styles.frame, { backgroundColor: tint }]}>
        {image ? <Image source={image} style={styles.image} /> : null}
      </View>
      <View style={styles.caption}>
        <Text style={[styles.label, { color: theme.colors.muted }]}>{t("homeSpotlightLabel")}</Text>
        <Text style={[styles.title, { color: theme.colors.foreground }]} numberOfLines={2}>
          {titleLine}
        </Text>
        {region || deity ? (
          <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={2}>
            {[region, deity].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  frame: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  caption: {
    gap: 2,
  },
  label: {
    fontSize: typography.small,
  },
  title: {
    fontSize: typography.heading + 2,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: typography.body,
  },
});
