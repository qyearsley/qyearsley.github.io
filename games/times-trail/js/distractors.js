/**
 * Distractor generation for Times Trail
 *
 * Builds the wrong answers on the multiple-choice tiles. This is the whole
 * pedagogy of the module: a distractor must be a *near-miss*, not a random
 * number. If the three wrong tiles for `6 x 7` were 13, 61 and 88, a child who
 * has no idea what 6 x 7 is would still pick 42 every time, because 42 is the
 * only number in the neighbourhood -- the question would test number sense, not
 * recall, and would report mastery she does not have. Offering 36, 48 and 49
 * instead forces the actual retrieval: every tile is a plausible answer, so the
 * only way through is to know the fact. It also turns a wrong tap into
 * information, because the near-miss she chose says *how* she is wrong -- 36 and
 * 48 are the neighbouring multiples (she skip-counted one step short or one
 * step long), 49 is the neighbouring square (she reached for the wrong table),
 * 43 and 41 are off-by-one slips, and 24 is a digit reversal.
 *
 * Architecture: two pure functions, layered. `nearMissCandidates` is the
 * pedagogy -- a deterministic, ordered list of plausible wrong answers with the
 * most confusable first, and no randomness at all. `generateOptions` is the
 * presentation -- it takes the top of that list, shuffles, and drops the answer
 * in at a random position so the correct tile is not always in the same place.
 * Splitting them this way keeps the interesting half testable without any rng
 * at all, and means the tile order is the only thing randomness touches.
 *
 * Determinism: every random choice comes from the injected `rng`, and the number
 * of `rng()` calls each function consumes is documented and fixed, so tests can
 * script an exact sequence and assert the result. See the "RNG contract" note on
 * `generateOptions`.
 *
 * Purity: no DOM, no storage, no clock, no argument mutation. `shuffle` copies
 * before it swaps, so the caller's array -- and the frozen `Fact` it came
 * from -- are untouched.
 */

import { DISTRACTORS } from "./constants.js"

/**
 * @typedef {import("./facts.js").Fact} Fact
 */

/**
 * @typedef {Object} GenerateOptionsConfig
 * @property {() => number} [rng]  - Source of randomness in [0, 1); defaults to Math.random
 * @property {number} [count]      - Total options including the answer; defaults to
 *   `DISTRACTORS.OPTION_COUNT` (4). Clamped to [2, 8].
 */

/** Smallest total option count that still poses a question (answer + 1 distractor). */
const MIN_OPTION_COUNT = 2

/** Largest total option count worth rendering as tiles. */
const MAX_OPTION_COUNT = 8

/**
 * Return a shuffled copy of `items` using an unbiased Fisher-Yates pass.
 *
 * Consumes exactly `max(0, items.length - 1)` `rng()` calls: the loop runs `i`
 * from `length - 1` down to `1` and draws once per iteration. The input array is
 * never mutated.
 * @private
 * @param {number[]} items - Values to shuffle
 * @param {() => number} rng - Source of randomness in [0, 1)
 * @returns {number[]} A new array holding the same values in a new order
 */
function shuffle(items, rng) {
  const result = items.slice()
  for (let i = result.length - 1; i >= 1; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const swap = result[i]
    result[i] = result[j]
    result[j] = swap
  }
  return result
}

/**
 * Plausible wrong answers for a fact, most confusable first.
 *
 * The list is built in four tiers, in this order, so that the front of the list
 * is where the real confusions live:
 *
 *   1. Adjacent multiples in the same two tables -- `a*(b-1)`, `a*(b+1)`,
 *      `b*(a-1)`, `b*(a+1)`. These are the skip-counting errors, and they are
 *      by far the most common, so they come first.
 *   2. Two steps out in each table -- `a*(b-2)`, `a*(b+2)`, `b*(a-2)`,
 *      `b*(a+2)`. Same error, one step further off.
 *   3. Digit slips -- `p + 1`, `p - 1`, `p + 10`, `p - 10`. Miscopying or
 *      mis-reading a remembered product.
 *   4. Operation confusion -- `a + b` (adding instead of multiplying, the
 *      classic mix-up) and the two-digit reversal of the product.
 *
 * The result is then deduplicated keeping the first (so the most confusable
 * position wins) and filtered of anything that is not a positive integer or is
 * the correct product itself. Squares collapse a lot -- for `7x7` the two
 * adjacent multiples are both 42 -- and small facts collapse more, because
 * `a*(b-2)` and `p - 10` can fall to zero or below.
 *
 * Pure, deterministic, and consumes no randomness whatsoever.
 * @param {Fact} fact - The fact whose near-misses are wanted; needs numeric `a`, `b`, `product`
 * @returns {number[]} A new array of distinct positive integers, none equal to
 *   `fact.product`, ordered most confusable first. At least 6 entries for every
 *   one of the game's 36 facts (see the candidate-supply invariant below).
 * @throws {TypeError} If `fact` is not an object with finite `a`, `b` and `product`
 */
export function nearMissCandidates(fact) {
  if (
    fact === null ||
    typeof fact !== "object" ||
    !Number.isFinite(fact.a) ||
    !Number.isFinite(fact.b) ||
    !Number.isFinite(fact.product)
  ) {
    throw new TypeError("nearMissCandidates requires a Fact with numeric a, b, product")
  }

  const { a, b, product: p } = fact
  const raw = [
    // 1. Adjacent multiples in the same tables.
    a * (b - 1),
    a * (b + 1),
    b * (a - 1),
    b * (a + 1),
    // 2. Two steps out.
    a * (b - 2),
    a * (b + 2),
    b * (a - 2),
    b * (a + 2),
    // 3. Digit slips.
    p + 1,
    p - 1,
    p + 10,
    p - 10,
    // 4. Operation confusion: adding instead of multiplying.
    a + b,
  ]
  // 4b. Operation confusion: reading a two-digit product backwards. Below 10
  // there is nothing to reverse, and the swap would just re-yield p.
  if (p >= 10) {
    raw.push((p % 10) * 10 + Math.floor(p / 10))
  }

  const seen = new Set()
  const candidates = []
  for (const value of raw) {
    if (!Number.isInteger(value) || value <= 0 || value === p) continue
    if (seen.has(value)) continue
    seen.add(value)
    candidates.push(value)
  }
  return candidates
}

/**
 * The full set of answer tiles for a fact: the correct product plus near-miss
 * distractors, in a randomised order.
 *
 * Only the top `DISTRACTORS.PRIORITY_WINDOW` (6) candidates are shuffled
 * against each other. That window is the point: it keeps the tiles drawn from
 * the genuinely confusable end of the list while still varying which of them
 * shows up, instead of serving the same three wrong answers for a fact every
 * single time. Candidates past the window are only reached when the window
 * itself cannot supply enough distinct values.
 *
 * **Candidate-supply invariant (verified, not assumed).** Every one of the 36
 * facts yields at least 6 near-miss candidates, so the default `count` of 4 (3
 * distractors) is always fillable from real near-misses and there is no padding
 * path. The tightest fact is `2x2` (`p = 4`), where most of the list collapses:
 * `a*(b-2)` and `b*(a-2)` are both 0, `p - 10` is -6, `a + b` is 4 (the product
 * itself), and there is no two-digit reversal below 10. What survives is exactly
 * `[2, 6, 8, 5, 3, 14]` -- 6 candidates, the minimum across all 36 facts, and
 * uniquely the minimum. The next tightest is `3x3` at 7. `distractors.test.js`
 * asserts both the `2x2` list and the global minimum, so a future change to
 * `nearMissCandidates` that under-supplies a fact fails loudly rather than
 * silently rendering a duplicate tile.
 *
 * Because supply can only fall short above `count = 7`, and nothing in this game
 * asks for more than `DISTRACTORS.OPTION_COUNT` (4), the returned length is
 * `count` in every real call. The one theoretical exception is `count: 8` on
 * `2x2`, which would return 7 options; that is preferred over inventing a
 * `p + k` filler tile that is not a near-miss at all.
 *
 * **RNG contract.** Total `rng()` calls are
 * `(min(candidates.length, PRIORITY_WINDOW) - 1) + (result.length - 1)`: one
 * Fisher-Yates pass over the priority window, then one over the finished option
 * list. Since every fact supplies at least `PRIORITY_WINDOW` candidates, at the
 * default `count = 4` that is `5 + 3 = 8` calls for all 36 facts -- including
 * `2x2`. Tests depend on this.
 * @param {Fact} fact - The fact being asked
 * @param {GenerateOptionsConfig} [options] - Randomness source and option count
 * @returns {number[]} A new array of distinct positive integers containing
 *   `fact.product` exactly once, at a position that varies with `rng`. Every
 *   other entry is a member of `nearMissCandidates(fact)` -- there is no other
 *   source of options.
 * @throws {TypeError} If `fact` is not an object with finite `a`, `b` and `product`
 */
export function generateOptions(fact, options = {}) {
  const rng = typeof options.rng === "function" ? options.rng : Math.random
  const requested = Number.isFinite(options.count) ? Math.floor(options.count) : undefined
  const count = Math.min(
    MAX_OPTION_COUNT,
    Math.max(MIN_OPTION_COUNT, requested ?? DISTRACTORS.OPTION_COUNT),
  )

  const candidates = nearMissCandidates(fact)
  // Named priorityWindow, not window: this module must never touch the browser
  // global of that name, so the name is not shadowed here either.
  const priorityWindow = candidates.slice(0, DISTRACTORS.PRIORITY_WINDOW)
  const rest = candidates.slice(DISTRACTORS.PRIORITY_WINDOW)

  // Shuffle only the priority window, then fall back to the tail in its
  // original (already most-confusable-first) order.
  const ordered = shuffle(priorityWindow, rng).concat(rest)

  const needed = count - 1
  const picked = []
  const taken = new Set()
  for (const value of ordered) {
    if (picked.length >= needed) break
    if (taken.has(value)) continue
    taken.add(value)
    picked.push(value)
  }

  return shuffle([...picked, fact.product], rng)
}
