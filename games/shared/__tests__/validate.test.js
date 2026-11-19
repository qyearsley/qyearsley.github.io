import { isPlainObject, nonNegativeInt } from "../validate.js"

describe("isPlainObject", () => {
  test("accepts objects only", () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject("x")).toBe(false)
    expect(isPlainObject(3)).toBe(false)
  })
})

describe("nonNegativeInt", () => {
  test("floors and clamps finite numbers", () => {
    expect(nonNegativeInt(3)).toBe(3)
    expect(nonNegativeInt(3.9)).toBe(3)
    expect(nonNegativeInt(-2)).toBe(0)
  })

  test("returns 0 for anything else", () => {
    expect(nonNegativeInt(NaN)).toBe(0)
    expect(nonNegativeInt(Infinity)).toBe(0)
    expect(nonNegativeInt("5")).toBe(0)
    expect(nonNegativeInt(undefined)).toBe(0)
  })
})
