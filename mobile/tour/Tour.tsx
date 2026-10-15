import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, radius, spacing, typography, useTheme } from "../theme";
import { tourStepCountLabel, useT } from "../ui-strings.ts";
import { useLanguage } from "../language-context.ts";
import { writeJSON } from "../storage.ts";
import { TOUR_SEEN_STORAGE_KEY, TOUR_STEPS } from "./tourSteps.ts";

/**
 * The "How to use the app" tour (steps in tourSteps.ts). TourProvider
 * holds whether it is running and which step is showing; TourTarget marks
 * an element a step can highlight; TourOverlay dims the screen around the
 * highlighted element and shows the step's card with Back / Next / Skip.
 *
 * The dimming is four panels around a hole, not one sheet with a cut-out,
 * so on an interactive step the highlighted element stays tappable (a
 * reader can switch the language mid-tour and watch the card follow). On
 * other steps a clear cover over the hole keeps taps from wandering off.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Measure = () => Promise<Rect | null>;

interface TourContextValue {
  active: boolean;
  /** Starts the tour from its first step. */
  start: () => void;
  /** Starts the tour once the tabs have had a moment to appear (used right after first-launch setup). */
  startSoon: () => void;
  register: (id: string, measure: Measure) => () => void;
  /** The Home screen's way to scroll a highlighted element into view. */
  registerScroller: (scrollBy: (dy: number) => void) => () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour must be used inside TourProvider");
  return value;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const targets = useRef(new Map<string, Measure>());
  const scroller = useRef<((dy: number) => void) | null>(null);

  const start = useCallback(() => setActive(true), []);
  const startSoon = useCallback(() => {
    setTimeout(() => setActive(true), 900);
  }, []);
  const register = useCallback((id: string, measure: Measure) => {
    targets.current.set(id, measure);
    return () => {
      if (targets.current.get(id) === measure) targets.current.delete(id);
    };
  }, []);
  const registerScroller = useCallback((scrollBy: (dy: number) => void) => {
    scroller.current = scrollBy;
    return () => {
      if (scroller.current === scrollBy) scroller.current = null;
    };
  }, []);

  const value = useMemo(
    () => ({ active, start, startSoon, register, registerScroller }),
    [active, start, startSoon, register, registerScroller]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {active ? (
        <TourOverlay
          targets={targets.current}
          scroller={scroller}
          onEnd={() => {
            setActive(false);
            void writeJSON(TOUR_SEEN_STORAGE_KEY, true);
          }}
        />
      ) : null}
    </TourContext.Provider>
  );
}

/** Marks an element the tour can highlight. Renders a plain View around its children. */
export function TourTarget({ id, style, children }: { id: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const context = useContext(TourContext);
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!context) return;
    return context.register(
      id,
      () =>
        new Promise((resolve) => {
          const node = ref.current;
          if (!node) return resolve(null);
          node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
        })
    );
  }, [context, id]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

/** Lets the Home screen scroll the tour's highlighted element into view. */
export function useTourScroller(scrollBy: (dy: number) => void) {
  const context = useContext(TourContext);
  useEffect(() => (context ? context.registerScroller(scrollBy) : undefined), [context, scrollBy]);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const PADDING = 6;
const CARD_ESTIMATE = 220;

function TourOverlay({
  targets,
  scroller,
  onEnd,
}: {
  targets: Map<string, Measure>;
  scroller: { current: ((dy: number) => void) | null };
  onEnd: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  // Open the step's tab, bring its element into view, then keep tracking it:
  // a language or text-size change, or a rotation, moves it.
  useEffect(() => {
    let cancelled = false;
    setRect(null);
    router.navigate(step.route as never);

    const measure = async () => (await targets.get(step.target)?.()) ?? null;
    (async () => {
      await wait(450);
      let found = await measure();
      if (cancelled) return;
      if (found && step.scroll && scroller.current) {
        const top = insets.top + 72;
        const bottom = screenH - insets.bottom - 90 - CARD_ESTIMATE;
        if (found.y < top || found.y + found.height > bottom) {
          scroller.current(found.y - top - 24);
          await wait(400);
          found = await measure();
        }
      }
      if (!cancelled) setRect(found);
    })();

    const timer = setInterval(async () => {
      const found = await measure();
      if (!cancelled) {
        setRect((prev) =>
          prev && found && prev.x === found.x && prev.y === found.y && prev.width === found.width && prev.height === found.height
            ? prev
            : found
        );
      }
    }, 600);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [index, step, targets, scroller, insets.top, insets.bottom, screenH]);

  const finish = () => {
    onEnd();
    router.navigate("/" as never);
  };

  const hole = rect
    ? {
        x: Math.max(0, rect.x - PADDING),
        y: Math.max(0, rect.y - PADDING),
        width: Math.min(screenW, rect.width + PADDING * 2),
        height: rect.height + PADDING * 2,
      }
    : null;

  // The card sits on whichever side of the highlight has more room.
  const cardBelow = hole ? hole.y + hole.height / 2 < screenH / 2 : false;
  const cardPosition: ViewStyle = hole
    ? cardBelow
      ? { top: Math.min(hole.y + hole.height + spacing.md, screenH - insets.bottom - CARD_ESTIMATE) }
      : { bottom: Math.max(screenH - hole.y + spacing.md, insets.bottom + spacing.md) }
    : { top: screenH / 2 - CARD_ESTIMATE / 2 };

  const dim = "rgba(0,0,0,0.6)";
  const cardWidth = Math.min(480, screenW - spacing.lg * 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityViewIsModal={!step.interactive}>
      {hole ? (
        <>
          <View style={[styles.dim, { backgroundColor: dim, top: 0, left: 0, right: 0, height: hole.y }]} />
          <View style={[styles.dim, { backgroundColor: dim, top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.dim, { backgroundColor: dim, top: hole.y, left: 0, width: hole.x, height: hole.height }]} />
          <View
            style={[styles.dim, { backgroundColor: dim, top: hole.y, left: hole.x + hole.width, right: 0, height: hole.height }]}
          />
          <View
            pointerEvents={step.interactive ? "none" : "auto"}
            style={[
              styles.ring,
              { borderColor: theme.colors.accent, left: hole.x, top: hole.y, width: hole.width, height: hole.height },
            ]}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dim }]} />
      )}

      <View
        style={[
          styles.card,
          cardPosition,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            width: cardWidth,
            left: (screenW - cardWidth) / 2,
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.count, { color: theme.colors.muted }]}>
          {tourStepCountLabel(language, index + 1, TOUR_STEPS.length)}
        </Text>
        <Text style={[styles.title, { color: theme.colors.foreground }]} accessibilityRole="header">
          {t(step.title)}
        </Text>
        <Text style={[styles.body, { color: theme.colors.foreground }]}>{t(step.body)}</Text>
        <View style={styles.buttons}>
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} style={styles.skip}>
            <Text style={[styles.skipText, { color: theme.colors.muted }]}>{t("tourSkip")}</Text>
          </Pressable>
          <View style={styles.navButtons}>
            {index > 0 ? (
              <Pressable
                onPress={() => setIndex((i) => i - 1)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, { borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.buttonText, { color: theme.colors.foreground }]}>{t("tourBack")}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => (last ? finish() : setIndex((i) => i + 1))}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>{last ? t("tourDone") : t("tourNext")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute" },
  ring: { position: "absolute", borderWidth: 3, borderRadius: radius.md },
  card: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  count: { fontSize: typography.eyebrow, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: typography.heading, fontWeight: "700" },
  body: { fontSize: typography.body, lineHeight: typography.body * 1.4 },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  navButtons: { flexDirection: "row", gap: spacing.sm },
  skip: { minHeight: layout.minTouchTarget, justifyContent: "center" },
  skipText: { fontSize: typography.small, fontWeight: "600" },
  button: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  buttonText: { fontSize: typography.body, fontWeight: "600" },
});
