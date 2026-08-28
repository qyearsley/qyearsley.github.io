/**
 * Tests for `js/modes/index.js` -- the mode registry and dispatcher.
 *
 * The load-bearing tests here are the contract-uniformity ones. `game.js` renders,
 * scores, and marks every answer through the same eleven-key `Challenge` object
 * whichever mode produced it, so anything that lets one mode return a slightly
 * different shape -- a missing `scaffold`, `options` on a keypad question, an
 * `entry` value nothing knows how to draw -- shows up as a mode-specific branch in
 * `game.js` rather than as a failure here. The sweep below asks every registered
 * mode for every one of the 36 facts and holds the whole shape to account.
 */

import { describe, test, expect } from "@jest/globals"
import { createChallenge, getMode, MODES, modeIds } from "../js/modes/index.js"
import { FACTS, getFact } from "../js/facts.js"
import { DISTRACTORS, INPUT_MODE, MODE_IDS, MODE_LABELS } from "../js/constants.js"

/** `6x7`, the spec's worked example throughout. */
const SIX_BY_SEVEN = getFact("6x7")

/** The exact key set every mode's challenge must have, sorted for comparison. */
const CHALLENGE_KEYS = [
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
].sort()

/** The exact key set of a `Scaffold`, sorted for comparison. */
const SCAFFOLD_KEYS = ["cols", "product", "rows", "skipCounts", "text"].sort()

/** Every legal `entry` value. A challenge outside this set cannot be rendered. */
const ENTRY_VALUES = Object.values(INPUT_MODE)

/** A challenge context that forces Quick Recall onto the keypad path. */
const KEYPAD_CONTEXT = { strength: 5, inputModeFor: () => INPUT_MODE.KEYPAD }

/** RNG calls a Quick Recall tiles challenge consumes: 1 orientation + 8 for options. */
const QUICK_RECALL_TILES_RNG_CALLS = 9

/** RNG calls a Quick Recall keypad challenge consumes: the orientation roll only. */
const QUICK_RECALL_KEYPAD_RNG_CALLS = 1

/**
 * An rng that always returns `value`, counting its calls so the dispatcher can be
 * shown to pass `rng` straight through rather than substituting its own.
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
 * Assert the full uniform `Challenge` contract (§ 12.1) on one challenge.
 *
 * Everything asserted here must hold for every mode: the exact key set, the type of
 * each key, a working `check`, a legal `entry`, the options-iff-tiles invariant, and
 * a well-formed scaffold. No branch below is keyed on `modeId` -- the only branch is
 * on `entry`, which is itself part of the shared contract.
 * @param {Object} challenge - The challenge under test
 * @param {Object} fact - The fact it was built for
 * @param {string} modeId - The mode id it was requested under
 * @returns {void}
 */
function expectUniformChallenge(challenge, fact, modeId) {
  expect(Object.keys(challenge).sort()).toEqual(CHALLENGE_KEYS)

  expect(challenge.modeId).toBe(modeId)
  expect(challenge.factId).toBe(fact.id)
  expect(Number.isInteger(challenge.left)).toBe(true)
  expect(Number.isInteger(challenge.right)).toBe(true)
  expect(challenge.answer).toBe(fact.product)
  expect(challenge.left * challenge.right).toBe(challenge.answer)
  expect(typeof challenge.prompt).toBe("string")
  expect(challenge.prompt.length).toBeGreaterThan(0)

  // entry is the one authority on the affordance, so it must be a value GameUI knows.
  expect(ENTRY_VALUES).toContain(challenge.entry)

  // options is non-null exactly when entry is tiles -- in both directions.
  if (challenge.entry === INPUT_MODE.TILES) {
    expect(Array.isArray(challenge.options)).toBe(true)
    expect(challenge.options).toHaveLength(DISTRACTORS.OPTION_COUNT)
    expect(new Set(challenge.options).size).toBe(challenge.options.length)
    expect(challenge.options).toContain(challenge.answer)
    for (const option of challenge.options) {
      expect(Number.isInteger(option)).toBe(true)
      expect(option).toBeGreaterThan(0)
    }
  } else {
    expect(challenge.options).toBeNull()
  }

  // visual is plain data discriminated by kind; never a DOM node.
  expect(typeof challenge.visual).toBe("object")
  expect(challenge.visual).not.toBeNull()
  expect(typeof challenge.visual.kind).toBe("string")
  expect(challenge.visual.kind.length).toBeGreaterThan(0)

  // check is the one authority on correctness and works the same way for every mode.
  expect(typeof challenge.check).toBe("function")
  expect(challenge.check(challenge.answer)).toBe(true)
  expect(challenge.check(String(challenge.answer))).toBe(true)
  expect(challenge.check(challenge.answer + 1)).toBe(false)
  expect(challenge.check(null)).toBe(false)
  expect(challenge.check(undefined)).toBe(false)
  expect(challenge.check("nope")).toBe(false)

  const { scaffold } = challenge
  expect(Object.keys(scaffold).sort()).toEqual(SCAFFOLD_KEYS)
  // Orientation-independent: rows is always the SMALLER operand, whichever way
  // round the challenge is displayed, so the same fact always teaches the same
  // (shorter, faster) array. See modes/shared.js.
  expect(scaffold.rows).toBe(Math.min(challenge.left, challenge.right))
  expect(scaffold.cols).toBe(Math.max(challenge.left, challenge.right))
  expect(scaffold.rows).toBeLessThanOrEqual(scaffold.cols)
  expect(scaffold.product).toBe(challenge.answer)
  expect(scaffold.skipCounts).toEqual(
    Array.from({ length: scaffold.rows }, (_unused, index) => (index + 1) * scaffold.cols),
  )
  expect(scaffold.skipCounts[scaffold.skipCounts.length - 1]).toBe(challenge.answer)
  expect(scaffold.text).toBe(`${scaffold.rows} rows of ${scaffold.cols} makes ${scaffold.product}`)
}

/** Every (mode id, fact id) pair: 1 mode x 36 facts. */
const MODE_FACT_PAIRS = FACTS.flatMap((fact) => MODES.map((mode) => [mode.id, fact.id]))

describe("modes/index", () => {
  describe("MODES", () => {
    test("has one entry per mode, in the documented menu order", () => {
      expect(MODES.map((mode) => mode.id)).toEqual([MODE_IDS.QUICK_RECALL])
    })

    test("every entry has an id, a label, and a createChallenge function", () => {
      for (const mode of MODES) {
        expect(typeof mode.id).toBe("string")
        expect(typeof mode.label).toBe("string")
        expect(mode.label.length).toBeGreaterThan(0)
        expect(typeof mode.createChallenge).toBe("function")
        expect(Object.keys(mode).sort()).toEqual(["createChallenge", "id", "label"])
      }
    })

    test("ids are unique", () => {
      const ids = MODES.map((mode) => mode.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    test("the array and each entry are frozen", () => {
      expect(Object.isFrozen(MODES)).toBe(true)
      for (const mode of MODES) {
        expect(Object.isFrozen(mode)).toBe(true)
      }
    })

    test("ids are exactly the MODE_IDS values, with no extras and no gaps", () => {
      const registered = MODES.map((mode) => mode.id).sort()
      expect(registered).toEqual(Object.values(MODE_IDS).sort())
    })

    test("MODE_LABELS keys are exactly the registered ids, with no extras and no gaps", () => {
      const registered = MODES.map((mode) => mode.id).sort()
      expect(Object.keys(MODE_LABELS).sort()).toEqual(registered)
    })

    test("each label is the MODE_LABELS entry for its id", () => {
      for (const mode of MODES) {
        expect(mode.label).toBe(MODE_LABELS[mode.id])
      }
    })
  })

  describe("getMode", () => {
    test("returns the definition for each registered id", () => {
      expect(getMode(MODE_IDS.QUICK_RECALL)).toBe(MODES[0])
    })

    test("returns null for an unknown id", () => {
      expect(getMode("nope")).toBeNull()
      expect(getMode("")).toBeNull()
      expect(getMode("Quick-Recall")).toBeNull()
    })

    test("returns null for null and undefined", () => {
      expect(getMode(null)).toBeNull()
      expect(getMode(undefined)).toBeNull()
    })

    test("returns null for a non-string", () => {
      expect(getMode(42)).toBeNull()
      expect(getMode(true)).toBeNull()
      expect(getMode({ id: MODE_IDS.QUICK_RECALL })).toBeNull()
      expect(getMode([MODE_IDS.QUICK_RECALL])).toBeNull()
    })

    test("returns null for Object.prototype keys", () => {
      expect(getMode("toString")).toBeNull()
      expect(getMode("constructor")).toBeNull()
      expect(getMode("__proto__")).toBeNull()
    })
  })

  describe("modeIds", () => {
    test("returns the ids in menu order", () => {
      expect(modeIds()).toEqual([MODE_IDS.QUICK_RECALL])
    })

    test("returns a fresh array each call", () => {
      const first = modeIds()
      const second = modeIds()
      expect(first).not.toBe(second)
      first.push("nope")
      expect(modeIds()).toEqual([MODE_IDS.QUICK_RECALL])
      expect(MODES).toHaveLength(1)
    })

    test("every id resolves through getMode", () => {
      for (const id of modeIds()) {
        expect(getMode(id)).not.toBeNull()
      }
    })
  })

  describe("createChallenge", () => {
    test("dispatches to Quick Recall", () => {
      const challenge = createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, {}, () => 0)
      expect(challenge.modeId).toBe(MODE_IDS.QUICK_RECALL)
      expect(challenge.visual.kind).toBe("expression")
    })

    test("forwards settings positionally, so the entry policy is honoured", () => {
      const challenge = createChallenge(
        MODE_IDS.QUICK_RECALL,
        SIX_BY_SEVEN,
        KEYPAD_CONTEXT,
        () => 0,
      )
      expect(challenge.entry).toBe(INPUT_MODE.KEYPAD)
      expect(challenge.options).toBeNull()
    })

    test("passes rng straight through, so each mode's call count is unchanged", () => {
      const tilesRng = countingRng(0.3)
      createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, {}, tilesRng)
      expect(tilesRng.calls).toBe(QUICK_RECALL_TILES_RNG_CALLS)

      const keypadRng = countingRng(0.3)
      createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, KEYPAD_CONTEXT, keypadRng)
      expect(keypadRng.calls).toBe(QUICK_RECALL_KEYPAD_RNG_CALLS)
    })

    test("is deterministic for a given rng", () => {
      const first = createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, {}, countingRng(0.42))
      const second = createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, {}, countingRng(0.42))
      expect(first.options).toEqual(second.options)
      expect(first.prompt).toBe(second.prompt)
    })

    test("works with settings and rng omitted", () => {
      for (const id of modeIds()) {
        const challenge = createChallenge(id, SIX_BY_SEVEN)
        expect(challenge.modeId).toBe(id)
        expect(challenge.answer).toBe(SIX_BY_SEVEN.product)
      }
    })

    test("does not mutate the settings object it is given", () => {
      const settings = { strength: 3, inputModeFor: KEYPAD_CONTEXT.inputModeFor }
      const before = { ...settings }
      createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, settings, () => 0)
      expect(settings).toEqual(before)
    })

    test("throws RangeError naming the mode, not the fact, for an unknown id", () => {
      expect(() => createChallenge("nope", SIX_BY_SEVEN)).toThrow(RangeError)
      expect(() => createChallenge("nope", SIX_BY_SEVEN)).toThrow("Unknown mode: nope")
      try {
        createChallenge("nope", SIX_BY_SEVEN)
      } catch (error) {
        expect(error.message).toContain("nope")
        expect(error.message).not.toContain(SIX_BY_SEVEN.id)
      }
    })

    test("throws RangeError for null", () => {
      expect(() => createChallenge(null, SIX_BY_SEVEN)).toThrow(RangeError)
      expect(() => createChallenge(null, SIX_BY_SEVEN)).toThrow("Unknown mode: null")
    })

    test("throws RangeError for undefined", () => {
      expect(() => createChallenge(undefined, SIX_BY_SEVEN)).toThrow(RangeError)
    })

    test("throws RangeError for a non-string", () => {
      expect(() => createChallenge(42, SIX_BY_SEVEN)).toThrow(RangeError)
      expect(() => createChallenge({ id: MODE_IDS.QUICK_RECALL }, SIX_BY_SEVEN)).toThrow(RangeError)
      expect(() => createChallenge([MODE_IDS.QUICK_RECALL], SIX_BY_SEVEN)).toThrow(RangeError)
    })

    test("checks the mode id before the fact, so an unknown id throws RangeError", () => {
      expect(() => createChallenge("nope", null)).toThrow(RangeError)
    })

    test("lets the mode's own TypeError through for a bad fact", () => {
      for (const id of modeIds()) {
        expect(() => createChallenge(id, null)).toThrow(TypeError)
        expect(() => createChallenge(id, {})).toThrow(TypeError)
        expect(() => createChallenge(id, "6x7")).toThrow(TypeError)
      }
    })

    test("touches no DOM", () => {
      document.body.innerHTML = '<p id="sentinel">unchanged</p>'
      const before = document.body.innerHTML
      for (const fact of FACTS.slice(0, 5)) {
        for (const id of modeIds()) {
          createChallenge(id, fact, {}, () => 0.5)
        }
      }
      expect(document.body.innerHTML).toBe(before)
      document.body.innerHTML = ""
    })
  })

  describe("Challenge contract uniformity", () => {
    test.each(MODE_FACT_PAIRS)(
      "%s builds a contract-uniform challenge for %s",
      (modeId, factId) => {
        const fact = getFact(factId)
        expectUniformChallenge(
          createChallenge(modeId, fact, {}, () => 0.5),
          fact,
          modeId,
        )
      },
    )

    test.each(MODE_FACT_PAIRS)(
      "%s stays contract-uniform on the keypad context for %s",
      (modeId, factId) => {
        const fact = getFact(factId)
        expectUniformChallenge(
          createChallenge(modeId, fact, KEYPAD_CONTEXT, () => 0.5),
          fact,
          modeId,
        )
      },
    )

    test("every registered mode returns the same key set for the same fact", () => {
      const keySets = MODES.map((mode) =>
        Object.keys(createChallenge(mode.id, SIX_BY_SEVEN, {}, () => 0.5)).sort(),
      )
      for (const keys of keySets) {
        expect(keys).toEqual(CHALLENGE_KEYS)
      }
    })

    test("both entry branches of the options invariant are actually exercised", () => {
      const tiles = createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, {}, () => 0.5)
      const keypad = createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, KEYPAD_CONTEXT, () => 0.5)
      expect(tiles.entry).toBe(INPUT_MODE.TILES)
      expect(tiles.options).not.toBeNull()
      expect(keypad.entry).toBe(INPUT_MODE.KEYPAD)
      expect(keypad.options).toBeNull()
    })

    test("returns a fresh challenge each call, sharing nothing with the last", () => {
      const first = createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, {}, () => 0.5)
      const second = createChallenge(MODE_IDS.QUICK_RECALL, SIX_BY_SEVEN, {}, () => 0.5)
      expect(first).not.toBe(second)
      expect(first.options).not.toBe(second.options)
      expect(first.scaffold).not.toBe(second.scaffold)
      expect(first.visual).not.toBe(second.visual)
    })

    test("every mode and orientation of a fact yields the same scaffold", () => {
      // modes/shared.js is the single scaffold builder. A miss must teach the same
      // array whichever mode she was playing and whichever way the orientation
      // roll landed -- otherwise the explanation's quality, and how long she has
      // to sit through it, are decided by a coin flip.
      for (const fact of FACTS) {
        const scaffolds = modeIds().flatMap((id) =>
          [0, 0.9].map((roll) => createChallenge(id, fact, {}, () => roll).scaffold),
        )
        for (const scaffold of scaffolds) {
          expect(scaffold).toEqual(scaffolds[0])
          expect(scaffold.rows).toBe(Math.min(fact.a, fact.b))
        }
      }
    })

    test("does not mutate the frozen fact it is given", () => {
      const fact = getFact("9x9")
      const before = { ...fact }
      for (const id of modeIds()) {
        createChallenge(id, fact, {}, () => 0.5)
      }
      expect({ ...fact }).toEqual(before)
    })
  })
})
