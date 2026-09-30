import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
import { useT } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Any week that starts on a Sunday, used only to render localized weekday initials in Sunday-first order. */
const SUNDAY_WEEK_START = new Date(2026, 8, 27);

/**
 * Month-grid date picker for the Panchangam calendar -- the mobile
 * counterpart of the web calendar's date field. Built on core React
 * Native (Modal + Pressable) rather than a native date-picker module, so
 * it adds no native dependency and looks the same on iOS and Android.
 * Month and weekday names come from toLocaleDateString in the reader's
 * language, like the calendar's own week strip.
 */
export function DatePickerModal({
  visible,
  selectedDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const locale = language || "en-US";
  const [month, setMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  // Reopening the picker always starts on the currently selected month.
  useEffect(() => {
    if (visible) setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [visible, selectedDate]);

  const today = new Date();
  const monthTitle = month.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const weekdayInitials = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(
          SUNDAY_WEEK_START.getFullYear(),
          SUNDAY_WEEK_START.getMonth(),
          SUNDAY_WEEK_START.getDate() + i
        ).toLocaleDateString(locale, { weekday: "narrow" })
      ),
    [locale]
  );

  // Leading blanks up to the month's first weekday, then every day of the month.
  const cells = useMemo(() => {
    const firstWeekday = month.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const result: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      result.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [month]);

  function shiftMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function pick(day: Date) {
    // Today keeps the current time (the Sankalpam is time-specific, as with
    // the Today button); any other day is taken at midday.
    onSelect(isSameDay(day, new Date()) ? new Date() : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12));
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("calendarClosePicker")}
      >
        {/* Swallow taps inside the card so only the backdrop closes the picker. */}
        <Pressable
          onPress={() => {}}
          accessible={false}
          style={[styles.card, shadows.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={t("calendarPreviousMonth")}
              style={styles.monthButton}
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.foreground} />
            </Pressable>
            <Text style={[styles.monthTitle, { color: theme.colors.foreground }]} accessibilityRole="header">
              {monthTitle}
            </Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={t("calendarNextMonth")}
              style={styles.monthButton}
            >
              <Ionicons name="chevron-forward" size={22} color={theme.colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.week}>
            {weekdayInitials.map((initial, i) => (
              <Text key={i} style={[styles.weekday, { color: theme.colors.muted }]}>
                {initial}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`blank-${i}`} style={styles.cell} />;
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => pick(day)}
                  style={styles.cell}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={day.toLocaleDateString(locale, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected
                        ? { backgroundColor: theme.colors.accent }
                        : isToday
                          ? { borderColor: theme.colors.accent, borderWidth: 1 }
                          : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        {
                          color: isSelected ? "#fff" : isToday ? theme.colors.accent : theme.colors.foreground,
                          fontWeight: isSelected || isToday ? "700" : "500",
                        },
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthButton: {
    padding: spacing.xs,
  },
  monthTitle: {
    fontSize: typography.body,
    fontWeight: "700",
  },
  week: {
    flexDirection: "row",
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.eyebrow,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: typography.small,
  },
});
