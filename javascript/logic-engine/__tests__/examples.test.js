/**
 * Predefined Examples Tests
 */

import { PREDEFINED_EXAMPLES, findExampleByName } from "../examples.js"

describe("findExampleByName", () => {
  test("finds an example by its exact name", () => {
    const example = findExampleByName("Modus Ponens")
    expect(example).toBeDefined()
    expect(example.premises).toEqual(["rain -> wet", "rain"])
  })

  test("returns undefined for an unknown name", () => {
    expect(findExampleByName("Not A Real Example")).toBeUndefined()
  })

  test("is case-sensitive", () => {
    expect(findExampleByName("modus ponens")).toBeUndefined()
  })

  test("every predefined example can be found by its own name", () => {
    for (const example of PREDEFINED_EXAMPLES) {
      expect(findExampleByName(example.name)).toBe(example)
    }
  })
})
