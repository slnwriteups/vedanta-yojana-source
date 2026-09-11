"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ONBOARDED_STORAGE_KEY, isValidCompletedFlag } from "@/lib/preferences";
import { readJSON, writeJSON } from "@/lib/storage";
import { useT } from "@/lib/ui-strings";
import { SettingsControls } from "@/components/SettingsControls";

/**
 * Web port of mobile/components/OnboardingScreen.tsx plus the gating
 * logic mobile/app/_layout.tsx applies around it. A one-time step shown
 * exactly once ever (unlike WelcomeGate.tsx's once-per-session), right
 * after the welcome gate on a person's very first visit: choose
 * Appearance/Text size/Language before landing on the site proper. The
 * same SettingsControls stay reachable any time afterward from
 * /settings -- this gate only decides whether they're front-loaded
 * once.
 *
 * Follows WelcomeGate.tsx's exact idiom: renders `children` always, an
 * overlay decided only inside a post-mount effect (hydration-safe on a
 * static export), so it composes as a plain wrapper around the rest of
 * the app -- nested inside WelcomeGate in app/layout.tsx so its own
 * overlay only becomes visible after Welcome's is dismissed.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [onboarded, setOnboarded] = useState(true);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    readJSON(ONBOARDED_STORAGE_KEY, isValidCompletedFlag).then((stored) => {
      if (!cancelled) setOnboarded(stored === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function finish() {
    setOnboarded(true);
    void writeJSON(ONBOARDED_STORAGE_KEY, true);
  }

  if (onboarded) return <>{children}</>;

  return (
    <>
      {children}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-heading"
        className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-8 overflow-y-auto bg-[var(--background)] px-6 py-10"
      >
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1 text-center">
            <h1 id="onboarding-heading" className="text-2xl font-bold text-[var(--foreground)]">
              {t("onboardingTitle")}
            </h1>
            <p className="prose-body text-[var(--muted)]">{t("onboardingSubtitle")}</p>
          </div>

          <SettingsControls />

          <button
            type="button"
            onClick={finish}
            className="w-full rounded-lg bg-[var(--accent)] py-3 text-center text-sm font-semibold text-[var(--surface)] transition-opacity hover:opacity-90"
          >
            {t("onboardingContinue")}
          </button>
        </div>
      </div>
    </>
  );
}
