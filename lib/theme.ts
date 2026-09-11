import { createContext, useContext } from "react";

/**
 * Web port of mobile/theme.ts -- only the reactive override/context shape,
 * not the color palette or design tokens. Those already live in
 * app/globals.css as CSS custom properties (--background, --surface,
 * --foreground, --muted, --border, --accent) driven by
 * `prefers-color-scheme`; duplicating them here would create a second,
 * driftable source of truth. This module exists purely so a
 * ThemeProvider can expose a manual light/dark override on top of that.
 */

export type ColorScheme = "light" | "dark";

export interface ThemeContextValue {
  scheme: ColorScheme;
  /** null = follow the system appearance; otherwise a persisted manual override. */
  override: ColorScheme | null;
  setOverride: (scheme: ColorScheme | null) => void;
}

/** Exported so ThemeProvider.tsx (the one client component, .Provider lives there) can supply a value. */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme/useThemeControls must be used within a ThemeProvider");
  return ctx;
}

export function useTheme(): ColorScheme {
  return useThemeContext().scheme;
}

/** Exposes the manual light/dark override for a settings-style toggle, separate from useTheme() so components that only read the scheme don't re-render on override plumbing changes. */
export function useThemeControls() {
  const { scheme, override, setOverride } = useThemeContext();
  return { scheme, override, setOverride };
}
