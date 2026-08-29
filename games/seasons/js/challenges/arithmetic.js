/**
 * Seasons arithmetic challenge -- the first (and so far only) challenge type.
 *
 * Architecture: a challenge module, conforming to the contract in
 * challenges/index.js. It exports `generate` and `check` and nothing else, and
 * it knows nothing about seasons, characters, trails, or the DOM. It is handed
 * a list of forms and an Rng, and hands back a question.
 *
 * A *form* describes a shape of question rather than a specific one, so a
 * season can say "two-digit subtraction that needs regrouping" once and get a
 * different question every time. seasons.js owns which forms a season uses;
 * this file owns what each form means. The five kinds:
 *
 * - `add`     {max, borrow}       a + b, sum at most max. `borrow` forces a carry.
 * - `sub`     {max, borrow}       a - b, never negative. `borrow` forces regrouping.
 * - `mul`     {tables, upTo, twoDigit}  one operand from `tables`; the other 2..upTo,
 *                                 or 10..upTo when `twoDigit` is set.
 * - `div`     {tables, upTo}      exact division only; the quotient is 2..upTo.
 * - `twoStep` {tables, upTo, max} a x b then + or - c, result 0..max.
 *
 * Answers are multiple choice (see PLAY.CHOICE_COUNT), so every question also
 * carries distractors. Those are generated as near misses -- the answer to the
 * wrong operation, an off-by-one operand, a digit slip -- rather than random
 * numbers, because a random distractor is trivially eliminated and teaches
 * nothing. A plausible wrong answer is what makes the question worth reading.
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
 * A generated question, ready to render.
 *
 * @typedef {Object} Question
 * @property {string} kind      - The form kind that produced it
 * @property {string} prompt    - The question text, e.g. "7 x 8"
 * @property {number} answer    - The correct answer
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
 * Addition. With `borrow`, both ones digits are forced high enough to carry,
 * which is the whole difficulty of multi-digit addition for a third grader.
 *
 * The carrying pair is chosen first and the tens are then sized to whatever is
 * left under `max`, rather than the other way round. Sizing the tens first is
 * what let an early version ignore a small `max` completely and return sums of
 * 20-38 for `max: 10`.
 *
 * @private
 * @param {Object} form - {max, borrow}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number}} The question
 */
function _add(form, rng) {
  const max = _size(form.max, 100, 10)
  if (form.borrow) {
    const onesA = rng.int(5, 9)
    const onesB = rng.int(10 - onesA, 9)
    const carrySum = onesA + onesB
    if (carrySum <= max) {
      // Whatever is left after the carrying pair, split between the two tens
      // columns. Both can be 0, which still carries: 7 + 8 is a valid question.
      const tensRoom = Math.floor((max - carrySum) / 10)
      const tensA = rng.int(0, Math.floor(tensRoom / 2))
      const tensB = rng.int(0, tensRoom - tensA)
      const a = tensA * 10 + onesA
      const b = tensB * 10 + onesB
      return { prompt: `${a} + ${b}`, answer: a + b }
    }
    // No carrying pair fits under max at all, so fall through to a plain sum
    // rather than silently exceeding the bound the form asked for.
  }
  const a = rng.int(2, Math.max(2, max - 2))
  const b = rng.int(1, Math.max(1, max - a))
  return { prompt: `${a} + ${b}`, answer: a + b }
}

/**
 * Subtraction, never negative. With `borrow`, the minuend's ones digit is
 * smaller than the subtrahend's, forcing regrouping.
 *
 * The minuend's tens are bounded by what `max` leaves after its ones digit, so
 * a form claiming `max: 100` cannot produce "104 - 27".
 *
 * @private
 * @param {Object} form - {max, borrow}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number}} The question
 */
function _sub(form, rng) {
  const max = _size(form.max, 100, 10)
  if (form.borrow) {
    const onesA = rng.int(0, 4)
    const onesB = rng.int(onesA + 1, 9)
    const maxTensA = Math.floor((max - onesA) / 10)
    // Regrouping needs the subtrahend to have a smaller tens column than the
    // minuend, so there has to be room for two distinct tens values.
    if (maxTensA >= 2) {
      const tensB = rng.int(1, Math.max(1, Math.floor(maxTensA / 2)))
      const tensA = rng.int(tensB + 1, Math.max(tensB + 1, maxTensA))
      const a = tensA * 10 + onesA
      const b = tensB * 10 + onesB
      return { prompt: `${a} - ${b}`, answer: a - b }
    }
  }
  const a = rng.int(3, max)
  const b = rng.int(1, Math.max(1, a - 1))
  return { prompt: `${a} - ${b}`, answer: a - b }
}

/**
 * Multiplication. `twoDigit` moves the second operand into the tens, which is
 * the autumn and winter step up from plain facts.
 * @private
 * @param {Object} form - {tables, upTo, twoDigit}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number}} The question
 */
function _mul(form, rng) {
  const table = rng.pick(_tables(form.tables))
  const upTo = _size(form.upTo, 10, 2)
  const other = form.twoDigit ? rng.int(10, Math.max(11, upTo)) : rng.int(2, upTo)
  // Show the operands in either order so the facts do not always read one way.
  const [a, b] = rng.next() < 0.5 ? [table, other] : [other, table]
  return { prompt: `${a} × ${b}`, answer: table * other }
}

/**
 * Division, always exact. Built from the product so it never has a remainder.
 * @private
 * @param {Object} form - {tables, upTo}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number}} The question
 */
function _div(form, rng) {
  const divisor = rng.pick(_tables(form.tables))
  const quotient = rng.int(2, _size(form.upTo, 10, 2))
  return { prompt: `${divisor * quotient} ÷ ${divisor}`, answer: quotient }
}

/**
 * Two steps: a multiplication and then an addition or subtraction. Subtraction
 * is only offered when it keeps the result at or above zero.
 *
 * The second operand is capped so the product leaves room for the second step
 * under `max`. An early version floored `max` at `product + 2`, which let the
 * floor override a smaller `max` and pushed spring's boss question over 100.
 *
 * The one case that can still exceed `max` is a form whose smallest possible
 * product already does -- `{tables: [9], max: 10}`, which no season uses. The
 * clamps below keep it returning a valid question rather than looping.
 *
 * @private
 * @param {Object} form - {tables, upTo, max}
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {{prompt: string, answer: number}} The question
 */
function _twoStep(form, rng) {
  const table = rng.pick(_tables(form.tables))
  const max = _size(form.max, 200, 10)
  const upTo = _size(form.upTo, 10, 2)
  // Leave at least 2 under max for the addition step.
  const maxOther = Math.max(2, Math.min(upTo, Math.floor((max - 2) / table)))
  const other = rng.int(2, maxOther)
  const product = table * other
  const addend = rng.int(2, Math.max(2, Math.min(20, max - product)))
  if (product > addend && rng.next() < 0.4) {
    return { prompt: `${table} × ${other} - ${addend}`, answer: product - addend }
  }
  return { prompt: `${table} × ${other} + ${addend}`, answer: product + addend }
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
 * Plausible wrong answers, in roughly decreasing order of how tempting they
 * are. Every candidate is a mistake a real player makes: off by one, off by
 * ten, the operands added instead of multiplied, a reversed pair of digits.
 * @private
 * @param {number} answer - The correct answer
 * @param {string} kind - The form kind, so the slips can suit the operation
 * @returns {number[]} Candidates, not yet filtered or trimmed
 */
function _candidates(answer, kind) {
  const near = [answer + 1, answer - 1, answer + 2, answer - 2]
  const scaled = [answer + 10, answer - 10, answer * 2, Math.floor(answer / 2)]
  const digits = String(answer)
  const swapped = digits.length > 1 ? [Number(digits.split("").reverse().join(""))] : []
  // Multiplication and division slip by a whole factor far more often than by
  // one, so those candidates come first for those kinds.
  return kind === "mul" || kind === "div" || kind === "twoStep"
    ? [...scaled, ...near, ...swapped]
    : [...near, ...scaled, ...swapped]
}

/**
 * Build the choice list: the answer plus distractors, shuffled.
 *
 * Guarantees exactly PLAY.CHOICE_COUNT distinct non-negative integers, one of
 * which is the answer. If the near misses run out -- which happens for very
 * small answers, where half the candidates collide or go negative -- it pads
 * upward from the answer rather than returning a short list, because a
 * three-button question would look like a bug to the player.
 *
 * @private
 * @param {number} answer - The correct answer
 * @param {string} kind - The form kind
 * @param {import("../rng.js").Rng} rng - Source of randomness
 * @returns {number[]} Shuffled choices
 */
function _choices(answer, kind, rng) {
  const seen = new Set([answer])
  const distractors = []
  for (const candidate of _candidates(answer, kind)) {
    if (distractors.length >= PLAY.CHOICE_COUNT - 1) break
    if (Number.isInteger(candidate) && candidate >= 0 && !seen.has(candidate)) {
      seen.add(candidate)
      distractors.push(candidate)
    }
  }
  let pad = answer + 3
  while (distractors.length < PLAY.CHOICE_COUNT - 1) {
    if (!seen.has(pad)) {
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
  const { prompt, answer } = GENERATORS[kind](form, rng)
  return { kind, prompt, answer, choices: _choices(answer, kind, rng) }
}

/**
 * Whether an answer is correct.
 *
 * Compares numerically after coercion, so a button that hands back the string
 * "42" is still right. Anything that is not a number or a numeric string is
 * wrong rather than an error.
 *
 * `null`, `undefined`, booleans, and blank strings are rejected up front rather
 * than coerced. `Number(null)` and `Number("")` are both 0, and a timeout
 * arrives here as `null` -- so without this guard a question whose answer was 0
 * would score a timeout as correct. No generator can currently produce a 0
 * answer, but a future form could, and the failure would be almost invisible.
 *
 * @param {Question} question - The question that was asked
 * @param {unknown} given - What the player chose, or null for a timeout
 * @returns {boolean} True if correct
 */
export function check(question, given) {
  if (!question || !Number.isFinite(question.answer)) return false
  if (given === null || given === undefined || typeof given === "boolean") return false
  if (typeof given === "string" && given.trim() === "") return false
  const value = Number(given)
  return Number.isFinite(value) && value === question.answer
}
