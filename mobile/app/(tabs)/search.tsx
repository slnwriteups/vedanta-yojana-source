import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { buildMobileSearchCorpus } from "../../content-lib/corpus.ts";
import { searchCorpus } from "../../../content-lib/search/run.ts";
import type { SearchResult, SearchResultType } from "../../../content-lib/search/types.ts";
import { CONTENT_TYPE_FILTERS, filterResultsByType } from "../../content-lib/search-filter.ts";
import { layout, radius, spacing, typography, useTheme } from "../../theme";
import { useLanguage } from "../../language-context.ts";
import { filterAccessibilityLabel, noResultsLabel, translateUi, useT, type UiStringKey } from "../../ui-strings.ts";

const RESULT_TYPE_LABEL_KEYS: Record<SearchResultType, UiStringKey> = {
  "divya-desam": "filterDivyaDesam",
  book: "filterBook",
  chapter: "filterChapter",
  knowledge: "filterKnowledge",
};

/**
 * Phase 6C -- theme-aware styling and accessibility labels only; the
 * offline search behavior is unchanged from Phase 6B (same in-memory
 * corpus, same pure ranking pipeline, no network). This file is a
 * single-file tab (no nested Stack), so its header title now comes from
 * app/(tabs)/_layout.tsx's Tabs.Screen options rather than an inline
 * <Stack.Screen> (which would have no Stack ancestor to attach to here).
 *
 * Phase 6D -- adds content-type filter chips (Divya Desam/Book/Chapter/
 * Knowledge, multi-select). Filtering happens strictly after
 * searchCorpus() has already ranked results (content-lib/
 * search-filter.ts's filterResultsByType is a plain Array.filter), so
 * relative ranking among surviving results never changes.
 */
export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { language } = useLanguage();
  const t = useT();
  const corpus = useMemo(() => buildMobileSearchCorpus(), []);
  const [query, setQuery] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<SearchResultType>>(() => new Set());

  const trimmedQuery = query.trim();
  const rankedResults = useMemo(
    () => (trimmedQuery ? searchCorpus(corpus, trimmedQuery) : []),
    [corpus, trimmedQuery]
  );
  const results = useMemo(() => filterResultsByType(rankedResults, activeTypes), [rankedResults, activeTypes]);

  function toggleType(type: SearchResultType) {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function renderItem({ item }: { item: SearchResult }) {
    const typeLabel = translateUi(RESULT_TYPE_LABEL_KEYS[item.type], language);
    return (
      <Pressable
        onPress={() => router.push(item.href as never)}
        accessibilityRole="link"
        accessibilityLabel={`${item.title}, ${typeLabel}${item.parentTitle ? `, in ${item.parentTitle}` : ""}`}
        style={({ pressed }) => [
          styles.result,
          { borderBottomColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.resultTitle, { color: theme.colors.accent }]}>{item.title}</Text>
        <Text style={[styles.resultMeta, { color: theme.colors.muted }]}>
          {typeLabel}
          {item.parentTitle ? ` · ${item.parentTitle}` : ""}
        </Text>
        {item.excerpt ? (
          <Text style={[styles.excerpt, { color: theme.colors.foreground }]}>{item.excerpt}</Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("searchPlaceholder")}
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={t("tabSearch")}
        accessibilityHint={t("searchHint")}
        style={[
          styles.input,
          { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface, color: theme.colors.foreground },
        ]}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <View style={styles.filterRow} accessibilityRole="none">
        {CONTENT_TYPE_FILTERS.map((filter) => {
          const selected = activeTypes.has(filter.value);
          const filterLabel = translateUi(RESULT_TYPE_LABEL_KEYS[filter.value], language);
          return (
            <Pressable
              key={filter.value}
              onPress={() => toggleType(filter.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={filterAccessibilityLabel(language, filterLabel)}
              style={[
                styles.filterChip,
                {
                  borderColor: selected ? theme.colors.accent : theme.colors.borderStrong,
                  backgroundColor: selected ? theme.colors.surfaceAlt : "transparent",
                },
              ]}
            >
              <Text style={[styles.filterLabel, { color: selected ? theme.colors.accent : theme.colors.muted }]}>
                {filterLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {trimmedQuery && results.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.muted }]}>{noResultsLabel(language, trimmedQuery)}</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.href}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    marginHorizontal: layout.screenPadding,
    marginTop: layout.screenPadding,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: typography.body,
    minHeight: layout.minTouchTarget,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  filterLabel: {
    fontSize: typography.small,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarClearance,
    gap: spacing.md,
  },
  result: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  resultTitle: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  resultMeta: {
    fontSize: typography.small,
  },
  excerpt: {
    fontSize: typography.small,
  },
  empty: {
    padding: layout.screenPadding,
    fontSize: typography.body,
  },
});
