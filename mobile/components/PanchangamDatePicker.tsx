import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { useT } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * A month calendar for jumping the Panchangam to any date -- the app's
 * counterpart of the website's date box. Plain React Native, no native
 * date-picker module, so it also reaches Android installs as an
 * over-the-air update. Month and year arrows move the view; tapping a
 * day chooses it.
 */
export function PanchangamDatePicker({
  visible,
  selected,
  today,
  onChoose,
  onClose,
}: {
  visible: boolean;
  selected: Date;
  /** Today at the place the Panchangam is for. */
  today: Date;
  onChoose: (day: { year: number; month: number; day: number }) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const locale = language || "en-US";
  const [view, setView] = useState(() => ({ year: selected.getFullYear(), month: selected.getMonth() }));

  useEffect(() => {
    if (visible) setView({ year: selected.getFullYear(), month: selected.getMonth() });
  }, [visible, selected]);

  const title = new Date(view.year, view.month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });

  // Weekday initials starting on Sunday, in the reader's language (1 Jan 2023 was a Sunday).
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(locale, { weekday: "narrow" })),
    [locale]
  );

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1).getDay();
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const list: Array<number | null> = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) list.push(d);
    while (list.length % 7) list.push(null);
    return list;
  }, [view]);

  const move = (months: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + months, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const navButton = (label: string, a11y: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.navBtn, { borderColor: theme.colors.borderStrong, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.navText, { color: theme.colors.foreground }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
        <View style={styles.inner}>
          <View style={styles.headerRow}>
            <Text style={[styles.heading, { color: theme.colors.foreground }]}>{t("panchangamChooseDate")}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("panchangamClosePlaces")} hitSlop={12}>
              <Text style={[styles.close, { color: theme.colors.accent }]}>{t("panchangamClosePlaces")}</Text>
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            {navButton("«", t("panchangamPreviousYear"), () => move(-12))}
            {navButton("‹", t("panchangamPreviousMonth"), () => move(-1))}
            <Text style={[styles.monthTitle, { color: theme.colors.foreground }]} accessibilityRole="header">
              {title}
            </Text>
            {navButton("›", t("panchangamNextMonth"), () => move(1))}
            {navButton("»", t("panchangamNextYear"), () => move(12))}
          </View>

          <View style={styles.grid}>
            {weekdays.map((w, i) => (
              <Text key={`w${i}`} style={[styles.weekday, { color: theme.colors.muted }]}>
                {w}
              </Text>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <View key={`e${i}`} style={styles.cell} />;
              const date = new Date(view.year, view.month, day);
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);
              return (
                <Pressable
                  key={`d${day}`}
                  onPress={() => onChoose({ year: view.year, month: view.month, day })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  style={({ pressed }) => [
                    styles.cell,
                    styles.dayCell,
                    isSelected
                      ? { backgroundColor: theme.colors.highlight, borderColor: theme.colors.highlight }
                      : { borderColor: isToday ? theme.colors.highlight : "transparent" },
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? theme.colors.onHighlight : theme.colors.foreground, fontWeight: isSelected || isToday ? "700" : "500" },
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => onChoose({ year: today.getFullYear(), month: today.getMonth(), day: today.getDate() })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.todayBtn, { borderColor: theme.colors.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.todayText, { color: theme.colors.accent }]}>{t("calendarTodayButton")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  inner: { width: "100%", maxWidth: 480, alignSelf: "center", padding: layout.screenPadding },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  heading: { fontSize: typography.title, fontWeight: "700" },
  close: { fontSize: typography.body, fontWeight: "600", lineHeight: layout.minTouchTarget },
  monthRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  monthTitle: { flex: 1, textAlign: "center", fontSize: typography.heading, fontWeight: "700" },
  navBtn: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  navText: { fontSize: typography.heading, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", fontSize: typography.small, paddingVertical: spacing.xs },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayCell: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: radius.md },
  dayText: { fontSize: typography.body },
  todayBtn: {
    marginTop: spacing.lg,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
  },
  todayText: { fontSize: typography.body, fontWeight: "600" },
});
