import { describe, test, expect } from "@jest/globals"
import { generateOptions, nearMissCandidates } from "../js/distractors.js"
import { FACTS, getFact } from "../js/facts.js"
import { DISTRACTORS } from "../js/constants.js"

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

/**
 * An rng that cycles through `values` forever, so a sweep can run many facts
 * against a varying but deterministic sequence.
 * @param {number[]} values - The sequence to cycle
 * @returns {() => number} The rng
 */
function cyclingRng(values) {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

/** Every rng behaviour the exhaustive sweep runs against. */
const SWEEP_RNGS = [
  ["always 0", () => () => 0],
  ["always 0.999", () => () => 0.999],
  ["always 0.5", () => () => 0.5],
  ["cycling", () => cyclingRng([0, 0.999, 0.25, 0.75, 0.5, 0.1, 0.9])],
]

describe("distractors", () => {
  describe("nearMissCandidates", () => {
    test("puts the adjacent multiples of 6x7 first, in table order", () => {
      const candidates = nearMissCandidates(getFact("6x7"))
      expect(candidates.slice(0, 4)).toEqual([36, 48, 35, 49])
    })

    test("builds the documented full ordered list for 6x7", () => {
      expect(nearMissCandidates(getFact("6x7"))).toEqual([
        36, 48, 35, 49, 30, 54, 28, 56, 43, 41, 52, 32, 13, 24,
      ])
    })

    test("2x2 is the smallest real pool and is still big enough", () => {
      const candidates = nearMissCandidates(getFact("2x2"))
      expect(candidates).toEqual([2, 6, 8, 5, 3, 14])
      expect(candidates).toHaveLength(6)
      for (const value of candidates) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThan(0)
        expect(value).not.toBe(4)
      }
    })

    test("the minimum supply across all 36 facts is 6, and it occurs at 2x2", () => {
      const lengths = FACTS.map((fact) => nearMissCandidates(fact).length)
      const minimum = Math.min(...lengths)
      expect(minimum).toBeGreaterThanOrEqual(4)
      expect(minimum).toBe(6)
      const tightest = FACTS.filter((fact) => nearMissCandidates(fact).length === minimum).map(
        (fact) => fact.id,
      )
      expect(tightest).toEqual(["2x2"])
    })

    test("supply is always at least the priority window, so no padding is needed", () => {
      for (const fact of FACTS) {
        expect(nearMissCandidates(fact).length).toBeGreaterThanOrEqual(DISTRACTORS.PRIORITY_WINDOW)
      }
    })

    test("9x9 offers the neighbouring multiples of nine and no duplicates", () => {
      const candidates = nearMissCandidates(getFact("9x9"))
      expect(candidates).toContain(72)
      expect(candidates).toContain(90)
      expect(new Set(candidates).size).toBe(candidates.length)
    })

    test("squares deduplicate their two identical adjacent multiples", () => {
      const candidates = nearMissCandidates(getFact("7x7"))
      expect(candidates.filter((value) => value === 42)).toEqual([42])
      expect(new Set(candidates).size).toBe(candidates.length)
    })

    test("skips the digit reversal for single-digit products", () => {
      // 2x3 has p = 6, so there is no two-digit reversal to offer.
      expect(nearMissCandidates(getFact("2x3"))).toEqual([4, 8, 3, 9, 2, 10, 12, 7, 5, 16])
    })

    test("every fact yields distinct positive integers that are never the product", () => {
      for (const fact of FACTS) {
        const candidates = nearMissCandidates(fact)
        expect(new Set(candidates).size).toBe(candidates.length)
        expect(candidates.length).toBeGreaterThanOrEqual(6)
        for (const value of candidates) {
          expect(Number.isInteger(value)).toBe(true)
          expect(value).toBeGreaterThan(0)
          expect(value).not.toBe(fact.product)
        }
      }
    })

    test("returns a fresh array each call and does not mutate the fact", () => {
      const fact = getFact("6x7")
      const first = nearMissCandidates(fact)
      const second = nearMissCandidates(fact)
      expect(first).not.toBe(second)
      expect(first).toEqual(second)
      expect(fact).toEqual({
        id: "6x7",
        a: 6,
        b: 7,
        product: 42,
        isSquare: false,
        isTough: true,
      })
    })

    test("throws TypeError for anything that is not a Fact", () => {
      for (const bad of [{}, null, undefined, 42, "6x7", { a: 6 }, { a: 6, b: 7 }]) {
        expect(() => nearMissCandidates(bad)).toThrow(TypeError)
      }
      expect(() => nearMissCandidates({})).toThrow(
        "nearMissCandidates requires a Fact with numeric a, b, product",
      )
    })
  })

  describe("generateOptions", () => {
    test.each(SWEEP_RNGS)(
      "holds the four-option invariants for all 36 facts (%s rng)",
      (_label, makeRng) => {
        const rng = makeRng()
        for (const fact of FACTS) {
          const options = generateOptions(fact, { rng })
          expect(options).toHaveLength(DISTRACTORS.OPTION_COUNT)
          expect(new Set(options).size).toBe(options.length)
          expect(options.filter((value) => value === fact.product)).toHaveLength(1)
          for (const value of options) {
            expect(Number.isInteger(value)).toBe(true)
            expect(value).toBeGreaterThan(0)
          }
        }
      },
    )

    test.each(SWEEP_RNGS)(
      "draws every non-answer option from nearMissCandidates (%s rng)",
      (_label, makeRng) => {
        const rng = makeRng()
        for (const fact of FACTS) {
          const candidates = nearMissCandidates(fact)
          const options = generateOptions(fact, { rng })
          for (const value of options) {
            if (value === fact.product) continue
            expect(candidates).toContain(value)
          }
        }
      },
    )

    test("2x2, the tightest supply, still yields 4 distinct options including 4", () => {
      for (const value of [0, 0.999]) {
        const options = generateOptions(getFact("2x2"), { rng: () => value })
        expect(options).toHaveLength(4)
        expect(new Set(options).size).toBe(4)
        expect(options).toContain(4)
        for (const option of options) {
          if (option === 4) continue
          expect([2, 6, 8, 5, 3, 14]).toContain(option)
        }
      }
    })

    test("is deterministic for identical scripted rng sequences", () => {
      const sequence = [0.1, 0.8, 0.3, 0.95, 0.42, 0.6, 0.05, 0.77]
      const first = generateOptions(getFact("6x7"), { rng: scriptedRng(sequence) })
      const second = generateOptions(getFact("6x7"), { rng: scriptedRng(sequence) })
      expect(first).toEqual(second)
    })

    test("honours count: 2 with one distractor plus the answer", () => {
      const fact = getFact("6x7")
      const options = generateOptions(fact, { rng: () => 0, count: 2 })
      expect(options).toHaveLength(2)
      expect(options).toContain(42)
      const distractors = options.filter((value) => value !== 42)
      expect(distractors).toHaveLength(1)
      expect(nearMissCandidates(fact)).toContain(distractors[0])
    })

    test("honours count: 6 for a rich fact and for the tightest one", () => {
      for (const id of ["6x7", "2x2"]) {
        const fact = getFact(id)
        const options = generateOptions(fact, { rng: () => 0.999, count: 6 })
        expect(options).toHaveLength(6)
        expect(new Set(options).size).toBe(6)
        expect(options).toContain(fact.product)
      }
    })

    test("clamps count to the [2, 8] range", () => {
      const fact = getFact("6x7")
      expect(generateOptions(fact, { rng: () => 0, count: 0 })).toHaveLength(2)
      expect(generateOptions(fact, { rng: () => 0, count: -5 })).toHaveLength(2)
      expect(generateOptions(fact, { rng: () => 0, count: 99 })).toHaveLength(8)
    })

    test("falls back to OPTION_COUNT for a non-numeric count", () => {
      const fact = getFact("6x7")
      expect(generateOptions(fact, { rng: () => 0, count: undefined })).toHaveLength(4)
      expect(generateOptions(fact, { rng: () => 0, count: NaN })).toHaveLength(4)
      expect(generateOptions(fact, { rng: () => 0 })).toHaveLength(4)
    })

    test("consumes exactly 5 + (count - 1) rng calls for 6x7", () => {
      const four = countingRng(0)
      generateOptions(getFact("6x7"), { rng: four })
      expect(four.calls).toBe(8)

      const six = countingRng(0)
      generateOptions(getFact("6x7"), { rng: six, count: 6 })
      expect(six.calls).toBe(5 + 5)
    })

    test("consumes the same 8 rng calls for 2x2, the smallest pool", () => {
      const rng = countingRng(0.999)
      generateOptions(getFact("2x2"), { rng })
      expect(rng.calls).toBe(8)
    })

    test("consumes the documented call count for every one of the 36 facts", () => {
      for (const fact of FACTS) {
        const rng = countingRng(0.5)
        generateOptions(fact, { rng })
        expect(rng.calls).toBe(8)
      }
    })

    test("puts the answer at different positions for different rng sequences", () => {
      const fact = getFact("6x7")
      const positions = new Set()
      for (const value of [0, 0.24, 0.5, 0.74, 0.999]) {
        const options = generateOptions(fact, { rng: () => value })
        positions.add(options.indexOf(42))
      }
      expect(positions.size).toBeGreaterThan(1)
    })

    test("can place the answer in any of the four slots", () => {
      // The final shuffle consumes rng calls 6, 7 and 8 (the first five go to the
      // priority window), so those three values decide where the answer lands.
      const fact = getFact("6x7")
      const window = [0, 0, 0, 0, 0]
      const sequences = [
        [...window, 0.1, 0.5, 0.9], // answer -> slot 0
        [...window, 0.3, 0.1, 0.9], // answer -> slot 1
        [...window, 0.6, 0.9, 0.1], // answer -> slot 2
        [...window, 0.9, 0.1, 0.1], // answer -> slot 3
      ]
      const positions = sequences.map((sequence) =>
        generateOptions(fact, { rng: scriptedRng(sequence) }).indexOf(42),
      )
      expect(positions).toEqual([0, 1, 2, 3])
    })

    test("spreads the answer over more than one slot across a cycling rng sweep", () => {
      const fact = getFact("6x7")
      const rng = cyclingRng([0, 0.13, 0.29, 0.47, 0.61, 0.78, 0.86, 0.94, 0.35, 0.52, 0.07])
      const positions = new Set()
      for (let i = 0; i < 200; i += 1) {
        positions.add(generateOptions(fact, { rng }).indexOf(42))
      }
      expect(positions.size).toBeGreaterThanOrEqual(3)
      expect(positions.has(-1)).toBe(false)
    })

    test("uses Math.random when rng is omitted and still holds the invariants", () => {
      for (let i = 0; i < 50; i += 1) {
        for (const id of ["2x2", "6x7", "9x9"]) {
          const fact = getFact(id)
          const options = generateOptions(fact)
          expect(options).toHaveLength(4)
          expect(new Set(options).size).toBe(4)
          expect(options).toContain(fact.product)
        }
      }
    })

    test("does not mutate the fact and returns a fresh array", () => {
      const fact = getFact("9x9")
      const before = { ...fact }
      const first = generateOptions(fact, { rng: () => 0 })
      const second = generateOptions(fact, { rng: () => 0 })
      expect(fact).toEqual(before)
      expect(first).not.toBe(second)
    })

    test("throws TypeError for anything that is not a Fact", () => {
      expect(() => generateOptions(null, { rng: () => 0 })).toThrow(TypeError)
      expect(() => generateOptions({ a: 6 }, { rng: () => 0 })).toThrow(TypeError)
    })
  })
})
