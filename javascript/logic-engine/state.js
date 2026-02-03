/**
 * Application State Management
 *
 * Centralized state for the logic proof application.
 * Manages proof steps, UI status, and provides methods for state updates.
 */

"use strict"

/**
 * UI status values
 * @typedef {'IDLE'|'LOADING'|'ERROR'|'SUCCESS'} InferenceStatus
 */

/**
 * Application state object
 */
export const state = {
  /** @type {import('./inference.js').ProofStep[]} */
  steps: [],

  /** @type {InferenceStatus} */
  status: "IDLE",

  /** @type {string} */
  errorMessage: "",

  /** Counter for generating unique step IDs */
  nextId: 1,
}

/**
 * Adds a premise (user-entered statement) to the proof
 * @param {string} expression - The logical expression
 * @param {import('./parser.js').ASTNode} ast - The parsed AST (for caching)
 */
export function addPremise(expression, ast) {
  state.steps.push({
    id: state.nextId++,
    expression: expression.trim(),
    ast,
    isPremise: true,
    timestamp: Date.now(),
  })
}

/**
 * Adds derived conclusions from inference
 * @param {import('./inference.js').DerivedConclusion[]} conclusions - The derived conclusions
 */
export function addDerivedSteps(conclusions) {
  for (const conclusion of conclusions) {
    state.steps.push({
      id: state.nextId++,
      expression: conclusion.expression,
      ast: conclusion.ast,
      isPremise: false,
      justification: conclusion.justification,
      referencedStepIds: conclusion.referencedStepIds,
      timestamp: Date.now(),
    })
  }
}

/**
 * Clears all proof steps and resets state
 */
export function clearAll() {
  state.steps = []
  state.nextId = 1
  state.status = "IDLE"
  state.errorMessage = ""
}

/**
 * Sets the inference status
 * @param {InferenceStatus} status - The new status
 */
export function setStatus(status) {
  state.status = status
}

/**
 * Sets an error message
 * @param {string} message - The error message
 */
export function setError(message) {
  state.errorMessage = message
  state.status = "ERROR"
}

/**
 * Clears the error state
 */
export function clearError() {
  state.errorMessage = ""
  if (state.status === "ERROR") {
    state.status = "IDLE"
  }
}

/**
 * Loads an example by setting premises (with parsed ASTs)
 * @param {Array<{expression: string, ast: import('./parser.js').ASTNode}>} parsedPremises - Array of premise expressions with ASTs
 */
export function loadExample(parsedPremises) {
  clearAll()
  for (const { expression, ast } of parsedPremises) {
    addPremise(expression, ast)
  }
}
