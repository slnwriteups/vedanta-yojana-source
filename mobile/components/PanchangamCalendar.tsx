import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { shadows } from "../shadows";
import { timesInZoneLabel, useT } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";
import {
  localizeSankalpamText,
  localizeUpcomingEkadashi,
  nakshatramLabel,
  pakshaLabel,
  tithiLabel,
} from "../panchangam-labels.ts";
import { fetchPanchangam, type PanchangamData } from "../services/panchangamService.ts";
import {
  calendarFestivalLine,
  localizePadukaFestival,
  localizePadukaTarpanam,
  padukaPanchangamFor,
  type PadukaPanchangamDay,
  type PadukaTarpanam,
} from "../../content-lib/paduka-panchangam.ts";
import { formatPanchangamTime } from "../services/panchangamTimings.ts";
import { setPanchangamPlace, usePanchangamPlace } from "../services/panchangamPlaceStore.ts";
import { PanchangamPlacePicker } from "./PanchangamPlacePicker";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const { place, ready: placeReady } = usePanchangamPlace();

  useEffect(() => {
    // Wait for the saved city (if any) rather than computing for the phone's location first.
    if (!placeReady) return;
    if (initialPanchangam && isSameDay(selectedDate, today)) {
      setData(initialPanchangam);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchPanchangam(selectedDate, place)
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
  }, [selectedDate, initialPanchangam, today, place, placeReady]);

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
  const showComputed = !isLoading && hasData;
  const festival = data ? calendarFestivalLine(data.festival, paduka?.day ?? null, language) : "";
  const locale = language || "en-US";
  // Only the timings the endpoint actually returned for this day are shown.
  const timingRows = data
    ? (
        [
          ["homeCalendarSunriseLabel", data.sunrise],
          ["homeCalendarSunsetLabel", data.sunset],
          ["homeCalendarRahuKaalamLabel", data.rahuKaalam],
          ["homeCalendarYamagandamLabel", data.yamagandam],
          ["homeCalendarGulikaKaalamLabel", data.gulikaKaalam],
        ] as const
      )
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => ({ label: t(key), value: formatPanchangamTime(value as string, locale) }))
    : [];

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
            {festival ? <Text style={[styles.festival, { color: theme.colors.accent }]}>{festival}</Text> : null}
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
            {timingRows.map(({ label, value }) => (
              <Row key={label} label={label} value={value} muted={theme.colors.muted} fg={theme.colors.foreground} />
            ))}
            {data.timeZoneNote ? (
              <Text style={[styles.zoneNote, { color: theme.colors.muted }]}>
                {timesInZoneLabel(language, data.timeZoneNote)}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.colors.muted }]}>{t("homeCalendarLocationLabel")}</Text>
              <View style={styles.locationValue}>
                {data.location ? (
                  <Text style={[styles.rowValue, styles.locationText, { color: theme.colors.foreground }]}>{data.location}</Text>
                ) : null}
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("panchangamChoosePlace")}
                  hitSlop={10}
                >
                  <Text style={[styles.changeLink, { color: theme.colors.accent }]}>{t("panchangamChangePlace")}</Text>
                </Pressable>
              </View>
            </View>

            {data.sankalpamText || paduka?.tarpanam ? (
              <SankalpamSection
                dailyText={data.sankalpamText || null}
                tarpanam={paduka?.tarpanam ?? null}
                show={showSankalpam}
                onToggle={() => setShowSankalpam((prev) => !prev)}
              />
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={[styles.unavailable, { color: theme.colors.muted }]}>{t("homeLocationUnavailable")}</Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.chooseBtn,
                { borderColor: theme.colors.accent, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.chooseBtnText, { color: theme.colors.accent }]}>{t("panchangamChoosePlace")}</Text>
            </Pressable>
          </View>
        )}

        {/* Bundled data: stands in for the computed rows while they are loading or unavailable. */}
        {paduka?.day && !showComputed ? <PadukaFallbackRows day={paduka.day} /> : null}
        {paduka?.tarpanam && !showComputed ? (
          <SankalpamSection
            dailyText={null}
            tarpanam={paduka.tarpanam}
            show={showSankalpam}
            onToggle={() => setShowSankalpam((prev) => !prev)}
          />
        ) : null}
      </View>
      <PanchangamPlacePicker
        visible={pickerOpen}
        current={place}
        onChoose={(chosen) => {
          setPanchangamPlace(chosen);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
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
 * The journal's tithi, nakshatram and observances for the selected day,
 * in the same rows as the computed figures and with no heading of its own,
 * shown only while those live figures are loading or unavailable. Bundled
 * data, so it needs no network or location access.
 */
function PadukaFallbackRows({ day }: { day: PadukaPanchangamDay }) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const pakshaTithi = [pakshaLabel(day.paksha, language), tithiLabel(day.tithi, language)].filter(Boolean).join(" ");
  const nakshatram = nakshatramLabel(day.nakshatram, language);

  return (
    <View style={styles.contentRows}>
      {day.festival ? (
        <Text style={[styles.festival, { color: theme.colors.accent }]}>{localizePadukaFestival(day.festival, language)}</Text>
      ) : null}
      {pakshaTithi ? (
        <Row label={t("homeCalendarTithiLabel")} value={pakshaTithi} muted={theme.colors.muted} fg={theme.colors.foreground} />
      ) : null}
      {nakshatram ? (
        <Row label={t("homeCalendarNakshatramLabel")} value={nakshatram} muted={theme.colors.muted} fg={theme.colors.foreground} />
      ) : null}
    </View>
  );
}

/**
 * The single Sankalpam box: the computed daily sankalpam and, on the
 * days the Paduka Panchangam prints one, its Tarpana Sankalpam beneath
 * it. Both are shown exactly as their sources give them; the small
 * labels only appear when there are two to tell apart.
 */
function SankalpamSection({
  dailyText,
  tarpanam,
  show,
  onToggle,
}: {
  dailyText: string | null;
  tarpanam: PadukaTarpanam | null;
  show: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const both = Boolean(dailyText && tarpanam);
  const bodyStyle = [
    styles.sankalpamBody,
    { color: theme.colors.foreground, fontFamily: Platform.select(typography.readingFontFamily) },
  ];

  return (
    <View style={[styles.sankalpamSection, { borderTopColor: theme.colors.border }]}>
      <Pressable
        onPress={onToggle}
        style={styles.sankalpamToggleBtn}
        accessibilityRole="button"
        accessibilityLabel={t("homeSankalpamLabel")}
      >
        <Text style={[styles.sankalpamSectionLabel, { color: theme.colors.muted }]}>{t("homeSankalpamLabel")}</Text>
        <Text style={[styles.toggleArrow, { color: theme.colors.muted }]}>{show ? "▲" : "▼"}</Text>
      </Pressable>
      {show ? (
        <View
          style={[
            styles.sankalpamBox,
            styles.sankalpamParts,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          {dailyText ? (
            <View>
              {both ? (
                <Text style={[styles.sankalpamPartLabel, { color: theme.colors.accent }]}>{t("sankalpamDailyLabel")}</Text>
              ) : null}
              <Text style={bodyStyle}>{localizeSankalpamText(dailyText, language)}</Text>
            </View>
          ) : null}
          {tarpanam ? (
            <View style={both ? [styles.sankalpamPartDivider, { borderTopColor: theme.colors.border }] : undefined}>
              {both ? (
                <Text style={[styles.sankalpamPartLabel, { color: theme.colors.accent }]}>{t("padukaTarpanamLabel")}</Text>
              ) : null}
              <Text style={bodyStyle}>{localizePadukaTarpanam(tarpanam, language)}</Text>
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
  sankalpamParts: {
    gap: spacing.sm,
  },
  sankalpamPartLabel: {
    fontSize: typography.small,
    fontWeight: "600",
    paddingBottom: 2,
  },
  sankalpamPartDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  sankalpamBody: {
    fontSize: typography.body,
    lineHeight: 24,
  },
  unavailable: {
    fontSize: typography.small,
    paddingVertical: spacing.sm,
  },
  chooseBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: layout.minTouchTarget,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  chooseBtnText: {
    fontSize: typography.small,
    fontWeight: "600",
  },
  zoneNote: {
    fontSize: typography.small,
    fontStyle: "italic",
  },
  locationValue: {
    flexDirection: "row",
    alignItems: "baseline",
    flexShrink: 1,
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  locationText: {
    textAlign: "right",
  },
  changeLink: {
    fontSize: typography.small,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});

