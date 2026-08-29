/**
 * Seasons RNG -- a small seeded pseudo-random number generator.
 *
 * The only source of randomness in the game. Every module that needs a random
 * value takes an Rng as an argument rather than calling `Math.random()`, which
 * makes question generation and distractor choice reproducible: the same seed
 * always produces the same season. That is what lets GameState be tested
 * without stubbing globals, and lets a bug report be reproduced from a seed
 * alone. (The trail's shape is not random at all -- the art pack's
 * `trailPath()` is fixed geometry and uses no rng.)
 *
 * - The algorithm is mulberry32: 32-bit state, one multiply-xorshift round per
 *   value. It is not cryptographically secure and must never be used for
 *   anything but gameplay.
 * - An Rng is mutable -- each call advances the internal state. Callers that
 *   need a repeatable subsequence should create a fresh Rng from a derived
 *   seed rather than trying to rewind one.
 *
 * Error Handling: `createRng` coerces any seed at all into a usable 32-bit
 * integer, so a missing or malformed seed produces a valid generator rather
 * than throwing. The methods themselves cannot fail; `pick` and `shuffle` on an
 * empty array return `undefined` and `[]` respectively.
 */

/**
 * A seeded generator. Every method advances the internal state.
 *
 * @typedef {Object} Rng
 * @property {function(): number} next        - Float in [0, 1)
 * @property {function(number, number): number} int - Integer in [min, max], inclusive
 * @property {function(Array): *} pick        - One element, or undefined if empty
 * @property {function(Array): Array} shuffle - A new shuffled copy
 */

/**
 * Coerce anything into a usable 32-bit seed. A non-finite seed becomes 1
 * rather than NaN, because a NaN seed silently produces the same value forever.
 * @private
 * @param {unknown} seed - Anything at all
 * @returns {number} A 32-bit unsigned integer, never 0
 */
function _toSeed(seed) {
  if (typeof seed === "string") {
    // FNV-1a over the string, so a human-readable seed like "spring-1" works.
    let hash = 2166136261
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0 || 1
  }
  if (!Number.isFinite(seed)) return 1
  return Math.floor(/** @type {number} */ (seed)) >>> 0 || 1
}

/**
 * Create a seeded generator.
 *
 * @param {number|string} [seed] - Any number or string; equal seeds give equal sequences
 * @returns {Rng} A new generator
 */
export function createRng(seed) {
  let state = _toSeed(seed)

  /**
   * Advance the state and return a float in [0, 1).
   * @returns {number} Float in [0, 1)
   */
  function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * An integer in [min, max], inclusive at both ends. A reversed range is
   * swapped rather than rejected, so `int(9, 2)` behaves like `int(2, 9)`.
   *
   * Two degenerate cases have no correct answer, and neither is reachable from
   * real content: a non-finite bound, and a span too narrow to contain an
   * integer (`int(0.2, 0.8)`). Both return the nearest finite bound, or 0 when
   * there is not one. The point is that they never return NaN, which would
   * spread silently through every calculation downstream.
   *
   * @param {number} min - Lower bound, inclusive
   * @param {number} max - Upper bound, inclusive
   * @returns {number} An integer in range, or a finite fallback for a
   *   degenerate range
   */
  function int(min, max) {
    const low = Math.ceil(Math.min(min, max))
    const high = Math.floor(Math.max(min, max))
    if (Number.isFinite(low) && Number.isFinite(high) && high >= low) {
      return low + Math.floor(next() * (high - low + 1))
    }
    if (Number.isFinite(low)) return low
    if (Number.isFinite(high)) return high
    return 0
  }

  /**
   * One element of an array.
   * @param {Array} items - Items to choose from
   * @returns {*} An element, or undefined if the array is empty
   */
  function pick(items) {
    if (!Array.isArray(items) || items.length === 0) return undefined
    return items[int(0, items.length - 1)]
  }

  /**
   * A shuffled copy, via Fisher-Yates. The input is never mutated.
   * @param {Array} items - Items to shuffle
   * @returns {Array} A new, shuffled array
   */
  function shuffle(items) {
    if (!Array.isArray(items)) return []
    const copy = items.slice()
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i)
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  return { next, int, pick, shuffle }
}
