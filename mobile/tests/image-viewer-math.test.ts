import test from "node:test";
import assert from "node:assert/strict";
import { clamp, classifyRelease, DISMISS_DISTANCE, maxPanOffset, pinchDistance, TAP_MOVE_THRESHOLD } from "../components/image-viewer-math.ts";

/**
 * Unit tests for ImageViewerModal.tsx's pure pinch/pan math. The
 * gesture-handling component itself imports react-native (Animated,
 * PanResponder, Modal) and can only be exercised via `npx expo export`/
 * an EAS build, not `node --test` -- see mobile/tests/screens.test.ts's
 * own header comment for the same, pre-existing boundary. These pure
 * helpers were split out specifically so the arithmetic they're
 * responsible for (which a gesture-level bug would be hard to notice
 * from touch-testing alone) has real coverage.
 */

test("pinchDistance: two touches directly apart on one axis measure their exact separation", () => {
  assert.equal(pinchDistance([{ pageX: 0, pageY: 0 }, { pageX: 100, pageY: 0 }]), 100);
  assert.equal(pinchDistance([{ pageX: 0, pageY: 0 }, { pageX: 0, pageY: 40 }]), 40);
});

test("pinchDistance: a 3-4-5 triangle gives the expected Euclidean distance", () => {
  assert.equal(pinchDistance([{ pageX: 0, pageY: 0 }, { pageX: 3, pageY: 4 }]), 5);
});

test("pinchDistance: order of the two touches does not matter", () => {
  const a = { pageX: 10, pageY: 20 };
  const b = { pageX: 70, pageY: 60 };
  assert.equal(pinchDistance([a, b]), pinchDistance([b, a]));
});

test("clamp: a value inside the range passes through unchanged", () => {
  assert.equal(clamp(5, 1, 10), 5);
});

test("clamp: a value below the minimum is raised to the minimum", () => {
  assert.equal(clamp(-3, 1, 10), 1);
});

test("clamp: a value above the maximum is lowered to the maximum", () => {
  assert.equal(clamp(99, 1, 10), 10);
});

test("clamp: a value exactly at either boundary is returned as-is", () => {
  assert.equal(clamp(1, 1, 10), 1);
  assert.equal(clamp(10, 1, 10), 10);
});

test("maxPanOffset: at scale 1 (not zoomed), the allowed pan is zero", () => {
  assert.equal(maxPanOffset(300, 1), 0);
});

test("maxPanOffset: scales linearly with how far past 1x the image is zoomed", () => {
  assert.equal(maxPanOffset(300, 2), 150);
  assert.equal(maxPanOffset(300, 3), 300);
});

test("maxPanOffset: a wider box allows proportionally more pan at the same zoom level", () => {
  assert.equal(maxPanOffset(400, 2) > maxPanOffset(200, 2), true);
});


const still = { dx: 0, dy: 0, vy: 0, hadMultitouch: false, scale: 1 };

test("Release: a barely-moving single finger is a tap, zoomed or not", () => {
  assert.equal(classifyRelease(still), "tap");
  assert.equal(classifyRelease({ ...still, dx: TAP_MOVE_THRESHOLD - 1, dy: -(TAP_MOVE_THRESHOLD - 1) }), "tap");
  assert.equal(classifyRelease({ ...still, scale: 2.5 }), "tap");
});

test("Release: a pinch is never a tap or a close", () => {
  assert.equal(classifyRelease({ ...still, hadMultitouch: true }), "none");
  assert.equal(classifyRelease({ ...still, hadMultitouch: true, dy: 400, vy: 3 }), "none");
});

test("Release: swiping the un-zoomed picture down far enough, or flicking it, closes", () => {
  assert.equal(classifyRelease({ ...still, dy: DISMISS_DISTANCE }), "dismiss");
  assert.equal(classifyRelease({ ...still, dy: 50, vy: 1.2 }), "dismiss");
  assert.equal(classifyRelease({ ...still, dy: 50, vy: 0.2 }), "none");
});

test("Release: swiping while zoomed in pans instead of closing", () => {
  assert.equal(classifyRelease({ ...still, dy: 400, vy: 3, scale: 2 }), "none");
});

test("Release: sideways or upward drags don't close", () => {
  assert.equal(classifyRelease({ ...still, dx: 200, dy: 130 }), "none");
  assert.equal(classifyRelease({ ...still, dy: -300, vy: -3 }), "none");
});
