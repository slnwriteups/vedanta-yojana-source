import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, radius, spacing, useTheme } from "../theme";
import { useT } from "../ui-strings.ts";
import {
  classifyRelease,
  clamp,
  DOUBLE_TAP_WINDOW_MS,
  maxPanOffset,
  pinchDistance,
  type ViewerTouch,
} from "./image-viewer-math.ts";

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
 *
 * Ways to close: tap anywhere, swipe the picture down, the close button
 * (top right, below the status bar), or Android back.
 *
 * Tap-to-close without clashing with zoom: one gesture recognizer covers
 * the whole screen, so taps, pinches and double-taps are all decided in
 * one place. A single tap only schedules the close, after the double-tap
 * window; ANY new touch landing in that window (the second half of a
 * double-tap, or a pinch starting) cancels it outright. An earlier
 * version removed tap-to-close because its timer, checked against a
 * timestamp the double-tap had already reset, still fired after a
 * double-tap and closed the picture mid-zoom; cancelling the timer
 * itself removes that race. While zoomed in, a single tap never closes
 * (the reader is exploring the picture); double-tap zooms back out.
 *
 * Swipe-down-to-close applies only when not zoomed in -- zoomed in, a
 * drag pans the picture.
 */

const MAX_SCALE = 4;
const DOUBLE_TAP_ZOOM = 2.5;

export function ImageViewerModal({
  visible,
  asset,
  label,
  onClose,
}: {
  visible: boolean;
  /** A Metro-bundled asset id (Divya Desam images) or `{ uri }` (a downloaded book's local chapter images) -- see ContentImage.tsx's ImageAsset type. */
  asset: number | { uri: string } | null;
  label?: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const boxWidth = width * 0.92;
  const boxHeight = height * 0.7;

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  /** Downward drag of the un-zoomed picture while swiping to close; also fades the backdrop. */
  const dismissY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = dismissY.interpolate({ inputRange: [0, 300], outputRange: [1, 0.35], extrapolate: "clamp" });

  // PanResponder callbacks run outside React's render cycle and need to
  // read the CURRENT transform synchronously (to compute a pinch/pan
  // delta against, or to decide whether a release was "still zoomed
  // in"), so these plain refs mirror the Animated values via listeners.
  const current = useRef({ scale: 1, x: 0, y: 0 });
  const gestureStart = useRef({
    scale: 1,
    x: 0,
    y: 0,
    pinchDistance: 0,
    panOrigin: null as ViewerTouch | null,
    hadMultitouch: false,
  });
  const lastTapAt = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelPendingClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  // Never leave a close scheduled across opens, or after unmount.
  useEffect(() => {
    if (!visible) cancelPendingClose();
    return cancelPendingClose;
  }, [visible]);

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
    cancelPendingClose();
    lastTapAt.current = 0;
    animateTo(1, 0, 0);
    dismissY.setValue(0);
    onClose();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        // A new touch inside the double-tap window means a double-tap or a
        // pinch is starting: the single tap before it must not close.
        cancelPendingClose();
        const touches = evt.nativeEvent.touches as readonly ViewerTouch[];
        gestureStart.current.scale = current.current.scale;
        gestureStart.current.x = current.current.x;
        gestureStart.current.y = current.current.y;
        gestureStart.current.pinchDistance = touches.length === 2 ? pinchDistance(touches) : 0;
        gestureStart.current.panOrigin = touches.length === 1 ? { pageX: touches[0].pageX, pageY: touches[0].pageY } : null;
        gestureStart.current.hadMultitouch = touches.length >= 2;
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches as readonly ViewerTouch[];
        if (touches.length >= 2) {
          gestureStart.current.hadMultitouch = true;
          gestureStart.current.panOrigin = null;
          dismissY.setValue(0);
          if (gestureStart.current.pinchDistance === 0) {
            // The second finger just landed (or landed a beat after the
            // first, which is the common case) -- there was no 2-touch
            // baseline yet, so establish one right now instead of only
            // at onPanResponderGrant, which may have fired with just the
            // first finger down.
            gestureStart.current.pinchDistance = pinchDistance(touches);
            gestureStart.current.scale = current.current.scale;
          } else {
            const ratio = pinchDistance(touches) / gestureStart.current.pinchDistance;
            scale.setValue(clamp(gestureStart.current.scale * ratio, 1, MAX_SCALE));
          }
        } else if (touches.length === 1) {
          if (gestureStart.current.pinchDistance !== 0 || !gestureStart.current.panOrigin) {
            // Either a finger was just lifted after a pinch, or this is
            // a fresh single-finger drag -- (re)anchor the pan origin to
            // right now so the image doesn't jump. gestureState.dx/dy
            // isn't used here precisely because it can't be reset
            // mid-gesture the way this raw touch position can.
            gestureStart.current.pinchDistance = 0;
            gestureStart.current.x = current.current.x;
            gestureStart.current.y = current.current.y;
            gestureStart.current.panOrigin = { pageX: touches[0].pageX, pageY: touches[0].pageY };
          }
          if (gestureStart.current.scale <= 1 && gestureStart.current.panOrigin) {
            // Not zoomed in: the picture follows a downward drag (swipe to close).
            const dy = touches[0].pageY - gestureStart.current.panOrigin.pageY;
            dismissY.setValue(Math.max(0, dy));
          } else if (gestureStart.current.scale > 1 && gestureStart.current.panOrigin) {
            const dx = touches[0].pageX - gestureStart.current.panOrigin.pageX;
            const dy = touches[0].pageY - gestureStart.current.panOrigin.pageY;
            const maxX = maxPanOffset(boxWidth, gestureStart.current.scale);
            const maxY = maxPanOffset(boxHeight, gestureStart.current.scale);
            translateX.setValue(clamp(gestureStart.current.x + dx, -maxX, maxX));
            translateY.setValue(clamp(gestureStart.current.y + dy, -maxY, maxY));
          }
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const kind = classifyRelease({
          dx: gestureState.dx,
          dy: gestureState.dy,
          vy: gestureState.vy,
          hadMultitouch: gestureStart.current.hadMultitouch,
          scale: current.current.scale,
        });

        if (kind === "dismiss") {
          handleClose();
          return;
        }
        Animated.spring(dismissY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();

        if (kind === "tap") {
          const now = Date.now();
          if (now - lastTapAt.current < DOUBLE_TAP_WINDOW_MS) {
            lastTapAt.current = 0;
            animateTo(current.current.scale > 1 ? 1 : DOUBLE_TAP_ZOOM);
            return;
          }
          lastTapAt.current = now;
          if (current.current.scale <= 1) {
            closeTimer.current = setTimeout(() => {
              closeTimer.current = null;
              handleClose();
            }, DOUBLE_TAP_WINDOW_MS);
          }
          return;
        }

        if (current.current.scale <= 1) animateTo(1, 0, 0);
      },
      onPanResponderTerminate: () => {
        Animated.spring(dismissY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      },
    })
  ).current;

  return (
    <Modal
      visible={visible && asset !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay, opacity: backdropOpacity }]}
        />
        {/* The whole screen is one gesture area, so a tap anywhere -- on the picture or around it -- is handled the same way. */}
        <View style={[StyleSheet.absoluteFill, styles.gestureArea]} {...panResponder.panHandlers}>
          {asset !== null ? (
            <Animated.Image
              source={asset}
              accessibilityLabel={label ?? undefined}
              style={[
                { width: boxWidth, height: boxHeight },
                { transform: [{ translateY: dismissY }, { scale }, { translateX }, { translateY }] },
              ]}
              resizeMode="contain"
            />
          ) : null}
        </View>

        <Text
          pointerEvents="none"
          style={[styles.hint, { bottom: insets.bottom + spacing.xl }]}
          importantForAccessibility="no"
        >
          {t("tapAnywhereToClose")}
        </Text>

        {/* Top right, clear of the status bar and notch, with a generous touch area. */}
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("closeImage")}
          hitSlop={spacing.md}
          style={({ pressed }) => [
            styles.closeButton,
            { top: insets.top + spacing.sm, right: insets.right + spacing.md, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="close" size={26} color="#fffaf5" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gestureArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 13,
    color: "#fffaf5",
    opacity: 0.8,
  },
  closeButton: {
    position: "absolute",
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
});
