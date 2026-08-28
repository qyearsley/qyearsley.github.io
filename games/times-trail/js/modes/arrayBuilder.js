/**
 * Array Builder mode for Times Trail
 *
 * The area model, playable. Instead of asking "what is 6 x 7?" and waiting for a
 * remembered number, this mode shows a target -- 42 squares -- and lets her
 * resize a rectangle until it holds exactly that many. A rectangle of 6 rows by
 * 7 columns *is* 6 x 7, so the answer stops being a fact she either has or has
 * not memorized and becomes something she can build, count, and see. That is the
 * whole point of the mode: it teaches the derivation, not the recall. A child who
 * can find the 6-by-7 rectangle can rebuild 42 next week without having
 * remembered anything, and a child who has only ever been drilled on flashcards
 * cannot.
 *
 * It is also the picture the post-miss scaffold reuses (§ 12.5): every challenge
 * in this game carries a `scaffold` describing the same rows-of-columns array
 * with its skip-count sequence, so a wrong answer in Quick Recall is explained
 * with exactly the visual this mode is built out of. Teaching one representation
 * twice is deliberate -- the array is the game's single mental model for
 * multiplication. Both modes build it through the one helper in
 * `modes/shared.js`, from `min(a, b)` rows, so the explanation does not depend on
 * which way round the orientation roll landed.
 *
 * Architecture: pure data in, pure data out. `createChallenge` returns a
 * `Challenge` (§ 12.1) whose `visual` describes the grid as numbers -- target,
 * starting dimensions, legal maxima, and the hint dimensions -- and whose
 * `check` is the *only* authority on whether a rectangle is right. `game.js`
 * owns the live `rows`/`cols`, moves them with `stepDimension`, renders them
 * through `ui.renderArrayBuilder(visual, rows, cols)`, and asks
 * `challenge.check({rows, cols})` when she submits. Neither this module nor the
 * UI layer compares products on its own; there is exactly one place correctness
 * is decided.
 *
 * Why `stepDimension` is number-in, number-out: the dependency graph (§ 2)
 * forbids `GameUI.js` from importing a mode, so the stepper arithmetic cannot
 * live behind an object the UI would have to hold. `game.js` is the sole caller;
 * it hands `GameUI` integers that are already clamped. Nothing here reaches for
 * a live grid, an element, or a class instance.
 *
 * Accessibility: the +/- steppers are not a fallback for dragging, they are the
 * primary control. This game is played on an iPad by an 8-year-old, and a drag
 * on a resize handle is the least reliable gesture available to her -- it needs
 * a sustained touch, a target she can miss, and fine motor control that a tap
 * does not. `stepDimension` is therefore the one path both interactions go
 * through: a drag resolves to a dimension and clamps through the same function a
 * tap does, so the two can never disagree about what is legal. To know whether a
 * stepper button should be disabled, compare its result to the current value:
 * `stepDimension(rows, -1, max) === rows` means the floor is already reached.
 *
 * The `settings` challenge context (§ 12.1), for reference -- this mode reads
 * neither property, because its entry affordance never adapts:
 *
 *   | property       | type                            | meaning                        |
 *   |----------------|---------------------------------|--------------------------------|
 *   | `strength`     | number                          | Strength before this answer    |
 *   | `inputModeFor` | (strength) => "tiles"\|"keypad" | Entry policy for Quick Recall  |
 *
 * Entry here is always `INPUT_MODE.GRID`: building the rectangle *is* the
 * question, so there is no tiles-versus-keypad decision to make. The parameter
 * is kept so both modes share one signature and `modes/index.js` can dispatch to
 * either without special cases.
 *
 * Determinism: every random choice comes from the injected `rng`.
 * **A challenge consumes exactly one `rng()` call** -- the orientation draw in
 * `randomOrientation` -- and nothing else in this module consumes randomness at
 * all. `stepDimension` and `check` are fully deterministic.
 *
 * Purity: no `document`, no `window`, no `localStorage`, no `setTimeout`, no
 * clock, and no argument is ever mutated. `visual` and `scaffold` are freshly
 * built plain objects, so a caller may hold them for the life of the question.
 */

import { INPUT_MODE, MODE_IDS, OPERAND_MAX } from "../constants.js"
import { randomOrientation } from "../facts.js"
import { buildScaffold } from "./shared.js"

/**
 * @typedef {import("../facts.js").Fact} Fact
 */

/**
 * @typedef {import("./shared.js").Scaffold} Scaffold
 */

/**
 * @typedef {Object} ArrayBuilderVisual
 * @property {"array-builder"} kind - Discriminator; tells `GameUI` how to render
 * @property {number} targetProduct - The number of squares the rectangle must hold
 * @property {number} startRows     - Rows the grid opens at
 * @property {number} startCols     - Columns the grid opens at
 * @property {number} maxRows       - Largest legal row count
 * @property {number} maxCols       - Largest legal column count
 * @property {number} hintRows      - Rows of a rectangle that works (the fact's orientation)
 * @property {number} hintCols      - Columns of that rectangle
 */

/**
 * @typedef {Object} Challenge
 * @property {string} modeId          - `MODE_IDS.ARRAY_BUILDER`
 * @property {string} factId          - Canonical id, e.g. "6x7"
 * @property {number} left            - Left operand as displayed
 * @property {number} right           - Right operand as displayed
 * @property {number} answer          - `left * right`
 * @property {string} prompt          - e.g. "Build a rectangle with 42 squares"
 * @property {"tiles"|"keypad"|"grid"} entry - Always `"grid"` in this mode
 * @property {number[]|null} options  - Always `null`; there are no tiles here
 * @property {ArrayBuilderVisual} visual - Plain render data; never a DOM node
 * @property {(input: *) => boolean} check - The single authority on correctness
 * @property {Scaffold} scaffold      - The post-miss teaching array (§ 12.5)
 */

/**
 * Smallest legal grid dimension. A rectangle needs at least one row and one
 * column; zero rows is not a degenerate rectangle, it is an empty screen.
 * @private
 * @type {number}
 */
const MIN_DIMENSION = 1

/**
 * Whether `value` is usable as a `Fact` by this module.
 *
 * Deliberately structural rather than an identity check against `FACTS`: a test
 * fixture built by hand is a legitimate fact, and the fields below are all this
 * module reads.
 * @private
 * @param {unknown} value - Candidate fact
 * @returns {boolean} Whether `value` has a string `id` and finite `a`, `b`, `product`
 */
function isFact(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    Number.isFinite(value.a) &&
    Number.isFinite(value.b) &&
    Number.isFinite(value.product)
  )
}

/**
 * Whether `value` is an integer within the legal dimension range.
 * @private
 * @param {unknown} value - Candidate dimension
 * @param {number} max - Largest legal value
 * @returns {boolean} Whether `value` is an integer in `[MIN_DIMENSION, max]`
 */
function isLegalDimension(value, max) {
  return Number.isInteger(value) && value >= MIN_DIMENSION && value <= max
}

/**
 * Move one grid dimension by `delta`, clamped to the legal operand range.
 *
 * This is the arithmetic behind the `+`/`-` steppers, and the reason they are
 * the equal of any drag: both interactions resolve to a candidate dimension and
 * both come through here, so neither can produce a rectangle wider or taller
 * than the fact set allows. The result is always an integer in
 * `[1, max]`, whatever is passed in -- a `delta` of -100 lands on 1, not on -97.
 *
 * Ownership (§ 2): **`game.js` is the only caller.** It holds the live
 * `rows`/`cols` for the current question, assigns the return value back, and
 * passes the resulting integers to `ui.renderArrayBuilder(visual, rows, cols)`.
 * `GameUI.js` must not import this function -- the UI layer depending on a mode
 * module is a forbidden edge in the dependency graph -- which is exactly why the
 * signature is numbers in, a number out and no live state object is involved.
 *
 * Pure: takes and returns plain numbers, so there is nothing it could mutate.
 * Consumes no randomness.
 * @param {number} value - Current dimension; a non-finite value is treated as the minimum
 * @param {number} delta - Signed step, normally `+1` or `-1`; a non-finite value steps zero
 * @param {number} [max] - Largest legal dimension; defaults to `OPERAND_MAX` (9)
 * @returns {number} An integer in `[1, max]`
 */
export function stepDimension(value, delta, max = OPERAND_MAX) {
  const limit = Number.isFinite(max) ? Math.max(MIN_DIMENSION, Math.floor(max)) : OPERAND_MAX
  const base = Number.isFinite(value) ? Math.round(value) : MIN_DIMENSION
  const step = Number.isFinite(delta) ? Math.round(delta) : 0
  return Math.min(limit, Math.max(MIN_DIMENSION, base + step))
}

/**
 * Build one Array Builder challenge for `fact`.
 *
 * The rectangle starts at 1 x 1 -- one square against a target of 42 -- so the
 * first thing she does is grow it, which is the action the mode is teaching.
 * `visual.hintRows`/`hintCols` carry one rectangle that works, for a hint
 * affordance to reveal; they are not the only right answer, because
 * `check` accepts any rectangle whose area matches.
 *
 * **Orientation is commutative and that is intentional.** `check` compares
 * `rows * cols` to the answer, so a 6-by-7 rectangle and a 7-by-6 rectangle are
 * both correct even though only one matches the displayed `left`/`right`. This
 * is the commutative property, which is the second thing the area model teaches:
 * turning the rectangle on its side does not change how many squares are in it.
 * Marking one of the two wrong would teach the opposite of the truth.
 *
 * Consumes **exactly one `rng()` call**, for the orientation draw -- including
 * for squares, where the orientation cannot vary (see `randomOrientation`), so
 * the count never depends on the fact.
 * @param {Fact} fact - The fact to build a challenge for
 * @param {Object} [_settings] - Challenge context (§ 12.1). Accepted so both modes
 *   share one signature, and deliberately unread: this mode's entry affordance is
 *   always the grid, so neither `strength` nor `inputModeFor` can change anything.
 *   The leading underscore is the repo's marker for an intentionally unused
 *   parameter; callers still pass the same object they pass Quick Recall.
 * @param {() => number} [rng] - Source of randomness in [0, 1); defaults to Math.random
 * @returns {Challenge} A fresh challenge; nothing is shared between calls
 * @throws {TypeError} If `fact` is not a Fact
 */
export function createChallenge(fact, _settings = {}, rng = Math.random) {
  if (!isFact(fact)) {
    throw new TypeError("createChallenge requires a Fact")
  }

  const { left, right } = randomOrientation(fact, rng)
  const answer = fact.product

  /** @type {ArrayBuilderVisual} */
  const visual = {
    kind: "array-builder",
    targetProduct: answer,
    startRows: MIN_DIMENSION,
    startCols: MIN_DIMENSION,
    maxRows: OPERAND_MAX,
    maxCols: OPERAND_MAX,
    hintRows: left,
    hintCols: right,
  }

  /** @type {Scaffold} */
  const scaffold = buildScaffold(fact.a, fact.b)

  return {
    modeId: MODE_IDS.ARRAY_BUILDER,
    factId: fact.id,
    left,
    right,
    answer,
    prompt: `Build a rectangle with ${answer} squares`,
    entry: INPUT_MODE.GRID,
    options: null,
    visual,
    check: (input) => checkInput(input, answer),
    scaffold,
  }
}

/**
 * Decide whether `input` solves a challenge whose answer is `answer`.
 *
 * Two input shapes are accepted, and nothing else:
 *
 *   1. **A rectangle** -- `{rows, cols}` with both values *strict integers* in
 *      `[1, 9]`. Correct when `rows * cols === answer`, in either orientation.
 *      Strings are refused here on purpose: an out-of-range or fractional
 *      dimension is a bug in the caller, not a typo by the player, and quietly
 *      coercing `{rows: "6"}` would hide it. Dimensions outside the legal range
 *      are wrong even when the product happens to match, so `{rows: 42, cols: 1}`
 *      is not a way to answer 42 without building anything.
 *   2. **A number, or a string of digits** -- the same tolerant compare Quick
 *      Recall uses, so a hardware keyboard remains a working fallback on the
 *      grid screen. `" 42 "` and `"0042"` pass; `"42abc"` and `""` do not.
 *
 * Everything else -- `null`, `undefined`, `NaN`, booleans, arrays, bare objects
 * -- is `false`. Never throws, and never mutates `input`.
 * @private
 * @param {*} input - Whatever the caller collected from the player
 * @param {number} answer - The target product
 * @returns {boolean} Whether the input is correct
 */
function checkInput(input, answer) {
  if (input === null || input === undefined) {
    return false
  }
  if (typeof input === "object") {
    const { rows, cols } = /** @type {{rows: unknown, cols: unknown}} */ (input)
    if (!isLegalDimension(rows, OPERAND_MAX) || !isLegalDimension(cols, OPERAND_MAX)) {
      return false
    }
    return rows * cols === answer
  }
  if (typeof input === "number") {
    return Number.isFinite(input) && input === answer
  }
  if (typeof input === "string") {
    const trimmed = input.trim()
    if (trimmed === "" || !/^\d+$/.test(trimmed)) {
      return false
    }
    return Number(trimmed) === answer
  }
  return false
}
