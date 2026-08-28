/**
 * Quick Recall mode for Times Trail
 *
 * The game's default mode and its plainest question: "7 × 6 = ?". One fact, one
 * answer, and an entry affordance that adapts to how well the player knows that
 * particular fact -- four tiles while it is still weak, the keypad once it is
 * strong enough that recognising the answer among four options would no longer
 * prove anything.
 *
 * Architecture: one exported pure function, `createChallenge`, returning a plain
 * `Challenge` object (§ 12.1 of the spec). There is **no DOM here at all** -- not
 * a node, not a query, not a class name. The challenge is data: a prompt string,
 * an entry mode, the tile options, the post-miss teaching scaffold, and a `check`
 * closure. `GameUI.js` decides how to draw it and `game.js` decides when.
 *
 * `challenge.entry` is the single source of truth for the entry affordance, and
 * `challenge.check` is the single authority on correctness. Both matter:
 *
 *   - Entry must never be recomputed by the caller. An earlier draft had
 *     `game.js` derive the entry mode a second time when scoring, which let an
 *     answer entered on the Array Builder's grid collect Quick Recall's keypad
 *     honesty bonus. `game.js` reads `challenge.entry` and nothing else.
 *   - `check` must never be second-guessed by comparing `input` to
 *     `challenge.answer` at the call site, because the two input paths deliver
 *     different types: a tile hands back a `number`, the keypad hands back a
 *     `string` of digits. `check` absorbs that difference (see its own JSDoc for
 *     the exact coercion rules) so no caller has to know which path fired.
 *
 * Determinism: every random choice comes from the injected `rng`. A challenge
 * consumes exactly **1** `rng()` call on the keypad path (the orientation roll)
 * and exactly **9** on the tiles path (orientation, then the 8 calls
 * `generateOptions` documents). Tests script an exact sequence and depend on
 * these counts.
 *
 * Purity: no `document`, `window`, `localStorage`, `setTimeout`, or clock. No
 * argument is mutated -- `fact` is a frozen object from `facts.js` and is only
 * read, and a fresh `Challenge` (with fresh `options`, `visual`, and `scaffold`)
 * is built on every call.
 *
 * The `settings` parameter is a **challenge context**, not the whole settings
 * object, though a live `Settings` instance satisfies it as-is:
 *
 * | property       | type                                    | meaning                                   | default when absent          |
 * |----------------|-----------------------------------------|-------------------------------------------|------------------------------|
 * | `strength`     | number                                  | the fact's strength *before* this answer  | `0`                          |
 * | `inputModeFor` | `(strength: number) => "tiles"\|"keypad"` | entry-mode policy                       | not called; entry is `tiles` |
 *
 * Any other property is ignored, so `game.js` can pass a small purpose-built
 * object and the mode cannot reach anything else.
 */

import { INPUT_MODE, MODE_IDS, STRENGTH } from "../constants.js"
import { randomOrientation } from "../facts.js"
import { generateOptions } from "../distractors.js"
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
 * @property {"tiles"|"keypad"|"grid"} entry - The one authority on the entry affordance
 * @property {number[]|null} options      - Distinct integers including `answer` when
 *   `entry === "tiles"`; `null` otherwise
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
 * The strength to hand the entry-mode policy: `context.strength` rounded and
 * clamped to `[STRENGTH.MIN, STRENGTH.MAX]`, or `STRENGTH.MIN` when it is absent
 * or not a finite number. A persisted record can carry junk, and a mode is not
 * the place to throw over it.
 * @private
 * @param {unknown} strength - Raw strength from the challenge context
 * @returns {number} An integer in [STRENGTH.MIN, STRENGTH.MAX]
 */
function _clampStrength(strength) {
  if (!Number.isFinite(strength)) return STRENGTH.MIN
  return Math.min(STRENGTH.MAX, Math.max(STRENGTH.MIN, Math.round(strength)))
}

/**
 * Resolve the entry affordance from the challenge context.
 *
 * Calls `context.inputModeFor(strength)` only when that property is a function,
 * and only honours `"tiles"` or `"keypad"` in return. Anything else -- a typo, a
 * stubbed policy, `"grid"` (which belongs to the Array Builder, not here) --
 * falls back to `"tiles"`. That keeps two invariants true for every challenge
 * this module returns: `entry` is always a value `game.js` recognises, and
 * `options` is non-null exactly when `entry === "tiles"`.
 * @private
 * @param {Object} context - The challenge context (`settings`)
 * @param {number} strength - Already clamped strength
 * @returns {"tiles"|"keypad"} The entry affordance
 */
function _resolveEntry(context, strength) {
  if (typeof context.inputModeFor !== "function") return INPUT_MODE.TILES
  const entry = context.inputModeFor(strength)
  return entry === INPUT_MODE.KEYPAD ? INPUT_MODE.KEYPAD : INPUT_MODE.TILES
}

/**
 * Build one Quick Recall challenge for a fact.
 *
 * RNG call order, exactly:
 *   1. the orientation roll (`randomOrientation`), always;
 *   2. eight more calls inside `generateOptions`, only on the tiles path.
 * So 9 calls with tiles and 1 with the keypad. Nothing else draws.
 *
 * The orientation roll changes `left`, `right`, and `prompt` -- and nothing else.
 * In particular the `scaffold` is built from the fact's operands, not from the
 * display order, so `9 × 2` teaches "2 rows of 9 makes 18" rather than nine rows
 * of two. See `modes/shared.js` for why.
 * @param {Fact} fact - The fact to ask, from `facts.js`
 * @param {Object} [settings] - Challenge context: `{strength?, inputModeFor?}`. See the
 *   file header. A non-object (including `null`) is treated as `{}`.
 * @param {() => number} [rng] - Source of randomness in [0, 1); defaults to `Math.random`.
 *   A non-function falls back to `Math.random` rather than throwing.
 * @returns {Challenge} A fresh challenge; nothing in it is shared with a previous call
 * @throws {TypeError} If `fact` is not a `Fact`-shaped object
 */
export function createChallenge(fact, settings = {}, rng = Math.random) {
  if (!_isFact(fact)) {
    throw new TypeError("createChallenge requires a Fact")
  }

  const context = settings !== null && typeof settings === "object" ? settings : {}
  const random = typeof rng === "function" ? rng : Math.random

  const strength = _clampStrength(context.strength)
  const entry = _resolveEntry(context, strength)

  // rng call 1: which way round the fact is shown, so both "7 × 6" and "6 × 7"
  // come up. Squares consume the call too -- see randomOrientation.
  const { left, right } = randomOrientation(fact, random)
  const answer = fact.product

  // rng calls 2..9, tiles only. The keypad needs no distractors, so it draws no
  // further randomness at all.
  const options = entry === INPUT_MODE.TILES ? generateOptions(fact, { rng: random }) : null

  return {
    modeId: MODE_IDS.QUICK_RECALL,
    factId: fact.id,
    left,
    right,
    answer,
    prompt: `${left} ${TIMES_SIGN} ${right} = ?`,
    entry,
    options,
    visual: { kind: "expression", left, right },
    /**
     * Is this input the right answer? The single authority on correctness for
     * this challenge -- callers must not compare against `answer` themselves.
     *
     * The two entry paths deliver different types, so the coercion rules are
     * fixed here and nowhere else:
     *
     *   - a **number** counts only when finite and exactly equal to the answer.
     *     `42.0` is `42` in JavaScript, so a "float" tile value passes; `41.5`,
     *     `NaN` and `Infinity` do not.
     *   - a **string** is trimmed, then must be digits only. `"42"` and `" 42 "`
     *     pass, and `"042"` passes deliberately: this is a numeric comparison,
     *     not a text one, and a keypad that let a leading zero through has still
     *     been told 42. `""`, `"42abc"`, `"4 2"`, `"+42"`, `"42.0"` and `"4e1"`
     *     are all rejected -- rejecting them here is cheaper than reasoning
     *     about what `Number()` would have done with them.
     *   - **everything else** is `false`: `null`, `undefined`, booleans, arrays,
     *     objects, symbols. There is no truthiness anywhere in this function.
     * @param {*} input - A number from a tile, or a digit string from the keypad
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
