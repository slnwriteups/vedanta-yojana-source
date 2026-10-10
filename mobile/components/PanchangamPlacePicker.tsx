import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { useT } from "../ui-strings.ts";
import { placeLabel, type ChosenPlace } from "../../content-lib/panchangam-place.ts";

type SearchPlaces = (text: string, limit?: number) => ChosenPlace[];

/**
 * Lets the reader choose any city for the Panchangam, or go back to the
 * phone's own location. The search runs over the bundled place list on
 * the device -- nothing typed here leaves the phone. The list is loaded
 * when the picker first opens, not at startup.
 */
export function PanchangamPlacePicker({
  visible,
  current,
  onChoose,
  onClose,
}: {
  visible: boolean;
  current: ChosenPlace | null;
  onChoose: (place: ChosenPlace | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchPlaces | null>(null);

  useEffect(() => {
    if (!visible || search) return;
    let cancelled = false;
    import("../../content-lib/panchangam-places.ts").then((m) => {
      if (!cancelled) setSearch(() => m.searchPlaces);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, search]);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const results = search && query.trim().length >= 2 ? search(query, 30) : [];
  const showEmpty = Boolean(search) && query.trim().length >= 2 && results.length === 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.inner}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.colors.foreground }]}>{t("panchangamChoosePlace")}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("panchangamClosePlaces")} hitSlop={12}>
              <Text style={[styles.close, { color: theme.colors.accent }]}>{t("panchangamClosePlaces")}</Text>
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("panchangamPlaceSearchPlaceholder")}
            placeholderTextColor={theme.colors.muted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel={t("panchangamPlaceSearchPlaceholder")}
            style={[
              styles.input,
              { color: theme.colors.foreground, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          />

          <Pressable
            onPress={() => onChoose(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: current === null }}
            style={({ pressed }) => [
              styles.option,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.optionText, { color: theme.colors.accent }]}>
              {current === null ? "✓ " : ""}
              {t("panchangamUseMyLocation")}
            </Text>
          </Pressable>

          <FlatList
            data={results}
            keyExtractor={(p) => `${p.name}|${p.region}|${p.country}|${p.latitude}|${p.longitude}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected =
                current !== null &&
                current.name === item.name &&
                current.latitude === item.latitude &&
                current.longitude === item.longitude;
              return (
                <Pressable
                  onPress={() => onChoose(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.result, { borderBottomColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.resultName, { color: theme.colors.foreground }]}>
                    {selected ? "✓ " : ""}
                    {item.name}
                  </Text>
                  <Text style={[styles.resultWhere, { color: theme.colors.muted }]}>
                    {placeLabel(item).slice(item.name.length + 2)}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              showEmpty ? <Text style={[styles.note, { color: theme.colors.muted }]}>{t("panchangamNoPlaces")}</Text> : null
            }
            ListFooterComponent={
              <View style={styles.footer}>
                <Text style={[styles.note, { color: theme.colors.muted }]}>{t("panchangamPlaceHint")}</Text>
                <Text style={[styles.credit, { color: theme.colors.muted }]}>{t("panchangamPlacesCredit")}</Text>
              </View>
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  inner: { flex: 1, width: "100%", maxWidth: layout.maxContentWidth, alignSelf: "center", padding: layout.screenPadding },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  title: { fontSize: typography.title, fontWeight: "700" },
  close: { fontSize: typography.body, fontWeight: "600", minHeight: layout.minTouchTarget, textAlignVertical: "center", lineHeight: layout.minTouchTarget },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: typography.body },
  option: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  optionText: { fontSize: typography.body, fontWeight: "600" },
  result: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultName: { fontSize: typography.body, fontWeight: "600" },
  resultWhere: { fontSize: typography.small, marginTop: 2 },
  footer: { paddingVertical: spacing.md, gap: spacing.sm },
  note: { fontSize: typography.small, paddingTop: spacing.md },
  credit: { fontSize: typography.eyebrow },
});
