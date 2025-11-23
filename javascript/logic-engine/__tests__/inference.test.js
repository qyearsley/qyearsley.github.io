/**
 * Inference Engine Tests
 *
 * Tests for all 10 inference rules
 */

import { inferNextSteps } from "../inference.js"

describe("Inference Rules", () => {
  test("Double Negation: ~~P => P", async () => {
    const steps = [{ id: 1, expression: "~~P", isPremise: true }]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions).toHaveLength(1)
    expect(conclusions[0].expression).toBe("P")
    expect(conclusions[0].justification).toBe("Double Negation")
    expect(conclusions[0].referencedStepIds).toEqual([1])
  })

  test("De Morgan's Law: ~(P & Q) => ~P | ~Q", async () => {
    const steps = [{ id: 1, expression: "~(P & Q)", isPremise: true }]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeGreaterThan(0)
    const deMorgan = conclusions.find((c) => c.justification === "De Morgan's Law")
    expect(deMorgan).toBeDefined()
    expect(deMorgan.expression).toBe("~P | ~Q")
  })

  test("De Morgan's Law: ~(P | Q) => ~P & ~Q", async () => {
    const steps = [{ id: 1, expression: "~(P | Q)", isPremise: true }]
    const conclusions = await inferNextSteps(steps)

    const deMorgan = conclusions.find((c) => c.justification === "De Morgan's Law")
    expect(deMorgan).toBeDefined()
    expect(deMorgan.expression).toBe("~P & ~Q")
  })

  test("Simplification: P & Q => P, Q", async () => {
    const steps = [{ id: 1, expression: "P & Q", isPremise: true }]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeGreaterThanOrEqual(2)
    const expressions = conclusions.map((c) => c.expression)
    expect(expressions).toContain("P")
    expect(expressions).toContain("Q")
    expect(conclusions.filter((c) => c.justification === "Simplification").length).toBe(2)
  })

  test("Modus Ponens: (P -> Q), P => Q", async () => {
    const steps = [
      { id: 1, expression: "P -> Q", isPremise: true },
      { id: 2, expression: "P", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeGreaterThan(0)
    const modusPonens = conclusions.find((c) => c.justification === "Modus Ponens")
    expect(modusPonens).toBeDefined()
    expect(modusPonens.expression).toBe("Q")
    expect(modusPonens.referencedStepIds.sort()).toEqual([1, 2])
  })

  test("Modus Tollens: (P -> Q), ~Q => ~P", async () => {
    const steps = [
      { id: 1, expression: "P -> Q", isPremise: true },
      { id: 2, expression: "~Q", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    const modusTollens = conclusions.find((c) => c.justification === "Modus Tollens")
    expect(modusTollens).toBeDefined()
    expect(modusTollens.expression).toBe("~P")
  })

  test("Disjunctive Syllogism: (P | Q), ~P => Q", async () => {
    const steps = [
      { id: 1, expression: "P | Q", isPremise: true },
      { id: 2, expression: "~P", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    const disjSyll = conclusions.find((c) => c.justification === "Disjunctive Syllogism")
    expect(disjSyll).toBeDefined()
    expect(disjSyll.expression).toBe("Q")
  })

  test("Disjunctive Syllogism: (P | Q), ~Q => P", async () => {
    const steps = [
      { id: 1, expression: "P | Q", isPremise: true },
      { id: 2, expression: "~Q", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    const disjSyll = conclusions.find((c) => c.justification === "Disjunctive Syllogism")
    expect(disjSyll).toBeDefined()
    expect(disjSyll.expression).toBe("P")
  })

  test("Hypothetical Syllogism: (P -> Q), (Q -> R) => (P -> R)", async () => {
    const steps = [
      { id: 1, expression: "P -> Q", isPremise: true },
      { id: 2, expression: "Q -> R", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    const hypSyll = conclusions.find((c) => c.justification === "Hypothetical Syllogism")
    expect(hypSyll).toBeDefined()
    expect(hypSyll.expression).toBe("P -> R")
  })

  test("Constructive Dilemma: ((P -> Q) & (R -> S)), (P | R) => (Q | S)", async () => {
    const steps = [
      { id: 1, expression: "(P -> Q) & (R -> S)", isPremise: true },
      { id: 2, expression: "P | R", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    const constrDilemma = conclusions.find((c) => c.justification === "Constructive Dilemma")
    expect(constrDilemma).toBeDefined()
    expect(constrDilemma.expression).toBe("Q | S")
  })

  test("Resolution: (P | Q), (~P | R) => (Q | R)", async () => {
    const steps = [
      { id: 1, expression: "P | Q", isPremise: true },
      { id: 2, expression: "~P | R", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    const resolution = conclusions.find((c) => c.justification === "Resolution")
    expect(resolution).toBeDefined()
    expect(resolution.expression).toBe("Q | R")
  })

  test("Adjunction: P, Q => P & Q (simple atoms only)", async () => {
    const steps = [
      { id: 1, expression: "P", isPremise: true },
      { id: 2, expression: "Q", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    const adjunction = conclusions.find((c) => c.justification === "Adjunction")
    expect(adjunction).toBeDefined()
    expect(adjunction.expression).toBe("P & Q")
  })

  test("Does not duplicate existing conclusions", async () => {
    const steps = [
      { id: 1, expression: "~~P", isPremise: true },
      { id: 2, expression: "P", isPremise: true }, // Already have P
    ]
    const conclusions = await inferNextSteps(steps)

    // Should not derive P again via double negation
    expect(conclusions.filter((c) => c.expression === "P")).toHaveLength(0)
  })

  test("Limits output to 3 conclusions max", async () => {
    // Create premises that will generate many conclusions
    const steps = [
      { id: 1, expression: "P", isPremise: true },
      { id: 2, expression: "Q", isPremise: true },
      { id: 3, expression: "R", isPremise: true },
      { id: 4, expression: "S", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeLessThanOrEqual(3)
  })

  test("Complex multi-step proof", async () => {
    // Start with Modus Ponens premises
    const steps = [
      { id: 1, expression: "P -> Q", isPremise: true },
      { id: 2, expression: "P", isPremise: true },
    ]

    // First inference should derive Q
    let conclusions = await inferNextSteps(steps)
    expect(conclusions.find((c) => c.expression === "Q")).toBeDefined()

    // Add Q to steps
    steps.push({
      id: 3,
      expression: "Q",
      isPremise: false,
      justification: "Modus Ponens",
      referencedStepIds: [1, 2],
    })

    // Add Q -> R
    steps.push({ id: 4, expression: "Q -> R", isPremise: true })

    // Should now derive R via Modus Ponens
    conclusions = await inferNextSteps(steps)
    const derivedR = conclusions.find((c) => c.expression === "R")
    expect(derivedR).toBeDefined()
    expect(derivedR.justification).toBe("Modus Ponens")
  })

  test("Handles unparseable expressions gracefully", async () => {
    const steps = [{ id: 1, expression: "invalid syntax @#$", isPremise: true }]
    const conclusions = await inferNextSteps(steps)
    // Should not crash, just return no conclusions
    expect(conclusions).toEqual([])
  })

  test("Works with descriptive atom names", async () => {
    const steps = [
      { id: 1, expression: "raining -> wet_street", isPremise: true },
      { id: 2, expression: "raining", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)
    const derived = conclusions.find((c) => c.expression === "wet_street")
    expect(derived).toBeDefined()
    expect(derived.justification).toBe("Modus Ponens")
  })

  test("Resolution works with all negation positions", async () => {
    // Test: (A | B), (C | ~A) => (B | C)
    const steps = [
      { id: 1, expression: "A | B", isPremise: true },
      { id: 2, expression: "C | ~A", isPremise: true },
    ]
    const conclusions = await inferNextSteps(steps)
    const resolution = conclusions.find((c) => c.justification === "Resolution")
    expect(resolution).toBeDefined()
    // Should derive B | C
    expect(resolution.expression).toMatch(/B.*C/)
  })
})
