import { describe, test, expect } from "@jest/globals"
import { levels, levelFromParam } from "../js/levels.js"

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

describe("level translations", () => {
  test("each level has a Chinese name and description", () => {
    for (const level of levels) {
      expect(level.zh.name.length).toBeGreaterThan(0)
      expect(level.zh.description.length).toBeGreaterThan(0)
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
