"use client";

import { useT, type UiStringKey } from "@/lib/ui-strings";

/**
 * Web port of mobile/components/HomeHeader.tsx -- Home's title: the
 * time-of-day greeting, with the site's one-line description beneath
 * it. Today's Panchangam is not repeated here; the Panchangam & Calendar
 * card below it is the one place it is shown.
 */
function greetingKeyForHour(hour: number): UiStringKey {
  if (hour < 12) return "homeGreetingMorning";
  if (hour < 17) return "homeGreetingAfternoon";
  if (hour < 21) return "homeGreetingEvening";
  return "homeGreetingNight";
}

export function HomeHeader() {
  const t = useT();
  return (
    <div>
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        {t(greetingKeyForHour(new Date().getHours()))}
      </h1>
      <p className="mt-3 text-lg text-[var(--muted)]">{t("homeGreetingSubtitle")}</p>
    </div>
  );
}
