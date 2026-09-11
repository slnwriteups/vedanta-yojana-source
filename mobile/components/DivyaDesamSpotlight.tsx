import { useMemo } from "react";
import { useRouter } from "expo-router";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { loadDivyaDesams, type DivyaDesam } from "../content-lib/loader.ts";
import { sourcePageNumber, divyaDesamNumberLabels } from "../content-lib/ordering.ts";
import { imagesByUuid } from "../content-lib/image-manifest.generated.ts";
import { localizeDivyaDesam } from "../../content-lib/i18n.ts";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
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

/** Whole calendar days since the Unix epoch, local device date -- a day counter that advances by exactly 1 each day. */
function daysSinceEpoch(date: Date): number {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utcMidnight / 86400000);
}

/**
 * A Wang/Murmur3-style integer finalizer: three multiply-xor-shift
 * rounds give strong avalanche even for near-identical inputs. Used
 * below to drive a seeded Fisher-Yates shuffle -- Math.imul keeps every
 * step in 32-bit integer arithmetic, matching the reference Wang hash
 * exactly.
 */
function hashInt(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

/** Fixed seed for the spotlight's shuffle order -- change only if a deliberately different rotation order is wanted. */
const SPOTLIGHT_SHUFFLE_SEED = 0x5d1f4a;

/**
 * A fixed, deterministic shuffle of [0, length) via seeded Fisher-Yates.
 * Walking this permutation one index per calendar day (see
 * `daysSinceEpoch` above, indexed with `% length`) visits every record
 * exactly once per length-day cycle before repeating -- so with ~107
 * records, no temple repeats within any 7-day window, and none repeats
 * until all 108 (counting the merged #36-37 record as two) have been
 * shown, at which point the same shuffled cycle restarts.
 */
function seededShuffle(length: number, seed: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  let state = seed;
  for (let i = length - 1; i > 0; i--) {
    state = hashInt(state);
    const j = state % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * Home's full-width Divya Desam spotlight -- one record from the real
 * 107-record corpus (content-lib/loader.ts's loadDivyaDesams(), the
 * same dataset and traditional pilgrimage ordering the Divya Desams tab
 * itself uses), rotated one-per-calendar-day through a fixed shuffled
 * order (seededShuffle() above) rather than walked in sequence or
 * picked independently at random each day, and pushing to the exact
 * detail route (/divya-desams/[slug]) the Divya Desams tab's own list
 * uses.
 */
export function DivyaDesamSpotlight() {
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();

  const sortedRecords = useMemo(
    () =>
      [...loadDivyaDesams()].sort(
        (a, b) => sourcePageNumber(a.migration.sourcePageId) - sourcePageNumber(b.migration.sourcePageId)
      ),
    []
  );

  if (sortedRecords.length === 0) return null;

  const numberLabels = divyaDesamNumberLabels(sortedRecords.map((r) => r.slug));
  const shuffleOrder = seededShuffle(sortedRecords.length, SPOTLIGHT_SHUFFLE_SEED);
  const cycleIndex = daysSinceEpoch(new Date()) % sortedRecords.length;
  const index = shuffleOrder[cycleIndex];
  const record = localizeDivyaDesam(sortedRecords[index], language);
  const tint = sectionTint("divya-desams", theme.scheme);
  const image = firstImageAsset(record.images);
  const numberLabel = numberLabels.get(record.slug) ?? "";
  const region = record.region ? regionLabel(record.region, language) : "";
  const deity = record.templeInformation.moolavar ?? "";
  const titleLine = `${numberLabel}. ${record.displayName}`;

  const overlay = (
    <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
      <Text style={styles.title} numberOfLines={2}>
        {titleLine}
      </Text>
      {region ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {region}
        </Text>
      ) : null}
      {deity ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {deity}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("homeSpotlightLabel")}</Text>
      <Pressable
        onPress={() => router.push(`/divya-desams/${record.slug}` as never)}
        accessibilityRole="button"
        accessibilityLabel={[titleLine, region, deity].filter(Boolean).join(". ")}
        style={({ pressed }) => [styles.cardWrap, shadows.card, { opacity: pressed ? 0.92 : 1 }]}
      >
        {image ? (
          <ImageBackground source={image} style={styles.card} imageStyle={styles.image}>
            {overlay}
          </ImageBackground>
        ) : (
          <View style={[styles.card, { backgroundColor: tint }]}>{overlay}</View>
        )}
      </Pressable>
    </View>
  );
}

const CARD_HEIGHT = 180;

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
  cardWrap: {
    marginHorizontal: layout.screenPadding,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  card: {
    height: CARD_HEIGHT,
    justifyContent: "flex-end",
  },
  image: {
    resizeMode: "cover",
  },
  overlay: {
    padding: spacing.md,
    gap: 2,
  },
  title: {
    color: "#fffaf5",
    fontSize: typography.heading,
    fontWeight: "700",
  },
  subtitle: {
    color: "#fffaf5",
    fontSize: typography.small,
    opacity: 0.9,
  },
});
