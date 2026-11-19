/**
 * Seasons arithmetic challenge -- generates and checks maths questions.
 *
 * A challenge module, conforming to the contract in challenges/index.js. It
 * exports `generate`, `check` and the optional `explain`, and it knows nothing
 * about seasons, characters, trails, or the DOM. It is handed a list of forms
 * and an Rng, and hands back a question.
 *
 * A *form* describes a shape of question rather than a specific one, so a
 * season can say "two-digit subtraction that needs regrouping" once and get a
 * different question every time. seasons.js owns which forms a season uses;
 * this file owns what each form means. The kinds, one per entry in GENERATORS:
 *
 * - `add`     {min, max, borrow}  a + b, sum min..max. `borrow` forces a carry.
 * - `sub`     {min, max, borrow}  a - b, never negative, minuend min..max.
 *                                 `borrow` forces regrouping.
 * - `mul`     {tables, upTo, twoDigit}  one operand from `tables`; the other 2..upTo,
 *                                 or 10..upTo when `twoDigit` is set.
 * - `div`     {tables, upTo, from}  exact division only; the quotient is from..upTo,
 *                                 defaulting to 2..upTo.
 * - `twoStep` {tables, upTo, max, from}  a × b then + or - c, result 0..max, with
 *                                 b drawn from from..upTo.
 *
 * `from` and `min` stop a hard slot asking an easy question. Narrowing `tables`
 * alone does nothing to the answer: `div` would still draw its quotient from 2
 * upward, so a boss could ask `12 ÷ 6 = 2`. See `_div`. `min` is the same idea
 * for add and sub, which live inside 20: without a floor summer's addition
 * could be `2 + 3`. See `_add`.
 *
 * Answers are multiple choice (see PLAY.CHOICE_COUNT), so every question also
 * carries distractors. They are near misses, because a random distractor is
 * eliminated at a glance. Each generator hands back its operands, and
 * `_candidates` slips one of them by one step: `4 × 80` offers 240 and 400 (the
 * 4 misremembered) and 280 and 360 (the 80 misremembered).
 *
 * Error Handling: every generator clamps its own inputs, so a mistyped form in
 * seasons.js produces an easy question rather than an infinite loop or a NaN.
 * An unknown `kind` falls back to simple addition. `generate` always returns a
 * well-formed question with a finite integer answer and CHOICE_COUNT distinct
 * choices, one of which is correct -- challenges/index.js and the tests both
 * rely on that being unconditional.
 */

import { PLAY } from "../constants.js"

/**
 * Above this answer, a slip in one of the operands is the believable mistake.
 * At or below it, being one or two out is.
 * @private
 */
const SLIP_FROM = 20

/**
 * Above this answer, an operand-sized slip is the believable mistake for any
 * operation. With neighbours one and two away, no choice can be ruled out by
 * estimating, so the player must carry out the sum exactly and then compare four
 * numbers, which is a reading test on top of a maths one. Ten out is what a real
 * carry error looks like at that size.
 * @private
 */
const BIG_ANSWER = 100

/**
 * A generated question, ready to render.
 *
 * @typedef {Object} Question
 * @property {string} kind      - The form kind that produced it
 * @property {string} prompt    - The question text, e.g. "7 × 8"
 * @property {number} answer    - The correct answer
 * @property {number[]} parts   - The operands the generator used, for `explain`
 * @property {number[]} choices - CHOICE_COUNT distinct options including the answer
 */

/**
 * Read a form field as a positive integer with a floor, so a missing or
 * nonsensical value in seasons.js degrades to something playable.
 * @private
 * @param {unknown} value - The value from the form
 * @param {number} fallback - Used when the value is unusable
 * @param {number} [floor] - Smallest acceptable result
 * @returns {number} A positive integer
 */
function _size(value, fallback, floor = 1) {
  if (!Number.isFinite(value)) return Math.max(floor, fallback)
  return Math.max(floor, Math.floor(/** @type {number} */ (value)))
}

/**
 * Read a form's `tables` as a non-empty list of positive integers.
 * @private
 * @param {unknown} tables - The value from the form
 * @returns {number[]} At least one table
 */
function _tables(tables) {
  if (!Array.isArray(tables)) return [2, 5, 10]
  const clean = tables.filter((n) => Number.isFinite(n) && n > 1).map((n) => Math.floor(n))
  return clean.length > 0 ? clean : [2, 5, 10]
}

/**
 * Read a form's `min` as a floor that cannot exceed its own ceiling. The
 * ceiling wins: it keeps the question inside the range the season was designed
 * around, while the floor only makes it less trivial.
 * @private
 * @param {unknown} value - The form's `min`
 * @param {number} max - The form's already-resolved `max`
 * @returns {number} A floor at least 3 and at most `max`
 */
function _floor(value, max) {
  return Math.min(_size(value, 3, 3), max)
}

/**
 * Split a total into two parts that are both single digits where the total
 * allows it. This makes a bounded sum a fact rather than a small number: a
 * uniform first part at `max: 18` offers `1 + 17` as often as anything, and
 * nobody recalls that. Both parts under ten is the addition-facts table. Above
 * 18 no such split exists, so the wide draw is the fallback.
 *
 * @private
 * @param {number} total - The sum, or the minuend
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {number} The first part, 1..total-1
 */
function _splitToFacts(total, rng) {
  const low = Math.max(1, total - 9)
  const high = Math.min(total - 1, 9)
  return low <= high ? rng.int(low, high) : rng.int(1, Math.max(1, total - 1))
}

/**
 * Addition. With `borrow`, both ones digits are forced high enough to carry,
 * which is the whole difficulty of multi-digit addition for a third grader.
 *
 * The carrying pair is chosen first and the tens are sized to what is left
 * between `min` and `max`. Sizing the tens first would let a small `max` be
 * ignored, because the carrying pair is added on top of them. The tens come
 * from drawing a total and dividing it: capping the first operand at half the
 * room put every leftover into the second, so `{max: 200, borrow: true}` gave a
 * three-digit operand 29% of the time (`5 + 195`).
 *
 * @private
 * @param {Object} form - {min, max, borrow}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number, parts: number[]}} The question
 */
function _add(form, rng) {
  const max = _size(form.max, 100, 10)
  const min = _floor(form.min, max)
  if (form.borrow) {
    const onesA = rng.int(5, 9)
    const onesB = rng.int(10 - onesA, 9)
    const carrySum = onesA + onesB
    // Whatever is left after the carrying pair, split evenly in expectation
    // between the two tens columns. Both can be 0, which still carries:
    // 7 + 8 is a valid question, and inside 20 it is the only kind there is.
    const lowTens = Math.max(0, Math.ceil((min - carrySum) / 10))
    const highTens = Math.floor((max - carrySum) / 10)
    if (lowTens <= highTens) {
      const tensTotal = rng.int(lowTens, highTens)
      const tensA = rng.int(0, tensTotal)
      const a = tensA * 10 + onesA
      const b = (tensTotal - tensA) * 10 + onesB
      return { prompt: `${a} + ${b}`, answer: a + b, parts: [a, b] }
    }
    // No carrying pair fits between min and max at all, so fall through to a
    // plain sum rather than silently breaking the bounds the form asked for.
  }
  // Drawn as a sum and then split, for the same reason as the tens above:
  // taking `a` uniformly puts the big number first.
  const sum = rng.int(min, max)
  const a = _splitToFacts(sum, rng)
  return { prompt: `${a} + ${sum - a}`, answer: sum, parts: [a, sum - a] }
}

/**
 * Subtraction, never negative. With `borrow`, the minuend's ones digit is
 * smaller than the subtrahend's, forcing regrouping. The minuend is drawn
 * inside `min`..`max`, so `max: 100` cannot produce "104 - 27".
 *
 * The tens are chosen before the ones, and the subtrahend may have no tens at
 * all. A subtrahend with no tens regroups fine, and `13 - 7` is the most common
 * regrouping question a seven-year-old meets. Choosing the tens first lets the
 * ones be fitted to the bounds, so every draw honours `borrow`.
 *
 * @private
 * @param {Object} form - {min, max, borrow}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number, parts: number[]}} The question
 */
function _sub(form, rng) {
  const max = _size(form.max, 100, 10)
  const min = _floor(form.min, max)
  if (form.borrow) {
    // At least one ten, or there is nothing to regroup from.
    const lowTens = Math.max(1, Math.floor(min / 10))
    const highTens = Math.floor(max / 10)
    if (lowTens <= highTens) {
      const tensA = rng.int(lowTens, highTens)
      // The minuend's ones digit has to leave a larger one beneath it, so it
      // stops at 8, and it has to keep the minuend inside the bounds.
      const lowOnes = Math.max(0, min - tensA * 10)
      const highOnes = Math.min(8, max - tensA * 10)
      if (lowOnes <= highOnes) {
        const onesA = rng.int(lowOnes, highOnes)
        const onesB = rng.int(onesA + 1, 9)
        // 0 is included: inside 20 the subtrahend is always a bare digit.
        // Capped one ten below the minuend's, which is what keeps the answer
        // positive -- the largest subtrahend this can build is `a - 1`.
        const tensB = rng.int(0, tensA - 1)
        const a = tensA * 10 + onesA
        const b = tensB * 10 + onesB
        return { prompt: `${a} - ${b}`, answer: a - b, parts: [a, b] }
      }
    }
    // Nothing that regroups fits between min and max, so fall through rather
    // than break the bounds the form asked for.
  }
  const a = rng.int(min, max)
  const b = _splitToFacts(a, rng)
  return { prompt: `${a} - ${b}`, answer: a - b, parts: [a, b] }
}

/**
 * Multiplication. `twoDigit` moves the second operand into the tens. The other
 * way to reach past the plain facts is multiples of ten in `tables`
 * (`{tables: [10, 20, ...90], upTo: 9}`), which the seasons use; see
 * ../seasons.js.
 * @private
 * @param {Object} form - {tables, upTo, twoDigit}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number, parts: number[]}} The question
 */
function _mul(form, rng) {
  const table = rng.pick(_tables(form.tables))
  const upTo = _size(form.upTo, 10, 2)
  const other = form.twoDigit ? rng.int(10, Math.max(11, upTo)) : rng.int(2, upTo)
  // Show the operands in either order so the facts do not always read one way.
  const [a, b] = rng.next() < 0.5 ? [table, other] : [other, table]
  return { prompt: `${a} × ${b}`, answer: table * other, parts: [table, other] }
}

/**
 * Division, always exact. Built from the product so it never has a remainder.
 *
 * `from` is the smallest quotient, and it makes a hard slot hard. Without it a
 * third of draws land on the ÷2 and ÷3 facts whatever the tables say. The
 * dividend follows from `tables` × the quotient, so `from: 7` on the 6-9 tables
 * asks `56 ÷ 8`, not `16 ÷ 8`.
 *
 * @private
 * @param {Object} form - {tables, upTo, from}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number, parts: number[]}} The question
 */
function _div(form, rng) {
  const divisor = rng.pick(_tables(form.tables))
  const upTo = _size(form.upTo, 10, 2)
  // A floor above the ceiling would be a contradiction; the ceiling wins, since
  // it is the one that keeps the fact inside the tables.
  const from = Math.min(_size(form.from, 2, 2), upTo)
  const quotient = rng.int(from, upTo)
  return {
    prompt: `${divisor * quotient} ÷ ${divisor}`,
    answer: quotient,
    parts: [divisor, quotient],
  }
}

/**
 * Two steps: a multiplication and then an addition or subtraction. Subtraction
 * is only offered when it keeps the result at or above zero.
 *
 * The second operand is capped so the product leaves room for the second step
 * under `max`. The cap must not be given a floor above `max`, or the floor
 * overrides the bound the form asked for.
 *
 * `from` is the smallest second operand, for the same reason as `div`'s: without
 * it the last question of the game could be `8 × 2 + 3`. It is clamped to the
 * cap rather than overriding it.
 *
 * A form whose smallest product already exceeds `max`, such as
 * `{tables: [9], max: 10}`, can still exceed it. The clamps below keep that
 * returning a valid question rather than looping.
 *
 * @private
 * @param {Object} form - {tables, upTo, max, from}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number, parts: number[]}} The question
 */
function _twoStep(form, rng) {
  const table = rng.pick(_tables(form.tables))
  const max = _size(form.max, 200, 10)
  const upTo = _size(form.upTo, 10, 2)
  // Leave at least 2 under max for the addition step.
  const maxOther = Math.max(2, Math.min(upTo, Math.floor((max - 2) / table)))
  const other = rng.int(Math.min(_size(form.from, 2, 2), maxOther), maxOther)
  const product = table * other
  // Cap the second step at half the product as well as 20, so subtracting
  // cannot wipe out the multiplication (`6 × 3 - 17 = 1`).
  const room = Math.min(20, Math.floor(product / 2), max - product)
  const addend = rng.int(2, Math.max(2, room))
  if (product > addend && rng.next() < 0.4) {
    return {
      prompt: `${table} × ${other} - ${addend}`,
      answer: product - addend,
      parts: [table, other, addend],
    }
  }
  return {
    prompt: `${table} × ${other} + ${addend}`,
    answer: product + addend,
    parts: [table, other, addend],
  }
}

/**
 * Form kind to generator.
 * @private
 */
const GENERATORS = {
  add: _add,
  sub: _sub,
  mul: _mul,
  div: _div,
  twoStep: _twoStep,
}

/**
 * The step by which an operand is plausibly misremembered: one whole ten for a
 * multiple of ten, one unit otherwise.
 *
 * 20..90 slip in their tens digit, the only thing being held: `4 × 80` becomes
 * `4 × 70`, never `4 × 79`. A bare 10 is excluded, since slipping it a ten
 * lands on 0 and nobody computes `5 × 0`.
 *
 * @private
 * @param {number} operand - One operand of the question
 * @returns {number} 10 or 1
 */
function _slipUnit(operand) {
  return operand >= 20 && operand % 10 === 0 ? 10 : 1
}

/**
 * How far off a believable slip in one operand lands, as unsigned distances in
 * decreasing order of how tempting they are.
 *
 * This needs the operands, not just the answer. Misremembering one factor of a
 * product by one step moves the answer by the other factor times that step:
 * `4 × 80` as `3 × 80` is 80 out, and as `4 × 70` is 40 out. A fixed
 * `answer × 2` would always be the largest choice, so "never pick the biggest"
 * would win.
 *
 * `mul` also offers two-step slips. The one-step pair collapses to one distance
 * when one factor is ten times the other (`40 × 4` gives 40 twice), leaving a
 * near miss to fill the third slot among multiples of forty, which is a free
 * elimination.
 *
 * @private
 * @param {string} kind - The form kind
 * @param {number[]} parts - The operands the generator used
 * @returns {number[]} Distances, most tempting first; empty when there is no
 *   operand-sized slip worth offering
 */
function _slipSizes(kind, parts) {
  const [first, second] = Array.isArray(parts) ? parts : []
  switch (kind) {
    case "mul": {
      // Larger step first, since a whole-factor miss is the more tempting, then
      // the same slips taken twice and three times over. Three rungs give each
      // side of the answer enough values to fill from alone (see the note on
      // `_slipSizes`).
      const steps = [second * _slipUnit(first), first * _slipUnit(second)].sort((x, y) => y - x)
      return [...steps, ...steps.map((step) => step * 2), ...steps.map((step) => step * 3)]
    }
    case "twoStep":
      // A slip in either factor, and the same slips taken twice over, so three
      // distinct values sit on each side of the answer and `_choices` can put
      // three distractors below it.
      //
      // Deliberately not offered: the second step taken the wrong way round
      // (`8 × 7 + 9` as `8 × 7 - 9`). It is a real mistake but always the
      // outlier, so estimating kills it.
      // `answer × 2`.
      return [second, first, second * 2, first * 2]
    case "add":
    case "sub":
      // A dropped carry or borrow, which is exactly one ten.
      return [10]
    default:
      // Division's answers are single-digit facts, so a slip in an operand and a
      // slip of one are the same thing; the near misses below already cover it.
      return []
  }
}

/**
 * How far a believable wrong answer sits from the right one, split into the
 * family that should fill the choices and the one that only tops them up.
 *
 * Two families. The near misses are one, two or three out, which is what a
 * slip in a ones digit looks like. The operand slips come from `_slipSizes`.
 * Which leads depends on the size of the answer, not the operation: ordering by
 * operation offered 13 and 1 alongside the answer 3 for "6 divided by 2", so
 * three buttons could be dismissed without doing the maths.
 *
 * The split into two lists matters as much as the order. `20 × 2 = 40` can only
 * go wrong by a multiple of twenty, and only one such value sits below it, so
 * the near misses must stay out of the way rather than queue behind the slips.
 * One flat list put `38, 39` under it (`20, 38, 39, 40`).
 *
 * @private
 * @param {number} answer - The correct answer
 * @param {string} kind - The form kind, so the slips can suit the operation
 * @param {number[]} parts - The operands the generator used
 * @returns {{primary: number[], fallback: number[]}} Distinct positive distances,
 *   most tempting first within each list
 */
function _distances(answer, kind, parts) {
  // Three near misses rather than two, so a question whose believable
  // slips are small still has six candidates, which lets `_choices` vary
  // how many land below the answer.
  const near = [1, 2, 3]
  const slips = _slipSizes(kind, parts)

  const factorKind = kind === "mul" || kind === "div" || kind === "twoStep"
  const preferSlips = answer >= BIG_ANSWER || (answer >= SLIP_FROM && factorKind)
  const clean = (list) => [...new Set(list.filter((d) => Number.isInteger(d) && d > 0))]
  return preferSlips
    ? { primary: clean(slips), fallback: clean(near) }
    : { primary: clean(near), fallback: clean(slips) }
}

/**
 * Build the choice list: the answer plus distractors, shuffled.
 *
 * Guarantees exactly PLAY.CHOICE_COUNT distinct non-negative integers, one of
 * which is the answer.
 *
 * How many distractors sit below the answer is drawn at random. Taking the
 * first three values that fit gives `answer + d1`, `answer - d1`, `answer + d2`:
 * one below and two above every time, so the answer is the second-smallest
 * button in every question and tapping it wins without arithmetic. Shuffling
 * hides where a choice appears, not how the values sort.
 *
 * Drawing the split first, then filling each side in order of temptingness,
 * keeps the distractors believable and spreads the answer across all four
 * ranks. Small answers cannot always reach the extremes (a quotient of 3 has
 * nothing three below it), so the count is clamped to what is available.
 *
 * @private
 * @param {number} answer - The correct answer
 * @param {string} kind - The form kind
 * @param {number[]} parts - The operands the generator used
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {number[]} Shuffled choices
 */
function _choices(answer, kind, parts, rng) {
  const wanted = PLAY.CHOICE_COUNT - 1
  const { primary, fallback } = _distances(answer, kind, parts)
  // Stop at 1, not 0: no generator answers 0, so a zero button would read as a bug.
  const under = (list) => list.map((d) => answer - d).filter((v) => v >= 1)
  const over = (list) => list.map((d) => answer + d)

  const seen = new Set([answer])
  const distractors = []
  const take = (pool, upTo) => {
    for (const value of pool) {
      if (distractors.length >= upTo) break
      if (Number.isInteger(value) && value >= 1 && !seen.has(value)) {
        seen.add(value)
        distractors.push(value)
      }
    }
  }

  // Draw how many sit below the answer, clamped to what the primary family
  // can supply: padding the low side from the fallback is what put `38,
  // 39` under `20 × 2`.
  const below = under(primary)
  const fromBelow = Math.min(rng.int(0, wanted), below.length, wanted)
  take(below, fromBelow)
  take(over(primary), wanted)
  // Whichever side ran short, top up from the rest of the primary family, then the fallback.
  take(below, wanted)
  take(over(fallback), wanted)
  take(under(fallback), wanted)

  let pad = answer + wanted
  while (distractors.length < wanted) {
    if (!seen.has(pad) && Number.isInteger(pad) && pad >= 1) {
      seen.add(pad)
      distractors.push(pad)
    }
    pad += 1
  }
  return rng.shuffle([answer, ...distractors])
}

/**
 * Generate one question from a list of forms.
 *
 * @param {Array<Object>} forms - Candidate forms; one is chosen at random
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {Question} A complete question
 */
export function generate(forms, rng) {
  const form = (Array.isArray(forms) && rng.pick(forms)) || { kind: "add", max: 20 }
  const kind = Object.hasOwn(GENERATORS, form.kind) ? form.kind : "add"
  const { prompt, answer, parts } = GENERATORS[kind](form, rng)
  // `parts` is kept for `explain`, which needs the operands for a 6 × 7
  // grid; parsing `prompt` back would be a worse copy.
  return { kind, prompt, answer, parts, choices: _choices(answer, kind, parts, rng) }
}

/**
 * Whether an answer is correct.
 *
 * Compares numerically after coercion, so a button that hands back the string
 * "42" is still right. Anything that is not a number or a numeric string is
 * wrong rather than an error.
 *
 * `null`, `undefined`, booleans, and blank strings are rejected up front.
 * `Number(null)` and `Number("")` are 0, and a timeout arrives as `null`, so
 * without the guard a question whose answer was 0 would score a timeout as
 * correct. No generator produces 0 today, but a future form could.
 *
 * @param {Question} question - The question that was asked
 * @param {unknown} given - What the player chose, or null for a timeout
 * @returns {boolean} True if correct
 */
export function check(question, given) {
  if (!question || !Number.isFinite(question.answer)) return false
  // Allow-list the two input shapes a real answer can have: too many
  // values coerce to 0 (`Number([])`) to block-list.
  if (typeof given !== "number" && typeof given !== "string") return false
  if (typeof given === "string" && given.trim() === "") return false
  const value = Number(given)
  return Number.isFinite(value) && value === question.answer
}

/**
 * Most dots a picture may draw. Past this the array is texture, not something a
 * child counts (`9 × 80` would ask for 720).
 * @private
 */
const MAX_DOTS = 60

/**
 * Longest side of a dot array. A 2 × 30 strip is unreadable as two rows of thirty.
 * @private
 */
const MAX_GRID_SIDE = 12

/**
 * Largest total a pair of ten-frames will show. Two frames hold twenty, which
 * is also where every `add` and `sub` form in the game stops.
 * @private
 */
const MAX_FRAME_TOTAL = 20

/**
 * A picture of a fact, for the reinforcement card.
 *
 * @typedef {Object} Explanation
 * @property {string} equation - The fact in full, e.g. "6 × 7 = 42"
 * @property {Model|null} model - A picture to draw under it, or null for none
 *
 * @typedef {Object} Model
 * @property {string} kind - "array", "groups", "tenFrames" or "steps"
 */

/**
 * Split a multiplication into a multiple of ten and a single digit, if it is
 * one. `6 × 80` is on grade as place value rather than as a fact to memorise,
 * so the picture worth drawing is the related fact and not 480 dots.
 * @private
 * @param {number[]} parts - The two operands
 * @returns {{unit: number, tens: number}|null} The split, or null
 */
function _tensSplit(parts) {
  const [a, b] = parts
  if (a >= 10 && a % 10 === 0 && b < 10) return { unit: b, tens: a }
  if (b >= 10 && b % 10 === 0 && a < 10) return { unit: a, tens: b }
  return null
}

/**
 * Explain a question, for the card shown after a missed question is finally
 * answered right. The optional third export of the challenge contract; see
 * challenges/index.js. Returning null for a question it cannot picture is
 * normal: the card then shows the equation alone.
 *
 * The equation is built from the question's own `prompt`, so the card cannot
 * drift from what was on screen. Every model is described rather than drawn,
 * because this module has no DOM and the UI has no arithmetic. GameUI draws the
 * kinds it knows and falls back to the equation, so a new model kind is
 * additive.
 *
 * @param {Question} question - The question that was finally answered
 * @returns {Explanation|null} What to show, or null for an unusable question
 */
export function explain(question) {
  if (!question || !Number.isFinite(question.answer) || typeof question.prompt !== "string") {
    return null
  }
  const parts = Array.isArray(question.parts) ? question.parts : []
  const equation = `${question.prompt} = ${question.answer}`
  return { equation, model: _model(question, parts) }
}

/**
 * The picture for a question, or null if none of them fit.
 * @private
 * @param {Question} question - The question being explained
 * @param {number[]} parts - The operands the generator used
 * @returns {Model|null} A described model, or null
 */
function _model(question, parts) {
  const [a, b, c] = parts

  if (question.kind === "mul" && Number.isFinite(a) && Number.isFinite(b)) {
    const rows = Math.min(a, b)
    const cols = Math.max(a, b)
    // Rows short side up, so the grid is always wider than tall; the
    // prompt may show the operands either way round.
    if (cols <= MAX_GRID_SIDE && rows * cols <= MAX_DOTS) return { kind: "array", rows, cols }
    const split = _tensSplit(parts)
    if (split) {
      return {
        kind: "steps",
        lines: [
          `${split.unit} × ${split.tens / 10} = ${(split.unit * split.tens) / 10}`,
          `${split.unit} × ${split.tens} = ${question.answer}`,
        ],
        note: "Ten times as many",
      }
    }
    return null
  }

  if (question.kind === "div" && Number.isFinite(a) && Number.isFinite(b)) {
    // parts is [divisor, quotient]: the dividend shared into `a` groups of `b`.
    if (a * b <= MAX_DOTS) return { kind: "groups", groups: a, per: b }
    return null
  }

  if ((question.kind === "add" || question.kind === "sub") && Number.isFinite(a)) {
    const total = question.kind === "add" ? question.answer : a
    if (total <= MAX_FRAME_TOTAL) {
      return { kind: "tenFrames", op: question.kind, a, b, answer: question.answer }
    }
    return null
  }

  if (question.kind === "twoStep" && Number.isFinite(a) && Number.isFinite(b)) {
    const product = a * b
    // The sign is recoverable without parsing the prompt: `_twoStep`
    // only adds or subtracts `c` from the product.
    const sign = question.answer === product + c ? "+" : "-"
    return {
      kind: "steps",
      lines: [`${a} × ${b} = ${product}`, `${product} ${sign} ${c} = ${question.answer}`],
      note: "One step, then the other",
    }
  }

  return null
}
