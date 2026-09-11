"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ReadingPreferencesProvider } from "@/components/providers/ReadingPreferencesProvider";
import { ReadingPositionProvider } from "@/components/providers/ReadingPositionProvider";
import { BookmarksProvider } from "@/components/providers/BookmarksProvider";
import { LiveAnnouncer } from "@/components/shared/LiveAnnouncer";

/**
 * Single composition root for every preference/settings provider,
 * nested in the same order as mobile/app/_layout.tsx's RootStack:
 * Theme > ReadingPreferences > Language > ReadingPosition > Bookmarks.
 * Mounted once in app/layout.tsx, outside WelcomeGate/OnboardingGate so
 * both gates (and every page) can read every preference.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ReadingPreferencesProvider>
        <LanguageProvider>
          <ReadingPositionProvider>
            <BookmarksProvider>
              <LiveAnnouncer>{children}</LiveAnnouncer>
            </BookmarksProvider>
          </ReadingPositionProvider>
        </LanguageProvider>
      </ReadingPreferencesProvider>
    </ThemeProvider>
  );
}
