/**
 * Runs `fn` over every item with at most `concurrency` calls in flight at
 * once, instead of either fully sequential (slow -- one round trip's
 * latency at a time) or fully unbounded (a burst of every request at
 * once). Results are returned in the same order as `items`, regardless
 * of which call actually finished first. Zero external imports, so this
 * can be unit-tested under plain `node --test` -- used by
 * bookOfflineCore.ts to download a book's images concurrently instead
 * of one at a time.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current], current);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
