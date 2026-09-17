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
