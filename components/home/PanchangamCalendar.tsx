"use client";

import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/lib/language-context";
import { useT } from "@/lib/ui-strings";
import {
  localizeSankalpamText,
  localizeUpcomingEkadashi,
  nakshatramLabel,
  pakshaLabel,
  tithiLabel,
} from "@/lib/panchangam-labels";
import { fetchAhobilaPanchangam, type PanchangamData } from "@/lib/panchangam-service";
import {
  localizePadukaFestival,
  localizePadukaTarpanam,
  padukaPanchangamFor,
  type PadukaPanchangamEntry,
} from "@/content-lib/paduka-panchangam.ts";

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function PanchangamCalendar({ initialPanchangam }: { initialPanchangam?: PanchangamData | null }) {
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
  const isUpcoming = !isCurrentToday && selectedDate.getTime() > today.getTime();

  // Generate 7-day pill strip centered around selectedDate
  const stripDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      dates.push(new Date(selectedDate.getTime() + i * 24 * 60 * 60 * 1000));
    }
    return dates;
  }, [selectedDate]);

  const formattedDateHeading = useMemo(() => {
    return selectedDate.toLocaleDateString(language || "en-US", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
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
  const showAhobila = !isLoading && hasData;

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow">{t("homeCalendarBrowseTitle")}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{t("homeCalendarBrowseSubtitle")}</p>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        {/* Navigation Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToOffset(-1)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--surface)]"
              aria-label={t("calendarPreviousDay")}
            >
              ← {t("calendarPreviousDay")}
            </button>
            <button
              type="button"
              onClick={goToToday}
              disabled={isCurrentToday}
              className={`inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium transition-colors ${
                isCurrentToday
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--surface)]"
              }`}
            >
              {t("calendarTodayButton")}
            </button>
            <button
              type="button"
              onClick={() => goToOffset(1)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--surface)]"
              aria-label={t("calendarNextDay")}
            >
              {t("calendarNextDay")} →
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={formatDateKey(selectedDate)}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(parseDateKey(e.target.value));
                }
              }}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] shadow-sm focus:border-[var(--accent)] focus:outline-none"
              aria-label="Select date"
            />
          </div>
        </div>

        {/* 7-Day Quick Strip */}
        <div className="grid grid-cols-7 gap-1 pt-1 sm:gap-2">
          {stripDates.map((d) => {
            const isSelected = isSameDay(d, selectedDate);
            const isDayToday = isSameDay(d, today);
            const dayName = d.toLocaleDateString(language || "en-US", { weekday: "narrow" });
            const dayNum = d.getDate();

            return (
              <button
                key={formatDateKey(d)}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`relative flex flex-col items-center justify-center rounded-md py-1.5 text-center transition-colors ${
                  isSelected
                    ? "bg-[var(--accent)] text-white font-bold"
                    : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--surface)]"
                }`}
              >
                <span className="text-[10px] uppercase opacity-80">{dayName}</span>
                <span className="text-sm font-semibold">{dayNum}</span>
                {isDayToday && (
                  <span
                    className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-[var(--accent)]"}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Header & Status Badge */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{formattedDateHeading}</h3>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
              isCurrentToday
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : isPast
                ? "bg-[var(--muted)]/15 text-[var(--muted)]"
                : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
            }`}
          >
            {isCurrentToday ? t("calendarTodayButton") : isPast ? t("calendarPastPassed") : t("calendarUpcoming")}
          </span>
        </div>

        {/* Panchangam Content Details */}
        {isLoading ? (
          <div className="py-4 text-center text-xs text-[var(--muted)]">
            <span className="animate-pulse">{t("calendarLoading")}</span>
          </div>
        ) : hasData && data ? (
          <div className="space-y-2 pt-1">
            {data.festival ? (
              <p className="text-sm font-bold text-[var(--accent)]">{data.festival}</p>
            ) : null}

            {pakshaTithi ? <Row label={t("homeCalendarTithiLabel")} value={pakshaTithi} /> : null}
            {nakshatram ? <Row label={t("homeCalendarNakshatramLabel")} value={nakshatram} /> : null}
            {data.upcomingEkadashiText ? (
              <Row
                label={t("homeCalendarEkadashiLabel")}
                value={localizeUpcomingEkadashi(data.upcomingEkadashiText, language)}
              />
            ) : null}
            {data.location ? <Row label={t("homeCalendarLocationLabel")} value={data.location} /> : null}

            {paduka ? <PadukaPanchangamSection entry={paduka} /> : null}

            {/* Sankalpam Section for Selected Day */}
            {data.sankalpamText ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    {t("homeSankalpamLabel")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSankalpam((prev) => !prev)}
                    className="text-xs font-medium text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                    aria-label={t("homeSankalpamLabel")}
                  >
                    {showSankalpam ? "▲" : "▼"}
                  </button>
                </div>
                {showSankalpam ? (
                  <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3.5">
                    <p className="prose-body text-xs sm:text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-line">
                      {localizeSankalpamText(data.sankalpamText, language)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="py-2 text-xs text-[var(--muted)]">{t("homeLocationUnavailable")}</p>
        )}

        {/* Bundled data: still shown while the Ahobila fetch is loading or unavailable (above the Sankalpam otherwise). */}
        {paduka && !showAhobila ? <PadukaPanchangamSection entry={paduka} /> : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs sm:text-sm text-[var(--muted)]">{label}</span>
      <span className="text-right text-xs sm:text-sm font-semibold text-[var(--foreground)]">{value}</span>
    </div>
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
  const t = useT();
  const { language } = useLanguage();
  const [showTarpanam, setShowTarpanam] = useState<boolean>(true);
  const { day, tarpanam } = entry;
  const pakshaTithi = day
    ? [pakshaLabel(day.paksha, language), tithiLabel(day.tithi, language)].filter(Boolean).join(" ")
    : "";
  const nakshatram = day ? nakshatramLabel(day.nakshatram, language) : "";

  return (
    <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
      <p className="pb-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
        {t("padukaPanchangamLabel")}
      </p>
      {day?.festival ? <p className="text-sm font-bold text-[var(--accent)]">{localizePadukaFestival(day.festival, language)}</p> : null}
      {pakshaTithi ? <Row label={t("homeCalendarTithiLabel")} value={pakshaTithi} /> : null}
      {nakshatram ? <Row label={t("homeCalendarNakshatramLabel")} value={nakshatram} /> : null}

      {tarpanam ? (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {t("padukaTarpanamLabel")}
            </span>
            <button
              type="button"
              onClick={() => setShowTarpanam((prev) => !prev)}
              className="text-xs font-medium text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              aria-label={t("padukaTarpanamLabel")}
            >
              {showTarpanam ? "▲" : "▼"}
            </button>
          </div>
          {showTarpanam ? (
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3.5">
              <p className="prose-body text-xs sm:text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-line">
                {localizePadukaTarpanam(tarpanam, language)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
