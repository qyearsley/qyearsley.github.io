import { describe, expect, test } from "@jest/globals"
import { LESSONS, SENTENCES, WORDS, FINGER_OF, keysUpTo } from "../js/lessons.js"
import { Run, practiceLine, stars, updateErrors, wordsFor, wpm } from "../js/engine.js"

/** A repeatable stand-in for Math.random. */
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

describe("lesson data", () => {
  test("every key is taught once, and every taught key has a finger", () => {
    const all = LESSONS.join("")
    expect(new Set(all).size).toBe(all.length)
    for (const key of all) expect(FINGER_OF[key]).toBeDefined()
  })

  test("all 26 letters are taught", () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz")
      expect(keysUpTo(LESSONS.length - 1)).toContain(ch)
  })

  test("the home row splits between the hands", () => {
    expect([..."asdf"].map((k) => FINGER_OF[k])).toEqual([0, 1, 2, 3])
    expect([..."jkl;"].map((k) => FINGER_OF[k])).toEqual([4, 5, 6, 7])
  })

  test("words and sentences use only taught keys", () => {
    const taught = keysUpTo(LESSONS.length - 1) + " "
    for (const text of [...WORDS, ...SENTENCES]) {
      for (const ch of text) expect(taught).toContain(ch)
    }
  })
})

describe("practiceLine", () => {
  test("uses only keys taught so far", () => {
    const rng = seeded()
    LESSONS.forEach((_, i) => {
      const allowed = keysUpTo(i) + " "
      for (const ch of practiceLine(i, {}, rng)) expect(allowed).toContain(ch)
    })
  })

  test("is about the requested length", () => {
    const line = practiceLine(5, {}, seeded(), 24)
    expect(line.length).toBeGreaterThanOrEqual(24)
    expect(line.length).toBeLessThan(40)
  })

  test("the first lesson drills letter groups, later lessons use real words", () => {
    expect(wordsFor(keysUpTo(0))).toEqual([])
    const words = practiceLine(6, {}, seeded()).split(" ")
    for (const word of words) expect(WORDS).toContain(word.replace(/[;.]$/, ""))
  })

  test("practices punctuation keys after words", () => {
    const rng = seeded(5)
    const text = (i) => Array.from({ length: 10 }, () => practiceLine(i, {}, rng)).join(" ")
    expect(text(3)).toMatch(/[a-z];/)
    expect(text(13)).toMatch(/[a-z]\./)
  })

  test("favors the lesson's new keys", () => {
    const text = Array.from({ length: 20 }, () => practiceLine(1, {}, seeded(7))).join("")
    const fresh = [...text].filter((ch) => "dk".includes(ch)).length
    const old = [...text].filter((ch) => "fj".includes(ch)).length
    expect(fresh).toBeGreaterThan(old)
  })

  test("favors keys the player misses", () => {
    const count = (errors) => {
      const rng = seeded(3)
      const text = Array.from({ length: 30 }, () => practiceLine(2, errors, rng)).join("")
      return [...text].filter((ch) => ch === "f").length
    }
    expect(count({ f: 5 })).toBeGreaterThan(count({}))
  })
})

describe("Run", () => {
  test("moves forward only on the right key", () => {
    const run = new Run("ab")
    expect(run.press("x")).toBe(false)
    expect(run.pos).toBe(0)
    expect(run.press("a")).toBe(true)
    expect(run.press("b")).toBe(true)
    expect(run.done).toBe(true)
    expect(run.press("b")).toBe(false)
  })

  test("accuracy counts letters that took more than one try once", () => {
    const run = new Run("abcd")
    run.press("x")
    run.press("y")
    for (const ch of "abcd") run.press(ch)
    expect(run.accuracy).toBe(0.75)
    expect(run.misses).toEqual({ a: 2 })
  })
})

describe("scoring", () => {
  test("stars", () => {
    expect(stars(1)).toBe(3)
    expect(stars(0.97)).toBe(3)
    expect(stars(0.9)).toBe(2)
    expect(stars(0.5)).toBe(1)
  })

  test("wpm counts five characters as a word", () => {
    expect(wpm(250, 60000)).toBe(50)
    expect(wpm(10, 0)).toBe(0)
  })

  test("updateErrors adds misses and forgives keys typed cleanly", () => {
    const run = new Run("fd")
    run.press("x")
    run.press("f")
    run.press("d")
    expect(updateErrors({ d: 2, k: 1 }, run)).toEqual({ f: 1, d: 1, k: 1 })
    const clean = new Run("d")
    clean.press("d")
    expect(updateErrors({ d: 1 }, clean)).toEqual({})
  })
})
