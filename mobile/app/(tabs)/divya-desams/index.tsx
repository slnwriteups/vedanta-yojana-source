import { useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadDivyaDesams, loadKnowledgeRecord, type DivyaDesam } from "../../../content-lib/loader.ts";
import { divyaDesamNumberLabels } from "../../../content-lib/ordering.ts";
import { imagesByUuid } from "../../../content-lib/image-manifest.generated.ts";
import { ContentCard } from "../../../components/ContentCard";
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

  function renderItem({ item }: { item: DivyaDesam }) {
    return (
      <ContentCard
        title={`${numberLabels.get(item.slug)}. ${item.displayName}`}
        subtitle={item.templeInformation.moolavar}
        status={item.status}
        needsReview={item.migration.needsReview}
        imageAsset={firstImageAsset(item)}
        tintColor={tint}
        variant="temple"
        onPress={() => router.push(`/divya-desams/${item.slug}` as never)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t("tabDivyaDesams") }} />
      <FlatList
        data={regionRecords}
        keyExtractor={(item) => item.slug}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {introduction ? (
              <ContentCard
                title={introduction.title}
                subtitle={t("introCardSubtitle")}
                tintColor={tint}
                onPress={() => router.push("/divya-desams/introduction" as never)}
              />
            ) : null}
            <Text style={[styles.classificationEyebrow, { color: theme.colors.muted }]}>
              {t("geoClassificationEyebrow")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRow}
            >
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
                        backgroundColor: active ? tint : theme.colors.surface,
                        borderColor: active ? tint : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.tabText, { color: active ? "#fffaf5" : theme.colors.foreground }]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={[styles.count, { color: theme.colors.muted }]}>
              {tabCountLabel(selectedTab, traditionalCount(regionRecords, numberLabels), language)}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  count: {
    fontSize: typography.small,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingBottom: layout.tabBarClearance,
  },
  classificationEyebrow: {
    fontSize: typography.eyebrow,
    fontWeight: "700",
    letterSpacing: 0.5,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Horizontal-only: this ScrollView's own contentContainerStyle scrolls
  // sideways within its row, never the outer FlatList/screen.
  tabRow: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
    paddingBottom: spacing.md,
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
});
