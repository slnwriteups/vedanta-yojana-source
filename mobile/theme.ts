import { createContext, useContext } from "react";

/**
 * Phase 6C -- the mobile design system. Phase 6A/6B's flat `colors`
 * export is replaced by a light/dark PAIR behind a React context, since
 * a plain module-level constant can never react to a theme change at
 * runtime. Typography/spacing/radius/layout are scheme-
 * independent and stay as plain exports -- only color needs to be
 * reactive.
 *
 * Palette intent (explicit, since "scholarly/spiritual, not SaaS" is a
 * design requirement, not just a color choice): warm, muted, low-
 * saturation tones in both modes -- no pure black/white, no saturated
 * brand blues/purples, no gradients. Dark mode is a genuine second
 * palette (warm near-black, not an inverted/auto-generated one), tuned
 * for the same restrained character as light mode.
 *
 * Deliberately kept JSX-free (the actual <ThemeContext.Provider> lives in
 * ThemeProvider.tsx): Node's native TypeScript execution (`node --test`,
 * used by every test file in this project) strips types but does not
 * transform JSX, so a JSX-bearing .ts/.tsx file can only ever be
 * exercised via `expo export`, not `node --test`. Keeping this module
 * pure lets mobile/tests/ux.test.ts import resolveTheme() and the design
 * tokens directly.
 */

/*
 * Roles shared with the website (app/globals.css): onAccent is text on an
 * accent fill or a book/section tint (white in light, dark brown in dark,
 * where the accent turns light); borderStrong outlines a control (field,
 * button, chip) at 3:1, while border stays for decorative edges;
 * highlight (turmeric gold) marks "today" and "new", leaving accent to
 * mean actions and links, with highlightSoft as its quiet tinted form.
 */
const lightColors = {
  background: "#FBF9F5",
  surface: "#ffffff",
  surfaceAlt: "#efe7da",
  foreground: "#211c16",
  muted: "#6b6259",
  border: "#e3dcd0",
  borderStrong: "#9a8d7b",
  accent: "#7a3b2e",
  onAccent: "#ffffff",
  highlight: "#e9b949",
  onHighlight: "#211c16",
  highlightSoft: "#f8ecc9",
  onHighlightSoft: "#6e4b00",
  overlay: "rgba(33, 28, 22, 0.85)",
} as const;

const darkColors = {
  background: "#1a1712",
  surface: "#231e18",
  surfaceAlt: "#302820",
  foreground: "#f1ece2",
  muted: "#a89e90",
  border: "#3a332a",
  borderStrong: "#7a6e5e",
  accent: "#d99879",
  onAccent: "#1a1712",
  highlight: "#e3b450",
  onHighlight: "#1a1712",
  highlightSoft: "#3a301c",
  onHighlightSoft: "#f0c868",
  overlay: "rgba(0, 0, 0, 0.9)",
} as const;

/** Widened to plain strings (not the literal union `typeof lightColors` would give) so darkColors -- a genuinely different palette -- can satisfy the same shape. */
export type ThemeColors = { [K in keyof typeof lightColors]: string };
export type ColorScheme = "light" | "dark";

export const typography = {
  title: 22,
  heading: 17,
  body: 16,
  small: 13,
  eyebrow: 12,
  /** Reading line-height multiplier for long-form prose (Sthala Puranam, chapter bodies). */
  readingLineHeight: 1.65,
  /**
   * Long-form reading body text (chapter/Sthala Puranam paragraphs
   * only, never headings or UI chrome) gets a serif face -- Georgia
   * and its Android/default counterpart are both system fonts already
   * present on every device, so this needs no font asset bundling or
   * expo-font loading. Plain platform-keyed strings rather than a
   * resolved value: Platform.select() itself is applied at the actual
   * usage site (Section.tsx), not here, since this module is
   * deliberately react-native-import-free so `node --test` can import
   * resolveTheme() directly (see the file-level comment above).
   */
  readingFontFamily: { ios: "Georgia", android: "serif", default: "serif" },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

export const layout = {
  /** Reading measure: caps line length for long-form prose on tablets/large phones. */
  maxContentWidth: 640,
  screenPadding: spacing.lg,
  /** Apple/Android accessibility guidance: minimum comfortable touch target. */
  minTouchTarget: 44,
  /**
   * Extra bottom clearance for every scrollable/list screen nested under
   * the (tabs) bottom tab bar -- reported as long content (Sthala
   * Puranam especially) scrolling up right to the tab bar's edge with no
   * breathing room. Sized generously above a typical iOS tab bar height
   * (~49pt) plus the home-indicator safe area (~34pt) so the last line
   * of text always clears it with real margin, on both platforms.
   */
  tabBarClearance: 96,
} as const;

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
}

/**
 * Exported (not just used internally) so mobile/tests/ux.test.ts can
 * verify the theme system without needing a react-native renderer under
 * `node --test` -- this pure function is the entire non-React surface of
 * "does the theme load and resolve both schemes correctly".
 */
export function resolveTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: scheme === "dark" ? darkColors : lightColors };
}

export interface ThemeContextValue {
  theme: Theme;
  /** null = follow the system appearance; otherwise a manual override for this session only (no persistence, per Phase 6C scope). */
  override: ColorScheme | null;
  setOverride: (scheme: ColorScheme | null) => void;
}

/** Exported so ThemeProvider.tsx (the one JSX-bearing file, .Provider lives there) can supply a value. */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme/useThemeControls must be used within a ThemeProvider");
  return ctx;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** Exposes the manual light/dark override for a settings-style toggle, separate from useTheme() so components that only read colors don't re-render on override plumbing changes. */
export function useThemeControls() {
  const { theme, override, setOverride } = useThemeContext();
  return { scheme: theme.scheme, override, setOverride };
}
