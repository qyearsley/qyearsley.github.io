/**
 * Inference Engine Tests
 *
 * Tests for all 10 inference rules
 */

import { inferNextSteps } from "../inference.js"
import { tokenize, Parser } from "../parser.js"

/**
 * Helper to create a step with parsed AST
 */
function createStep(id, expression, isPremise = true) {
  const tokens = tokenize(expression)
  const ast = new Parser(tokens).parse()
  return { id, expression, ast, isPremise }
}

describe("Inference Rules", () => {
  test("Double Negation: ~~P => P", async () => {
    const steps = [createStep(1, "~~P")]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions).toHaveLength(1)
    expect(conclusions[0].expression).toBe("P")
    expect(conclusions[0].justification).toBe("Double Negation")
    expect(conclusions[0].referencedStepIds).toEqual([1])
    expect(conclusions[0].ast).toBeDefined() // Verify AST is cached
  })

  test("De Morgan's Law: ~(P & Q) => ~P | ~Q", async () => {
    const steps = [createStep(1, "~(P & Q)")]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeGreaterThan(0)
    const deMorgan = conclusions.find((c) => c.justification === "De Morgan's Law")
    expect(deMorgan).toBeDefined()
    expect(deMorgan.expression).toBe("~P | ~Q")
    expect(deMorgan.ast).toBeDefined()
  })

  test("De Morgan's Law: ~(P | Q) => ~P & ~Q", async () => {
    const steps = [createStep(1, "~(P | Q)")]
    const conclusions = await inferNextSteps(steps)

    const deMorgan = conclusions.find((c) => c.justification === "De Morgan's Law")
    expect(deMorgan).toBeDefined()
    expect(deMorgan.expression).toBe("~P & ~Q")
  })

  test("Literal Simplification: ~true => false", async () => {
    const steps = [createStep(1, "~true")]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions).toHaveLength(1)
    expect(conclusions[0].expression).toBe("false")
    expect(conclusions[0].justification).toBe("Literal Simplification")
  })

  test("Literal Simplification: true & P => P", async () => {
    const steps = [createStep(1, "true & P")]
    const conclusions = await inferNextSteps(steps)

    const simplified = conclusions.find((c) => c.justification === "Literal Simplification")
    expect(simplified).toBeDefined()
    expect(simplified.expression).toBe("P")
  })

  test("Literal Simplification: false | P => P", async () => {
    const steps = [createStep(1, "false | P")]
    const conclusions = await inferNextSteps(steps)

    const simplified = conclusions.find((c) => c.justification === "Literal Simplification")
    expect(simplified).toBeDefined()
    expect(simplified.expression).toBe("P")
  })

  test("Simplification: P & Q => P, Q", async () => {
    const steps = [createStep(1, "P & Q")]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeGreaterThanOrEqual(2)
    const expressions = conclusions.map((c) => c.expression)
    expect(expressions).toContain("P")
    expect(expressions).toContain("Q")
    expect(conclusions.filter((c) => c.justification === "Simplification").length).toBe(2)
  })

  test("Modus Ponens: (P -> Q), P => Q", async () => {
    const steps = [createStep(1, "P -> Q"), createStep(2, "P")]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeGreaterThan(0)
    const modusPonens = conclusions.find((c) => c.justification === "Modus Ponens")
    expect(modusPonens).toBeDefined()
    expect(modusPonens.expression).toBe("Q")
    expect(modusPonens.referencedStepIds.sort()).toEqual([1, 2])
  })

  test("Modus Tollens: (P -> Q), ~Q => ~P", async () => {
    const steps = [createStep(1, "P -> Q"), createStep(2, "~Q")]
    const conclusions = await inferNextSteps(steps)

    const modusTollens = conclusions.find((c) => c.justification === "Modus Tollens")
    expect(modusTollens).toBeDefined()
    expect(modusTollens.expression).toBe("~P")
  })

  test("Disjunctive Syllogism: (P | Q), ~P => Q", async () => {
    const steps = [createStep(1, "P | Q"), createStep(2, "~P")]
    const conclusions = await inferNextSteps(steps)

    const disjSyll = conclusions.find((c) => c.justification === "Disjunctive Syllogism")
    expect(disjSyll).toBeDefined()
    expect(disjSyll.expression).toBe("Q")
  })

  test("Disjunctive Syllogism: (P | Q), ~Q => P", async () => {
    const steps = [createStep(1, "P | Q"), createStep(2, "~Q")]
    const conclusions = await inferNextSteps(steps)

    const disjSyll = conclusions.find((c) => c.justification === "Disjunctive Syllogism")
    expect(disjSyll).toBeDefined()
    expect(disjSyll.expression).toBe("P")
  })

  test("Hypothetical Syllogism: (P -> Q), (Q -> R) => (P -> R)", async () => {
    const steps = [createStep(1, "P -> Q"), createStep(2, "Q -> R")]
    const conclusions = await inferNextSteps(steps)

    const hypSyll = conclusions.find((c) => c.justification === "Hypothetical Syllogism")
    expect(hypSyll).toBeDefined()
    expect(hypSyll.expression).toBe("P -> R")
  })

  test("Constructive Dilemma: ((P -> Q) & (R -> S)), (P | R) => (Q | S)", async () => {
    const steps = [createStep(1, "(P -> Q) & (R -> S)"), createStep(2, "P | R")]
    const conclusions = await inferNextSteps(steps)

    const constrDilemma = conclusions.find((c) => c.justification === "Constructive Dilemma")
    expect(constrDilemma).toBeDefined()
    expect(constrDilemma.expression).toBe("Q | S")
  })

  test("Resolution: (P | Q), (~P | R) => (Q | R)", async () => {
    const steps = [createStep(1, "P | Q"), createStep(2, "~P | R")]
    const conclusions = await inferNextSteps(steps)

    const resolution = conclusions.find((c) => c.justification === "Resolution")
    expect(resolution).toBeDefined()
    expect(resolution.expression).toBe("Q | R")
  })

  test("Adjunction: P, Q => P & Q (simple atoms only)", async () => {
    const steps = [createStep(1, "P"), createStep(2, "Q")]
    const conclusions = await inferNextSteps(steps)

    const adjunction = conclusions.find((c) => c.justification === "Adjunction")
    expect(adjunction).toBeDefined()
    expect(adjunction.expression).toBe("P & Q")
  })

  test("Contradiction Detection: P, ~P => false", async () => {
    const steps = [createStep(1, "P"), createStep(2, "~P")]
    const conclusions = await inferNextSteps(steps)

    const contradiction = conclusions.find((c) => c.justification.includes("Contradiction"))
    expect(contradiction).toBeDefined()
    expect(contradiction.expression).toBe("false")
  })

  test("Does not duplicate existing conclusions", async () => {
    const steps = [createStep(1, "~~P"), createStep(2, "P")]
    const conclusions = await inferNextSteps(steps)

    // Should not derive P again via double negation
    expect(conclusions.filter((c) => c.expression === "P")).toHaveLength(0)
  })

  test("Limits output to 3 conclusions max", async () => {
    // Create premises that will generate many conclusions
    const steps = [createStep(1, "P"), createStep(2, "Q"), createStep(3, "R"), createStep(4, "S")]
    const conclusions = await inferNextSteps(steps)

    expect(conclusions.length).toBeLessThanOrEqual(3)
  })

  test("Complex multi-step proof", async () => {
    // Start with Modus Ponens premises
    const steps = [createStep(1, "P -> Q"), createStep(2, "P")]

    // First inference should derive Q
    let conclusions = await inferNextSteps(steps)
    expect(conclusions.find((c) => c.expression === "Q")).toBeDefined()

    // Add Q to steps
    const qConclusion = conclusions.find((c) => c.expression === "Q")
    steps.push({
      id: 3,
      expression: "Q",
      ast: qConclusion.ast,
      isPremise: false,
      justification: "Modus Ponens",
      referencedStepIds: [1, 2],
    })

    // Add Q -> R
    steps.push(createStep(4, "Q -> R"))

    // Should now derive R via Modus Ponens
    conclusions = await inferNextSteps(steps)
    const derivedR = conclusions.find((c) => c.expression === "R")
    expect(derivedR).toBeDefined()
    expect(derivedR.justification).toBe("Modus Ponens")
  })

  test("Handles steps without cached AST (fallback parsing)", async () => {
    const steps = [{ id: 1, expression: "~~P", isPremise: true }] // No ast property
    const conclusions = await inferNextSteps(steps)

    expect(conclusions).toHaveLength(1)
    expect(conclusions[0].expression).toBe("P")
  })

  test("Works with descriptive atom names", async () => {
    const steps = [createStep(1, "raining -> wet_street"), createStep(2, "raining")]
    const conclusions = await inferNextSteps(steps)
    const derived = conclusions.find((c) => c.expression === "wet_street")
    expect(derived).toBeDefined()
    expect(derived.justification).toBe("Modus Ponens")
  })

  test("Resolution works with all negation positions", async () => {
    // Test: (A | B), (C | ~A) => (B | C)
    const steps = [createStep(1, "A | B"), createStep(2, "C | ~A")]
    const conclusions = await inferNextSteps(steps)
    const resolution = conclusions.find((c) => c.justification === "Resolution")
    expect(resolution).toBeDefined()
    // Should derive B | C
    expect(resolution.expression).toMatch(/B.*C/)
  })

  test("Resolution case 4: right-right complementary literals", async () => {
    // Test: (B | A), (C | ~A) => (B | C)
    // This tests the case where both complementary literals are on the right
    const steps = [createStep(1, "B | A"), createStep(2, "C | ~A")]
    const conclusions = await inferNextSteps(steps)
    const resolution = conclusions.find((c) => c.justification === "Resolution")
    expect(resolution).toBeDefined()
    expect(resolution.expression).toMatch(/B.*C/)
  })

  test("Does not add duplicate conclusions in same inference batch", async () => {
    // This tests the dedup logic
    // Create a scenario where the same conclusion could be derived multiple ways
    const steps = [
      createStep(1, "P & Q"), // Simplification will derive P and Q
      createStep(2, "P"), // P already exists
    ]
    const conclusions = await inferNextSteps(steps)
    // Should not derive P (already exists) or Q twice
    const pConclusions = conclusions.filter((c) => c.expression === "P")
    expect(pConclusions).toHaveLength(0) // P shouldn't be derived since it exists
  })
})
