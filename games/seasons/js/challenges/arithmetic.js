/**
 * Seasons arithmetic challenge -- generates and checks maths questions.
 *
 * A challenge module, conforming to the contract in challenges/index.js. It
 * exports `generate` and `check` and nothing else, and it knows nothing about
 * seasons, characters, trails, or the DOM. It is handed a list of forms and an
 * Rng, and hands back a question.
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
 * `from` and `min` are what stop a hard slot asking an easy question. A season
 * narrows `tables` to make a form harder, but that alone does nothing to the
 * *answer*: `div` used to draw its quotient from 2 upward whatever the tables
 * said, so autumn's boss asked `12 ÷ 6 = 2`. See `_div`. `min` is the same idea
 * one operation over: every season's add and sub now live inside 20, so without
 * a floor the whole of summer's addition could be `2 + 3`. See `_add`.
 *
 * Answers are multiple choice (see PLAY.CHOICE_COUNT), so every question also
 * carries distractors. Those are near misses rather than random numbers, because
 * a random distractor is trivially eliminated and teaches nothing. Each
 * generator hands back the operands it used, and `_candidates` builds the
 * distractors by slipping one of them by one step -- so `4 × 80` offers 240 and
 * 400 (the 4 misremembered) and 280 and 360 (the 80 misremembered), every one of
 * which a child could actually arrive at.
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
 * Above this answer, a slip in one of the operands is the believable mistake and
 * makes the better distractor. At or below it, being one or two out is, and an
 * operand-sized slip stops resembling anything a child would actually write
 * down.
 * @private
 */
const SLIP_FROM = 20

/**
 * Above this answer, an operand-sized slip is the believable mistake for *any*
 * operation, not just the ones where a factor is involved.
 *
 * Column arithmetic with neighbours one and two away means no choice can be
 * ruled out by estimating -- the whole sum has to be carried out exactly and
 * then four numbers read and compared, which is a reading test on top of a
 * maths one. Ten out is what a real carry error looks like at that size.
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
 * Read a form's `min` as a floor that cannot exceed its own ceiling.
 *
 * A form that asks for more than its `max` allows is a contradiction, and the
 * ceiling has to win: it is the bound that keeps the question inside the range
 * the season was designed around, while the floor only makes it less trivial.
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
 * allows it.
 *
 * This is what makes a bounded sum a *fact* rather than merely a small number.
 * Drawing the first part uniformly from 1..total-1 is correct arithmetic and
 * useless practice: at `max: 18` it offers `1 + 17` and `19 - 1` as often as
 * anything else, and neither is a thing a child recalls. Keeping both parts
 * under ten is exactly the addition-facts table.
 *
 * Above 18 no such split exists, so the wide draw is the fallback rather than
 * the rule -- a form with a large `max` behaves as it always did.
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
 * The carrying pair is chosen first and the tens are then sized to whatever is
 * left between `min` and `max`. Sizing the tens first lets a small `max` be
 * ignored entirely, because the carrying pair still has to be added on top of
 * them.
 *
 * The tens are split by drawing a total and then dividing it, rather than
 * capping the first operand at half the room and giving the second the rest.
 * That earlier split was asymmetric: every bit of leftover magnitude landed in
 * the second operand, so `{max: 200, borrow: true}` put a three-digit number in
 * one of the two slots 29% of the time -- `5 + 195` among them -- which is a
 * shape the form never asked for.
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
  // Drawn as a sum and then split, for the same reason as the tens above: taking
  // `a` uniformly and giving `b` the remainder put the big number first every
  // time, with medians of 50 and 19 at `max: 100`.
  const sum = rng.int(min, max)
  const a = _splitToFacts(sum, rng)
  return { prompt: `${a} + ${sum - a}`, answer: sum, parts: [a, sum - a] }
}

/**
 * Subtraction, never negative. With `borrow`, the minuend's ones digit is
 * smaller than the subtrahend's, forcing regrouping.
 *
 * The minuend is drawn inside `min`..`max`, so a form claiming `max: 100`
 * cannot produce "104 - 27".
 *
 * **The tens are chosen before the ones, and the subtrahend is allowed to have
 * no tens at all.** Both of those are fixes for the same bug. The old version
 * picked the ones digits first, derived `maxTensA` from what `max` had left,
 * and then required `maxTensA >= 2` on the grounds that "regrouping needs the
 * subtrahend to have a smaller tens column than the minuend". That reasoning is
 * wrong: a subtrahend with *no* tens column regroups perfectly well, and
 * `13 - 7` is the single most common regrouping question a seven-year-old
 * meets. Because the old code forced `tensB >= 1`, it could not produce that
 * shape at all -- and at `max: 20` the `maxTensA >= 2` guard failed for every
 * ones digit except 0, so the form silently fell through to plain subtraction
 * and quietly stopped asking for the thing it was written to ask for. Choosing
 * the tens first means the ones can then be fitted to the bounds instead of the
 * other way round, and every draw honours `borrow`.
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
 * Multiplication. `twoDigit` moves the second operand into the tens, which is
 * one way to reach beyond the plain facts; putting the multiples of ten in
 * `tables` (`{tables: [10, 20, ...90], upTo: 9}`) is the other, and the one the
 * seasons use -- see ../seasons.js.
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
 * `from` is the smallest quotient, and it is the field that makes a hard slot
 * actually hard. Without it the quotient was drawn from 2 upward whatever the
 * tables said, so a third of every draw landed on the ÷2 and ÷3 facts and
 * narrowing `tables` changed nothing: autumn's boss, the climax of the third
 * season, asked `12 ÷ 6 = 2`. The dividend follows from `tables` × the quotient,
 * so raising the floor raises the dividend too -- `from: 7` on the 6-9 tables
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
 * silently overrides the bound the form asked for.
 *
 * `from` is the smallest second operand, and it exists for the same reason as
 * `div`'s: without it the last question of the game could be `8 × 2 + 3`, which
 * is not a climax. It is clamped to the cap rather than overriding it.
 *
 * One case can still exceed `max`: a form whose smallest possible product
 * already does, such as `{tables: [9], max: 10}`. The clamps below keep that
 * returning a valid question rather than looping forever.
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
  // Cap the second step at half the product as well as at 20, so subtracting
  // cannot wipe the multiplication out -- `6 × 3 - 17 = 1` was reachable, which
  // is a one-step question wearing a two-step prompt.
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
 * 20..90 slip in their tens digit, because that digit is the only thing being
 * held -- `4 × 80` becomes `4 × 70`, never `4 × 79`. A bare 10 is excluded
 * deliberately: slipping it a ten lands on 0, and nobody computes `5 × 0`.
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
 * This is the part that needs the operands rather than just the answer. For a
 * product, misremembering one factor by one step moves the answer by the *other*
 * factor times that step: `4 × 80` mistaken as `3 × 80` is 80 out, and as
 * `4 × 70` is 40 out. Both are numbers a child actually arrives at; `answer × 2`,
 * which this replaced, is not -- and because it was always the largest choice on
 * offer, "never pick the biggest" worked on every large question in the game.
 *
 * `mul` also offers two-step slips, and needs to. The one-step pair collapses to
 * a single distance whenever one factor is ten times the other -- `40 × 4` gives
 * `4 × 10` and `40 × 1`, both 40 -- which left only two distinct distractors and
 * let a near miss fill the third slot. `160, 161, 120, 200` puts an answer among
 * multiples of forty that nothing could produce, which is a free elimination.
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
      // Larger step first, since a whole-factor miss is the more tempting of the
      // two, then the same slips taken twice and three times over.
      //
      // Three rungs rather than one because the pair collapses to a single
      // distance whenever one factor is ten times the other -- `40 × 4` gives
      // `4 × 10` and `40 × 1`, both 40. With only one rung, one side of the
      // answer had just two believable values on it, and `_choices` had to fill
      // the third from the near misses: `160, 161, 200, 240` puts a number among
      // multiples of forty that nothing could produce, which is a free
      // elimination. Three rungs give either side enough to fill from alone.
      const steps = [second * _slipUnit(first), first * _slipUnit(second)].sort((x, y) => y - x)
      return [...steps, ...steps.map((step) => step * 2), ...steps.map((step) => step * 3)]
    }
    case "twoStep":
      // A slip in either factor, and the same slips taken twice over -- two rungs
      // rather than one so that three distinct values sit on each side of the
      // answer. With only `[second, first]` the low side held just two, so
      // `_choices` could never put three distractors below the answer and
      // winter's boss -- the last question of the game -- had the answer stuck at
      // one of two ranks.
      //
      // Deliberately *not* offered: the second step taken the wrong way round,
      // `8 × 7 + 9` answered as `8 × 7 - 9`. It is a real mistake, but it is
      // always the outlying choice by a wide margin -- `6 × 6 - 16 = 20` was
      // offering 52 -- so estimating kills it, which is the same flaw as
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
 * Two families. The *near misses* are one, two or three out, which is what a slip
 * in a ones digit looks like. The *operand slips* come from `_slipSizes`. Which
 * one leads depends on the size of the answer, not on the operation:
 *
 * Ordering by operation put the operand slips first for every multiplication and
 * division, which is right for a large product but produces nonsense for a small
 * quotient. "6 divided by 2" was offering 13 and 1 alongside the answer 3,
 * neither of which anybody would arrive at by miscounting, so three of the four
 * buttons could be dismissed without doing the maths. Below the threshold the
 * believable mistake is being one or two out.
 *
 * The split into two lists matters as much as the order. `20 × 2 = 40` can only
 * go wrong by a multiple of twenty, and only one such value sits below it, so the
 * near misses have to stay out of the way rather than queue up behind the slips:
 * with one flat list, `_choices` filled the low side with `38, 39` and offered
 * `20, 38, 39, 40`.
 *
 * @private
 * @param {number} answer - The correct answer
 * @param {string} kind - The form kind, so the slips can suit the operation
 * @param {number[]} parts - The operands the generator used
 * @returns {{primary: number[], fallback: number[]}} Distinct positive distances,
 *   most tempting first within each list
 */
function _distances(answer, kind, parts) {
  // Three near misses rather than two, so that a question whose only believable
  // slips are small still has six candidates to draw three from -- which is what
  // lets `_choices` vary how many land below the answer.
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
 * **How many distractors sit below the answer is drawn at random, and that is the
 * whole point of this function's shape.** Every distance is believable in both
 * directions, so the obvious implementation -- walk the distances and take the
 * first three values that fit -- yields `answer + d1`, `answer - d1`,
 * `answer + d2`: one below and two above, every single time. The answer was
 * therefore the **second-smallest of the four buttons in 100% of questions in the
 * game**, so tapping the second-smallest number won every question without doing
 * any arithmetic. `rng.shuffle` hid it, because shuffling changes where a choice
 * appears on screen but not how the four values sort.
 *
 * Drawing the split first, then filling each side in order of temptingness, keeps
 * the distractors just as believable and spreads the answer across all four
 * ranks. Small answers cannot always reach the extremes -- a quotient of 3 has
 * nothing three below it -- so the count is clamped to what is actually
 * available rather than forced.
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
  // Stop at 1, not 0. No generator can answer 0, so a zero button is never a near
  // miss -- it just reads like a bug next to `20 × 2`.
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

  // Draw how many distractors sit below the answer, clamped to how many the
  // *primary* family can supply -- letting the fallback family pad the low side
  // is what put `38, 39` under `20 × 2`.
  const below = under(primary)
  const fromBelow = Math.min(rng.int(0, wanted), below.length, wanted)
  take(below, fromBelow)
  take(over(primary), wanted)
  // Whichever side ran short, top up: the rest of the primary family first, then
  // the fallback one.
  take(below, wanted)
  take(over(fallback), wanted)
  take(under(fallback), wanted)

  let pad = answer + wanted
  let step = 1
  while (distractors.length < wanted) {
    if (!seen.has(pad) && Number.isInteger(pad) && pad >= 1) {
      seen.add(pad)
      distractors.push(pad)
    }
    // Above 2^53 the gap between representable numbers exceeds the step, so
    // `pad + step` can equal `pad` and this loop would never end. Grow the step
    // until it moves. Unreachable from any real form -- no season's `max` is
    // remotely this large -- but a hang is not an acceptable failure mode.
    const next = pad + step
    if (next === pad) {
      step *= 2
      pad = pad * 2 || 1
    } else {
      pad = next
    }
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
  // `parts` is deliberately not returned: it exists so the distractors can be
  // believable, and nothing outside this module has any use for it.
  return { kind, prompt, answer, choices: _choices(answer, kind, parts, rng) }
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
  // Allow-list the two input shapes a real answer can have, rather than
  // block-listing the coercions that go wrong. There are too many values that
  // coerce to 0 to enumerate -- `Number([])` is one -- and each one missed is a
  // wrong answer scored as correct on a question whose answer is 0.
  if (typeof given !== "number" && typeof given !== "string") return false
  if (typeof given === "string" && given.trim() === "") return false
  const value = Number(given)
  return Number.isFinite(value) && value === question.answer
}
