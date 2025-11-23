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
  // Phase 0: Parse all existing steps into ASTs for pattern matching
  // Why parse here instead of caching? Steps are modified rarely, and parsing is fast (O(n))
  const parsed = []
  for (const step of currentSteps) {
    try {
      const tokens = tokenize(step.expression)
      const ast = new Parser(tokens).parse()
      parsed.push({ id: step.id, ast, raw: step.expression })
    } catch (e) {
      // Lenient parsing: skip malformed expressions instead of crashing
      console.warn(`Failed to parse step ${step.id}: ${step.expression}`, e)
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
    if (
      newConclusions.some((c) => {
        const cAst = new Parser(tokenize(c.expression)).parse()
        return areEqual(cAst, ast)
      })
    ) {
      return
    }

    // Unique conclusion - add it!
    newConclusions.push({
      expression: formatAST(ast),
      justification: rule,
      referencedStepIds: refs,
    })
  }

  // Phase 1: Apply Unary Rules (O(n) - single pass through steps)
  // These rules transform one fact into another fact

  for (const step of parsed) {
    // Rule 1: Double Negation (~~A => A)
    //
    // Logical Principle: A double negative equals the positive
    // Example: "It's not true that it's not raining" = "It's raining"
    //
    // Pattern matching:
    // - Must have: NOT(NOT(...))
    // - Extract: the inner operand (after removing both NOTs)
    //
    // Why useful?
    // Often arises from applying other rules, especially De Morgan's Laws
    // or negating implications
    if (step.ast.type === "NOT") {
      const inner = step.ast.operand
      if (inner.type === "NOT") {
        // Found ~~A, derive A
        addConclusion(inner.operand, "Double Negation", [step.id])
      }
    }

    // Rule 2: De Morgan's Laws
    // ~(A & B) => ~A | ~B  (negation distributes over AND, flips to OR)
    // ~(A | B) => ~A & ~B  (negation distributes over OR, flips to AND)
    //
    // Logical Principle: Negating a compound statement distributes to parts
    // Examples:
    // - "Not (raining AND cold)" = "(Not raining) OR (Not cold)"
    // - "Not (coffee OR tea)" = "(Not coffee) AND (Not tea)"
    //
    // Why the flip?
    // Think about truth conditions:
    // - A & B is false when AT LEAST ONE is false → ~A | ~B
    // - A | B is false when BOTH are false → ~A & ~B
    //
    // Pattern matching:
    // - Must have: NOT(BINARY(...))
    // - Check operator: & or |
    // - Build new AST: negate each operand, flip operator
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

    // Rule 3: Simplification (A & B => A, B)
    //
    // Logical Principle: If a conjunction is true, both parts are true
    // Example: "It's raining AND cold" → "It's raining" (also → "It's cold")
    //
    // Why two conclusions?
    // From one conjunction, we derive both parts independently
    // Deduplication prevents adding duplicates if called multiple times
    //
    // Pattern matching:
    // - Must have: BINARY with & operator
    // - Derive: left operand AND right operand (separately)
    //
    // Note: This only works for AND, not OR
    // - P | Q doesn't tell us which is true (could be either or both)
    // - P & Q guarantees both are true
    if (step.ast.type === "BINARY" && step.ast.operator === "&") {
      addConclusion(step.ast.left, "Simplification", [step.id])
      addConclusion(step.ast.right, "Simplification", [step.id])
    }
  }

  // Phase 2: Apply Binary Rules (O(n²) - compare all pairs of steps)
  // These rules combine two facts to derive a new fact
  //
  // Why nested loops?
  // We need to check every combination of two facts to find matching patterns
  // Example: To apply Modus Ponens, we need to find (P → Q) and P somewhere in our facts
  //
  // Why i === j check?
  // A rule that requires two *different* facts shouldn't match a fact with itself
  // Exception: some rules below check i < j to avoid duplicate pairs (1,2) and (2,1)

  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue // Skip comparing a fact with itself

      const p1 = parsed[i]
      const p2 = parsed[j]

      // Rule 4: Modus Ponens ((P -> Q), P => Q)
      //
      // Logical Principle: If we know "P implies Q" and "P is true", then Q must be true
      // Example: "If it rains, streets are wet" + "It's raining" → "Streets are wet"
      //
      // Pattern matching:
      // - p1 must be: BINARY with -> operator (an implication)
      // - p2 must be: structurally equal to left side of p1 (the antecedent)
      // - Derive: right side of p1 (the consequent)
      //
      // Why order matters:
      // We check p1 as implication and p2 as antecedent
      // The outer loop will also try p2 as implication and p1 as antecedent
      // This handles facts in any order
      if (p1.ast.type === "BINARY" && p1.ast.operator === "->") {
        if (areEqual(p1.ast.left, p2.ast)) {
          addConclusion(p1.ast.right, "Modus Ponens", [p1.id, p2.id])
        }
      }

      // Rule 5: Modus Tollens ((P -> Q), ~Q => ~P)
      //
      // Logical Principle: If "P implies Q" and "Q is false", then P must be false
      // Example: "If it rains, streets are wet" + "Streets aren't wet" → "It's not raining"
      // This is the contrapositive reasoning
      //
      // Pattern matching:
      // - p1 must be: BINARY with -> operator
      // - p2 must be: negation of right side of p1 (negated consequent)
      // - Derive: negation of left side of p1 (negated antecedent)
      //
      // Why isNegation instead of areEqual?
      // p2 could be ~Q (when p1.right is Q) or Q (when p1.right is ~Q)
      // isNegation handles both directions bidirectionally
      if (p1.ast.type === "BINARY" && p1.ast.operator === "->") {
        if (isNegation(p1.ast.right, p2.ast)) {
          addConclusion({ type: "NOT", operand: p1.ast.left }, "Modus Tollens", [p1.id, p2.id])
        }
      }

      // Rule 6: Disjunctive Syllogism ((P | Q), ~P => Q)
      //
      // Logical Principle: If "P or Q" is true and "P is false", then Q must be true
      // Example: "Coffee or tea" + "Not coffee" → "Tea"
      //
      // Pattern matching:
      // - p1 must be: BINARY with | operator (a disjunction)
      // - p2 must be: negation of either left or right side
      // - Derive: the OTHER side (the non-negated option)
      //
      // Two cases:
      // 1. p2 is ~P (negates left) → derive Q (right)
      // 2. p2 is ~Q (negates right) → derive P (left)
      if (p1.ast.type === "BINARY" && p1.ast.operator === "|") {
        if (isNegation(p1.ast.left, p2.ast)) {
          addConclusion(p1.ast.right, "Disjunctive Syllogism", [p1.id, p2.id])
        } else if (isNegation(p1.ast.right, p2.ast)) {
          addConclusion(p1.ast.left, "Disjunctive Syllogism", [p1.id, p2.id])
        }
      }

      // Rule 7: Hypothetical Syllogism ((A -> B), (B -> C) => (A -> C))
      //
      // Logical Principle: Chain implications together
      // Example: "Rain → Wet" + "Wet → Slippery" → "Rain → Slippery"
      // Also called "transitive property of implication"
      //
      // Pattern matching:
      // - Both p1 and p2 must be: BINARY with -> operator
      // - p1.right must equal p2.left (the middle term chains)
      // - Derive: new implication from p1.left to p2.right (skip the middle)
      //
      // Why this works:
      // If A → B and B → C, then whenever A is true:
      // 1. B must be true (from A → B)
      // 2. C must be true (from B → C)
      // Therefore A → C
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

      // Rule 8: Constructive Dilemma (((A -> B) & (C -> D)), (A | C) => (B | D))
      //
      // Logical Principle: If we have two implications and one of the antecedents is true,
      // then one of the consequents must be true
      //
      // Example:
      // - "If study, pass" AND "If work, earn money"
      // - "Study OR work"
      // - Therefore: "Pass OR earn money"
      //
      // Pattern matching (most complex rule):
      // - p1 must be: (A → B) & (C → D)  [conjunction of two implications]
      // - p2 must be: A | C              [disjunction of the two antecedents]
      // - Derive: B | D                  [disjunction of the two consequents]
      //
      // Why complex?
      // Nested structure checking: must verify p1 contains AND of two IMPLIES
      // Then extract A, B, C, D and check p2 matches A | C (in either order)
      //
      // Commutativity handling:
      // p2 could be "A | C" or "C | A", both are valid
      if (p1.ast.type === "BINARY" && p1.ast.operator === "&") {
        const left = p1.ast.left
        const right = p1.ast.right

        // Check if p1 is a conjunction of two implications
        if (
          left.type === "BINARY" &&
          left.operator === "->" &&
          right.type === "BINARY" &&
          right.operator === "->"
        ) {
          // Extract the four components: (A → B) & (C → D)
          const A = left.left
          const B = left.right
          const C = right.left
          const D = right.right

          // Check if p2 matches (A | C) in either order
          if (p2.ast.type === "BINARY" && p2.ast.operator === "|") {
            if (
              (areEqual(p2.ast.left, A) && areEqual(p2.ast.right, C)) ||
              (areEqual(p2.ast.left, C) && areEqual(p2.ast.right, A))
            ) {
              // Derive (B | D)
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

      // Rule 9: Resolution ((A | B), (~A | C) => (B | C))
      //
      // Logical Principle: If two disjunctions share a complementary literal,
      // we can "resolve" them by combining the remaining parts
      //
      // Example: "Rain or snow" + "Not rain or cold" → "Snow or cold"
      //
      // Pattern matching:
      // - Both p1 and p2 must be: BINARY with | operator
      // - Find a pair where one literal is the negation of another
      // - Derive: disjunction of the two non-complementary literals
      //
      // Four cases to check (exhaustive):
      // 1. p1.left and p2.left are complementary → keep p1.right | p2.right
      // 2. p1.left and p2.right are complementary → keep p1.right | p2.left
      // 3. p1.right and p2.left are complementary → keep p1.left | p2.right
      // 4. p1.right and p2.right are complementary → keep p1.left | p2.left
      //
      // Why all four?
      // Disjunctions are commutative: (A | B) = (B | A)
      // And negations can be on either side of either disjunction
      // Must check all combinations to handle any order
      //
      // Used in automated theorem proving:
      // Resolution is complete for propositional logic (can prove any tautology)
      if (
        p1.ast.type === "BINARY" &&
        p1.ast.operator === "|" &&
        p2.ast.type === "BINARY" &&
        p2.ast.operator === "|"
      ) {
        // Case 1: left-left complementary (A | B), (~A | C) → (B | C)
        if (isNegation(p1.ast.left, p2.ast.left)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.right, right: p2.ast.right },
            "Resolution",
            [p1.id, p2.id],
          )
        }
        // Case 2: left-right complementary (A | B), (C | ~A) → (B | C)
        else if (isNegation(p1.ast.left, p2.ast.right)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.right, right: p2.ast.left },
            "Resolution",
            [p1.id, p2.id],
          )
        }
        // Case 3: right-left complementary (B | A), (~A | C) → (B | C)
        else if (isNegation(p1.ast.right, p2.ast.left)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.left, right: p2.ast.right },
            "Resolution",
            [p1.id, p2.id],
          )
        }
        // Case 4: right-right complementary (B | A), (C | ~A) → (B | C)
        else if (isNegation(p1.ast.right, p2.ast.right)) {
          addConclusion(
            { type: "BINARY", operator: "|", left: p1.ast.left, right: p2.ast.left },
            "Resolution",
            [p1.id, p2.id],
          )
        }
      }

      // Rule 10: Adjunction (P, Q => P & Q)
      //
      // Logical Principle: If two facts are both true, their conjunction is true
      // Example: "It's raining" + "It's cold" → "It's raining AND cold"
      //
      // Pattern matching:
      // - Both p1 and p2 must be: simple propositions (atoms or negated atoms)
      // - Derive: conjunction of the two facts
      //
      // Why i < j?
      // Prevents duplicate pairs: we don't want both (P, Q) and (Q, P)
      // With i < j, we only process each unique pair once
      //
      // Why restrict to isSimple()?
      // This is a CRITICAL restriction to prevent combinatorial explosion!
      //
      // Without restriction - Explosion scenario:
      // Starting facts: P, Q, R, S (4 atoms)
      // Step 1: Adjunction creates C(4,2) = 6 conjunctions
      //   → P&Q, P&R, P&S, Q&R, Q&S, R&S
      // Step 2: Now we have 10 facts (4 + 6), Adjunction creates C(10,2) = 45 conjunctions
      // Step 3: Now we have 55 facts, Adjunction creates C(55,2) = 1485 conjunctions
      // Result: Exponential growth, browser freezes, UI becomes unusable
      //
      // With isSimple() restriction:
      // - Only applies to atoms and negated atoms: P, Q, ~P, ~Q
      // - Complex expressions like P&Q, P->Q, ~(P&Q) are excluded
      // - Limits growth to O(n²) instead of exponential
      // - Example: 20 simple atoms → at most C(20,2) = 190 conjunctions total
      //
      // Trade-off:
      // We lose some completeness (can't derive all possible conjunctions)
      // But gain usability (UI remains responsive, results are manageable)
      if (i < j && isSimple(p1.ast) && isSimple(p2.ast)) {
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
