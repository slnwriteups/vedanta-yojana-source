import type { UiStringKey } from "../ui-strings.ts";

/**
 * The "How to use the app" tour: one step per thing a new reader should
 * know, in the order they are shown. Each step opens its tab (`route`),
 * highlights one element (`target`, a TourTarget id) and explains it.
 * `interactive` steps leave the highlighted element tappable, so a reader
 * can actually change the language, appearance and text size mid-tour.
 */

export type TourRoute = "/" | "/divya-desams" | "/library" | "/search" | "/settings";

export interface TourStep {
  id: string;
  route: TourRoute;
  target: string;
  title: UiStringKey;
  body: UiStringKey;
  interactive?: boolean;
  /** The element sits in the Home screen's scrolling content, so scroll it into view first. */
  scroll?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: "home", route: "/", target: "tab-home", title: "tabHome", body: "tourHomeBody" },
  { id: "date", route: "/", target: "panchangam-date", title: "tourDateTitle", body: "tourDateBody", scroll: true },
  { id: "place", route: "/", target: "panchangam-place", title: "tourPlaceTitle", body: "tourPlaceBody", scroll: true },
  { id: "divya-desams", route: "/divya-desams", target: "tab-divya-desams", title: "tabDivyaDesams", body: "tourDivyaDesamsBody" },
  { id: "library", route: "/library", target: "tab-library", title: "tabLibrary", body: "tourLibraryBody" },
  { id: "search", route: "/search", target: "tab-search", title: "tabSearch", body: "tourSearchBody" },
  { id: "language", route: "/settings", target: "settings-language", title: "settingsLanguageLabel", body: "tourLanguageBody", interactive: true },
  { id: "appearance", route: "/settings", target: "settings-appearance", title: "settingsAppearanceLabel", body: "tourAppearanceBody", interactive: true },
  { id: "text-size", route: "/settings", target: "settings-text-size", title: "settingsTextSizeLabel", body: "tourTextSizeBody", interactive: true },
  { id: "replay", route: "/settings", target: "settings-tour", title: "settingsHowToUse", body: "tourReplayBody" },
];

/** Set once a reader has finished or skipped the tour, so it starts on its own only once. */
export const TOUR_SEEN_STORAGE_KEY = "vy.tour.seen";
