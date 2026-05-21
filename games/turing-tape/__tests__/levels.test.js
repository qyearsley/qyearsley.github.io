import { describe, test, expect } from "@jest/globals"
import { levels, demos } from "../js/levels.js"
import { TuringMachine } from "../js/TuringMachine.js"

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
      expect(typeof level.maxSteps).toBe("number")
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
      expect(typeof demo.maxSteps).toBe("number")
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

  test("each demo halts within its declared maxSteps", () => {
    for (const demo of demos) {
      const tm = new TuringMachine([...demo.tape], rulesFromArray(demo.rules), "A", demo.headStart)
      let steps = 0
      while (!tm.halted && steps <= demo.maxSteps) {
        tm.step()
        steps++
      }
      expect(tm.halted).toBe(true)
    }
  })
})
