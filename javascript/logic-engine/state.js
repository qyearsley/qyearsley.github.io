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
 */
export function addPremise(expression) {
  state.steps.push({
    id: state.nextId++,
    expression: expression.trim(),
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
 * Loads an example by setting premises
 * @param {string[]} premises - Array of premise expressions
 */
export function loadExample(premises) {
  clearAll()
  for (const premise of premises) {
    addPremise(premise)
  }
}
