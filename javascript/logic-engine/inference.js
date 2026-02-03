/**
 * Logical Inference Engine
 *
 * Implements classical propositional logic inference rules to derive new
 * conclusions from existing premises. All rules are sound (they preserve truth).
 *
 * Implemented rules:
 * 1. Double Negation: ~~A => A
 * 2. De Morgan's Laws: ~(A & B) => ~A | ~B, ~(A | B) => ~A & ~B
 * 3. Simplification: A & B => A, B
 * 4. Modus Ponens: (P -> Q), P => Q
 * 5. Modus Tollens: (P -> Q), ~Q => ~P
 * 6. Disjunctive Syllogism: (P | Q), ~P => Q
 * 7. Hypothetical Syllogism: (A -> B), (B -> C) => (A -> C)
 * 8. Constructive Dilemma: ((A -> B) & (C -> D)), (A | C) => (B | D)
 * 9. Resolution: (A | B), (~A | C) => (B | C)
 * 10. Adjunction: P, Q => P & Q (restricted to simple propositions)
 */

"use strict"

import { tokenize, Parser, areEqual, isNegation, isSimple } from "./parser.js"
import { formatAST } from "./formatter.js"

/**
 * A derived conclusion from inference
 * @typedef {Object} DerivedConclusion
 * @property {string} expression - The derived logical expression
 * @property {import('./parser.js').ASTNode} ast - The parsed AST (cached for performance)
 * @property {string} justification - The inference rule name
 * @property {number[]} referencedStepIds - IDs of the steps used in this inference
 */

/**
 * A step in the proof (premise or derived)
 * @typedef {Object} ProofStep
 * @property {number} id - Unique step number (1-indexed)
 * @property {string} expression - The logical expression
 * @property {boolean} isPremise - True if user-entered, false if derived
 * @property {string} [justification] - The inference rule (for derived steps)
 * @property {number[]} [referencedStepIds] - Parent step IDs (for derived steps)
 */

/**
 * Internal representation of a parsed step
 * @typedef {Object} ParsedStep
 * @property {number} id - Step ID
 * @property {import('./parser.js').ASTNode} ast - Parsed AST
 * @property {string} raw - Original string expression
 */

/**
 * Type for the addConclusion callback
 * @callback AddConclusionFn
 * @param {import('./parser.js').ASTNode} ast - The conclusion AST
 * @param {string} rule - The inference rule name
 * @param {number[]} refs - Referenced step IDs
 */

/**
 * Applies Double Negation rule: ~~A => A
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyDoubleNegation(parsed, addConclusion) {
  for (const step of parsed) {
    if (step.ast.type === "NOT") {
      const inner = step.ast.operand
      if (inner.type === "NOT") {
        addConclusion(inner.operand, "Double Negation", [step.id])
      }
    }
  }
}

/**
 * Applies Literal Simplification rules for true/false constants
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyLiteralSimplification(parsed, addConclusion) {
  for (const step of parsed) {
    // ~true → false, ~false → true
    if (step.ast.type === "NOT" && step.ast.operand.type === "LITERAL") {
      const newValue = !step.ast.operand.value
      addConclusion({ type: "LITERAL", value: newValue }, "Literal Simplification", [step.id])
    }

    // Binary operations with literals
    if (step.ast.type === "BINARY") {
      const { left, right, operator } = step.ast

      // Conjunction simplifications
      if (operator === "&") {
        if (left.type === "LITERAL" && left.value === true) {
          addConclusion(right, "Literal Simplification", [step.id])
        } else if (right.type === "LITERAL" && right.value === true) {
          addConclusion(left, "Literal Simplification", [step.id])
        } else if (left.type === "LITERAL" && left.value === false) {
          addConclusion({ type: "LITERAL", value: false }, "Literal Simplification", [step.id])
        } else if (right.type === "LITERAL" && right.value === false) {
          addConclusion({ type: "LITERAL", value: false }, "Literal Simplification", [step.id])
        }
      }

      // Disjunction simplifications
      if (operator === "|") {
        if (left.type === "LITERAL" && left.value === true) {
          addConclusion({ type: "LITERAL", value: true }, "Literal Simplification", [step.id])
        } else if (right.type === "LITERAL" && right.value === true) {
          addConclusion({ type: "LITERAL", value: true }, "Literal Simplification", [step.id])
        } else if (left.type === "LITERAL" && left.value === false) {
          addConclusion(right, "Literal Simplification", [step.id])
        } else if (right.type === "LITERAL" && right.value === false) {
          addConclusion(left, "Literal Simplification", [step.id])
        }
      }

      // Implication simplifications
      if (operator === "->") {
        if (left.type === "LITERAL" && left.value === true) {
          addConclusion(right, "Literal Simplification", [step.id])
        } else if (left.type === "LITERAL" && left.value === false) {
          addConclusion({ type: "LITERAL", value: true }, "Literal Simplification", [step.id])
        } else if (right.type === "LITERAL" && right.value === true) {
          addConclusion({ type: "LITERAL", value: true }, "Literal Simplification", [step.id])
        }
      }
    }
  }
}

/**
 * Applies De Morgan's Laws: ~(A & B) => ~A | ~B, ~(A | B) => ~A & ~B
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyDeMorgan(parsed, addConclusion) {
  for (const step of parsed) {
    if (step.ast.type === "NOT") {
      const inner = step.ast.operand

      if (inner.type === "BINARY" && inner.operator === "&") {
        // ~(A & B) => ~A | ~B
        const newAst = {
          type: "BINARY",
          operator: "|",
          left: { type: "NOT", operand: inner.left },
          right: { type: "NOT", operand: inner.right },
        }
        addConclusion(newAst, "De Morgan's Law", [step.id])
      } else if (inner.type === "BINARY" && inner.operator === "|") {
        // ~(A | B) => ~A & ~B
        const newAst = {
          type: "BINARY",
          operator: "&",
          left: { type: "NOT", operand: inner.left },
          right: { type: "NOT", operand: inner.right },
        }
        addConclusion(newAst, "De Morgan's Law", [step.id])
      }
    }
  }
}

/**
 * Applies Simplification rule: A & B => A, B
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applySimplification(parsed, addConclusion) {
  for (const step of parsed) {
    if (step.ast.type === "BINARY" && step.ast.operator === "&") {
      addConclusion(step.ast.left, "Simplification", [step.id])
      addConclusion(step.ast.right, "Simplification", [step.id])
    }
  }
}

/**
 * Applies Modus Ponens: (P -> Q), P => Q
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyModusPonens(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue

      const p1 = parsed[i]
      const p2 = parsed[j]

      if (p1.ast.type === "BINARY" && p1.ast.operator === "->") {
        if (areEqual(p1.ast.left, p2.ast)) {
          addConclusion(p1.ast.right, "Modus Ponens", [p1.id, p2.id])
        }
      }
    }
  }
}

/**
 * Applies Modus Tollens: (P -> Q), ~Q => ~P
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyModusTollens(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue

      const p1 = parsed[i]
      const p2 = parsed[j]

      if (p1.ast.type === "BINARY" && p1.ast.operator === "->") {
        if (isNegation(p1.ast.right, p2.ast)) {
          addConclusion({ type: "NOT", operand: p1.ast.left }, "Modus Tollens", [p1.id, p2.id])
        }
      }
    }
  }
}

/**
 * Applies Disjunctive Syllogism: (P | Q), ~P => Q
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyDisjunctiveSyllogism(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue

      const p1 = parsed[i]
      const p2 = parsed[j]

      if (p1.ast.type === "BINARY" && p1.ast.operator === "|") {
        if (isNegation(p1.ast.left, p2.ast)) {
          addConclusion(p1.ast.right, "Disjunctive Syllogism", [p1.id, p2.id])
        } else if (isNegation(p1.ast.right, p2.ast)) {
          addConclusion(p1.ast.left, "Disjunctive Syllogism", [p1.id, p2.id])
        }
      }
    }
  }
}

/**
 * Applies Hypothetical Syllogism: (A -> B), (B -> C) => (A -> C)
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyHypotheticalSyllogism(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue

      const p1 = parsed[i]
      const p2 = parsed[j]

      if (
        p1.ast.type === "BINARY" &&
        p1.ast.operator === "->" &&
        p2.ast.type === "BINARY" &&
        p2.ast.operator === "->"
      ) {
        if (areEqual(p1.ast.right, p2.ast.left)) {
          addConclusion(
            {
              type: "BINARY",
              operator: "->",
              left: p1.ast.left,
              right: p2.ast.right,
            },
            "Hypothetical Syllogism",
            [p1.id, p2.id],
          )
        }
      }
    }
  }
}

/**
 * Applies Constructive Dilemma: ((A -> B) & (C -> D)), (A | C) => (B | D)
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyConstructiveDilemma(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue

      const p1 = parsed[i]
      const p2 = parsed[j]

      if (p1.ast.type === "BINARY" && p1.ast.operator === "&") {
        const left = p1.ast.left
        const right = p1.ast.right

        if (
          left.type === "BINARY" &&
          left.operator === "->" &&
          right.type === "BINARY" &&
          right.operator === "->"
        ) {
          const A = left.left
          const B = left.right
          const C = right.left
          const D = right.right

          if (p2.ast.type === "BINARY" && p2.ast.operator === "|") {
            if (
              (areEqual(p2.ast.left, A) && areEqual(p2.ast.right, C)) ||
              (areEqual(p2.ast.left, C) && areEqual(p2.ast.right, A))
            ) {
              addConclusion(
                {
                  type: "BINARY",
                  operator: "|",
                  left: B,
                  right: D,
                },
                "Constructive Dilemma",
                [p1.id, p2.id],
              )
            }
          }
        }
      }
    }
  }
}

/**
 * Applies Resolution: (A | B), (~A | C) => (B | C)
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyResolution(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue

      const p1 = parsed[i]
      const p2 = parsed[j]

      if (
        p1.ast.type === "BINARY" &&
        p1.ast.operator === "|" &&
        p2.ast.type === "BINARY" &&
        p2.ast.operator === "|"
      ) {
        // Check all four cases for complementary literals
        if (isNegation(p1.ast.left, p2.ast.left)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.right, right: p2.ast.right },
            "Resolution",
            [p1.id, p2.id],
          )
        } else if (isNegation(p1.ast.left, p2.ast.right)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.right, right: p2.ast.left },
            "Resolution",
            [p1.id, p2.id],
          )
        } else if (isNegation(p1.ast.right, p2.ast.left)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.left, right: p2.ast.right },
            "Resolution",
            [p1.id, p2.id],
          )
        } else if (isNegation(p1.ast.right, p2.ast.right)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.left, right: p2.ast.left },
            "Resolution",
            [p1.id, p2.id],
          )
        }
      }
    }
  }
}

/**
 * Applies Adjunction: P, Q => P & Q (restricted to simple propositions)
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function applyAdjunction(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const p1 = parsed[i]
      const p2 = parsed[j]

      if (isSimple(p1.ast) && isSimple(p2.ast)) {
        addConclusion(
          {
            type: "BINARY",
            operator: "&",
            left: p1.ast,
            right: p2.ast,
          },
          "Adjunction",
          [p1.id, p2.id],
        )
      }
    }
  }
}

/**
 * Detects contradictions: P and ~P => false
 * @param {ParsedStep[]} parsed - All parsed steps
 * @param {AddConclusionFn} addConclusion - Callback to add conclusions
 */
function detectContradiction(parsed, addConclusion) {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const p1 = parsed[i]
      const p2 = parsed[j]

      // Check if p1 and p2 contradict each other
      if (isNegation(p1.ast, p2.ast)) {
        addConclusion(
          { type: "LITERAL", value: false },
          `Contradiction (steps ${p1.id} and ${p2.id})`,
          [p1.id, p2.id],
        )
      }

      // Check for literal contradiction: true and false
      if (p1.ast.type === "LITERAL" && p2.ast.type === "LITERAL" && p1.ast.value !== p2.ast.value) {
        addConclusion(
          { type: "LITERAL", value: false },
          `Contradiction (steps ${p1.id} and ${p2.id})`,
          [p1.id, p2.id],
        )
      }
    }
  }
}

/**
 * Attempts to derive new conclusions from existing proof steps
 *
 * Algorithm: Two-phase pattern matching (unary then binary rules)
 * Time Complexity: O(n) for parsing + O(n) for unary rules + O(n²) for binary rules
 *
 * High-Level Strategy:
 * This function implements a forward-chaining inference engine. Unlike backward chaining
 * (which starts with a goal and works backwards), we start with known facts and derive
 * all possible conclusions.
 *
 * Phase 1: Unary Rules (O(n))
 * - Pattern: single fact → new fact
 * - Examples: ~~A → A, ~(A & B) → ~A | ~B
 * - Efficient: one pass through facts
 *
 * Phase 2: Binary Rules (O(n²))
 * - Pattern: two facts → new fact
 * - Examples: (P → Q), P → Q
 * - Expensive: must check all pairs
 *
 * Why O(n²) is acceptable:
 * - Limited to 3 conclusions per run to prevent UI overload
 * - Typical proofs have 5-20 steps, so n² ≈ 25-400 comparisons
 * - Browser can easily handle hundreds of AST comparisons per frame
 *
 * Deduplication Strategy:
 * 1. Check new conclusion against existing facts (already proven)
 * 2. Check new conclusion against other new conclusions (prevent duplicates in this batch)
 * 3. Result: no redundant work in future inference runs
 *
 * Why async?
 * Currently returns immediately, but marked async for future enhancement:
 * - Could pause/resume for very large proof spaces
 * - Could delegate to Web Worker for parallelization
 * - API remains compatible
 *
 * @param {ProofStep[]} currentSteps - All existing proof steps (premises + previous derivations)
 * @returns {Promise<DerivedConclusion[]>} Array of new derived conclusions (max 3)
 */
export async function inferNextSteps(currentSteps) {
  // Phase 0: Build parsed steps array from cached ASTs
  // This is now O(1) per step since ASTs are pre-parsed and cached
  const parsed = []
  for (const step of currentSteps) {
    if (step.ast) {
      parsed.push({ id: step.id, ast: step.ast, raw: step.expression })
    } else {
      // Fallback for steps without cached AST (shouldn't happen in normal flow)
      console.warn(`Step ${step.id} missing cached AST, parsing on demand`)
      try {
        const tokens = tokenize(step.expression)
        const ast = new Parser(tokens).parse()
        parsed.push({ id: step.id, ast, raw: step.expression })
      } catch (e) {
        console.warn(`Failed to parse step ${step.id}: ${step.expression}`, e)
      }
    }
  }

  const newConclusions = []

  /**
   * Adds a conclusion if it's unique (deduplication)
   *
   * Deduplication Algorithm:
   * 1. Parse the proposed conclusion AST
   * 2. Check if structurally equal to any existing fact (already proven)
   * 3. Check if structurally equal to any conclusion we found in this batch
   * 4. If unique, add to newConclusions array
   *
   * Why check newConclusions separately?
   * Multiple rules might derive the same conclusion in one run:
   * - From P & Q, Simplification derives both P and Q
   * - From P and Q, Adjunction derives P & Q
   * - Without dedup: P & Q → P, Q → P & Q (circular!)
   *
   * Performance note:
   * Re-parsing conclusion strings is slightly inefficient, but keeps code simple.
   * Alternative: store AST in newConclusions, but then formatAST must happen earlier.
   * Trade-off: simplicity vs tiny perf gain - we choose simplicity.
   *
   * @param {import('./parser.js').ASTNode} ast - The conclusion AST
   * @param {string} rule - The inference rule name (for UI display)
   * @param {number[]} refs - Referenced step IDs (for proof tree display)
   */
  const addConclusion = (ast, rule, refs) => {
    // Dedup against existing facts (already proven, don't derive again)
    if (parsed.some((p) => areEqual(p.ast, ast))) {
      return
    }

    // Dedup against new conclusions in this batch
    if (newConclusions.some((c) => areEqual(c.ast, ast))) {
      return
    }

    // Unique conclusion - add it with cached AST for performance!
    newConclusions.push({
      expression: formatAST(ast),
      ast, // Cache the AST for future inference runs
      justification: rule,
      referencedStepIds: refs,
    })
  }

  // Phase 1: Apply Unary Rules (O(n) - single pass through steps)
  applyDoubleNegation(parsed, addConclusion)
  applyLiteralSimplification(parsed, addConclusion)
  applyDeMorgan(parsed, addConclusion)
  applySimplification(parsed, addConclusion)

  // Phase 2: Apply Binary Rules (O(n²) - compare all pairs of steps)
  applyModusPonens(parsed, addConclusion)
  applyModusTollens(parsed, addConclusion)
  applyDisjunctiveSyllogism(parsed, addConclusion)
  applyHypotheticalSyllogism(parsed, addConclusion)
  applyConstructiveDilemma(parsed, addConclusion)
  applyResolution(parsed, addConclusion)
  applyAdjunction(parsed, addConclusion)

  // Phase 2.5: Contradiction Detection
  detectContradiction(parsed, addConclusion)

  // Phase 3: Limit Output (UX optimization)
  //
  // Why limit to 3 conclusions?
  //
  // Problem: The inference engine can derive many conclusions in a single run
  // Example: From "P & Q & R", Simplification alone derives P, Q, R (3 conclusions)
  // Add more facts and binary rules, and we could easily derive 10-20+ conclusions
  //
  // UX issues with unlimited output:
  // 1. Overwhelming: Too many new steps at once confuses users
  // 2. Scrolling: User loses track of what was just added
  // 3. Performance: Rendering many DOM elements at once causes jank
  // 4. Pedagogical: Users can't follow the reasoning if steps appear too fast
  //
  // Solution: Batch conclusions in small groups
  // - Return max 3 conclusions per run
  // - User clicks "Run Inference" again to get next batch
  // - This makes the proof construction feel more interactive and understandable
  // - User can examine each new conclusion before proceeding
  //
  // Why 3 specifically?
  // - Not too small: 1-2 would feel tedious (too many clicks)
  // - Not too large: 5+ would feel overwhelming
  // - Magic number: Cognitive research suggests 3-4 items is optimal for quick comprehension
  // - Practical: Fits nicely on screen without scrolling
  //
  // Alternative approaches considered:
  // - Derive everything at once: Too overwhelming
  // - User selects which rules to apply: Too complex for beginners
  // - Derive until proof is complete: Removes user agency
  // - Priority queue (most useful rules first): Too complicated to implement
  //
  // This simple "first 3" approach balances simplicity, UX, and educational value
  return newConclusions.slice(0, 3)
}
