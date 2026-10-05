import { describe, test, expect } from "@jest/globals"
import { createChallenge } from "../js/modes/quickRecall.js"
import { FACTS, getFact } from "../js/facts.js"
import { MODE_IDS } from "../js/constants.js"

/** The multiplication sign the prompt must use, U+00D7 -- never the letter "x". */
const TIMES_SIGN = "×"

/** `6x7`, the spec's worked example throughout. */
const SIX_BY_SEVEN = getFact("6x7")

/**
 * An rng that always returns `value`, counting its calls so the documented
 * consumption contract can be asserted.
 * @param {number} value - The constant value to return
 * @returns {(() => number) & {calls: number}} The rng, with a `calls` counter
 */
function countingRng(value) {
  const rng = () => {
    rng.calls += 1
    return value
  }
  rng.calls = 0
  return rng
}

/**
 * An rng that replays `values` in order and throws once exhausted, so an
 * unexpected extra call fails loudly instead of silently reusing a value.
 * @param {number[]} values - The sequence to return
 * @returns {(() => number) & {calls: number}} The rng, with a `calls` counter
 */
function scriptedRng(values) {
  const rng = () => {
    if (rng.calls >= values.length) throw new Error("rng exhausted")
    const value = values[rng.calls]
    rng.calls += 1
    return value
  }
  rng.calls = 0
  return rng
}

/** RNG calls a challenge consumes: the orientation roll and nothing else. */
const RNG_CALLS = 1

describe("quickRecall", () => {
  describe("createChallenge shape", () => {
    test("returns every documented Challenge field with the right type", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0.3)

      expect(Object.keys(challenge).sort()).toEqual([
        "answer",
        "check",
        "factId",
        "left",
        "modeId",
        "prompt",
        "right",
        "scaffold",
        "visual",
      ])
      expect(typeof challenge.modeId).toBe("string")
      expect(typeof challenge.factId).toBe("string")
      expect(typeof challenge.left).toBe("number")
      expect(typeof challenge.right).toBe("number")
      expect(typeof challenge.answer).toBe("number")
      expect(typeof challenge.prompt).toBe("string")
      expect(typeof challenge.visual).toBe("object")
      expect(typeof challenge.check).toBe("function")
      expect(typeof challenge.scaffold).toBe("object")
    })

    test("identifies the mode and the fact", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0.3)

      expect(challenge.modeId).toBe(MODE_IDS.QUICK_RECALL)
      expect(challenge.modeId).toBe("quick-recall")
      expect(challenge.factId).toBe("6x7")
      expect(challenge.answer).toBe(42)
      expect(challenge.left * challenge.right).toBe(challenge.answer)
    })

    test("prompt uses U+00D7 and not the letter x", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

      expect(challenge.prompt).toBe(`6 ${TIMES_SIGN} 7 = ?`)
      expect(challenge.prompt).toMatch(/^\d+ × \d+ = \?$/)
      expect(challenge.prompt).not.toContain("x")
      expect(challenge.prompt).not.toContain("X")
      expect(challenge.prompt.codePointAt(2)).toBe(0x00d7)
    })

    test("visual is plain expression data, never a DOM node", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0.9)

      expect(challenge.visual).toEqual({ kind: "expression", left: 7, right: 6 })
      expect(challenge.visual.left).toBe(challenge.left)
      expect(challenge.visual.right).toBe(challenge.right)
      expect(challenge.visual.nodeType).toBeUndefined()
    })

    test("returns fresh objects on every call, sharing nothing", () => {
      const first = createChallenge(SIX_BY_SEVEN, {}, () => 0.3)
      const second = createChallenge(SIX_BY_SEVEN, {}, () => 0.3)

      expect(first).not.toBe(second)
      expect(first.scaffold).not.toBe(second.scaffold)
      expect(first.visual).not.toBe(second.visual)
      expect(first.scaffold.skipCounts).not.toBe(second.scaffold.skipCounts)
    })

    test("does not mutate the fact it is given", () => {
      const before = { ...SIX_BY_SEVEN }
      createChallenge(SIX_BY_SEVEN, {}, () => 0.3)

      expect({ ...SIX_BY_SEVEN }).toEqual(before)
    })

    test("does not mutate the challenge context it is given", () => {
      const context = { strength: 3 }
      createChallenge(SIX_BY_SEVEN, context, () => 0)

      expect(context).toEqual({ strength: 3 })
    })

    test("touches no DOM over repeated calls", () => {
      document.body.innerHTML = "<p>untouched</p>"
      for (let i = 0; i < 10; i += 1) {
        createChallenge(FACTS[i], {}, () => 0.3)
      }

      expect(document.body.innerHTML).toBe("<p>untouched</p>")
    })

    test("throws TypeError for anything that is not a Fact", () => {
      for (const bad of [null, undefined, {}, "6x7", 42, [], { a: 6, b: 7 }]) {
        expect(() => createChallenge(bad, {}, () => 0)).toThrow(TypeError)
        expect(() => createChallenge(bad, {}, () => 0)).toThrow("createChallenge requires a Fact")
      }
    })
  })

  describe("createChallenge orientation", () => {
    test("rng below 0.5 shows the smaller operand first", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

      expect(challenge.left).toBe(SIX_BY_SEVEN.a)
      expect(challenge.right).toBe(SIX_BY_SEVEN.b)
      expect(challenge.prompt).toBe(`6 ${TIMES_SIGN} 7 = ?`)
    })

    test("rng at or above 0.5 shows the larger operand first", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0.9)

      expect(challenge.left).toBe(SIX_BY_SEVEN.b)
      expect(challenge.right).toBe(SIX_BY_SEVEN.a)
      expect(challenge.prompt).toBe(`7 ${TIMES_SIGN} 6 = ?`)
    })

    test("the 0.5 boundary flips the orientation", () => {
      const low = createChallenge(SIX_BY_SEVEN, {}, () => 0.4999)
      const high = createChallenge(SIX_BY_SEVEN, {}, () => 0.5)

      expect(low.left).toBe(6)
      expect(high.left).toBe(7)
    })

    test("a square reads the same either way", () => {
      for (const roll of [0, 0.9]) {
        const challenge = createChallenge(getFact("7x7"), {}, () => roll)

        expect(challenge.left).toBe(7)
        expect(challenge.right).toBe(7)
        expect(challenge.prompt).toBe(`7 ${TIMES_SIGN} 7 = ?`)
      }
    })

    test("the prompt always matches the orientation the rng chose", () => {
      for (const fact of FACTS) {
        for (const roll of [0, 0.25, 0.5, 0.999]) {
          const challenge = createChallenge(fact, {}, () => roll)
          const expectedLeft = fact.isSquare || roll < 0.5 ? fact.a : fact.b
          const expectedRight = fact.isSquare || roll < 0.5 ? fact.b : fact.a

          expect(challenge.left).toBe(expectedLeft)
          expect(challenge.right).toBe(expectedRight)
          expect(challenge.prompt).toBe(`${expectedLeft} ${TIMES_SIGN} ${expectedRight} = ?`)
          // The orientation roll moves the prompt and NOT the scaffold: the
          // teaching array is always min(a, b) rows.
          expect(challenge.scaffold.rows).toBe(Math.min(fact.a, fact.b))
          expect(challenge.scaffold.cols).toBe(Math.max(fact.a, fact.b))
        }
      }
    })
  })

  describe("createChallenge rng consumption", () => {
    test("consumes exactly 1 call, the orientation roll", () => {
      const rng = countingRng(0.3)
      createChallenge(SIX_BY_SEVEN, {}, rng)

      expect(rng.calls).toBe(RNG_CALLS)
    })

    test("the count holds for every fact", () => {
      for (const fact of FACTS) {
        const rng = countingRng(0.3)
        createChallenge(fact, {}, rng)
        expect(rng.calls).toBe(RNG_CALLS)
      }
    })

    test("the orientation roll is the first call", () => {
      const rng = scriptedRng([0.9])
      const challenge = createChallenge(SIX_BY_SEVEN, {}, rng)

      expect(challenge.left).toBe(7)
      expect(rng.calls).toBe(RNG_CALLS)
    })

    test("a missing or non-function rng falls back to Math.random without throwing", () => {
      for (const rng of [undefined, null, 0.5, "random", {}]) {
        const challenge = createChallenge(SIX_BY_SEVEN, {}, rng)

        expect([6, 7]).toContain(challenge.left)
      }
    })
  })

  describe("check", () => {
    const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

    test("accepts the correct number", () => {
      expect(challenge.check(42)).toBe(true)
    })

    test("accepts the correct answer as a string, as a raw-digit entry path would send it", () => {
      expect(challenge.check("42")).toBe(true)
    })

    test("accepts a correct-but-float number, since 42.0 is 42", () => {
      expect(challenge.check(42.0)).toBe(true)
      expect(challenge.check(84 / 2)).toBe(true)
    })

    test("accepts a string padded with whitespace", () => {
      expect(challenge.check(" 42 ")).toBe(true)
      expect(challenge.check("\t42\n")).toBe(true)
    })

    test('accepts "042": the comparison is numeric, not textual', () => {
      expect(challenge.check("042")).toBe(true)
      expect(challenge.check("0042")).toBe(true)
    })

    test("rejects a wrong number", () => {
      expect(challenge.check(41)).toBe(false)
      expect(challenge.check(43)).toBe(false)
      expect(challenge.check(24)).toBe(false)
      expect(challenge.check(0)).toBe(false)
      expect(challenge.check(-42)).toBe(false)
    })

    test("rejects a near-miss float", () => {
      expect(challenge.check(41.5)).toBe(false)
      expect(challenge.check(42.0001)).toBe(false)
    })

    test("rejects a wrong string", () => {
      expect(challenge.check("41")).toBe(false)
      expect(challenge.check("420")).toBe(false)
      expect(challenge.check("4")).toBe(false)
    })

    test("rejects the empty string and whitespace only", () => {
      expect(challenge.check("")).toBe(false)
      expect(challenge.check("   ")).toBe(false)
      expect(challenge.check("\n")).toBe(false)
    })

    test("rejects null and undefined", () => {
      expect(challenge.check(null)).toBe(false)
      expect(challenge.check(undefined)).toBe(false)
      expect(challenge.check()).toBe(false)
    })

    test("rejects a non-numeric string", () => {
      for (const input of ["x", "42abc", "abc", "4 2", "+42", "42.0", "4e1", "0x2a", "٤٢"]) {
        expect(challenge.check(input)).toBe(false)
      }
    })

    test("rejects non-finite numbers", () => {
      expect(challenge.check(NaN)).toBe(false)
      expect(challenge.check(Infinity)).toBe(false)
      expect(challenge.check(-Infinity)).toBe(false)
    })

    test("rejects every other type, with no truthiness anywhere", () => {
      for (const input of [true, false, {}, [], [42], { value: 42 }, () => 42, Symbol("42")]) {
        expect(challenge.check(input)).toBe(false)
      }
    })

    test("is the single authority: it agrees with the answer for every fact", () => {
      for (const fact of FACTS) {
        const current = createChallenge(fact, {}, () => 0.3)

        expect(current.check(current.answer)).toBe(true)
        expect(current.check(String(current.answer))).toBe(true)
        expect(current.check(` ${current.answer} `)).toBe(true)
        expect(current.check(current.answer + 1)).toBe(false)
        expect(current.check(String(current.answer + 1))).toBe(false)
        expect(current.check(null)).toBe(false)
        expect(current.check("")).toBe(false)
      }
    })
  })

  describe("scaffold", () => {
    test("6 x 7 skip-counts by sevens up to 42", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

      expect(challenge.scaffold).toEqual({
        rows: 6,
        cols: 7,
        product: 42,
        skipCounts: [7, 14, 21, 28, 35, 42],
        text: "6 rows of 7 makes 42",
      })
    })

    test("the flipped orientation teaches the SAME array, not nine rows of two", () => {
      // The scaffold's length and quality used to be a coin flip: shown as 7 x 6
      // the same fact produced 7 rows, the sentence "7 rows of 6 makes 42", and
      // a 4550 ms wait instead of a 4100 ms one. Now the display orientation
      // cannot reach the scaffold at all.
      const flipped = createChallenge(SIX_BY_SEVEN, {}, () => 0.9)
      const straight = createChallenge(SIX_BY_SEVEN, {}, () => 0)

      expect(flipped.left).toBe(7)
      expect(flipped.right).toBe(6)
      expect(flipped.scaffold).toEqual(straight.scaffold)
      expect(flipped.scaffold.rows).toBe(6)
      expect(flipped.scaffold.cols).toBe(7)
      expect(flipped.scaffold.text).toBe("6 rows of 7 makes 42")
    })

    test("2 x 9 and 9 x 2 both teach the two-row array", () => {
      // The worked example from the review: a 9-row array with a 5450 ms display
      // is both the worse explanation and the longer wait.
      const twoByNine = FACTS.find((fact) => fact.id === "2x9")
      for (const roll of [0, 0.9]) {
        const { scaffold } = createChallenge(twoByNine, {}, () => roll)
        expect(scaffold.rows).toBe(2)
        expect(scaffold.cols).toBe(9)
        expect(scaffold.skipCounts).toEqual([9, 18])
        expect(scaffold.text).toBe("2 rows of 9 makes 18")
      }
    })

    test("holds its shape for every fact and orientation", () => {
      for (const fact of FACTS) {
        for (const roll of [0, 0.9]) {
          const { scaffold, answer } = createChallenge(fact, {}, () => roll)

          expect(Object.keys(scaffold).sort()).toEqual([
            "cols",
            "product",
            "rows",
            "skipCounts",
            "text",
          ])
          expect(scaffold.rows).toBe(Math.min(fact.a, fact.b))
          expect(scaffold.cols).toBe(Math.max(fact.a, fact.b))
          expect(scaffold.rows).toBeLessThanOrEqual(scaffold.cols)
          expect(scaffold.product).toBe(answer)
          expect(scaffold.skipCounts).toHaveLength(scaffold.rows)
          expect(scaffold.skipCounts.at(-1)).toBe(answer)
          expect(scaffold.skipCounts[0]).toBe(scaffold.cols)
          for (const [index, value] of scaffold.skipCounts.entries()) {
            expect(value).toBe((index + 1) * scaffold.cols)
            expect(value % scaffold.cols).toBe(0)
          }
          expect(scaffold.text).toBe(
            `${scaffold.rows} rows of ${scaffold.cols} makes ${scaffold.product}`,
          )
        }
      }
    })
  })

  describe("all 36 facts", () => {
    test.each(FACTS.map((fact) => [fact.id, fact]))(
      "%s produces a complete, valid challenge",
      (id, fact) => {
        const challenge = createChallenge(fact, {}, () => 0.3)

        expect(challenge.modeId).toBe(MODE_IDS.QUICK_RECALL)
        expect(challenge.factId).toBe(id)
        expect(challenge.answer).toBe(fact.product)
        expect(challenge.left * challenge.right).toBe(challenge.answer)
        expect([fact.a, fact.b]).toContain(challenge.left)
        expect([fact.a, fact.b]).toContain(challenge.right)
        expect(challenge.prompt).toBe(`${challenge.left} ${TIMES_SIGN} ${challenge.right} = ?`)
        expect(challenge.visual).toEqual({
          kind: "expression",
          left: challenge.left,
          right: challenge.right,
        })

        expect(challenge.check(challenge.answer)).toBe(true)
        expect(challenge.check(String(challenge.answer))).toBe(true)
        expect(challenge.check(challenge.answer + 1)).toBe(false)

        expect(challenge.scaffold.rows).toBe(Math.min(fact.a, fact.b))
        expect(challenge.scaffold.cols).toBe(Math.max(fact.a, fact.b))
        expect(challenge.scaffold.skipCounts).toHaveLength(Math.min(fact.a, fact.b))
        expect(challenge.scaffold.skipCounts.at(-1)).toBe(challenge.answer)
      },
    )
  })
})
