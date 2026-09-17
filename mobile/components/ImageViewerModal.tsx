import { useEffect, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { layout, radius, spacing, useTheme } from "../theme";
import { useT } from "../ui-strings.ts";
import { clamp, maxPanOffset, pinchDistance, type ViewerTouch } from "./image-viewer-math.ts";

/**
 * Full-screen image viewer with pinch-to-zoom, pan-while-zoomed, and
 * double-tap-to-zoom, built entirely on react-native core's Animated +
 * PanResponder -- neither is a new dependency (Animated is already used
 * by ContentImage.tsx's FadeInImage). react-native-gesture-handler and
 * react-native-reanimated, which would make this multi-touch math more
 * ergonomic, are NOT installed anywhere in this project (confirmed
 * absent from node_modules; expo-router lists them only as optional
 * peer dependencies for its own Drawer navigator, which this app
 * doesn't use) -- PanResponder is less convenient but sufficient for
 * this one feature, so no new dependency was added.
 *
 * Accessibility: TalkBack/VoiceOver's own touch-exploration layer
 * intercepts raw touches before a bare View's PanResponder would see
 * them, and double-tap is TalkBack's own "activate" gesture -- so the
 * custom pinch/pan/double-tap gestures below are a sighted-user
 * enhancement layer, not the only way to dismiss. The explicit close
 * button is a real Pressable/accessibilityRole="button" specifically so
 * screen-reader users have a reliable, ordinary control regardless of
 * whether the gesture layer responds to their input method. Android
 * back (`onRequestClose`) is unaffected by any of this.
 */

const MAX_SCALE = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_WINDOW_MS = 250;
const TAP_MOVE_THRESHOLD = 6;

export function ImageViewerModal({
  visible,
  asset,
  label,
  onClose,
}: {
  visible: boolean;
  asset: number | null;
  label?: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const { width, height } = useWindowDimensions();
  const boxWidth = width * 0.92;
  const boxHeight = height * 0.7;

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // PanResponder callbacks run outside React's render cycle and need to
  // read the CURRENT transform synchronously (to compute a pinch/pan
  // delta against, or to decide whether a release was "still zoomed
  // in"), so these plain refs mirror the Animated values via listeners.
  const current = useRef({ scale: 1, x: 0, y: 0 });
  const gestureStart = useRef({ scale: 1, x: 0, y: 0, pinchDistance: 0 });
  const lastTapAt = useRef(0);

  useEffect(() => {
    const scaleId = scale.addListener(({ value }) => {
      current.current.scale = value;
    });
    const xId = translateX.addListener(({ value }) => {
      current.current.x = value;
    });
    const yId = translateY.addListener(({ value }) => {
      current.current.y = value;
    });
    return () => {
      scale.removeListener(scaleId);
      translateX.removeListener(xId);
      translateY.removeListener(yId);
    };
  }, [scale, translateX, translateY]);

  function animateTo(nextScale: number, x = 0, y = 0) {
    current.current = { scale: nextScale, x, y };
    Animated.parallel([
      Animated.spring(scale, { toValue: nextScale, useNativeDriver: true, friction: 8 }),
      Animated.spring(translateX, { toValue: x, useNativeDriver: true, friction: 8 }),
      Animated.spring(translateY, { toValue: y, useNativeDriver: true, friction: 8 }),
    ]).start();
  }

  function handleClose() {
    animateTo(1, 0, 0);
    onClose();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        gestureStart.current.scale = current.current.scale;
        gestureStart.current.x = current.current.x;
        gestureStart.current.y = current.current.y;
        gestureStart.current.pinchDistance =
          evt.nativeEvent.touches.length === 2
            ? pinchDistance(evt.nativeEvent.touches as ViewerTouch[])
            : 0;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2 && gestureStart.current.pinchDistance > 0) {
          const ratio = pinchDistance(touches as ViewerTouch[]) / gestureStart.current.pinchDistance;
          scale.setValue(clamp(gestureStart.current.scale * ratio, 1, MAX_SCALE));
        } else if (touches.length === 1 && gestureStart.current.scale > 1) {
          const maxX = maxPanOffset(boxWidth, gestureStart.current.scale);
          const maxY = maxPanOffset(boxHeight, gestureStart.current.scale);
          translateX.setValue(clamp(gestureStart.current.x + gestureState.dx, -maxX, maxX));
          translateY.setValue(clamp(gestureStart.current.y + gestureState.dy, -maxY, maxY));
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const wasTap =
          gestureStart.current.pinchDistance === 0 &&
          Math.abs(gestureState.dx) < TAP_MOVE_THRESHOLD &&
          Math.abs(gestureState.dy) < TAP_MOVE_THRESHOLD;

        if (wasTap) {
          const now = Date.now();
          const isDoubleTap = now - lastTapAt.current < DOUBLE_TAP_WINDOW_MS;
          lastTapAt.current = isDoubleTap ? 0 : now;

          if (isDoubleTap) {
            animateTo(current.current.scale > 1 ? 1 : DOUBLE_TAP_ZOOM);
            return;
          }

          if (current.current.scale <= 1) {
            // A single tap closes, but only after the double-tap window
            // passes with no second tap -- otherwise every double-tap's
            // first half would close the viewer before the second half
            // (the actual zoom) could ever land.
            setTimeout(() => {
              if (Date.now() - lastTapAt.current >= DOUBLE_TAP_WINDOW_MS) handleClose();
            }, DOUBLE_TAP_WINDOW_MS);
            return;
          }
        }

        if (current.current.scale <= 1) animateTo(1, 0, 0);
      },
    })
  ).current;

  return (
    <Modal visible={visible && asset !== null} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} accessibilityViewIsModal>
        <View style={styles.gestureArea} {...panResponder.panHandlers}>
          {asset !== null ? (
            <Animated.Image
              source={asset}
              accessibilityLabel={label ?? undefined}
              style={[
                { width: boxWidth, height: boxHeight },
                { transform: [{ scale }, { translateX }, { translateY }] },
              ]}
              resizeMode="contain"
            />
          ) : null}
        </View>

        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("closeImage")}
          hitSlop={spacing.sm}
          style={[styles.closeButton, { backgroundColor: theme.colors.overlay }]}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>

        <Text style={[styles.hint, { color: theme.colors.background }]}>{t("tapAnywhereToClose")}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  gestureArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#fffaf5",
    fontSize: 20,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    opacity: 0.8,
  },
});
