/**
 * The pure day-rotation logic extracted from
 * mobile/components/DivyaDesamSpotlight.tsx (its non-RN, non-rendering
 * half) so both runtimes share one implementation instead of each
 * keeping its own copy of the shuffle math. Only the rendering shell
 * (mobile's ImageBackground/Pressable/expo-router push vs. web's
 * DivyaDesamSpotlight.tsx client component) stays platform-specific.
 *
 * pickSpotlightRecord is generic (not typed to DivyaDesam) because web's
 * caller (components/divya-desams/DivyaDesamSpotlightSection.tsx) must
 * run this entirely client-side, not at Next.js static-export build
 * time -- a statically exported site has no per-request server, so a
 * server-side `new Date()` bakes in the *build* day forever, until the
 * next deploy, rather than rotating daily for each visitor. The web
 * client component therefore calls this with an array of its own
 * already-server-resolved display entries, not raw DivyaDesam records.
 */

/** Whole calendar days since the Unix epoch, local device date -- a day counter that advances by exactly 1 each day. */
export function daysSinceEpoch(date: Date): number {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utcMidnight / 86400000);
}

/**
 * A Wang/Murmur3-style integer finalizer: three multiply-xor-shift
 * rounds give strong avalanche even for near-identical inputs. Used
 * below to drive a seeded Fisher-Yates shuffle -- Math.imul keeps every
 * step in 32-bit integer arithmetic, matching the reference Wang hash
 * exactly.
 */
export function hashInt(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

/** Fixed seed for the spotlight's shuffle order -- change only if a deliberately different rotation order is wanted. */
export const SPOTLIGHT_SHUFFLE_SEED = 0x5d1f4a;

/**
 * A fixed, deterministic shuffle of [0, length) via seeded Fisher-Yates.
 * Walking this permutation one index per calendar day (see
 * `daysSinceEpoch` above, indexed with `% length`) visits every record
 * exactly once per length-day cycle before repeating -- so with ~107
 * records, no temple repeats within any 7-day window, and none repeats
 * until all 108 (counting the merged #36-37 record as two) have been
 * shown, at which point the same shuffled cycle restarts.
 */
export function seededShuffle(length: number, seed: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  let state = seed;
  for (let i = length - 1; i > 0; i--) {
    state = hashInt(state);
    const j = state % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * Picks the day's featured entry from an already source-page-sorted
 * list (see content-lib/ordering.ts) -- one entry per calendar day,
 * rotated through seededShuffle()'s fixed order rather than walked in
 * sequence or picked independently at random each day. Returns null
 * for an empty list rather than throwing. Generic over T (rather than
 * fixed to DivyaDesam) purely so callers on both platforms can pass
 * whatever shape they've already resolved their records into -- the
 * function only ever indexes into the array, never reads a field.
 */
export function pickSpotlightRecord<T>(sortedRecords: readonly T[], date: Date = new Date()): T | null {
  if (sortedRecords.length === 0) return null;
  const shuffleOrder = seededShuffle(sortedRecords.length, SPOTLIGHT_SHUFFLE_SEED);
  const cycleIndex = daysSinceEpoch(date) % sortedRecords.length;
  return sortedRecords[shuffleOrder[cycleIndex]];
}
