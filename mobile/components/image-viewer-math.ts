/**
 * The pure, framework-free half of ImageViewerModal.tsx's pinch/pan math
 * -- split out so it can be unit-tested under plain `node --test`
 * (mobile/tests/*.test.ts's own established convention: no react-native
 * import, since Node has no Metro/RN runtime to satisfy one). Everything
 * that actually touches react-native (Animated, PanResponder, Modal)
 * stays in ImageViewerModal.tsx itself, which can only be exercised via
 * `npx expo export`/an EAS build, not `node --test`.
 */

export type ViewerTouch = { pageX: number; pageY: number };

/**
 * Euclidean distance between two touches, used to scale a pinch gesture
 * relative to where it started. Takes any array of 2+ touches (as a
 * native touch event's `.touches` list is typed) rather than a strict
 * tuple -- every call site already checks `.length === 2` first, and
 * requiring a tuple here would need an unsound cast at each call site
 * instead of one honest array-length assumption in one place.
 */
export function pinchDistance(touches: readonly ViewerTouch[]): number {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** How far the zoomed image may pan on one axis before its edge would show blank space, for a box of the given size at the given scale. */
export function maxPanOffset(boxSize: number, scale: number): number {
  return (boxSize * (scale - 1)) / 2;
}

/** A finger that moved less than this (px) on release was a tap, not a drag. */
export const TAP_MOVE_THRESHOLD = 6;
/** Two taps released within this window (ms) are a double-tap; a single tap closes only after it passes. */
export const DOUBLE_TAP_WINDOW_MS = 300;
/** Dragging the un-zoomed picture down at least this far (px) closes it on release... */
export const DISMISS_DISTANCE = 120;
/** ...as does a quick downward flick (px/ms) that has moved at least DISMISS_MIN_FLICK_DISTANCE. */
export const DISMISS_VELOCITY = 0.9;
export const DISMISS_MIN_FLICK_DISTANCE = 40;

export type ReleaseKind = "tap" | "dismiss" | "none";

/**
 * What a finished one-gesture touch meant. A pinch (any second finger)
 * is never a tap or a dismiss. Swipe-to-close only applies when the
 * picture isn't zoomed in -- zoomed in, a drag pans the picture instead.
 */
export function classifyRelease(gesture: { dx: number; dy: number; vy: number; hadMultitouch: boolean; scale: number }): ReleaseKind {
  const { dx, dy, vy, hadMultitouch, scale } = gesture;
  if (hadMultitouch) return "none";
  if (Math.abs(dx) < TAP_MOVE_THRESHOLD && Math.abs(dy) < TAP_MOVE_THRESHOLD) return "tap";
  const notZoomed = scale <= 1.01;
  const mostlyDown = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.5;
  if (notZoomed && mostlyDown && (dy >= DISMISS_DISTANCE || (vy >= DISMISS_VELOCITY && dy >= DISMISS_MIN_FLICK_DISTANCE))) {
    return "dismiss";
  }
  return "none";
}
