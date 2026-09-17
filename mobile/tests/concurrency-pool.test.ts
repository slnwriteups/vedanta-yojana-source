import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../services/concurrencyPool.ts";

test("mapWithConcurrency: returns results in input order regardless of completion order", async () => {
  const delays = [30, 10, 20, 0];
  const results = await mapWithConcurrency(delays, 4, async (delay, index) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return index;
  });
  assert.deepEqual(results, [0, 1, 2, 3]);
});

test("mapWithConcurrency: never runs more than `concurrency` calls at once", async () => {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 20 }, (_, i) => i);

  await mapWithConcurrency(items, 3, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
  });

  assert.ok(maxActive <= 3, `expected at most 3 concurrent calls, saw ${maxActive}`);
  assert.equal(maxActive, 3, "expected the pool to actually reach the concurrency limit, not run less parallel than allowed");
});

test("mapWithConcurrency: every item is processed exactly once", async () => {
  const seen: number[] = [];
  const items = Array.from({ length: 10 }, (_, i) => i);
  await mapWithConcurrency(items, 4, async (item) => {
    seen.push(item);
  });
  assert.deepEqual([...seen].sort((a, b) => a - b), items);
});

test("mapWithConcurrency: an empty list resolves immediately to an empty array", async () => {
  const results = await mapWithConcurrency([], 4, async () => 1);
  assert.deepEqual(results, []);
});

test("mapWithConcurrency: a concurrency higher than the item count doesn't throw or over-run", async () => {
  const results = await mapWithConcurrency([1, 2], 10, async (n) => n * 2);
  assert.deepEqual(results, [2, 4]);
});

test("mapWithConcurrency: one failing call rejects the whole call, but already-started work still runs", async () => {
  let started = 0;
  await assert.rejects(
    mapWithConcurrency([1, 2, 3], 3, async (n) => {
      started += 1;
      if (n === 2) throw new Error("boom");
      await new Promise((resolve) => setTimeout(resolve, 5));
      return n;
    })
  );
  assert.equal(started, 3, "expected all 3 workers to have started before the rejection propagated");
});
