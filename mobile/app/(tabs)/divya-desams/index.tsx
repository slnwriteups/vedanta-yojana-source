import { useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { loadDivyaDesams, loadKnowledgeRecord, type DivyaDesam } from "../../../content-lib/loader.ts";
import { divyaDesamNumberLabels } from "../../../content-lib/ordering.ts";
import { imagesByUuid } from "../../../content-lib/image-manifest.generated.ts";
import { GridTile } from "../../../components/GridTile";
import { layout, radius, spacing, typography, useTheme } from "../../../theme";
import { sectionTint } from "../../../section-tints.ts";
import { localizeDivyaDesam, localizeKnowledge } from "../../../../content-lib/i18n.ts";
import { DIVYA_DESAM_REGION_ORDER, type DivyaDesamRegion } from "../../../../content-lib/schemas/divya-desam-region.ts";
import { useLanguage } from "../../../language-context.ts";
import { translateUi, useT } from "../../../ui-strings.ts";
import { regionLabel } from "../../../divya-desam-region-labels.ts";
import type { LanguageCode } from "../../../content-lib/preferences.ts";

/** The one region that is a celestial abode, not a terrestrial one -- gets "Celestial Divya Desams" instead of "Divya Desams" in the count line. */
const CELESTIAL_REGION: DivyaDesamRegion = "Viṇṇulaga Tiruppatigaḷ";

/**
 * "All 108" is a UI-only pseudo-tab, not a content classification -- it
 * is deliberately NOT a DivyaDesamRegion enum value (that would wrongly
 * imply every record's own `region` field could be "All 108"). Kept as
 * a distinct sentinel type so selectedTab can hold either this or a
 * real region, and the filter below branches on it explicitly.
 */
const ALL_TAB = "All 108" as const;
type DivyaDesamTab = typeof ALL_TAB | DivyaDesamRegion;
const TABS: readonly DivyaDesamTab[] = [ALL_TAB, ...DIVYA_DESAM_REGION_ORDER];

/**
 * Now routed through ui-strings.ts's ta/kn/hi translateUi() the same way
 * as the rest of this screen: the noun ("Divya Desam"/"Celestial Divya
 * Desam") is a real per-language translation, not a guess -- English
 * keeps its existing "s" pluralization; Tamil/Kannada/Hindi numerals
 * don't take an English-style plural suffix, so the noun is used as-is
 * regardless of count.
 */
function tabCountLabel(tab: DivyaDesamTab, count: number, language: LanguageCode | null): string {
  const nounKey = tab === CELESTIAL_REGION ? "celestialDivyaDesamCountNoun" : "divyaDesamCountNoun";
  const noun = translateUi(nounKey, language);
  const suffix = language === null && count !== 1 ? "s" : "";
  return `${count} ${noun}${suffix}`;
}

/**
 * The traditional Divya Desam count for a set of records -- NOT
 * records.length. One record (Tiruttetriambalam Tirumanikoodam) is a
 * single card/file but represents TWO traditionally-numbered Divya
 * Desams (#36-37), so a record whose number label is a range ("36-37")
 * counts as 2. Without this, "All 108" would read 107 and Chōḻa Nāḍu
 * would read 39, both one short of the traditional total.
 */
function traditionalCount(records: DivyaDesam[], numberLabels: Map<string, string>): number {
  let total = 0;
  for (const record of records) {
    total += numberLabels.get(record.slug)?.includes("-") ? 2 : 1;
  }
  return total;
}

/**
 * Phase 6C -- Divya Desam index refined: each card now shows an image
 * preview when the record has at least one resolvable image (most do),
 * plus tighter list spacing. Ordering is unchanged from Phase 6B -- the
 * traditional pilgrimage sequence, never alphabetical -- now via each
 * record's own `sourceOrder` (content-lib/mobile-content.ts), a plain
 * integer derived once at manifest-generation time from the internal
 * migration.sourcePageId this app must not ship, rather than re-parsing
 * that string at render time.
 *
 * UI/UX pass: every row carries the same "divya-desams" section tint
 * (section-tints.ts) as its card-edge stripe -- unlike Library's
 * per-book tints, this one color is shared across all 107 records
 * plus the introduction card, reinforcing "you're in this section" as
 * a section-wide identity rather than distinguishing them from each
 * other (their own photos already do that).
 *
 * Each title is now prefixed with its traditional 1-108 number (see
 * ordering.ts#divyaDesamNumberLabels) so the pilgrimage sequence this
 * list is already sorted by is visible, not just implicit.
 *
 * "Geographical Classification" tabs: a horizontally-scrolling row of
 * an "All 108" tab plus the seven traditional Sri Vaishnava regions
 * (schemas/divya-desam.ts's DIVYA_DESAM_REGION_ORDER) sits above the
 * list. Selecting a region tab filters the SAME FlatList to just that
 * region's records via each record's own `region` field; "All 108" (the
 * default) shows the full, unfiltered, canonically-ordered list -- no
 * duplicate content, no separate screens/routes, mirroring the existing
 * "existing entries filtered by an existing field" architecture rather
 * than introducing a new one.
 */

/** First resolvable image asset for a record, or null -- never a fabricated placeholder. */
function firstImageAsset(record: DivyaDesam): number | null {
  for (const image of record.images) {
    const asset = imagesByUuid[image.sourceAssetUuid.toLowerCase()];
    if (asset !== undefined) return asset;
  }
  return null;
}

export default function DivyaDesamsIndexScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const sortedRecords = [...loadDivyaDesams()].sort((a, b) => a.sourceOrder - b.sourceOrder);
  const numberLabels = divyaDesamNumberLabels(sortedRecords.map((r) => r.slug));
  const records = sortedRecords.map((r) => localizeDivyaDesam(r, language));
  const loadedIntroduction = loadKnowledgeRecord("introduction");
  const introduction = loadedIntroduction ? localizeKnowledge(loadedIntroduction, language) : null;
  const tint = sectionTint("divya-desams", theme.scheme);

  const [selectedTab, setSelectedTab] = useState<DivyaDesamTab>(ALL_TAB);
  const regionRecords = useMemo(
    () => (selectedTab === ALL_TAB ? records : records.filter((r) => r.region === selectedTab)),
    [records, selectedTab]
  );

  // Grouped by Nadu under a heading each (the "All" view shows every group
  // in DIVYA_DESAM_REGION_ORDER; a selected tab shows its own), laid out
  // two photographs to a row. Rows rather than one big grid so the list
  // stays virtualized across all 107 records.
  const rows = useMemo(() => {
    const out: IndexRow[] = [];
    for (const region of DIVYA_DESAM_REGION_ORDER) {
      const inRegion = regionRecords.filter((r) => r.region === region);
      if (inRegion.length === 0) continue;
      out.push({ key: `h-${region}`, region, count: traditionalCount(inRegion, numberLabels) });
      for (let i = 0; i < inRegion.length; i += 2) {
        out.push({ key: `r-${inRegion[i].slug}`, pair: inRegion.slice(i, i + 2) });
      }
    }
    return out;
  }, [regionRecords, numberLabels]);

  function renderRow({ item: row }: { item: IndexRow }) {
    if ("region" in row) {
      return (
        <Text style={[styles.regionHeading, { color: theme.colors.foreground }]} accessibilityRole="header">
          {regionLabel(row.region, language)}
          <Text style={[styles.regionCount, { color: theme.colors.muted }]}>{`  ${tabCountLabel(row.region, row.count, language)}`}</Text>
        </Text>
      );
    }
    return (
      <View style={styles.pairRow}>
        {row.pair.map((item) => (
          <GridTile
            key={item.slug}
            title={item.displayName}
            titlePrefix={`${numberLabels.get(item.slug)}.`}
            subtitle={item.templeInformation.moolavar}
            status={item.status}
            needsReview={item.migration.needsReview}
            imageAsset={firstImageAsset(item)}
            tintColor={tint}
            fallbackText={numberLabels.get(item.slug)}
            variant="photo"
            onPress={() => router.push(`/divya-desams/${item.slug}` as never)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t("tabDivyaDesams") }} />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {introduction ? (
              <Pressable
                onPress={() => router.push("/divya-desams/introduction" as never)}
                accessibilityRole="button"
                accessibilityLabel={introduction.title}
                style={({ pressed }) => [styles.intro, { backgroundColor: theme.colors.surfaceAlt, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[styles.introTitle, { color: theme.colors.foreground }]}>
                  {introduction.title} <Text style={{ color: theme.colors.accent }}>→</Text>
                </Text>
                <Text style={[styles.introSubtitle, { color: theme.colors.muted }]}>{t("introCardSubtitle")}</Text>
              </Pressable>
            ) : null}
            <Text style={[styles.classificationLabel, { color: theme.colors.muted }]}>{t("geoClassificationEyebrow")}</Text>
            <View style={styles.tabRow}>
              {TABS.map((tab) => {
                const active = tab === selectedTab;
                const label = tab === ALL_TAB ? t("allDivyaDesamsTab") : regionLabel(tab, language);
                return (
                  <Pressable
                    key={tab}
                    onPress={() => setSelectedTab(tab)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={label}
                    style={[
                      styles.tab,
                      {
                        backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                        borderColor: active ? theme.colors.accent : theme.colors.borderStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.tabText, { color: active ? theme.colors.onAccent : theme.colors.foreground }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.count, { color: theme.colors.muted }]}>
              {tabCountLabel(selectedTab, traditionalCount(regionRecords, numberLabels), language)}
            </Text>
          </View>
        }
      />
    </View>
  );
}

type IndexRow = { key: string; region: DivyaDesamRegion; count: number } | { key: string; pair: DivyaDesam[] };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarClearance,
  },
  header: {
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  intro: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  introTitle: {
    fontSize: typography.title,
    fontWeight: "600",
  },
  introSubtitle: {
    fontSize: typography.body,
  },
  classificationLabel: {
    fontSize: typography.small,
    fontWeight: "500",
    paddingTop: spacing.sm,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tab: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: typography.small,
    fontWeight: "600",
  },
  count: {
    fontSize: typography.small,
  },
  regionHeading: {
    fontSize: typography.title,
    fontWeight: "600",
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  regionCount: {
    fontSize: typography.body,
    fontWeight: "400",
  },
  pairRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
});
