"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type ColorScheme, type ThemeContextValue } from "@/lib/theme";
import { THEME_STORAGE_KEY, isValidThemeOverride } from "@/lib/preferences";
import { readJSON, writeJSON } from "@/lib/storage";

/**
 * Web port of mobile/ThemeProvider.tsx. Defaults to the OS appearance via
 * `prefers-color-scheme`, with a persisted manual override on top --
 * same "brief first paint before the stored override is read" tradeoff
 * mobile accepts (see mobile/ThemeProvider.tsx's own doc comment), which
 * is also required here for hydration safety: a static export always
 * renders the "no override yet" branch first, then corrects itself in
 * an effect after mount, so server and first client render agree.
 *
 * Sets `document.documentElement.dataset.theme` as a side effect so
 * app/globals.css's `:root[data-theme="…"]` blocks can take precedence
 * over the `prefers-color-scheme` media query once a scheme is known.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<ColorScheme>("light");
  const [override, setOverrideState] = useState<ColorScheme | null>(null);
  const scheme: ColorScheme = override ?? systemScheme;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemScheme(media.matches ? "dark" : "light");
    function handleChange(event: MediaQueryListEvent) {
      setSystemScheme(event.matches ? "dark" : "light");
    }
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    readJSON(THEME_STORAGE_KEY, isValidThemeOverride).then((stored) => {
      if (!cancelled && stored !== null) setOverrideState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
  }, [scheme]);

  function setOverride(next: ColorScheme | null) {
    setOverrideState(next);
    void writeJSON(THEME_STORAGE_KEY, next);
  }

  const value = useMemo<ThemeContextValue>(() => ({ scheme, override, setOverride }), [scheme, override]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
