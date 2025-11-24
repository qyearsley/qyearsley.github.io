/**
 * UI Management and DOM Manipulation
 *
 * Handles all user interface updates, event handling, and DOM manipulation.
 * Renders the proof tree with indentation showing derivation relationships.
 */

"use strict"

import {
  state,
  addPremise,
  addDerivedSteps,
  clearAll,
  setStatus,
  setError,
  clearError,
  loadExample,
} from "./state.js"
import { inferNextSteps } from "./inference.js"
import { PREDEFINED_EXAMPLES } from "./examples.js"
import { tokenize, Parser } from "./parser.js"

/**
 * Initializes the UI and sets up event listeners
 */
export function initUI() {
  // Get DOM elements
  const premiseInput = document.getElementById("premise-input")
  const addButton = document.getElementById("add-premise")
  const inferButton = document.getElementById("run-inference")
  const clearButton = document.getElementById("clear-all")
  const examplesContainer = document.getElementById("examples")

  // Add premise on button click
  addButton.addEventListener("click", () => {
    const input = premiseInput.value.trim()
    if (input) {
      // Split by comma to support multiple premises
      const expressions = input.split(",").map((expr) => expr.trim()).filter((expr) => expr)

      if (expressions.length > 0) {
        let hasError = false
        let errorMsg = ""

        // Validate all expressions before adding any
        for (const expression of expressions) {
          try {
            const tokens = tokenize(expression)
            const parser = new Parser(tokens)
            parser.parse()
          } catch (e) {
            hasError = true
            errorMsg = `Invalid expression "${expression}": ${e.message}`
            break
          }
        }

        if (hasError) {
          setError(errorMsg)
          render()
        } else {
          // All valid, add them
          expressions.forEach((expression) => {
            addPremise(expression)
          })
          premiseInput.value = ""
          clearError()
          render()
        }
      }
    }
  })

  // Add premise on Enter key
  premiseInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addButton.click()
    }
  })

  // Run inference
  inferButton.addEventListener("click", async () => {
    if (state.steps.length === 0) {
      setError("Add at least one premise before running inference")
      render()
      return
    }

    setStatus("LOADING")
    render()

    try {
      const conclusions = await inferNextSteps(state.steps)

      if (conclusions.length === 0) {
        setStatus("IDLE")
        setError("No new conclusions found")
      } else {
        addDerivedSteps(conclusions)
        setStatus("SUCCESS")
        clearError()
      }
    } catch (error) {
      setError("Inference error: " + error.message)
    }

    render()
  })

  // Clear all
  clearButton.addEventListener("click", () => {
    clearAll()
    render()
  })

  // Load examples
  PREDEFINED_EXAMPLES.forEach((example) => {
    const button = document.createElement("button")
    button.textContent = example.name
    button.className = "example-btn"
    if (example.description) {
      button.title = example.description
    }
    button.addEventListener("click", () => {
      loadExample(example.premises)
      render()
    })
    examplesContainer.appendChild(button)
  })

  // Initial render
  render()
}

/**
 * Calculates the depth/level of each step in the proof tree
 * Depth is the maximum distance from any premise
 * @returns {Map<number, number>} Map of step ID to depth
 */
function calculateDepths() {
  const depths = new Map()

  // Initialize all premises at depth 0
  for (const step of state.steps) {
    if (step.isPremise) {
      depths.set(step.id, 0)
    }
  }

  // Iteratively calculate depths for derived steps
  // A step's depth is 1 + max(depth of referenced steps)
  let changed = true
  while (changed) {
    changed = false
    for (const step of state.steps) {
      if (!step.isPremise && step.referencedStepIds) {
        // Check if all referenced steps have depths
        const refDepths = step.referencedStepIds
          .map((id) => depths.get(id))
          .filter((d) => d !== undefined)

        if (refDepths.length === step.referencedStepIds.length) {
          const newDepth = Math.max(...refDepths) + 1
          if (depths.get(step.id) !== newDepth) {
            depths.set(step.id, newDepth)
            changed = true
          }
        }
      }
    }
  }

  return depths
}

/**
 * Renders the entire UI
 */
function render() {
  renderSteps()
  renderStatus()
  updateButtons()
}

/**
 * Renders the proof steps as an indented tree
 */
function renderSteps() {
  const container = document.getElementById("steps-container")

  if (state.steps.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p>No proof steps yet</p>
        <p>Add premises or load an example to begin</p>
      </div>
    `
    return
  }

  const depths = calculateDepths()
  let html = '<div class="steps-container">'

  for (const step of state.steps) {
    const depth = depths.get(step.id) || 0
    const indentPx = depth * 24 // 24px per level
    const stepClass = step.isPremise ? "premise" : "derived"

    html += `
      <div class="proof-step ${stepClass}" style="margin-left: ${indentPx}px">
        <div class="step-badge ${stepClass}">
          ${step.id}
        </div>
        <div class="step-content">
          <div class="step-expression">${escapeHtml(step.expression)}</div>
          ${
            step.isPremise
              ? '<div class="step-justification premise">Premise</div>'
              : `<div class="step-justification derived">
                <span class="rule-name">${escapeHtml(step.justification)}</span>
                <span class="step-refs"> (from steps ${step.referencedStepIds.join(", ")})</span>
               </div>`
          }
        </div>
      </div>
    `
  }

  html += "</div>"
  container.innerHTML = html
}

/**
 * Renders the status message area
 */
function renderStatus() {
  const statusDiv = document.getElementById("status-message")

  if (state.status === "ERROR" && state.errorMessage) {
    statusDiv.innerHTML = `
      <div class="status-message error">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
        </svg>
        <div class="message-text">${escapeHtml(state.errorMessage)}</div>
      </div>
    `
  } else if (state.status === "SUCCESS") {
    statusDiv.innerHTML = `
      <div class="status-message success">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
        </svg>
        <div class="message-text">
          New conclusions derived! Run inference again to continue.
        </div>
      </div>
    `
  } else {
    statusDiv.innerHTML = ""
  }
}

/**
 * Updates button states based on application state
 */
function updateButtons() {
  const inferButton = document.getElementById("run-inference")
  const addButton = document.getElementById("add-premise")
  const input = document.getElementById("premise-input")

  const isLoading = state.status === "LOADING"

  inferButton.disabled = isLoading
  addButton.disabled = isLoading
  input.disabled = isLoading

  if (isLoading) {
    inferButton.innerHTML = `
      <svg class="btn-icon animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Inferring...
    `
  } else {
    inferButton.innerHTML = `
      <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
      </svg>
      Run Inference
    `
  }
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - The text to escape
 * @returns {string} The escaped text
 */
function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}
