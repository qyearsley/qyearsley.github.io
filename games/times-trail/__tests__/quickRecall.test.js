import { describe, test, expect } from "@jest/globals"
import { createChallenge } from "../js/modes/quickRecall.js"
import { FACTS, getFact } from "../js/facts.js"
import { nearMissCandidates } from "../js/distractors.js"
import { DISTRACTORS, INPUT_MODE, MODE_IDS, STRENGTH } from "../js/constants.js"

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

/** A challenge context that forces the tiles path. */
const TILES_CONTEXT = { strength: 0, inputModeFor: () => INPUT_MODE.TILES }

/** A challenge context that forces the keypad path. */
const KEYPAD_CONTEXT = { strength: 5, inputModeFor: () => INPUT_MODE.KEYPAD }

/** RNG calls a tiles challenge consumes: 1 orientation + 8 inside generateOptions. */
const TILES_RNG_CALLS = 9

/** RNG calls a keypad challenge consumes: the orientation roll and nothing else. */
const KEYPAD_RNG_CALLS = 1

describe("quickRecall", () => {
  describe("createChallenge shape", () => {
    test("returns every documented Challenge field with the right type", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, () => 0.3)

      expect(Object.keys(challenge).sort()).toEqual([
        "answer",
        "check",
        "entry",
        "factId",
        "left",
        "modeId",
        "options",
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
      expect(typeof challenge.entry).toBe("string")
      expect(Array.isArray(challenge.options)).toBe(true)
      expect(typeof challenge.visual).toBe("object")
      expect(typeof challenge.check).toBe("function")
      expect(typeof challenge.scaffold).toBe("object")
    })

    test("identifies the mode and the fact", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, () => 0.3)

      expect(challenge.modeId).toBe(MODE_IDS.QUICK_RECALL)
      expect(challenge.modeId).toBe("quick-recall")
      expect(challenge.factId).toBe("6x7")
      expect(challenge.answer).toBe(42)
      expect(challenge.left * challenge.right).toBe(challenge.answer)
    })

    test("prompt uses U+00D7 and not the letter x", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0)

      expect(challenge.prompt).toBe(`6 ${TIMES_SIGN} 7 = ?`)
      expect(challenge.prompt).toMatch(/^\d+ × \d+ = \?$/)
      expect(challenge.prompt).not.toContain("x")
      expect(challenge.prompt).not.toContain("X")
      expect(challenge.prompt.codePointAt(2)).toBe(0x00d7)
    })

    test("visual is plain expression data, never a DOM node", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0.9)

      expect(challenge.visual).toEqual({ kind: "expression", left: 7, right: 6 })
      expect(challenge.visual.left).toBe(challenge.left)
      expect(challenge.visual.right).toBe(challenge.right)
      expect(challenge.visual.nodeType).toBeUndefined()
    })

    test("returns fresh objects on every call, sharing nothing", () => {
      const first = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, () => 0.3)
      const second = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, () => 0.3)

      expect(first).not.toBe(second)
      expect(first.options).not.toBe(second.options)
      expect(first.scaffold).not.toBe(second.scaffold)
      expect(first.visual).not.toBe(second.visual)
      expect(first.scaffold.skipCounts).not.toBe(second.scaffold.skipCounts)
    })

    test("does not mutate the fact it is given", () => {
      const before = { ...SIX_BY_SEVEN }
      createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, () => 0.3)

      expect({ ...SIX_BY_SEVEN }).toEqual(before)
    })

    test("does not mutate the challenge context it is given", () => {
      const context = { strength: 3, inputModeFor: () => INPUT_MODE.KEYPAD }
      createChallenge(SIX_BY_SEVEN, context, () => 0)

      expect(Object.keys(context).sort()).toEqual(["inputModeFor", "strength"])
      expect(context.strength).toBe(3)
    })

    test("touches no DOM over repeated calls", () => {
      document.body.innerHTML = "<p>untouched</p>"
      for (let i = 0; i < 10; i += 1) {
        createChallenge(FACTS[i], TILES_CONTEXT, () => 0.3)
      }

      expect(document.body.innerHTML).toBe("<p>untouched</p>")
    })

    test("throws TypeError for anything that is not a Fact", () => {
      for (const bad of [null, undefined, {}, "6x7", 42, [], { a: 6, b: 7 }]) {
        expect(() => createChallenge(bad, TILES_CONTEXT, () => 0)).toThrow(TypeError)
        expect(() => createChallenge(bad, TILES_CONTEXT, () => 0)).toThrow(
          "createChallenge requires a Fact",
        )
      }
    })
  })

  describe("createChallenge orientation", () => {
    test("rng below 0.5 shows the smaller operand first", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0)

      expect(challenge.left).toBe(SIX_BY_SEVEN.a)
      expect(challenge.right).toBe(SIX_BY_SEVEN.b)
      expect(challenge.prompt).toBe(`6 ${TIMES_SIGN} 7 = ?`)
    })

    test("rng at or above 0.5 shows the larger operand first", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0.9)

      expect(challenge.left).toBe(SIX_BY_SEVEN.b)
      expect(challenge.right).toBe(SIX_BY_SEVEN.a)
      expect(challenge.prompt).toBe(`7 ${TIMES_SIGN} 6 = ?`)
    })

    test("the 0.5 boundary flips the orientation", () => {
      const low = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0.4999)
      const high = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0.5)

      expect(low.left).toBe(6)
      expect(high.left).toBe(7)
    })

    test("a square reads the same either way", () => {
      for (const roll of [0, 0.9]) {
        const challenge = createChallenge(getFact("7x7"), KEYPAD_CONTEXT, () => roll)

        expect(challenge.left).toBe(7)
        expect(challenge.right).toBe(7)
        expect(challenge.prompt).toBe(`7 ${TIMES_SIGN} 7 = ?`)
      }
    })

    test("the prompt always matches the orientation the rng chose", () => {
      for (const fact of FACTS) {
        for (const roll of [0, 0.25, 0.5, 0.999]) {
          const challenge = createChallenge(fact, KEYPAD_CONTEXT, () => roll)
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

  describe("createChallenge entry mode", () => {
    test("the tiles path yields four distinct near-miss options including the answer", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, () => 0.3)

      expect(challenge.entry).toBe(INPUT_MODE.TILES)
      expect(challenge.entry).toBe("tiles")
      expect(challenge.options).toHaveLength(DISTRACTORS.OPTION_COUNT)
      expect(new Set(challenge.options).size).toBe(DISTRACTORS.OPTION_COUNT)
      expect(challenge.options).toContain(42)
      expect(challenge.options.filter((value) => value === 42)).toHaveLength(1)
    })

    test("the keypad path yields no options", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0.3)

      expect(challenge.entry).toBe(INPUT_MODE.KEYPAD)
      expect(challenge.entry).toBe("keypad")
      expect(challenge.options).toBeNull()
    })

    test("entry comes from the context's policy, which is passed the clamped strength", () => {
      const seen = []
      const context = {
        strength: 4,
        inputModeFor: (strength) => {
          seen.push(strength)
          return strength >= 3 ? INPUT_MODE.KEYPAD : INPUT_MODE.TILES
        },
      }
      const challenge = createChallenge(SIX_BY_SEVEN, context, () => 0)

      expect(seen).toEqual([4])
      expect(challenge.entry).toBe(INPUT_MODE.KEYPAD)
    })

    test("strength is rounded and clamped into [MIN, MAX] before the policy sees it", () => {
      const cases = [
        [-7, STRENGTH.MIN],
        [0, 0],
        [3.4, 3],
        [3.6, 4],
        [99, STRENGTH.MAX],
        [undefined, STRENGTH.MIN],
        [null, STRENGTH.MIN],
        ["4", STRENGTH.MIN],
        [NaN, STRENGTH.MIN],
        [Infinity, STRENGTH.MIN],
      ]
      for (const [raw, expected] of cases) {
        const seen = []
        createChallenge(
          SIX_BY_SEVEN,
          {
            strength: raw,
            inputModeFor: (strength) => {
              seen.push(strength)
              return INPUT_MODE.TILES
            },
          },
          () => 0,
        )

        expect(seen).toEqual([expected])
      }
    })

    test("no settings at all falls back to tiles and strength 0", () => {
      const challenge = createChallenge(SIX_BY_SEVEN)

      expect(challenge.entry).toBe(INPUT_MODE.TILES)
      expect(challenge.options).toHaveLength(DISTRACTORS.OPTION_COUNT)
      expect(challenge.options).toContain(42)
    })

    test("a context with no policy, or a junk context, still yields tiles", () => {
      for (const context of [{}, null, undefined, 42, "settings", [], { strength: 5 }]) {
        const challenge = createChallenge(SIX_BY_SEVEN, context, () => 0.3)

        expect(challenge.entry).toBe(INPUT_MODE.TILES)
        expect(challenge.options).toContain(42)
      }
    })

    test("a policy returning something unrecognised falls back to tiles", () => {
      for (const returned of ["grid", "TILES", "", null, undefined, 1, {}]) {
        const challenge = createChallenge(
          SIX_BY_SEVEN,
          { strength: 5, inputModeFor: () => returned },
          () => 0.3,
        )

        expect(challenge.entry).toBe(INPUT_MODE.TILES)
        expect(challenge.options).toHaveLength(DISTRACTORS.OPTION_COUNT)
      }
    })

    test("options are non-null exactly when entry is tiles", () => {
      for (const fact of FACTS) {
        for (const context of [TILES_CONTEXT, KEYPAD_CONTEXT, {}]) {
          const challenge = createChallenge(fact, context, () => 0.3)

          expect(challenge.options === null).toBe(challenge.entry !== INPUT_MODE.TILES)
        }
      }
    })
  })

  describe("createChallenge rng consumption", () => {
    test("the tiles path consumes exactly 9 calls", () => {
      const rng = countingRng(0.3)
      createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, rng)

      expect(rng.calls).toBe(TILES_RNG_CALLS)
    })

    test("the keypad path consumes exactly 1 call", () => {
      const rng = countingRng(0.3)
      createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, rng)

      expect(rng.calls).toBe(KEYPAD_RNG_CALLS)
    })

    test("the counts hold for every fact, including the tightest option supply", () => {
      for (const fact of FACTS) {
        const tiles = countingRng(0.3)
        createChallenge(fact, TILES_CONTEXT, tiles)
        expect(tiles.calls).toBe(TILES_RNG_CALLS)

        const keypad = countingRng(0.3)
        createChallenge(fact, KEYPAD_CONTEXT, keypad)
        expect(keypad.calls).toBe(KEYPAD_RNG_CALLS)
      }
    })

    test("the orientation roll is the first call, before any option shuffling", () => {
      const rng = scriptedRng([0.9, 0, 0, 0, 0, 0, 0, 0, 0])
      const challenge = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, rng)

      expect(challenge.left).toBe(7)
      expect(rng.calls).toBe(TILES_RNG_CALLS)
    })

    test("a scripted rng makes the whole challenge reproducible", () => {
      const sequence = [0.1, 0.2, 0.9, 0.4, 0.5, 0.6, 0.7, 0.8, 0.05]
      const first = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, scriptedRng(sequence))
      const second = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, scriptedRng(sequence))

      expect(first.options).toEqual(second.options)
      expect(first.prompt).toBe(second.prompt)
    })

    test("a missing or non-function rng falls back to Math.random without throwing", () => {
      for (const rng of [undefined, null, 0.5, "random", {}]) {
        const challenge = createChallenge(SIX_BY_SEVEN, TILES_CONTEXT, rng)

        expect(challenge.options).toHaveLength(DISTRACTORS.OPTION_COUNT)
        expect(challenge.options).toContain(42)
        expect([6, 7]).toContain(challenge.left)
      }
    })
  })

  describe("check", () => {
    const challenge = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0)

    test("accepts the correct number", () => {
      expect(challenge.check(42)).toBe(true)
    })

    test("accepts the correct answer as a string, as a tile or keypad would send it", () => {
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

    test("is the single authority: it agrees with the answer for every fact and both paths", () => {
      for (const fact of FACTS) {
        for (const context of [TILES_CONTEXT, KEYPAD_CONTEXT]) {
          const current = createChallenge(fact, context, () => 0.3)

          expect(current.check(current.answer)).toBe(true)
          expect(current.check(String(current.answer))).toBe(true)
          expect(current.check(` ${current.answer} `)).toBe(true)
          expect(current.check(current.answer + 1)).toBe(false)
          expect(current.check(String(current.answer + 1))).toBe(false)
          expect(current.check(null)).toBe(false)
          expect(current.check("")).toBe(false)
        }
      }
    })

    test("rejects every wrong tile on the tiles path", () => {
      for (const fact of FACTS) {
        const current = createChallenge(fact, TILES_CONTEXT, () => 0.3)
        const accepted = current.options.filter((option) => current.check(option))

        expect(accepted).toEqual([fact.product])
      }
    })
  })

  describe("scaffold", () => {
    test("6 x 7 skip-counts by sevens up to 42", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0)

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
      const flipped = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0.9)
      const straight = createChallenge(SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0)

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
        const { scaffold } = createChallenge(twoByNine, KEYPAD_CONTEXT, () => roll)
        expect(scaffold.rows).toBe(2)
        expect(scaffold.cols).toBe(9)
        expect(scaffold.skipCounts).toEqual([9, 18])
        expect(scaffold.text).toBe("2 rows of 9 makes 18")
      }
    })

    test("holds its shape for every fact and orientation", () => {
      for (const fact of FACTS) {
        for (const roll of [0, 0.9]) {
          const { scaffold, answer } = createChallenge(fact, KEYPAD_CONTEXT, () => roll)

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
        const challenge = createChallenge(fact, TILES_CONTEXT, () => 0.3)

        expect(challenge.modeId).toBe(MODE_IDS.QUICK_RECALL)
        expect(challenge.factId).toBe(id)
        expect(challenge.answer).toBe(fact.product)
        expect(challenge.left * challenge.right).toBe(challenge.answer)
        expect([fact.a, fact.b]).toContain(challenge.left)
        expect([fact.a, fact.b]).toContain(challenge.right)
        expect(challenge.prompt).toBe(`${challenge.left} ${TIMES_SIGN} ${challenge.right} = ?`)
        expect(challenge.entry).toBe(INPUT_MODE.TILES)
        expect(challenge.visual).toEqual({
          kind: "expression",
          left: challenge.left,
          right: challenge.right,
        })

        expect(challenge.options).toHaveLength(DISTRACTORS.OPTION_COUNT)
        expect(new Set(challenge.options).size).toBe(DISTRACTORS.OPTION_COUNT)
        expect(challenge.options).toContain(challenge.answer)
        for (const option of challenge.options) {
          expect(Number.isInteger(option)).toBe(true)
          expect(option).toBeGreaterThan(0)
        }
        const nearMisses = nearMissCandidates(fact)
        for (const option of challenge.options.filter((value) => value !== challenge.answer)) {
          expect(nearMisses).toContain(option)
        }

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
