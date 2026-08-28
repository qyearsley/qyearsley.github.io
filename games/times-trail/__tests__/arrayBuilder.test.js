import { describe, test, expect } from "@jest/globals"
import { createChallenge, stepDimension } from "../js/modes/arrayBuilder.js"
import { createChallenge as createQuickRecallChallenge } from "../js/modes/quickRecall.js"
import { FACTS, getFact } from "../js/facts.js"
import { INPUT_MODE, MODE_IDS, OPERAND_MAX } from "../js/constants.js"

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

/** The fact used by most of the single-case assertions: 6 x 7 = 42. */
const SIX_BY_SEVEN = getFact("6x7")

/** Every legal dimension, 1..9. */
const DIMENSIONS = Array.from({ length: OPERAND_MAX }, (_, index) => index + 1)

describe("arrayBuilder", () => {
  describe("createChallenge", () => {
    test("returns every documented Challenge field with the right types", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

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
      expect(challenge.modeId).toBe(MODE_IDS.ARRAY_BUILDER)
      expect(challenge.modeId).toBe("array-builder")
      expect(challenge.factId).toBe("6x7")
      expect(challenge.answer).toBe(42)
      expect(challenge.left * challenge.right).toBe(challenge.answer)
      expect(challenge.entry).toBe(INPUT_MODE.GRID)
      expect(challenge.entry).toBe("grid")
      expect(challenge.options).toBeNull()
      expect(challenge.prompt).toBe("Build a rectangle with 42 squares")
      expect(typeof challenge.check).toBe("function")
    })

    test("describes the grid as plain data in visual", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

      expect(challenge.visual).toEqual({
        kind: "array-builder",
        targetProduct: 42,
        startRows: 1,
        startCols: 1,
        maxRows: 9,
        maxCols: 9,
        hintRows: 6,
        hintCols: 7,
      })
      expect(challenge.visual.maxRows).toBe(OPERAND_MAX)
      expect(challenge.visual.maxCols).toBe(OPERAND_MAX)
      expect(challenge.visual.hintRows * challenge.visual.hintCols).toBe(challenge.answer)
    })

    test("builds the shared scaffold from min(a, b) rows, not the displayed orientation", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

      expect(challenge.scaffold.rows).toBe(6)
      expect(challenge.scaffold.cols).toBe(7)
      expect(challenge.scaffold.product).toBe(42)
      expect(challenge.scaffold.skipCounts).toEqual([7, 14, 21, 28, 35, 42])
      expect(challenge.scaffold.text).toBe("6 rows of 7 makes 42")
    })

    test("the orientation roll cannot reach the scaffold", () => {
      // Same fact, both display orientations, one scaffold. Building it from the
      // displayed order made the explanation and the wait a coin flip.
      const straight = createChallenge(SIX_BY_SEVEN, {}, () => 0)
      const flipped = createChallenge(SIX_BY_SEVEN, {}, () => 0.9)

      expect(flipped.left).toBe(7)
      expect(flipped.right).toBe(6)
      expect(flipped.scaffold).toEqual(straight.scaffold)
    })

    test("matches Quick Recall's scaffold for the same fact, exactly", () => {
      // Both modes go through modes/shared.js, which is the point of the helper:
      // a miss teaches the identical array whichever mode she was playing.
      for (const roll of [0, 0.9]) {
        expect(createChallenge(SIX_BY_SEVEN, {}, () => roll).scaffold).toEqual(
          createQuickRecallChallenge(SIX_BY_SEVEN, {}, () => roll).scaffold,
        )
      }
    })

    test("consumes exactly one rng call", () => {
      const rng = countingRng(0.3)
      createChallenge(SIX_BY_SEVEN, {}, rng)

      expect(rng.calls).toBe(1)
    })

    test("consumes exactly one rng call for a square too", () => {
      const rng = countingRng(0.9)
      createChallenge(getFact("7x7"), {}, rng)

      expect(rng.calls).toBe(1)
    })

    test("draws the displayed orientation from the rng", () => {
      const aFirst = createChallenge(SIX_BY_SEVEN, {}, () => 0)
      const bFirst = createChallenge(SIX_BY_SEVEN, {}, () => 0.9)

      expect([aFirst.left, aFirst.right]).toEqual([6, 7])
      expect([bFirst.left, bFirst.right]).toEqual([7, 6])
    })

    test("uses the grid entry whatever the settings context says", () => {
      const keypadContext = { strength: 5, inputModeFor: () => INPUT_MODE.KEYPAD }
      const tilesContext = { strength: 0, inputModeFor: () => INPUT_MODE.TILES }

      expect(createChallenge(SIX_BY_SEVEN, keypadContext, () => 0).entry).toBe(INPUT_MODE.GRID)
      expect(createChallenge(SIX_BY_SEVEN, tilesContext, () => 0).entry).toBe(INPUT_MODE.GRID)
    })

    test("works with no settings and no rng argument", () => {
      const challenge = createChallenge(SIX_BY_SEVEN)

      expect(challenge.entry).toBe(INPUT_MODE.GRID)
      expect(challenge.answer).toBe(42)
    })

    test("does not mutate the fact or the settings context", () => {
      const settings = { strength: 3 }
      createChallenge(SIX_BY_SEVEN, settings, () => 0)

      expect(settings).toEqual({ strength: 3 })
      expect(SIX_BY_SEVEN).toEqual(getFact("6x7"))
    })

    test("returns a fresh visual and scaffold on every call", () => {
      const first = createChallenge(SIX_BY_SEVEN, {}, () => 0)
      const second = createChallenge(SIX_BY_SEVEN, {}, () => 0)

      expect(first.visual).not.toBe(second.visual)
      expect(first.scaffold).not.toBe(second.scaffold)
      expect(first.scaffold.skipCounts).not.toBe(second.scaffold.skipCounts)
    })

    test("throws TypeError for anything that is not a Fact", () => {
      expect(() => createChallenge(null)).toThrow(TypeError)
      expect(() => createChallenge(undefined)).toThrow(TypeError)
      expect(() => createChallenge({})).toThrow(TypeError)
      expect(() => createChallenge("6x7")).toThrow(TypeError)
      expect(() => createChallenge(42)).toThrow(TypeError)
      expect(() => createChallenge({ id: "6x7", a: 6, b: 7 })).toThrow(TypeError)
      expect(() => createChallenge(null)).toThrow("createChallenge requires a Fact")
    })

    test("touches no DOM", () => {
      document.body.innerHTML = '<div id="sentinel">untouched</div>'
      for (let i = 0; i < 10; i += 1) {
        const challenge = createChallenge(FACTS[i], {}, () => i / 10)
        challenge.check({ rows: 1, cols: 1 })
      }

      expect(document.body.innerHTML).toBe('<div id="sentinel">untouched</div>')
    })

    test.each(FACTS.map((fact) => [fact.id, fact]))(
      "%s produces a well-formed challenge whose target is reachable in range",
      (_id, fact) => {
        const challenge = createChallenge(fact, {}, () => 0.3)

        expect(challenge.modeId).toBe(MODE_IDS.ARRAY_BUILDER)
        expect(challenge.factId).toBe(fact.id)
        expect(challenge.answer).toBe(fact.product)
        expect(challenge.left * challenge.right).toBe(challenge.answer)
        expect(challenge.entry).toBe(INPUT_MODE.GRID)
        expect(challenge.options).toBeNull()
        expect(challenge.prompt).toBe(`Build a rectangle with ${fact.product} squares`)
        expect(challenge.visual.kind).toBe("array-builder")
        expect(challenge.visual.targetProduct).toBe(fact.product)
        expect(challenge.scaffold.skipCounts).toHaveLength(Math.min(fact.a, fact.b))
        expect(challenge.scaffold.skipCounts.at(-1)).toBe(challenge.answer)
        expect(
          challenge.scaffold.skipCounts.every((value) => value % Math.max(fact.a, fact.b) === 0),
        ).toBe(true)

        // The hint is a legal rectangle, and it is one check accepts.
        expect(DIMENSIONS).toContain(challenge.visual.hintRows)
        expect(DIMENSIONS).toContain(challenge.visual.hintCols)
        expect(
          challenge.check({
            rows: challenge.visual.hintRows,
            cols: challenge.visual.hintCols,
          }),
        ).toBe(true)

        // At least one legal rectangle exists, and every one of them is
        // reachable from the starting 1 x 1 by repeated single steps.
        const solutions = []
        for (const rows of DIMENSIONS) {
          for (const cols of DIMENSIONS) {
            if (challenge.check({ rows, cols })) solutions.push([rows, cols])
          }
        }
        expect(solutions.length).toBeGreaterThan(0)
        for (const [rows, cols] of solutions) {
          let walkedRows = challenge.visual.startRows
          let walkedCols = challenge.visual.startCols
          while (walkedRows < rows) {
            walkedRows = stepDimension(walkedRows, 1, challenge.visual.maxRows)
          }
          while (walkedCols < cols) {
            walkedCols = stepDimension(walkedCols, 1, challenge.visual.maxCols)
          }
          expect([walkedRows, walkedCols]).toEqual([rows, cols])
        }
      },
    )
  })

  describe("check", () => {
    const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)

    test("accepts a rectangle of the right area in either orientation", () => {
      expect(challenge.check({ rows: 6, cols: 7 })).toBe(true)
      expect(challenge.check({ rows: 7, cols: 6 })).toBe(true)
    })

    test("rejects a rectangle of the wrong size", () => {
      expect(challenge.check({ rows: 6, cols: 6 })).toBe(false)
      expect(challenge.check({ rows: 1, cols: 1 })).toBe(false)
      expect(challenge.check({ rows: 6, cols: 8 })).toBe(false)
      expect(challenge.check({ rows: 5, cols: 7 })).toBe(false)
    })

    test("rejects dimensions outside the legal range even when the product matches", () => {
      expect(challenge.check({ rows: 42, cols: 1 })).toBe(false)
      expect(challenge.check({ rows: 1, cols: 42 })).toBe(false)
      expect(challenge.check({ rows: 0, cols: 5 })).toBe(false)
      expect(challenge.check({ rows: -6, cols: -7 })).toBe(false)
    })

    test("rejects non-integer and non-numeric dimensions", () => {
      expect(challenge.check({ rows: 6.5, cols: 7 })).toBe(false)
      expect(challenge.check({ rows: "6", cols: "7" })).toBe(false)
      expect(challenge.check({ rows: 6 })).toBe(false)
      expect(challenge.check({ rows: NaN, cols: 7 })).toBe(false)
      expect(challenge.check({})).toBe(false)
      expect(challenge.check([6, 7])).toBe(false)
    })

    test("accepts a typed number or digit string as a keyboard fallback", () => {
      expect(challenge.check(42)).toBe(true)
      expect(challenge.check("42")).toBe(true)
      expect(challenge.check(" 42 ")).toBe(true)
      expect(challenge.check("0042")).toBe(true)
      expect(challenge.check(41)).toBe(false)
      expect(challenge.check("x")).toBe(false)
      expect(challenge.check("42abc")).toBe(false)
      expect(challenge.check("")).toBe(false)
    })

    test("rejects every other kind of input", () => {
      expect(challenge.check(null)).toBe(false)
      expect(challenge.check(undefined)).toBe(false)
      expect(challenge.check(NaN)).toBe(false)
      expect(challenge.check(Infinity)).toBe(false)
      expect(challenge.check(true)).toBe(false)
      expect(challenge.check(false)).toBe(false)
      expect(challenge.check()).toBe(false)
    })

    test("does not mutate the rectangle it is given", () => {
      const state = { rows: 6, cols: 7 }
      challenge.check(state)

      expect(state).toEqual({ rows: 6, cols: 7 })
    })

    test("is the only authority: it agrees with the area for all legal rectangles", () => {
      for (const rows of DIMENSIONS) {
        for (const cols of DIMENSIONS) {
          expect(challenge.check({ rows, cols })).toBe(rows * cols === 42)
        }
      }
    })
  })

  describe("stepDimension", () => {
    test("steps up and down by one", () => {
      expect(stepDimension(5, 1, 9)).toBe(6)
      expect(stepDimension(5, -1, 9)).toBe(4)
    })

    test("clamps at the upper boundary", () => {
      expect(stepDimension(9, 1, 9)).toBe(9)
      expect(stepDimension(8, 1, 9)).toBe(9)
      expect(stepDimension(3, 100, 9)).toBe(9)
    })

    test("clamps at the lower boundary", () => {
      expect(stepDimension(1, -1, 9)).toBe(1)
      expect(stepDimension(2, -1, 9)).toBe(1)
      expect(stepDimension(3, -5, 9)).toBe(1)
    })

    test("defaults max to OPERAND_MAX", () => {
      expect(stepDimension(9, 1)).toBe(OPERAND_MAX)
      expect(stepDimension(1, 100)).toBe(OPERAND_MAX)
    })

    test("never produces an illegal dimension", () => {
      const deltas = [-100, -9, -2, -1, 0, 1, 2, 9, 100]
      const values = [-5, 0, ...DIMENSIONS, 10, 99, NaN, Infinity, undefined]
      for (const value of values) {
        for (const delta of deltas) {
          const result = stepDimension(value, delta, OPERAND_MAX)
          expect(Number.isInteger(result)).toBe(true)
          expect(result).toBeGreaterThanOrEqual(1)
          expect(result).toBeLessThanOrEqual(OPERAND_MAX)
        }
      }
    })

    test("a step of zero holds still", () => {
      for (const value of DIMENSIONS) {
        expect(stepDimension(value, 0, 9)).toBe(value)
      }
    })

    test("reports the boundary by returning the value unchanged", () => {
      // How game.js decides whether to disable a stepper button.
      expect(stepDimension(1, -1, 9) === 1).toBe(true)
      expect(stepDimension(9, 1, 9) === 9).toBe(true)
      expect(stepDimension(5, 1, 9) === 5).toBe(false)
    })

    test("does not mutate the state object it is given", () => {
      const session = { rows: 3, cols: 4 }
      const nextRows = stepDimension(session.rows, 1, 9)
      const nextCols = stepDimension(session.cols, -1, 9)

      expect(session).toEqual({ rows: 3, cols: 4 })
      expect([nextRows, nextCols]).toEqual([4, 3])
    })

    test("does not mutate the challenge visual it reads bounds from", () => {
      const challenge = createChallenge(SIX_BY_SEVEN, {}, () => 0)
      const before = { ...challenge.visual }
      stepDimension(challenge.visual.startRows, 5, challenge.visual.maxRows)

      expect(challenge.visual).toEqual(before)
    })

    test("walks the full range one step at a time in both directions", () => {
      let value = 1
      for (let i = 0; i < 20; i += 1) {
        value = stepDimension(value, 1, OPERAND_MAX)
      }
      expect(value).toBe(OPERAND_MAX)

      for (let i = 0; i < 20; i += 1) {
        value = stepDimension(value, -1, OPERAND_MAX)
      }
      expect(value).toBe(1)
    })
  })
})
