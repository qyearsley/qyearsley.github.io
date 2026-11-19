/**
 * Quick Recall: the game's question, "7 × 6 = ?". Builds a plain `Challenge`
 * object (no DOM): a prompt, a `check` closure and the post-miss scaffold.
 * `GameUI.js` draws it and `game.js` decides when.
 *
 * `challenge.check` is the single authority on correctness; callers must not
 * compare input to `challenge.answer` themselves.
 *
 * All randomness comes from the injected `rng`. A challenge consumes exactly one
 * `rng()` call (the orientation roll); tests depend on this count.
 */

import { randomOrientation } from "../facts.js"

/**
 * @typedef {import("../facts.js").Fact} Fact
 */

/**
 * The post-miss teaching array, as pure data.
 * @typedef {Object} Scaffold
 * @property {number} rows         - Rows in the array: `min(a, b)`
 * @property {number} cols         - Columns in the array: `max(a, b)`
 * @property {number} product      - `rows * cols`
 * @property {number[]} skipCounts - `[cols, 2*cols, ..., rows*cols]`; length === `rows`
 * @property {string} text         - e.g. "6 rows of 7 makes 42"
 */

/**
 * @typedef {Object} Challenge
 * @property {string} factId              - Canonical id, e.g. `"6x7"`
 * @property {number} left                - Left operand as displayed
 * @property {number} right               - Right operand as displayed
 * @property {number} answer              - `left * right`, i.e. `fact.product`
 * @property {string} prompt              - e.g. `"7 × 6 = ?"` (U+00D7, not the letter x)
 * @property {(input: *) => boolean} check - The one authority on correctness
 * @property {Scaffold} scaffold          - Shown after a miss
 */

const TIMES_SIGN = "×"

/** One or more ASCII digits and nothing else; `"042"` passes, `"42.0"` and `"+42"` do not. */
const DIGITS_ONLY = /^\d+$/

/**
 * Structural check rather than `instanceof`: `facts.js` exports frozen plain
 * objects, and tests build stand-ins.
 * @private
 * @param {unknown} fact - Candidate fact
 * @returns {boolean} Whether it is usable as a `Fact`
 */
function _isFact(fact) {
  return (
    fact !== null &&
    typeof fact === "object" &&
    typeof fact.id === "string" &&
    Number.isInteger(fact.a) &&
    Number.isInteger(fact.b) &&
    Number.isInteger(fact.product)
  )
}

/**
 * Build the skip-counting scaffold for a fact's two operands.
 *
 * Orientation-independent: the smaller operand becomes `rows`, so `(2, 9)` and
 * `(9, 2)` give the same scaffold. Built from the fact, not the display order,
 * so a miss on `9 × 2` teaches "2 rows of 9" (the shortest skip count and the
 * shortest wait) rather than nine rows of two. Non-integer input is clamped to
 * at least 1 rather than rejected, so a bad operand never blanks a teaching moment.
 * @param {number} a - One operand, in either position
 * @param {number} b - The other operand
 * @returns {Scaffold} A fresh scaffold
 */
export function buildScaffold(a, b) {
  const first = _dimension(a)
  const second = _dimension(b)
  const rows = Math.min(first, second)
  const cols = Math.max(first, second)
  const product = rows * cols
  return {
    rows,
    cols,
    product,
    skipCounts: Array.from({ length: rows }, (_unused, index) => (index + 1) * cols),
    text: `${rows} rows of ${cols} makes ${product}`,
  }
}

/**
 * Coerce one operand into a positive integer.
 * @private
 * @param {unknown} value - Candidate operand
 * @returns {number} An integer >= 1
 */
function _dimension(value) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}

/**
 * Build one challenge for a fact. The orientation roll (the one `rng` call)
 * changes `left`, `right` and `prompt` and nothing else.
 * @param {Fact} fact - The fact to ask, from `facts.js`
 * @param {() => number} [rng] - Randomness in [0, 1); a non-function falls back to `Math.random`
 * @returns {Challenge} A fresh challenge; nothing in it is shared with a previous call
 * @throws {TypeError} If `fact` is not a `Fact`-shaped object
 */
export function createChallenge(fact, rng = Math.random) {
  if (!_isFact(fact)) {
    throw new TypeError("createChallenge requires a Fact")
  }

  const random = typeof rng === "function" ? rng : Math.random

  // Squares consume the call too -- see randomOrientation.
  const { left, right } = randomOrientation(fact, random)
  const answer = fact.product

  return {
    factId: fact.id,
    left,
    right,
    answer,
    prompt: `${left} ${TIMES_SIGN} ${right} = ?`,
    /**
     * Is this input the right answer? `Keypad` sends a number; a digit string
     * is also accepted so a raw-digit entry path needs no change.
     *
     *   - a number counts only when finite and equal to the answer
     *   - a string is trimmed, then must be digits only (`"042"` passes: the
     *     comparison is numeric); `""`, `"4e1"`, `"+42"`, `"42.0"` are rejected
     *   - anything else is `false`, with no truthiness anywhere
     * @param {*} input - Whatever the entry path collected
     * @returns {boolean} Whether the input is the correct answer
     */
    check(input) {
      if (typeof input === "number") {
        return Number.isFinite(input) && input === answer
      }
      if (typeof input === "string") {
        const trimmed = input.trim()
        if (!DIGITS_ONLY.test(trimmed)) return false
        return Number(trimmed) === answer
      }
      return false
    },
    scaffold: buildScaffold(fact.a, fact.b),
  }
}
