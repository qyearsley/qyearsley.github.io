/**
 * Tests for the Seasons arithmetic challenge (js/challenges/arithmetic.js).
 *
 * The centrepiece is a property test: for every form list the four real seasons
 * actually use -- `forms`, `glowingForms`, and `boss.forms` -- it generates a
 * question from each of 300 seeds and asserts the whole contract every time.
 * That contract is the answer being a finite non-negative integer, CHOICE_COUNT
 * distinct non-negative integer choices containing the answer exactly once, a
 * prompt built only from digits, spaces, and + - × ÷, `check` agreeing with the
 * answer and only the answer, and -- the part that catches a broken generator --
 * the prompt re-evaluating to the answer when the test parses and recomputes it
 * independently of the source.
 *
 * The rest is targeted: determinism from a seed, the specific promise each form
 * kind makes (a forced carry, a forced regrouping, a two-digit operand, exact
 * division, a non-negative two-step result), that malformed forms degrade to an
 * easy question rather than throwing or hanging, that small answers still fill
 * out the choice list, and that `check` coerces sensibly.
 */

import { describe, expect, it } from "@jest/globals"
import { check, generate } from "../js/challenges/arithmetic.js"
import { PLAY } from "../js/constants.js"
import { createRng } from "../js/rng.js"
import { SEASON_LIST } from "../js/seasons.js"

/** How many seeds the property sweep runs per form list. */
const SEED_COUNT = 300

/** Every prompt is built from these characters and nothing else. */
const PROMPT_CHARS = /^[\d +\-×÷]+$/

/** `a × b + c` and `a × b - c`, the only two-step shapes. */
const TWO_STEP = /^(\d+) × (\d+) ([+-]) (\d+)$/

/** `a + b`, `a - b`, `a × b`, `a ÷ b`. */
const BINARY = /^(\d+) ([+\-×÷]) (\d+)$/

/** Each season's three form lists, labelled for failure messages. */
const FORM_LISTS = SEASON_LIST.flatMap((season) => [
  [`${season.id}.forms`, season.forms],
  [`${season.id}.glowingForms`, season.glowingForms],
  [`${season.id}.boss.forms`, season.boss.forms],
])

/**
 * Recompute a prompt's value by parsing it, independently of the generator that
 * produced it. This is what makes the property test able to catch a prompt and
 * answer that disagree.
 * @param {string} prompt - The question text
 * @returns {number} The value, or NaN if the prompt is not a shape we know
 */
function evaluatePrompt(prompt) {
  const twoStep = TWO_STEP.exec(prompt)
  if (twoStep) {
    const product = Number(twoStep[1]) * Number(twoStep[2])
    const addend = Number(twoStep[4])
    return twoStep[3] === "+" ? product + addend : product - addend
  }
  const binary = BINARY.exec(prompt)
  if (!binary) return NaN
  const a = Number(binary[1])
  const b = Number(binary[3])
  switch (binary[2]) {
    case "+":
      return a + b
    case "-":
      return a - b
    case "×":
      return a * b
    case "÷":
      return b === 0 ? NaN : a / b
    default:
      return NaN
  }
}

/**
 * The two operands of a one-step prompt, for the tests that care about the
 * digits rather than the value.
 * @param {string} prompt - The question text
 * @returns {number[]} [a, b], or [] if the prompt is not one step
 */
function operands(prompt) {
  const binary = BINARY.exec(prompt)
  return binary ? [Number(binary[1]), Number(binary[3])] : []
}

/**
 * Every way a question can violate the contract, as readable strings. Returning
 * problems rather than asserting inline keeps the sweep's failures legible: the
 * message names the form list, the seed, and the prompt.
 * @param {Object} question - The question to inspect
 * @param {string} where - Context for the failure message
 * @returns {string[]} One string per violation; empty when the question is good
 */
function invariantProblems(question, where) {
  const problems = []
  const at = `${where} (${JSON.stringify(question && question.prompt)})`

  if (!question || typeof question !== "object") return [`${at}: not an object`]

  const { answer, choices, prompt } = question
  if (!Number.isInteger(answer) || answer < 0) {
    problems.push(`${at}: answer ${answer} is not a non-negative integer`)
  }
  if (typeof prompt !== "string" || prompt.length === 0) {
    problems.push(`${at}: prompt is not a non-empty string`)
  } else if (!PROMPT_CHARS.test(prompt)) {
    problems.push(`${at}: prompt has characters outside digits, spaces and + - × ÷`)
  } else if (evaluatePrompt(prompt) !== answer) {
    problems.push(`${at}: prompt evaluates to ${evaluatePrompt(prompt)}, not ${answer}`)
  }
  if (!Array.isArray(choices) || choices.length !== PLAY.CHOICE_COUNT) {
    problems.push(`${at}: expected ${PLAY.CHOICE_COUNT} choices, got ${choices && choices.length}`)
  } else {
    if (new Set(choices).size !== choices.length) {
      problems.push(`${at}: choices ${choices} are not distinct`)
    }
    if (choices.some((value) => !Number.isInteger(value) || value < 0)) {
      problems.push(`${at}: choices ${choices} are not all non-negative integers`)
    }
    const hits = choices.filter((value) => value === answer).length
    if (hits !== 1) {
      problems.push(`${at}: answer ${answer} appears ${hits} times in ${choices}`)
    }
  }
  if (check(question, answer) !== true) problems.push(`${at}: check rejected the answer`)
  if (check(question, answer + 1) !== false) {
    problems.push(`${at}: check accepted ${answer + 1}`)
  }
  return problems
}

/**
 * Assert one question is well formed, for the targeted tests.
 * @param {Object} question - The question to inspect
 */
function expectWellFormed(question) {
  expect(invariantProblems(question, "question")).toEqual([])
}

/**
 * Generate many questions from one form, for the per-kind invariants.
 * @param {Object} form - A single arithmetic form
 * @param {number} [count] - How many questions to generate
 * @returns {Object[]} The questions
 */
function sample(form, count = 200) {
  const questions = []
  for (let seed = 0; seed < count; seed += 1) {
    questions.push(generate([form], createRng(`${JSON.stringify(form)}-${seed}`)))
  }
  return questions
}

describe("arithmetic", () => {
  describe("the question contract", () => {
    it("holds for every real season form list across 300 seeds", () => {
      const problems = []
      for (const [label, forms] of FORM_LISTS) {
        for (let seed = 0; seed < SEED_COUNT; seed += 1) {
          const question = generate(forms, createRng(`${label}-${seed}`))
          problems.push(...invariantProblems(question, `${label} seed ${seed}`))
        }
      }
      // Slice so a systemic break reports a handful of cases, not thousands.
      expect(problems.slice(0, 10)).toEqual([])
    })

    it("would catch a prompt that disagrees with its answer", () => {
      // Guards the guard: the sweep above is only worth anything if a wrong
      // prompt, an unparseable prompt, or a short choice list actually fails.
      const good = generate(SEASON_LIST[0].forms, createRng("meta"))
      expect(invariantProblems(good, "good")).toEqual([])
      expect(invariantProblems({ ...good, answer: good.answer + 1 }, "off by one")).not.toEqual([])
      expect(invariantProblems({ ...good, prompt: "7 ** 8" }, "bad prompt")).not.toEqual([])
      expect(invariantProblems({ ...good, prompt: "" }, "empty prompt")).not.toEqual([])
      expect(invariantProblems({ ...good, choices: [good.answer] }, "short")).not.toEqual([])
      expect(invariantProblems({ ...good, choices: [1, 1, 1, 1] }, "dupes")).not.toEqual([])
      expect(invariantProblems({ ...good, answer: -1 }, "negative")).not.toEqual([])
    })

    it("sweeps every form list, so no season is silently skipped", () => {
      // Three lists per season -- forms, glowingForms and boss.forms -- and the
      // last season's boss named explicitly, because that is the one a loop
      // that stops early would drop.
      expect(FORM_LISTS).toHaveLength(SEASON_LIST.length * 3)
      expect(FORM_LISTS.map(([label]) => label)).toContain(`${SEASON_LIST.at(-1).id}.boss.forms`)
      for (const [, forms] of FORM_LISTS) {
        expect(Array.isArray(forms) && forms.length).toBeGreaterThan(0)
      }
    })

    it("reports the kind it generated, and only known kinds", () => {
      const kinds = new Set()
      for (const [label, forms] of FORM_LISTS) {
        for (let seed = 0; seed < 40; seed += 1) {
          kinds.add(generate(forms, createRng(`${label}-${seed}`)).kind)
        }
      }
      expect([...kinds].sort()).toEqual(["add", "div", "mul", "sub", "twoStep"])
    })
  })

  describe("determinism", () => {
    it("gives an identical question for the same seed and forms", () => {
      for (const [label, forms] of FORM_LISTS) {
        const first = generate(forms, createRng(`${label}-fixed`))
        const second = generate(forms, createRng(`${label}-fixed`))
        expect(first).toEqual(second)
      }
    })

    it("gives different questions across different seeds", () => {
      const prompts = new Set()
      for (let seed = 0; seed < 50; seed += 1) {
        prompts.add(generate(SEASON_LIST[0].forms, createRng(seed)).prompt)
      }
      expect(prompts.size).toBeGreaterThan(1)
    })
  })

  describe("add", () => {
    it("forces a carry when borrow is set", () => {
      for (const question of sample({ kind: "add", max: 100, borrow: true })) {
        const [a, b] = operands(question.prompt)
        expect(question.prompt).toContain(" + ")
        expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10)
      }
    })

    it("forces a carry for the thousand-range autumn form too", () => {
      for (const question of sample({ kind: "add", max: 1000, borrow: true })) {
        const [a, b] = operands(question.prompt)
        expect((a % 10) + (b % 10)).toBeGreaterThanOrEqual(10)
      }
    })

    it("keeps the sum within max when borrow is not set", () => {
      for (const question of sample({ kind: "add", max: 50 })) {
        expect(question.answer).toBeLessThanOrEqual(50)
        expect(question.answer).toBeGreaterThan(0)
      }
    })
  })

  describe("sub", () => {
    it("never produces a negative answer", () => {
      for (const form of [
        { kind: "sub", max: 100 },
        { kind: "sub", max: 100, borrow: true },
        { kind: "sub", max: 1000, borrow: true },
        { kind: "sub", max: 10 },
      ]) {
        for (const question of sample(form)) {
          expect(question.answer).toBeGreaterThanOrEqual(0)
          const [a, b] = operands(question.prompt)
          expect(a).toBeGreaterThanOrEqual(b)
        }
      }
    })

    it("forces regrouping when borrow is set", () => {
      for (const question of sample({ kind: "sub", max: 100, borrow: true })) {
        const [a, b] = operands(question.prompt)
        expect(question.prompt).toContain(" - ")
        expect(a % 10).toBeLessThan(b % 10)
      }
    })
  })

  describe("mul", () => {
    it("always has an operand of ten or more when twoDigit is set", () => {
      for (const form of [
        { kind: "mul", tables: [2, 3, 4, 5, 6, 7, 8, 9], upTo: 20, twoDigit: true },
        { kind: "mul", tables: [6, 7, 8, 9], upTo: 90, twoDigit: true },
        // upTo below ten would leave no room; the generator widens it to 11.
        { kind: "mul", tables: [3], upTo: 4, twoDigit: true },
      ]) {
        for (const question of sample(form)) {
          const [a, b] = operands(question.prompt)
          expect(Math.max(a, b)).toBeGreaterThanOrEqual(10)
        }
      }
    })

    it("keeps both operands within upTo when twoDigit is not set", () => {
      for (const question of sample({ kind: "mul", tables: [2, 3, 4], upTo: 9 })) {
        const [a, b] = operands(question.prompt)
        expect(Math.max(a, b)).toBeLessThanOrEqual(9)
        expect(Math.min(a, b)).toBeGreaterThanOrEqual(2)
      }
    })

    it("draws one operand from the table list", () => {
      const tables = [6, 7, 8, 9]
      for (const question of sample({ kind: "mul", tables, upTo: 12 })) {
        const [a, b] = operands(question.prompt)
        expect(tables.includes(a) || tables.includes(b)).toBe(true)
      }
    })

    it("shows the operands in both orders across seeds", () => {
      const shapes = new Set()
      for (const question of sample({ kind: "mul", tables: [2], upTo: 9 }, 60)) {
        const [a] = operands(question.prompt)
        shapes.add(a === 2)
      }
      expect(shapes.size).toBe(2)
    })
  })

  describe("div", () => {
    it("is always exact", () => {
      for (const form of [
        { kind: "div", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], upTo: 10 },
        { kind: "div", tables: [6, 7, 8, 9], upTo: 12 },
        { kind: "div", tables: [3, 4, 6, 7, 8, 9], upTo: 12 },
      ]) {
        for (const question of sample(form)) {
          const [dividend, divisor] = operands(question.prompt)
          expect(divisor).toBeGreaterThan(0)
          expect(dividend % divisor).toBe(0)
          expect(dividend / divisor).toBe(question.answer)
        }
      }
    })

    it("never has a quotient below two", () => {
      for (const question of sample({ kind: "div", tables: [5], upTo: 10 })) {
        expect(question.answer).toBeGreaterThanOrEqual(2)
      }
    })

    it("honours a quotient floor, which is what makes a hard slot hard", () => {
      // Without this the quotient came from 2 upward whatever `tables` said, so a
      // third of every draw was a ÷2 or ÷3 fact and narrowing the tables changed
      // nothing: autumn's boss asked `12 ÷ 6 = 2`.
      for (const from of [4, 6, 7, 10]) {
        for (const question of sample({ kind: "div", tables: [6, 7, 8, 9], from, upTo: 10 })) {
          expect(question.answer).toBeGreaterThanOrEqual(from)
          expect(question.answer).toBeLessThanOrEqual(10)
        }
      }
    })

    it("lets the ceiling win when the floor is above it", () => {
      // A contradictory form must degrade rather than hang or invert, and it is
      // `upTo` that keeps the fact inside the tables, so `upTo` is the one to
      // respect.
      for (const question of sample({ kind: "div", tables: [7], from: 50, upTo: 6 })) {
        expect(question.answer).toBe(6)
        expect(question.prompt).toBe("42 ÷ 7")
      }
    })
  })

  describe("twoStep", () => {
    it("keeps the result at or above zero", () => {
      for (const form of [
        { kind: "twoStep", tables: [2, 5, 10], upTo: 10, max: 100 },
        { kind: "twoStep", tables: [4, 6, 7, 8, 9], upTo: 12, max: 600 },
        { kind: "twoStep", tables: [2], upTo: 2, max: 4 },
      ]) {
        for (const question of sample(form)) {
          expect(question.answer).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it("uses both the adding and the subtracting shape", () => {
      const operators = new Set()
      for (const question of sample({ kind: "twoStep", tables: [6, 7, 8], upTo: 10, max: 200 })) {
        operators.add(TWO_STEP.exec(question.prompt)[3])
      }
      expect([...operators].sort()).toEqual(["+", "-"])
    })

    it("honours a floor on the second operand", () => {
      // Same reason as `div`'s: without it the last question of the game could be
      // `8 × 2 + 3`, which is not a climax.
      for (const question of sample({
        kind: "twoStep",
        tables: [6, 7, 8, 9],
        from: 7,
        upTo: 10,
        max: 100,
      })) {
        const [, , other] = TWO_STEP.exec(question.prompt)
        expect(Number(other)).toBeGreaterThanOrEqual(7)
      }
    })

    it("never lets the second step wipe out the multiplication", () => {
      // `6 × 3 - 17 = 1` was reachable: a one-step question wearing a two-step
      // prompt, and its choices ran down to 0.
      for (const form of [
        { kind: "twoStep", tables: [6, 7, 8, 9], from: 7, upTo: 10, max: 100 },
        { kind: "twoStep", tables: [2, 3], upTo: 10, max: 100 },
      ]) {
        for (const question of sample(form)) {
          const [, table, other] = TWO_STEP.exec(question.prompt)
          const product = Number(table) * Number(other)
          expect(question.answer).toBeGreaterThanOrEqual(Math.floor(product / 2))
        }
      }
    })
  })

  describe("degenerate and malformed forms", () => {
    const cases = [
      ["empty form", [{}]],
      ["unknown kind", [{ kind: "nonsense" }]],
      ["empty tables", [{ kind: "mul", tables: [] }]],
      ["tables that is a string", [{ kind: "mul", tables: "abc" }]],
      ["NaN max", [{ kind: "add", max: NaN }]],
      ["negative max", [{ kind: "add", max: -5 }]],
      ["null form in the list", [null]],
      ["empty form list", []],
      ["no form list at all", null],
      ["undefined form list", undefined],
    ]

    it.each(cases)("still returns a well-formed question: %s", (_label, forms) => {
      for (let seed = 0; seed < 50; seed += 1) {
        expectWellFormed(generate(forms, createRng(seed)))
      }
    })

    it("falls back to addition for an unknown kind", () => {
      const question = generate([{ kind: "nonsense" }], createRng(1))
      expect(question.kind).toBe("add")
      expect(question.prompt).toContain(" + ")
    })

    it("substitutes default tables when tables is unusable", () => {
      for (const tables of [[], "abc", null, [0, 1, NaN], 42]) {
        for (const question of sample({ kind: "mul", tables, upTo: 6 }, 40)) {
          const [a, b] = operands(question.prompt)
          expect([2, 5, 10].includes(a) || [2, 5, 10].includes(b)).toBe(true)
        }
      }
    })

    it("does not hang on a form whose bounds are inverted or absurd", () => {
      for (const form of [
        { kind: "add", max: 0 },
        { kind: "sub", max: -100 },
        { kind: "mul", tables: [2], upTo: -3 },
        { kind: "div", tables: [3], upTo: 0 },
        { kind: "twoStep", tables: [9], upTo: 12, max: 1 },
        { kind: "twoStep", tables: [9], upTo: Infinity, max: Infinity },
      ]) {
        for (const question of sample(form, 30)) {
          expectWellFormed(question)
        }
      }
    })
  })

  describe("choices", () => {
    it("gives small answers a full set of distinct non-negative choices", () => {
      // The smallest answer any generator can produce is 1, so this is where the
      // candidate list runs thinnest and the padding path is closest to firing.
      const small = []
      for (let seed = 0; seed < 400; seed += 1) {
        const question = generate([{ kind: "sub", max: 10 }], createRng(`small-${seed}`))
        if (question.answer <= 2) small.push(question)
      }
      expect(small.length).toBeGreaterThan(0)
      for (const question of small) {
        expect(question.choices).toHaveLength(PLAY.CHOICE_COUNT)
        expect(new Set(question.choices).size).toBe(PLAY.CHOICE_COUNT)
        expect(question.choices).toContain(question.answer)
        for (const value of question.choices) {
          expect(Number.isInteger(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it("puts the answer in more than one position across seeds", () => {
      const positions = new Set()
      for (let seed = 0; seed < 40; seed += 1) {
        const question = generate(SEASON_LIST[1].forms, createRng(`pos-${seed}`))
        positions.add(question.choices.indexOf(question.answer))
      }
      expect(positions.size).toBeGreaterThan(1)
      expect(positions.has(-1)).toBe(false)
    })

    it("offers near misses rather than arbitrary numbers, below the big-answer mark", () => {
      // The tolerance here used to be Math.max(10, answer), which for an answer
      // of 90 admitted anything in [0, 180] -- uniform random distractors would
      // have passed it, so it could not fail for the thing it is named after.
      //
      // Capped at max 90 so every answer stays under BIG_ANSWER. Above that the
      // ordering deliberately flips to whole-factor slips, because +-1 and +-2
      // on a three-digit sum leave nothing to estimate with -- there is a
      // separate group covering that.
      let distractors = 0
      for (let seed = 0; seed < 100; seed += 1) {
        const question = generate([{ kind: "add", max: 90 }], createRng(`near-${seed}`))
        expect(question.answer).toBeLessThan(100)
        for (const value of question.choices) {
          if (value === question.answer) continue
          expect(Math.abs(value - question.answer)).toBeLessThanOrEqual(3)
          distractors += 1
        }
      }
      // The loop asserts nothing when a question has no distractors, so count.
      expect(distractors).toBe(100 * (PLAY.CHOICE_COUNT - 1))
    })
  })

  describe("check", () => {
    it("accepts the answer as a number or as a string", () => {
      const question = { kind: "add", prompt: "40 + 2", answer: 42, choices: [42, 41, 43, 52] }
      expect(check(question, 42)).toBe(true)
      expect(check(question, "42")).toBe(true)
      expect(check(question, " 42 ")).toBe(true)
      expect(check(question, 42.0)).toBe(true)
    })

    it("rejects a wrong value", () => {
      const question = { kind: "add", prompt: "40 + 2", answer: 42, choices: [42, 41, 43, 52] }
      for (const given of [41, 43, "41", 4.2, -42]) {
        expect(check(question, given)).toBe(false)
      }
    })

    it("rejects non-numeric and missing answers", () => {
      const question = { kind: "add", prompt: "40 + 2", answer: 42, choices: [42, 41, 43, 52] }
      for (const given of [null, undefined, NaN, "", "  ", "forty-two", {}, [], Infinity]) {
        expect(check(question, given)).toBe(false)
      }
    })

    it("rejects a timeout on a question whose answer is 0", () => {
      // The only shape that can catch the guard `check` opens with. `Number(null)`,
      // `Number("")`, `Number("  ")` and `Number(false)` are all 0, and a timeout
      // arrives as null -- so with the guard deleted, this question scores every
      // one of them as correct. The 42-answer case above passes either way,
      // because 0 !== 42, which is why it needs this companion.
      const zero = { kind: "sub", prompt: "5 - 5", answer: 0, choices: [0, 1, 2, 3] }
      expect(check(zero, 0)).toBe(true)
      expect(check(zero, "0")).toBe(true)
      expect(check(zero, " 0 ")).toBe(true)
      for (const given of [null, undefined, "", "  ", "\t\n", false, true]) {
        expect(check(zero, given)).toBe(false)
      }
    })

    it("rejects a malformed or missing question", () => {
      for (const bad of [null, undefined, {}, { answer: NaN }, { answer: "42" }, 42, "42"]) {
        expect(check(bad, 42)).toBe(false)
      }
    })

    it("agrees with every generated question's own answer", () => {
      for (const [label, forms] of FORM_LISTS) {
        for (let seed = 0; seed < 25; seed += 1) {
          const question = generate(forms, createRng(`check-${label}-${seed}`))
          expect(check(question, question.answer)).toBe(true)
          expect(check(question, String(question.answer))).toBe(true)
          for (const value of question.choices) {
            expect(check(question, value)).toBe(value === question.answer)
          }
        }
      }
    })
  })
})

/**
 * Regression tests for three generators that used to overshoot the `max` their
 * form declared. All three were found by sweeping the real season forms, and
 * one of them was live: spring's glowing subtraction claimed `max: 100` and
 * produced prompts like "104 - 27".
 *
 * These assert the bound directly rather than through the property sweep,
 * because the sweep only checks that a prompt agrees with its own answer -- an
 * out-of-range question is perfectly self-consistent and slipped straight
 * through it.
 */
describe("generators respect the max their form declares", () => {
  /**
   * Largest number appearing anywhere in a prompt, operands included. The bound
   * has to cover the operands and not just the answer: "104 - 27" is the bug
   * even though its answer, 77, is well under 100.
   * @param {string} prompt - A generated prompt
   * @returns {number} The largest value in it
   */
  function largestIn(prompt) {
    return Math.max(...prompt.match(/\d+/g).map(Number))
  }

  it("keeps carrying addition under max, even when max is tiny", () => {
    // max: 10 used to be ignored entirely, giving sums of 20-38.
    for (const max of [10, 20, 40, 100, 1000]) {
      for (let seed = 0; seed < 200; seed += 1) {
        const question = generate([{ kind: "add", max, borrow: true }], createRng(seed))
        expect(question.answer).toBeLessThanOrEqual(max)
        expect(largestIn(question.prompt)).toBeLessThanOrEqual(max)
      }
    }
  })

  it("keeps regrouping subtraction's minuend under max", () => {
    for (const max of [20, 30, 100, 1000]) {
      for (let seed = 0; seed < 200; seed += 1) {
        const question = generate([{ kind: "sub", max, borrow: true }], createRng(seed))
        expect(largestIn(question.prompt)).toBeLessThanOrEqual(max)
        expect(question.answer).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("keeps two-step results under max", () => {
    const forms = [
      { kind: "twoStep", tables: [2, 5, 10], upTo: 10, max: 100 },
      { kind: "twoStep", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], upTo: 10, max: 200 },
      { kind: "twoStep", tables: [4, 6, 7, 8, 9], upTo: 12, max: 600 },
    ]
    for (const form of forms) {
      for (let seed = 0; seed < 300; seed += 1) {
        const question = generate([form], createRng(seed))
        expect(question.answer).toBeLessThanOrEqual(form.max)
        expect(question.answer).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it("holds for every form list the real seasons use", () => {
    const overshoots = []
    let checked = 0
    for (const [label, forms] of FORM_LISTS) {
      for (const form of forms) {
        if (!Number.isFinite(form.max)) continue
        for (let seed = 0; seed < 150; seed += 1) {
          const question = generate([form], createRng(`bounds-${label}-${seed}`))
          checked += 1
          if (question.answer > form.max || largestIn(question.prompt) > form.max) {
            overshoots.push(`${label} ${form.kind} max=${form.max}: ${question.prompt}`)
          }
        }
      }
    }
    // The sweep collects inside the loop and asserts outside it, so it would
    // pass having generated nothing at all -- if FORM_LISTS were empty, or if
    // every real form lost its `max`. Nine of the twelve lists carry a bounded
    // form today, at 150 seeds each.
    expect(checked).toBeGreaterThan(1000)
    expect(overshoots.slice(0, 10)).toEqual([])
  })
})

/**
 * Distractor plausibility, which is a quality property rather than a
 * correctness one: every choice has to be a number a child could actually
 * arrive at. Nothing guarded this, and division was offering 13 and 1 against
 * an answer of 3 -- three of four buttons dismissable without doing the maths.
 */
describe("distractors stay believable for the size of the answer", () => {
  /**
   * Generate until an answer falls in the wanted range, so the assertion is
   * about the size of the answer rather than about a particular seed.
   * @param {Object} form - A single form to generate from
   * @param {function(number): boolean} wanted - Predicate on the answer
   * @returns {Object|null} A matching question, or null if none turned up
   */
  function findQuestion(form, wanted) {
    for (let seed = 0; seed < 400; seed += 1) {
      const question = generate([form], createRng(`plausible-${seed}`))
      if (wanted(question.answer)) return question
    }
    return null
  }

  it("keeps small answers within a couple of the truth", () => {
    // A quotient of 3 invites 2 and 4, never 13. The old ordering put the
    // off-by-ten and halved candidates first for every division regardless of
    // how small the answer was.
    const question = findQuestion({ kind: "div", tables: [2, 5, 10], upTo: 6 }, (a) => a <= 6)
    expect(question).not.toBeNull()
    for (const choice of question.choices) {
      expect(Math.abs(choice - question.answer)).toBeLessThanOrEqual(4)
    }
  })

  it("still offers whole-factor slips for large answers", () => {
    // For a real product the believable mistake is a whole factor out, so at
    // least one choice should be further away than a near miss.
    const question = findQuestion({ kind: "mul", tables: [6, 7, 8, 9], upTo: 12 }, (a) => a >= 40)
    expect(question).not.toBeNull()
    const distances = question.choices.map((c) => Math.abs(c - question.answer))
    expect(Math.max(...distances)).toBeGreaterThan(4)
  })

  it("never offers a negative or a duplicate, whatever the answer's size", () => {
    for (const form of [
      { kind: "div", tables: [2, 5, 10], upTo: 6 },
      { kind: "mul", tables: [6, 7, 8, 9], upTo: 12 },
      { kind: "sub", max: 100 },
      { kind: "twoStep", tables: [4, 6, 7, 8, 9], upTo: 12, max: 600 },
    ]) {
      for (let seed = 0; seed < 120; seed += 1) {
        const { choices, answer } = generate([form], createRng(`safe-${form.kind}-${seed}`))
        expect(new Set(choices).size).toBe(choices.length)
        expect(choices).toContain(answer)
        for (const choice of choices) expect(choice).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe("big answers get whole-factor distractors, whatever the operation", () => {
  it("spreads the choices for column arithmetic", () => {
    // Addition with neighbours one and two away cannot be narrowed by
    // estimating: the sum has to be carried out exactly, then four numbers read
    // and compared. Ten out is what a real carry slip looks like at that size,
    // and it leaves something to reason about.
    //
    // `max: 400` is above anything the seasons ask for now -- the retune caps
    // addition at 100 -- so this exercises the mechanism directly rather than a
    // live form.
    let checked = 0
    for (let seed = 0; seed < 300; seed += 1) {
      const question = generate([{ kind: "add", max: 400, borrow: true }], createRng(`big-${seed}`))
      if (question.answer < 100) continue
      const spread = Math.max(...question.choices.map((c) => Math.abs(c - question.answer)))
      expect(spread).toBeGreaterThan(4)
      checked += 1
    }
    expect(checked).toBeGreaterThan(20)
  })
})

/**
 * Distractors built from the operands rather than from the answer alone.
 *
 * The candidates used to include `answer * 2`, which for any answer at or above
 * BIG_ANSWER was both offered and always the largest choice -- so "never pick the
 * biggest" was a reliable strategy on every large question in the game, and the
 * question was effectively one-in-three. Nothing caught it, because every test
 * here asked whether the choices were *spread*, and a doubled answer is very
 * spread indeed. So the property below is the opposite one: every choice has to
 * be a number some slip actually lands on.
 */
describe("distractors are numbers a child could actually reach", () => {
  /**
   * The operands of any prompt shape, one-step or two.
   * @param {string} prompt - The question text
   * @returns {number[]} The numbers in it, in the order they appear
   */
  function allOperands(prompt) {
    return prompt.match(/\d+/g).map(Number)
  }

  /**
   * Every value a believable slip can land on, worked out from the prompt rather
   * than from the implementation. Kept in step with `_slipSizes` on purpose --
   * this is the model the generator has to satisfy, and restating it here is what
   * makes a regression visible.
   *
   * Exact, with no slack: an earlier version also allowed `answer + 3` through
   * `answer + 8`, to cover `_choices`'s upward padding. That padding only fires
   * when the candidates collide, which needs a very small answer -- so allowing it
   * unconditionally widened the set enough that gutting `_candidates` to return
   * nothing still passed. The sweep below skips small answers instead.
   *
   * @param {Object} question - A generated question
   * @returns {Set<number>} The values the choices are allowed to take
   */
  function reachable(question) {
    const { answer, kind, prompt } = question
    const nums = allOperands(prompt)
    const unit = (n) => (n >= 20 && n % 10 === 0 ? 10 : 1)
    let steps = []
    if (kind === "mul") {
      const [a, b] = nums
      steps = [b * unit(a), a * unit(b)]
      steps = [...steps, ...steps.map((s) => s * 2), ...steps.map((s) => s * 3)]
    } else if (kind === "twoStep") {
      steps = [nums[0], nums[1], nums[0] * 2, nums[1] * 2]
    } else if (kind === "add" || kind === "sub") {
      steps = [10]
    }
    // Near misses apply to every kind, and are the only slips division gets.
    steps = [...steps, 1, 2, 3]
    const values = new Set([answer])
    for (const step of steps) {
      values.add(answer + step)
      values.add(answer - step)
    }
    return values
  }

  /**
   * Below this answer `_choices` can run out of candidates and pad upward, which
   * legitimately produces values no slip would reach. Five is the smallest answer
   * for which the four near misses are all distinct and non-negative.
   */
  const PADDING_FREE_FROM = 5

  it.each(FORM_LISTS)("offers only reachable choices: %s", (label, forms) => {
    const unreachable = []
    let checked = 0
    for (let seed = 0; seed < 400; seed += 1) {
      const question = generate(forms, createRng(`reach-${label}-${seed}`))
      if (question.answer < PADDING_FREE_FROM) continue
      checked += 1
      const allowed = reachable(question)
      for (const choice of question.choices) {
        if (!allowed.has(choice)) {
          unreachable.push(
            `${question.prompt} = ${question.answer}: ${choice} in ${question.choices}`,
          )
        }
      }
    }
    // The `continue` above could skip everything -- a form list of tiny quotients
    // would assert nothing at all -- so name how much actually got looked at.
    expect(checked).toBeGreaterThan(100)
    expect(unreachable.slice(0, 5)).toEqual([])
  })

  it("would catch the doubled answer it was written for", () => {
    // Guards the guard. `574 - 38 = 536` used to offer 1072, and the model above
    // has to reject it -- otherwise the sweep proves nothing.
    const old = { kind: "sub", prompt: "574 - 38", answer: 536, choices: [526, 546, 1072, 536] }
    const allowed = reachable(old)
    expect(allowed.has(526)).toBe(true)
    expect(allowed.has(546)).toBe(true)
    expect(allowed.has(1072)).toBe(false)
    // And it has to reject the padding values too, or deleting the whole slip
    // mechanism would pass: with no candidates at all, `_choices` pads upward.
    expect(allowed.has(540)).toBe(false)
    expect(allowed.has(541)).toBe(false)
    // The digits reversed is no longer offered, so the model must not allow it.
    expect(allowed.has(635)).toBe(false)
  })

  it("spreads a two-step's choices by its factors, not by one or two", () => {
    // The `twoStep` branch of `_slipSizes` had nothing holding it, so the last
    // question of the game -- winter's boss is 100% two-step -- could have lost
    // its operand slips and dropped to `answer ± 1, ± 2` without failing a test.
    let checked = 0
    for (let seed = 0; seed < 400; seed += 1) {
      const question = generate(
        [{ kind: "twoStep", tables: [6, 7, 8, 9], from: 7, upTo: 10, max: 100 }],
        createRng(`two-${seed}`),
      )
      const spread = Math.max(...question.choices.map((c) => Math.abs(c - question.answer)))
      expect(spread).toBeGreaterThan(2)
      checked += 1
    }
    expect(checked).toBe(400)
  })

  it("keeps every choice on the grid for a product of a multiple of ten", () => {
    // `40 × 4` can only plausibly be got wrong by a multiple of forty, so a
    // choice of 161 is a free elimination. This failed at 13% of tens products
    // before `_slipSizes` learned to offer two-step slips: the one-step pair
    // collapses to a single distance when one factor is ten times the other,
    // which left a near miss filling the last slot.
    //
    // Scoped to a tens operand of 20 and up, because `7 × 10` is a plain fact
    // rather than a place-value question -- slipping the 10 itself to 9 or 11 is
    // believable there, so its choices need not sit on the grid.
    const offGrid = []
    for (let seed = 0; seed < 3000; seed += 1) {
      const question = generate(
        [{ kind: "mul", tables: [20, 30, 40, 50, 60, 70, 80, 90], upTo: 9 }],
        createRng(`grid-${seed}`),
      )
      if (question.choices.some((choice) => choice % 10 !== 0)) {
        offGrid.push(`${question.prompt} -> ${question.choices}`)
      }
    }
    expect(offGrid.slice(0, 5)).toEqual([])
  })

  it.each(FORM_LISTS)("does not put the answer at a predictable rank: %s", (label, forms) => {
    // The worst bug this file has held, and it survived every other distractor
    // test. Each distance is believable in both directions, so taking the first
    // three candidates that fit always gave `answer + d1`, `answer - d1`,
    // `answer + d2` -- one below the answer and two above, in **100% of questions
    // in the game**. Tapping the second-smallest of the four buttons therefore won
    // every question without doing any arithmetic.
    //
    // `puts the answer in more than one position across seeds` did not see it,
    // because `rng.shuffle` changes where a choice sits on screen but not how the
    // four values sort. This asserts on the sorted rank instead.
    const counts = [0, 0, 0, 0]
    const draws = 3000
    for (let seed = 0; seed < draws; seed += 1) {
      const question = generate(forms, createRng(`rank-${label}-${seed}`))
      counts[question.choices.filter((choice) => choice < question.answer).length] += 1
    }
    // Loose on purpose: the point is that no single rank is a winning strategy,
    // not that the split is exactly even. A perfect generator sits at 25% each;
    // the old one sat at 100% on rank 1.
    for (const share of counts) {
      expect(share / draws).toBeGreaterThan(0.1)
      expect(share / draws).toBeLessThan(0.45)
    }
  })

  it("splits a carrying sum's tens evenly between the two operands", () => {
    // `_add` used to cap the first operand's tens at half the available room and
    // give the second whatever was left, so every bit of spare magnitude landed
    // in the second slot: `{max: 200, borrow: true}` produced `5 + 195`. The sum
    // was in range, so the bound tests passed and nothing noticed the shape.
    // Both branches: the carrying one and the plain-sum fallback. The fallback had
    // the same flaw for longer -- `a` uniform and `b` given the remainder put the
    // big number first, with medians of 50 and 19 at `max: 100`.
    for (const borrow of [true, false]) {
      for (const max of [100, 200, 1000]) {
        let firstLarger = 0
        const draws = 4000
        for (let seed = 0; seed < draws; seed += 1) {
          const [a, b] = operands(
            generate([{ kind: "add", max, borrow }], createRng(`bal-${borrow}-${max}-${seed}`))
              .prompt,
          )
          if (a > b) firstLarger += 1
        }
        // Neither slot should be the big one much more often than the other. The
        // old splits sat near 0.06 and near 0.95; a fair one sits near 0.5.
        expect(firstLarger / draws).toBeGreaterThan(0.4)
        expect(firstLarger / draws).toBeLessThan(0.6)
      }
    }
  })
})
