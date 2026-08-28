import { describe, test, expect } from "@jest/globals"
import {
  FACTS,
  FACT_IDS,
  SQUARE_IDS,
  canonicalize,
  factId,
  parseFactId,
  getFact,
  getFactFor,
  factsForTables,
  factIdsForTables,
  factsForRegionTable,
  randomOrientation,
} from "../js/facts.js"
import {
  ALL_TABLES,
  OPERAND_MAX,
  OPERAND_MIN,
  TOTAL_FACTS,
  PATTERN_FREE_IDS,
} from "../js/constants.js"

/** Counts calls so rng-consumption contracts can be asserted. */
function countingRng(value) {
  const rng = () => {
    rng.calls += 1
    return value
  }
  rng.calls = 0
  return rng
}

describe("facts", () => {
  describe("FACTS", () => {
    test("holds exactly TOTAL_FACTS facts", () => {
      expect(FACTS.length).toBe(36)
      expect(FACTS.length).toBe(TOTAL_FACTS)
    })

    test("is ordered ascending by a then b", () => {
      expect(FACTS[0].id).toBe("2x2")
      expect(FACTS[FACTS.length - 1].id).toBe("9x9")
      const sorted = [...FACTS].sort((x, y) => x.a - y.a || x.b - y.b)
      expect(FACTS.map((f) => f.id)).toEqual(sorted.map((f) => f.id))
    })

    test("ids are unique", () => {
      expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length)
    })

    test("every fact is canonical with operands in range", () => {
      for (const fact of FACTS) {
        expect(fact.a).toBeLessThanOrEqual(fact.b)
        expect(fact.a).toBeGreaterThanOrEqual(OPERAND_MIN)
        expect(fact.b).toBeLessThanOrEqual(OPERAND_MAX)
        expect(fact.id).toBe(`${fact.a}x${fact.b}`)
      }
    })

    test("product equals a * b", () => {
      for (const fact of FACTS) {
        expect(fact.product).toBe(fact.a * fact.b)
      }
    })

    test("includes both boundary operands", () => {
      expect(getFact(`${OPERAND_MIN}x${OPERAND_MIN}`)).not.toBeNull()
      expect(getFact(`${OPERAND_MIN}x${OPERAND_MAX}`)).not.toBeNull()
      expect(getFact(`${OPERAND_MAX}x${OPERAND_MAX}`)).not.toBeNull()
      expect(FACTS.some((f) => f.a === OPERAND_MIN && f.b === OPERAND_MIN)).toBe(true)
      expect(FACTS.some((f) => f.a === OPERAND_MAX && f.b === OPERAND_MAX)).toBe(true)
    })

    test("isSquare is true for exactly 8 facts", () => {
      const squares = FACTS.filter((f) => f.isSquare)
      expect(squares.length).toBe(8)
      for (const fact of squares) {
        expect(fact.a).toBe(fact.b)
      }
    })

    test("isTough matches PATTERN_FREE_IDS as a set", () => {
      const tough = FACTS.filter((f) => f.isTough).map((f) => f.id)
      expect(tough.length).toBe(10)
      expect(new Set(tough)).toEqual(new Set(PATTERN_FREE_IDS))
    })

    test("the array and its elements are frozen", () => {
      expect(Object.isFrozen(FACTS)).toBe(true)
      expect(Object.isFrozen(FACTS[0])).toBe(true)
      expect(Object.isFrozen(FACTS[FACTS.length - 1])).toBe(true)
    })

    test("a caller cannot mutate it", () => {
      expect(() => FACTS.push({ id: "nope" })).toThrow(TypeError)
      expect(() => {
        FACTS[0] = null
      }).toThrow(TypeError)
      expect(() => {
        FACTS[0].product = 99
      }).toThrow(TypeError)
      expect(FACTS.length).toBe(36)
      expect(FACTS[0].id).toBe("2x2")
    })
  })

  describe("FACT_IDS", () => {
    test("matches FACTS order and is frozen", () => {
      expect(FACT_IDS).toEqual(FACTS.map((f) => f.id))
      expect(Object.isFrozen(FACT_IDS)).toBe(true)
      expect(() => FACT_IDS.push("2x2")).toThrow(TypeError)
    })
  })

  describe("SQUARE_IDS", () => {
    test("has the 8 diagonal ids in order", () => {
      expect(SQUARE_IDS).toEqual(["2x2", "3x3", "4x4", "5x5", "6x6", "7x7", "8x8", "9x9"])
    })

    test("every id parses to a === b", () => {
      for (const id of SQUARE_IDS) {
        const parsed = parseFactId(id)
        expect(parsed).not.toBeNull()
        expect(parsed.a).toBe(parsed.b)
      }
    })

    test("matches the isSquare facts", () => {
      expect(SQUARE_IDS).toEqual(FACTS.filter((f) => f.isSquare).map((f) => f.id))
    })

    test("is frozen", () => {
      expect(Object.isFrozen(SQUARE_IDS)).toBe(true)
      expect(() => SQUARE_IDS.push("1x1")).toThrow(TypeError)
    })
  })

  describe("canonicalize", () => {
    test("orders both orientations the same way", () => {
      expect(canonicalize(7, 8)).toEqual({ a: 7, b: 8 })
      expect(canonicalize(8, 7)).toEqual({ a: 7, b: 8 })
    })

    test("handles squares", () => {
      expect(canonicalize(6, 6)).toEqual({ a: 6, b: 6 })
    })

    test("handles the boundary operands", () => {
      expect(canonicalize(2, 2)).toEqual({ a: 2, b: 2 })
      expect(canonicalize(9, 2)).toEqual({ a: 2, b: 9 })
      expect(canonicalize(9, 9)).toEqual({ a: 9, b: 9 })
    })

    test("returns a new object each call", () => {
      expect(canonicalize(3, 4)).not.toBe(canonicalize(3, 4))
    })

    test("throws RangeError for out-of-range or non-integer operands", () => {
      expect(() => canonicalize(1, 5)).toThrow(RangeError)
      expect(() => canonicalize(5, 10)).toThrow(RangeError)
      expect(() => canonicalize(2.5, 3)).toThrow(RangeError)
      expect(() => canonicalize("6", 7)).toThrow(RangeError)
      expect(() => canonicalize(NaN, 3)).toThrow(RangeError)
      expect(() => canonicalize(0, 0)).toThrow(RangeError)
      expect(() => canonicalize(undefined, undefined)).toThrow(RangeError)
    })

    test("the RangeError message names the bounds and the arguments", () => {
      expect(() => canonicalize(1, 5)).toThrow(
        `Operands must be integers ${OPERAND_MIN}-${OPERAND_MAX}, got (1, 5)`,
      )
    })
  })

  describe("factId", () => {
    test("returns the canonical id regardless of argument order", () => {
      expect(factId(8, 7)).toBe("7x8")
      expect(factId(7, 8)).toBe("7x8")
      expect(factId(6, 6)).toBe("6x6")
    })

    test("is symmetric for all 64 ordered pairs", () => {
      for (const x of ALL_TABLES) {
        for (const y of ALL_TABLES) {
          expect(factId(x, y)).toBe(factId(y, x))
        }
      }
    })

    test("produces exactly the 36 known ids", () => {
      const ids = new Set()
      for (const x of ALL_TABLES) {
        for (const y of ALL_TABLES) {
          ids.add(factId(x, y))
        }
      }
      expect(ids.size).toBe(36)
      expect(ids).toEqual(new Set(FACT_IDS))
    })

    test("throws RangeError for bad operands", () => {
      expect(() => factId(1, 5)).toThrow(RangeError)
      expect(() => factId(10, 3)).toThrow(RangeError)
    })
  })

  describe("parseFactId", () => {
    test("parses a canonical id", () => {
      expect(parseFactId("7x8")).toEqual({ a: 7, b: 8 })
      expect(parseFactId("2x2")).toEqual({ a: 2, b: 2 })
      expect(parseFactId("9x9")).toEqual({ a: 9, b: 9 })
    })

    test("rejects a non-canonical order", () => {
      expect(parseFactId("8x7")).toBeNull()
      expect(parseFactId("9x2")).toBeNull()
    })

    test("rejects out-of-range operands", () => {
      expect(parseFactId("1x5")).toBeNull()
      expect(parseFactId("10x3")).toBeNull()
      expect(parseFactId("10x2")).toBeNull()
      expect(parseFactId("0x0")).toBeNull()
      expect(parseFactId("2x10")).toBeNull()
    })

    test("rejects wrong separators and casing", () => {
      expect(parseFactId("7X8")).toBeNull()
      expect(parseFactId("7*8")).toBeNull()
      expect(parseFactId("7-8")).toBeNull()
      expect(parseFactId("78")).toBeNull()
    })

    test("rejects malformed strings", () => {
      expect(parseFactId("")).toBeNull()
      expect(parseFactId("7x")).toBeNull()
      expect(parseFactId("x8")).toBeNull()
      expect(parseFactId("axb")).toBeNull()
      expect(parseFactId("7x8x9")).toBeNull()
      expect(parseFactId(" 7x8")).toBeNull()
      expect(parseFactId("7x8 ")).toBeNull()
      expect(parseFactId("07x8")).toBeNull()
    })

    test("rejects non-strings without throwing", () => {
      expect(parseFactId(null)).toBeNull()
      expect(parseFactId(undefined)).toBeNull()
      expect(parseFactId(78)).toBeNull()
      expect(parseFactId({})).toBeNull()
      expect(parseFactId([])).toBeNull()
      expect(parseFactId(["7x8"])).toBeNull()
    })

    test("never throws for any of the rejected inputs", () => {
      const bad = ["", "7x", "axb", "1x5", "10x3", "7X8", null, undefined, 78, {}, NaN]
      for (const input of bad) {
        expect(() => parseFactId(input)).not.toThrow()
      }
    })

    test("round-trips every id in FACT_IDS", () => {
      for (const id of FACT_IDS) {
        const parsed = parseFactId(id)
        expect(parsed).not.toBeNull()
        expect(factId(parsed.a, parsed.b)).toBe(id)
      }
    })
  })

  describe("getFact", () => {
    test("round-trips id -> fact -> id for every fact", () => {
      for (const id of FACT_IDS) {
        const fact = getFact(id)
        expect(fact).not.toBeNull()
        expect(fact.id).toBe(id)
        expect(factId(fact.a, fact.b)).toBe(id)
      }
    })

    test("returns the same frozen instance as FACTS", () => {
      expect(getFact("6x7")).toBe(FACTS.find((f) => f.id === "6x7"))
    })

    test("returns null for unknown, non-canonical, and non-string ids", () => {
      expect(getFact("1x1")).toBeNull()
      expect(getFact("8x7")).toBeNull()
      expect(getFact("10x3")).toBeNull()
      expect(getFact("")).toBeNull()
      expect(getFact(null)).toBeNull()
      expect(getFact(undefined)).toBeNull()
      expect(getFact(67)).toBeNull()
    })
  })

  describe("getFactFor", () => {
    test("returns the fact for either operand order", () => {
      expect(getFactFor(8, 7).id).toBe("7x8")
      expect(getFactFor(7, 8).id).toBe("7x8")
      expect(getFactFor(7, 8).product).toBe(56)
    })

    test("works at both operand boundaries", () => {
      expect(getFactFor(2, 2).product).toBe(4)
      expect(getFactFor(9, 9).product).toBe(81)
    })

    test("throws RangeError for bad operands", () => {
      expect(() => getFactFor(1, 5)).toThrow(RangeError)
      expect(() => getFactFor(3, 3.5)).toThrow(RangeError)
    })
  })

  describe("factsForTables", () => {
    test("includes a fact when EITHER operand is enabled", () => {
      const sevens = factsForTables([7])
      expect(sevens.length).toBe(8)
      for (const fact of sevens) {
        expect(fact.a === 7 || fact.b === 7).toBe(true)
      }
    })

    test("two tables overlap rather than adding up", () => {
      // 6 and 7 own eight facts each, and 6x7 belongs to both.
      expect(factsForTables([6, 7]).length).toBe(15)
    })

    test("every table gives the whole fact set", () => {
      expect(factsForTables([...ALL_TABLES]).length).toBe(36)
    })

    // The old "both" ceiling mode would have given 10 here, excluding 4x8. There
    // is no ceiling mode any more: tables are families.
    test("a low range still reaches its high partners", () => {
      const low = factsForTables([2, 3, 4, 5])
      expect(low.length).toBe(26)
      expect(low.map((fact) => fact.id)).toContain("4x8")
    })

    test("returns [] for an empty or all-invalid table list", () => {
      expect(factsForTables([])).toEqual([])
      expect(factsForTables([1, 10, "7"])).toEqual([])
    })

    test("returns [] for a non-array", () => {
      expect(factsForTables(null)).toEqual([])
      expect(factsForTables(undefined)).toEqual([])
      expect(factsForTables(7)).toEqual([])
      expect(factsForTables("2,3")).toEqual([])
    })

    test("ignores invalid entries rather than throwing", () => {
      expect(() => factsForTables([2, "3", 4.5, null, 99])).not.toThrow()
      expect(factsForTables([2, "3", 4.5, null, 99]).map((f) => f.id)).toEqual([
        "2x2",
        "2x3",
        "2x4",
        "2x5",
        "2x6",
        "2x7",
        "2x8",
        "2x9",
      ])
    })

    test("preserves FACTS order", () => {
      const ids = factsForTables([2, 3]).map((f) => f.id)
      expect(ids).toEqual(FACT_IDS.filter((id) => ids.includes(id)))
    })

    test("returns a new array each call, and mutating it leaves FACTS alone", () => {
      const first = factsForTables([2, 3])
      const second = factsForTables([2, 3])
      expect(first).not.toBe(second)
      expect(first).toEqual(second)
      const size = first.length
      first.length = 0
      expect(factsForTables([2, 3]).length).toBe(size)
      expect(FACTS.length).toBe(36)
    })

    test("ignores any extra argument, so a stale mode string cannot change the pool", () => {
      expect(factsForTables([7], "both")).toEqual(factsForTables([7]))
      expect(factsForTables([7], "either")).toEqual(factsForTables([7]))
    })
  })

  describe("factIdsForTables", () => {
    test("returns the ids of factsForTables", () => {
      expect(factIdsForTables([2])).toEqual(
        FACTS.filter((fact) => fact.a === 2 || fact.b === 2).map((fact) => fact.id),
      )
      expect(factIdsForTables([...ALL_TABLES])).toEqual([...FACT_IDS])
    })

    test("returns [] for junk input", () => {
      expect(factIdsForTables([])).toEqual([])
      expect(factIdsForTables(null)).toEqual([])
    })
  })

  describe("factsForRegionTable", () => {
    test("region sizes are 1..8 for tables 2..9", () => {
      const sizes = ALL_TABLES.map((table) => factsForRegionTable(table).length)
      expect(sizes).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    test("selects facts by the larger operand", () => {
      expect(factsForRegionTable(3).map((f) => f.id)).toEqual(["2x3", "3x3"])
      expect(factsForRegionTable(9).every((f) => f.b === 9)).toBe(true)
    })

    test("the regions partition all 36 facts", () => {
      const ids = ALL_TABLES.flatMap((table) => factsForRegionTable(table).map((f) => f.id))
      expect(ids.length).toBe(36)
      expect(new Set(ids).size).toBe(36)
      expect(new Set(ids)).toEqual(new Set(FACT_IDS))
    })

    test("returns [] for an out-of-range table", () => {
      expect(factsForRegionTable(1)).toEqual([])
      expect(factsForRegionTable(10)).toEqual([])
      expect(factsForRegionTable(0)).toEqual([])
      expect(factsForRegionTable(4.5)).toEqual([])
      expect(factsForRegionTable("7")).toEqual([])
      expect(factsForRegionTable(null)).toEqual([])
    })

    test("returns a new array each call", () => {
      expect(factsForRegionTable(9)).not.toBe(factsForRegionTable(9))
    })
  })

  describe("randomOrientation", () => {
    test("rng below 0.5 keeps the canonical order", () => {
      expect(randomOrientation(getFact("3x8"), () => 0)).toEqual({ left: 3, right: 8 })
    })

    test("rng at or above 0.5 swaps the operands", () => {
      expect(randomOrientation(getFact("3x8"), () => 0.9)).toEqual({ left: 8, right: 3 })
    })

    test("0.4999 is a-first and 0.5 is b-first (boundary)", () => {
      expect(randomOrientation(getFact("6x7"), () => 0.4999)).toEqual({ left: 6, right: 7 })
      expect(randomOrientation(getFact("6x7"), () => 0.5)).toEqual({ left: 7, right: 6 })
    })

    test("squares return {a, a} for either rng value", () => {
      expect(randomOrientation(getFact("7x7"), () => 0)).toEqual({ left: 7, right: 7 })
      expect(randomOrientation(getFact("7x7"), () => 0.9)).toEqual({ left: 7, right: 7 })
    })

    test("consumes exactly one rng call, squares included", () => {
      const low = countingRng(0)
      randomOrientation(getFact("6x7"), low)
      expect(low.calls).toBe(1)

      const high = countingRng(0.9)
      randomOrientation(getFact("6x7"), high)
      expect(high.calls).toBe(1)

      const square = countingRng(0.9)
      randomOrientation(getFact("7x7"), square)
      expect(square.calls).toBe(1)
    })

    test("always returns the fact's own operands", () => {
      for (const fact of FACTS) {
        for (const value of [0, 0.75]) {
          const { left, right } = randomOrientation(fact, () => value)
          expect(left * right).toBe(fact.product)
          expect(new Set([left, right])).toEqual(new Set([fact.a, fact.b]))
        }
      }
    })

    test("defaults to Math.random when no rng is given", () => {
      for (let i = 0; i < 20; i += 1) {
        const { left, right } = randomOrientation(getFact("4x9"))
        expect(left * right).toBe(36)
        expect(new Set([left, right])).toEqual(new Set([4, 9]))
      }
    })

    test("does not mutate the fact", () => {
      const fact = getFact("6x7")
      randomOrientation(fact, () => 0.9)
      expect(fact).toEqual({ id: "6x7", a: 6, b: 7, product: 42, isSquare: false, isTough: true })
    })
  })
})
