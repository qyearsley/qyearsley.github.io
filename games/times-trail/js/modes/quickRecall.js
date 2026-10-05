/**
 * Quick Recall mode for Times Trail
 *
 * The game's default mode and its plainest question: "7 × 6 = ?". One fact, one
 * answer, typed on the keypad.
 *
 * Architecture: one exported pure function, `createChallenge`, returning a plain
 * `Challenge` object (§ 12.1 of the spec). There is **no DOM here at all** -- not
 * a node, not a query, not a class name. The challenge is data: a prompt string,
 * the post-miss teaching scaffold, and a `check` closure. `GameUI.js` decides how to draw it and `game.js` decides when.
 *
 * `challenge.check` is the single authority on correctness. Callers must not
 * second-guess it by comparing `input` to `challenge.answer` at the call site.
 * `Keypad` submits a `Number` today, but `check` also accepts a digit string, so
 * a future entry path that reports raw digits needs no change anywhere else. See
 * its own JSDoc for the exact coercion rules.
 *
 * Determinism: every random choice comes from the injected `rng`. A challenge
 * consumes exactly **1** `rng()` call (the orientation roll). Tests script an
 * exact sequence and depend on this count.
 *
 * Purity: no `document`, `window`, `localStorage`, `setTimeout`, or clock. No
 * argument is mutated -- `fact` is a frozen object from `facts.js` and is only
 * read, and a fresh `Challenge` (with fresh `visual` and `scaffold`)
 * is built on every call.
 *
 * The `settings` parameter is a **challenge context**, not the whole settings
 * object. Quick Recall reads nothing from it today; the parameter stays so every
 * mode shares the dispatcher's `(fact, settings, rng)` signature.
 */

import { MODE_IDS } from "../constants.js"
import { randomOrientation } from "../facts.js"
import { buildScaffold } from "./shared.js"

/**
 * @typedef {import("../facts.js").Fact} Fact
 */

/**
 * @typedef {import("./shared.js").Scaffold} Scaffold
 */

/**
 * Mode-specific render data for Quick Recall. Plain data, never a DOM node.
 * @typedef {Object} ExpressionVisual
 * @property {"expression"} kind - Discriminant, so `GameUI` can dispatch on it
 * @property {number} left       - Left operand as displayed
 * @property {number} right      - Right operand as displayed
 */

/**
 * The shared contract every mode implements and `game.js` consumes.
 * @typedef {Object} Challenge
 * @property {string} modeId              - A `MODE_IDS` value; `"quick-recall"` here
 * @property {string} factId              - Canonical id, e.g. `"6x7"`
 * @property {number} left                - Left operand as displayed
 * @property {number} right               - Right operand as displayed
 * @property {number} answer              - `left * right`, i.e. `fact.product`
 * @property {string} prompt              - e.g. `"7 × 6 = ?"` (U+00D7, not the letter x)
 * @property {ExpressionVisual} visual    - Mode-specific render data
 * @property {(input: *) => boolean} check - The one authority on correctness
 * @property {Scaffold} scaffold          - Shown after a miss
 */

/**
 * The multiplication sign, U+00D7 -- the real glyph, not the letter `x`. Named
 * so the prompt template reads clearly and so a later edit cannot swap in an `x`
 * in one place and leave the tests passing on another.
 * @private
 * @type {string}
 */
const TIMES_SIGN = "×"

/**
 * Matches a string of one or more ASCII digits and nothing else. Anchored, so
 * `"4 2"`, `"+42"`, `"42abc"`, `"4e1"` and `"42.0"` all fail; `"042"` passes.
 * @private
 * @type {RegExp}
 */
const DIGITS_ONLY = /^\d+$/

/**
 * True when `fact` carries the four fields this mode reads off a `Fact`.
 *
 * Deliberately structural rather than an `instanceof` check: `facts.js` exports
 * frozen plain objects, and tests build stand-ins. `isSquare` is not required --
 * `randomOrientation` reads it, and a missing value is falsy, which is the
 * correct behaviour for a non-square.
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
 * Build one Quick Recall challenge for a fact.
 *
 * RNG call order: one call, the orientation roll (`randomOrientation`).
 * Nothing else draws.
 *
 * The orientation roll changes `left`, `right`, and `prompt` -- and nothing else.
 * In particular the `scaffold` is built from the fact's operands, not from the
 * display order, so `9 × 2` teaches "2 rows of 9 makes 18" rather than nine rows
 * of two. See `modes/shared.js` for why.
 * @param {Fact} fact - The fact to ask, from `facts.js`
 * @param {Object} [_settings] - Challenge context; unused. See the file header.
 * @param {() => number} [rng] - Source of randomness in [0, 1); defaults to `Math.random`.
 *   A non-function falls back to `Math.random` rather than throwing.
 * @returns {Challenge} A fresh challenge; nothing in it is shared with a previous call
 * @throws {TypeError} If `fact` is not a `Fact`-shaped object
 */
export function createChallenge(fact, _settings = {}, rng = Math.random) {
  if (!_isFact(fact)) {
    throw new TypeError("createChallenge requires a Fact")
  }

  const random = typeof rng === "function" ? rng : Math.random

  // rng call 1: which way round the fact is shown, so both "7 × 6" and "6 × 7"
  // come up. Squares consume the call too -- see randomOrientation.
  const { left, right } = randomOrientation(fact, random)
  const answer = fact.product

  return {
    modeId: MODE_IDS.QUICK_RECALL,
    factId: fact.id,
    left,
    right,
    answer,
    prompt: `${left} ${TIMES_SIGN} ${right} = ?`,
    visual: { kind: "expression", left, right },
    /**
     * Is this input the right answer? The single authority on correctness for
     * this challenge -- callers must not compare against `answer` themselves.
     *
     * `Keypad` hands over a `number` (`Number(buffer)`). The string rules are
     * here so an entry path that reports raw digits stays a drop-in, and so that
     * whatever arrives is coerced in exactly one place:
     *
     *   - a **number** counts only when finite and exactly equal to the answer.
     *     `42.0` is `42` in JavaScript, so a "float" value passes; `41.5`,
     *     `NaN` and `Infinity` do not.
     *   - a **string** is trimmed, then must be digits only. `"42"` and `" 42 "`
     *     pass, and `"042"` passes deliberately: this is a numeric comparison,
     *     not a text one. `""`, `"42abc"`, `"4 2"`, `"+42"`, `"42.0"` and `"4e1"`
     *     are all rejected -- rejecting them here is cheaper than reasoning
     *     about what `Number()` would have done with them.
     *   - **everything else** is `false`: `null`, `undefined`, booleans, arrays,
     *     objects, symbols. There is no truthiness anywhere in this function.
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
