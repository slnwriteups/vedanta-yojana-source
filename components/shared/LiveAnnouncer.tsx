"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

/**
 * Minimal web substitute for React Native's
 * `AccessibilityInfo.announceForAccessibility`: a visually-hidden
 * `aria-live="polite"` region whose text content is updated
 * imperatively. Mounted once near the root (see AppProviders.tsx) and
 * used via `useAnnounce()` from SettingsControls.tsx and
 * BookmarkButton.tsx, the same two call sites mobile's
 * announceForAccessibility has.
 *
 * Setting the same text twice in a row would not re-announce it (no DOM
 * mutation for a screen reader to notice), so each call clears the
 * region first and sets the real text on the next frame.
 */
const AnnounceContext = createContext<(message: string) => void>(() => {});

export function useAnnounce(): (message: string) => void {
  return useContext(AnnounceContext);
}

export function LiveAnnouncer({ children }: { children: ReactNode }) {
  const regionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    const region = regionRef.current;
    if (!region) return;
    region.textContent = "";
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  }, []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div aria-live="polite" className="sr-only" ref={regionRef} />
    </AnnounceContext.Provider>
  );
}
