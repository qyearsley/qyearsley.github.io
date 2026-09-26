import * as kk from "./knights-knaves.js"

describe("islanderVar", () => {
  test("lowercases and trims a name", () => {
    expect(kk.islanderVar(" A ")).toBe("a")
    expect(kk.islanderVar("B")).toBe("b")
  })
})

describe("buildConstraint", () => {
  test("skips islanders with no statement", () => {
    const islanders = [
      { name: "A", statement: "not b" },
      { name: "B", statement: "" },
    ]
    expect(kk.buildConstraint(islanders)).toBe("(a eq (not b))")
  })

  test("ANDs together every speaking islander's clause", () => {
    const islanders = [
      { name: "A", statement: "not b" },
      { name: "B", statement: "not a" },
    ]
    expect(kk.buildConstraint(islanders)).toBe("(a eq (not b)) and (b eq (not a))")
  })

  test("returns an empty string when nobody speaks", () => {
    expect(kk.buildConstraint([{ name: "A", statement: "" }])).toBe("")
    expect(kk.buildConstraint([])).toBe("")
  })
})

describe("describeConstraints", () => {
  test("describes only speaking islanders, lowercased", () => {
    const islanders = [
      { name: "A", statement: "not b" },
      { name: "B", statement: "" },
    ]
    expect(kk.describeConstraints(islanders)).toEqual(["a is a knight iff (not b)"])
  })
})

describe("solvePuzzle", () => {
  test("throws when no islander says anything", () => {
    expect(() => kk.solvePuzzle([{ name: "A", statement: "" }])).toThrow(
      "At least one islander needs to say something.",
    )
    expect(() => kk.solvePuzzle([])).toThrow()
  })

  test("throws when a statement fails to parse", () => {
    expect(() => kk.solvePuzzle([{ name: "A", statement: "a and" }])).toThrow()
  })

  test("'we are both knaves' has exactly one solution: A a knave, B a knight", () => {
    const islanders = [
      { name: "A", statement: "(not a) and (not b)" },
      { name: "B", statement: "" },
    ]
    const result = kk.solvePuzzle(islanders)
    expect(result.solutionCount).toBe(1)
    expect(result.table.rows[0]).toEqual(["a", "b", result.constraintExpr])
    expect(result.solutionRows).toEqual([["false", "true", "true"]])
  })

  test("the liar's paradox has no solution", () => {
    const result = kk.solvePuzzle([{ name: "A", statement: "not a" }])
    expect(result.solutionCount).toBe(0)
    expect(result.solutionRows).toEqual([])
  })

  test("two islanders who each call the other a knave have two solutions", () => {
    const islanders = [
      { name: "A", statement: "not b" },
      { name: "B", statement: "not a" },
    ]
    const result = kk.solvePuzzle(islanders)
    expect(result.solutionCount).toBe(2)
    // Exactly one of them is a knight, either one.
    const knightCounts = result.solutionRows.map(
      (row) => row.filter((cell) => cell === "true").length - 1, // -1 for the constraint column
    )
    expect(knightCounts).toEqual([1, 1])
  })

  test("constraintDescriptions lists one line per speaking islander", () => {
    const islanders = [
      { name: "A", statement: "not b" },
      { name: "B", statement: "not a" },
    ]
    const result = kk.solvePuzzle(islanders)
    expect(result.constraintDescriptions).toEqual([
      "a is a knight iff (not b)",
      "b is a knight iff (not a)",
    ])
  })
})

describe("PRESETS", () => {
  test("every preset solves without throwing and has at least one islander", () => {
    for (const preset of kk.PRESETS) {
      expect(preset.islanders.length).toBeGreaterThan(0)
      expect(() => kk.solvePuzzle(preset.islanders)).not.toThrow()
    }
  })

  test("'both-knaves' preset has a unique solution", () => {
    const preset = kk.PRESETS.find((p) => p.id === "both-knaves")
    expect(kk.solvePuzzle(preset.islanders).solutionCount).toBe(1)
  })

  test("'liars-paradox' preset has no solution", () => {
    const preset = kk.PRESETS.find((p) => p.id === "liars-paradox")
    expect(kk.solvePuzzle(preset.islanders).solutionCount).toBe(0)
  })

  test("'point-the-finger' preset has two solutions", () => {
    const preset = kk.PRESETS.find((p) => p.id === "point-the-finger")
    expect(kk.solvePuzzle(preset.islanders).solutionCount).toBe(2)
  })

  test("'three-islanders' preset has a unique solution: A knave, B knight, C knave", () => {
    const preset = kk.PRESETS.find((p) => p.id === "three-islanders")
    const result = kk.solvePuzzle(preset.islanders)
    expect(result.solutionCount).toBe(1)
    expect(result.table.rows[0].slice(0, 3)).toEqual(["a", "b", "c"])
    expect(result.solutionRows[0].slice(0, 3)).toEqual(["false", "true", "false"])
  })
})
