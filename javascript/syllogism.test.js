import { checkSyllogism, DEFAULT_STATE, PRESETS } from "./syllogism.js"

describe("checkSyllogism: presets", () => {
  test.each(PRESETS)("$label", (preset) => {
    const result = checkSyllogism(preset.premise1, preset.premise2, preset.conclusion)
    expect(result.valid).toBe(preset.valid)
    expect(result.contradiction).toBe(false)
  })
})

describe("checkSyllogism: the idea doc's own example", () => {
  test("All A are B; some C are A; so some C are B -- valid", () => {
    const result = checkSyllogism(
      DEFAULT_STATE.premise1,
      DEFAULT_STATE.premise2,
      DEFAULT_STATE.conclusion,
    )
    expect(result.valid).toBe(true)
    expect(result.contradiction).toBe(false)
  })
})

describe("checkSyllogism: contradictory premises", () => {
  test("No term1 are term2; some term1 are term2 -- contradiction, not a validity verdict", () => {
    const result = checkSyllogism(
      { quantifier: "E", subject: "term1", predicate: "term2" },
      { quantifier: "I", subject: "term1", predicate: "term2" },
      { quantifier: "A", subject: "term1", predicate: "term3" },
    )
    expect(result.contradiction).toBe(true)
    expect(result.valid).toBe(false)
    expect(result.explanation).toMatch(/contradict/)
  })
})
