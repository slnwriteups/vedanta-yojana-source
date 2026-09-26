import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
import { useT } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";
import {
  localizeSankalpamText,
  localizeUpcomingEkadashi,
  nakshatramLabel,
  pakshaLabel,
  tithiLabel,
} from "../panchangam-labels.ts";
import { fetchAhobilaPanchangam, type PanchangamData } from "../services/panchangamService.ts";
import { padukaPanchangamFor, type PadukaPanchangamEntry } from "../../content-lib/paduka-panchangam.ts";

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function PanchangamCalendar({ initialPanchangam }: { initialPanchangam?: PanchangamData | null } = {}) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [data, setData] = useState<PanchangamData | null>(initialPanchangam ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPanchangam);
  const [showSankalpam, setShowSankalpam] = useState<boolean>(true);

  useEffect(() => {
    if (initialPanchangam && isSameDay(selectedDate, today)) {
      setData(initialPanchangam);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchAhobilaPanchangam(selectedDate)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, initialPanchangam, today]);

  const goToOffset = (days: number) => {
    const next = new Date(selectedDate.getTime() + days * 24 * 60 * 60 * 1000);
    setSelectedDate(next);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isCurrentToday = isSameDay(selectedDate, today);
  const isPast = !isCurrentToday && selectedDate.getTime() < today.getTime();

  const stripDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      dates.push(new Date(selectedDate.getTime() + i * 24 * 60 * 60 * 1000));
    }
    return dates;
  }, [selectedDate]);

  const formattedDateHeading = useMemo(() => {
    return selectedDate.toLocaleDateString(language || "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDate, language]);

  const pakshaTithi = data
    ? [pakshaLabel(data.paksha, language), tithiLabel(data.tithi, language)]
        .filter(Boolean)
        .join(" ")
    : "";
  const nakshatram = data ? nakshatramLabel(data.nakshatram, language) : "";
  const hasData = Boolean(data && (data.tithi || data.nakshatram || data.festival));
  const paduka = useMemo(() => padukaPanchangamFor(selectedDate), [selectedDate]);

  return (
    <View style={styles.section}>
      <View style={styles.headerArea}>
        <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{t("homeCalendarBrowseTitle")}</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.muted }]}>{t("homeCalendarBrowseSubtitle")}</Text>
      </View>

      <View
        style={[styles.card, shadows.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        {/* Navigation Toolbar */}
        <View style={[styles.toolbar, { borderBottomColor: theme.colors.border }]}>
          <Pressable
            onPress={() => goToOffset(-1)}
            style={({ pressed }) => [
              styles.navBtn,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.background, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("calendarPreviousDay")}
          >
            <Text style={[styles.navBtnText, { color: theme.colors.foreground }]}>← {t("calendarPreviousDay")}</Text>
          </Pressable>

          <Pressable
            onPress={goToToday}
            disabled={isCurrentToday}
            style={({ pressed }) => [
              styles.navBtn,
              isCurrentToday
                ? { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }
                : { borderColor: theme.colors.border, backgroundColor: theme.colors.background, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("calendarTodayButton")}
          >
            <Text
              style={[
                styles.navBtnText,
                { color: isCurrentToday ? "#fff" : theme.colors.foreground, fontWeight: isCurrentToday ? "700" : "500" },
              ]}
            >
              {t("calendarTodayButton")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => goToOffset(1)}
            style={({ pressed }) => [
              styles.navBtn,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.background, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("calendarNextDay")}
          >
            <Text style={[styles.navBtnText, { color: theme.colors.foreground }]}>{t("calendarNextDay")} →</Text>
          </Pressable>
        </View>

        {/* 7-Day Quick Strip */}
        <View style={styles.stripRow}>
          {stripDates.map((d) => {
            const isSelected = isSameDay(d, selectedDate);
            const isDayToday = isSameDay(d, today);
            const dayName = d.toLocaleDateString(language || "en-US", { weekday: "narrow" });
            const dayNum = d.getDate();

            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => setSelectedDate(d)}
                style={[
                  styles.stripChip,
                  isSelected
                    ? { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }
                    : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${d.toDateString()}`}
              >
                <Text
                  style={[
                    styles.chipDayName,
                    { color: isSelected ? "#fff" : theme.colors.muted },
                  ]}
                >
                  {dayName}
                </Text>
                <Text
                  style={[
                    styles.chipDayNum,
                    { color: isSelected ? "#fff" : theme.colors.foreground, fontWeight: isSelected ? "700" : "600" },
                  ]}
                >
                  {dayNum}
                </Text>
                {isDayToday ? (
                  <View
                    style={[
                      styles.todayDot,
                      { backgroundColor: isSelected ? "#fff" : theme.colors.accent },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Selected Date Header with Status Badge */}
        <View style={[styles.dateHeadingRow, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.dateHeadingText, { color: theme.colors.foreground }]}>{formattedDateHeading}</Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isCurrentToday
                  ? theme.colors.accent + "20"
                  : isPast
                  ? theme.colors.muted + "20"
                  : theme.colors.accent + "15",
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isCurrentToday ? theme.colors.accent : isPast ? theme.colors.muted : theme.colors.accent },
              ]}
            >
              {isCurrentToday ? t("calendarTodayButton") : isPast ? t("calendarPastPassed") : t("calendarUpcoming")}
            </Text>
          </View>
        </View>

        {/* Details Content */}
        {isLoading ? (
          <View style={styles.loadingArea}>
            <Text style={[styles.loadingText, { color: theme.colors.muted }]}>{t("calendarLoading")}</Text>
          </View>
        ) : hasData && data ? (
          <View style={styles.contentRows}>
            {data.festival ? (
              <Text style={[styles.festival, { color: theme.colors.accent }]}>{data.festival}</Text>
            ) : null}
            {pakshaTithi ? (
              <Row
                label={t("homeCalendarTithiLabel")}
                value={pakshaTithi}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}
            {nakshatram ? (
              <Row
                label={t("homeCalendarNakshatramLabel")}
                value={nakshatram}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}
            {data.upcomingEkadashiText ? (
              <Row
                label={t("homeCalendarEkadashiLabel")}
                value={localizeUpcomingEkadashi(data.upcomingEkadashiText, language)}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}
            {data.location ? (
              <Row
                label={t("homeCalendarLocationLabel")}
                value={data.location}
                muted={theme.colors.muted}
                fg={theme.colors.foreground}
              />
            ) : null}

            {data.sankalpamText ? (
              <View style={[styles.sankalpamSection, { borderTopColor: theme.colors.border }]}>
                <Pressable
                  onPress={() => setShowSankalpam((prev) => !prev)}
                  style={styles.sankalpamToggleBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("homeSankalpamLabel")}
                >
                  <Text style={[styles.sankalpamSectionLabel, { color: theme.colors.muted }]}>
                    {t("homeSankalpamLabel")}
                  </Text>
                  <Text style={[styles.toggleArrow, { color: theme.colors.muted }]}>
                    {showSankalpam ? "▲" : "▼"}
                  </Text>
                </Pressable>
                {showSankalpam ? (
                  <View
                    style={[
                      styles.sankalpamBox,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sankalpamBody,
                        {
                          color: theme.colors.foreground,
                          fontFamily: Platform.select(typography.readingFontFamily),
                        },
                      ]}
                    >
                      {localizeSankalpamText(data.sankalpamText, language)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.unavailable, { color: theme.colors.muted }]}>{t("homeLocationUnavailable")}</Text>
        )}

        {paduka ? <PadukaPanchangamSection entry={paduka} /> : null}
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

/**
 * The Sri Ranganatha Paduka Panchangam for the selected day, laid out
 * exactly like the Ahobila rows above it (festival line, Tithi and
 * Nakshatram rows, a collapsible sankalpam) and localized through the
 * same panchangam-labels maps. Bundled data, so it shows regardless of
 * the live Ahobila fetch's loading/location state.
 */
function PadukaPanchangamSection({ entry }: { entry: PadukaPanchangamEntry }) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const [showTarpanam, setShowTarpanam] = useState<boolean>(true);
  const { day, tarpanam } = entry;
  const pakshaTithi = day
    ? [pakshaLabel(day.paksha, language), tithiLabel(day.tithi, language)].filter(Boolean).join(" ")
    : "";
  const nakshatram = day ? nakshatramLabel(day.nakshatram, language) : "";

  return (
    <View style={[styles.sankalpamSection, styles.contentRows, { borderTopColor: theme.colors.border }]}>
      <Text style={[styles.sankalpamSectionLabel, styles.padukaHeading, { color: theme.colors.muted }]}>
        {t("padukaPanchangamLabel")}
      </Text>
      {day?.festival ? <Text style={[styles.festival, { color: theme.colors.accent }]}>{day.festival}</Text> : null}
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

      {tarpanam ? (
        <View style={[styles.sankalpamSection, { borderTopColor: theme.colors.border }]}>
          <Pressable
            onPress={() => setShowTarpanam((prev) => !prev)}
            style={styles.sankalpamToggleBtn}
            accessibilityRole="button"
            accessibilityLabel={t("padukaTarpanamLabel")}
          >
            <Text style={[styles.sankalpamSectionLabel, { color: theme.colors.muted }]}>{t("padukaTarpanamLabel")}</Text>
            <Text style={[styles.toggleArrow, { color: theme.colors.muted }]}>{showTarpanam ? "▲" : "▼"}</Text>
          </Pressable>
          {showTarpanam ? (
            <View
              style={[styles.sankalpamBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
              <Text
                style={[
                  styles.sankalpamBody,
                  { color: theme.colors.foreground, fontFamily: Platform.select(typography.readingFontFamily) },
                ]}
              >
                {`${tarpanam.title}: ${tarpanam.sankalpam}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  headerArea: {
    paddingHorizontal: layout.screenPadding,
    gap: 2,
  },
  sectionLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: typography.small,
  },
  card: {
    marginHorizontal: layout.screenPadding,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  navBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navBtnText: {
    fontSize: typography.small,
  },
  stripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  stripChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDayName: {
    fontSize: 10,
    textTransform: "uppercase",
  },
  chipDayNum: {
    fontSize: typography.small,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  dateHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dateHeadingText: {
    fontSize: typography.body,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.lg,
  },
  badgeText: {
    fontSize: typography.eyebrow,
    fontWeight: "700",
  },
  loadingArea: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  loadingText: {
    fontSize: typography.small,
  },
  contentRows: {
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
    alignItems: "baseline",
    gap: spacing.sm,
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
  sankalpamSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  sankalpamToggleBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  sankalpamSectionLabel: {
    fontSize: typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  toggleArrow: {
    fontSize: 12,
  },
  sankalpamBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sankalpamBody: {
    fontSize: typography.body,
    lineHeight: 24,
  },
  padukaHeading: {
    paddingVertical: spacing.xs,
  },
  unavailable: {
    fontSize: typography.small,
    paddingVertical: spacing.sm,
  },
});

