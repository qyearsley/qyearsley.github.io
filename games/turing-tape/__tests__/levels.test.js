import { describe, test, expect } from "@jest/globals"
import { levels, demos, levelFromParam } from "../js/levels.js"
import { TuringMachine } from "../js/TuringMachine.js"

// Step bound for the demo halting test. Every demo halts in under 20 steps, so
// 100 is generous. Keep it well below TuringMachine's MAX_STEPS (500): at that
// cap the machine sets halted = true itself, so a bound of 500 or more would
// let a demo that never halts pass the test.
const DEMO_STEP_BOUND = 100

function rulesFromArray(ruleArray) {
  const map = new Map()
  for (const [state, read, write, move, nextState] of ruleArray) {
    map.set(`${state},${read}`, { write, move, nextState })
  }
  return map
}

describe("levels", () => {
  test("each level has the required fields with correct types", () => {
    for (const level of levels) {
      expect(typeof level.id).toBe("string")
      expect(typeof level.name).toBe("string")
      expect(typeof level.description).toBe("string")
      expect(Array.isArray(level.tape)).toBe(true)
      expect(Array.isArray(level.target)).toBe(true)
      expect(typeof level.headStart).toBe("number")
      expect(Array.isArray(level.states)).toBe(true)
      expect(Array.isArray(level.symbols)).toBe(true)
    }
  })

  test("level ids are unique", () => {
    const ids = levels.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test("each level includes a HALT state and the blank symbol", () => {
    for (const level of levels) {
      expect(level.states).toContain("HALT")
      expect(level.symbols).toContain("_")
    }
  })

  test("headStart is a valid index into the level tape", () => {
    for (const level of levels) {
      expect(level.headStart).toBeGreaterThanOrEqual(0)
      expect(level.headStart).toBeLessThan(level.tape.length)
    }
  })

  test("every tape and target symbol is declared in level.symbols", () => {
    for (const level of levels) {
      const declared = new Set(level.symbols)
      for (const sym of [...level.tape, ...level.target]) {
        expect(declared.has(sym)).toBe(true)
      }
    }
  })
})

describe("demos", () => {
  test("each demo has the required fields with correct types", () => {
    for (const demo of demos) {
      expect(typeof demo.id).toBe("string")
      expect(typeof demo.name).toBe("string")
      expect(typeof demo.description).toBe("string")
      expect(Array.isArray(demo.tape)).toBe(true)
      expect(typeof demo.headStart).toBe("number")
      expect(Array.isArray(demo.states)).toBe(true)
      expect(Array.isArray(demo.symbols)).toBe(true)
      expect(Array.isArray(demo.rules)).toBe(true)
      expect(demo.rules.length).toBeGreaterThan(0)
    }
  })

  test("demo rules reference only declared states and symbols", () => {
    for (const demo of demos) {
      const states = new Set(demo.states)
      const symbols = new Set(demo.symbols)
      const moves = new Set(["L", "R", "S"])
      for (const [state, read, write, move, nextState] of demo.rules) {
        expect(states.has(state)).toBe(true)
        expect(symbols.has(read)).toBe(true)
        expect(symbols.has(write)).toBe(true)
        expect(moves.has(move)).toBe(true)
        expect(states.has(nextState)).toBe(true)
      }
    }
  })

  test("each demo halts", () => {
    for (const demo of demos) {
      const tm = new TuringMachine([...demo.tape], rulesFromArray(demo.rules), "A", demo.headStart)
      let steps = 0
      while (!tm.halted && steps < DEMO_STEP_BOUND) {
        tm.step()
        steps++
      }
      expect(tm.halted).toBe(true)
      // The demo must reach HALT or run out of rules on its own. Halting by
      // hitting the 500-step cap would mean it never terminates.
      expect(tm.haltReason).not.toBe("max-steps")
    }
  })
})

describe("levelFromParam", () => {
  test("resolves a 1-based index to the matching level", () => {
    expect(levelFromParam("1")).toBe(levels[0])
    expect(levelFromParam("2")).toBe(levels[1])
    expect(levelFromParam(String(levels.length))).toBe(levels[levels.length - 1])
  })

  test("returns null when the value is missing", () => {
    expect(levelFromParam(null)).toBeNull()
  })

  test("returns null for non-numeric input", () => {
    expect(levelFromParam("flip-it")).toBeNull()
    expect(levelFromParam("")).toBeNull()
  })

  test("returns null for a non-integer number", () => {
    expect(levelFromParam("1.5")).toBeNull()
  })

  test("returns null when the index is out of range", () => {
    expect(levelFromParam("0")).toBeNull()
    expect(levelFromParam("-1")).toBeNull()
    expect(levelFromParam(String(levels.length + 1))).toBeNull()
  })
})
