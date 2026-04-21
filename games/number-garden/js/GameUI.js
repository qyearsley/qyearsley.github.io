import { MATH } from "./constants.js"
import { BaseGameUI } from "../../shared/BaseGameUI.js"
import { CastleUI } from "./CastleUI.js"

const VISUAL_ITEM_ANIMATION_DELAY_MS = 100

/**
 * Handles all DOM manipulation and UI updates for Number Garden
 *
 * Security Note: This class uses innerHTML for dynamic content generation.
 * All content is generated from controlled game data (questions, visual representations,
 * garden layouts) and not from user input, making it safe from XSS attacks.
 */
export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.elements = this.cacheElements()
    this.castle = new CastleUI(this.elements)
  }

  /**
   * Cache DOM elements to avoid repeated queries
   * @returns {Object} Object containing cached DOM elements
   */
  cacheElements() {
    return {
      ...this.cacheCommonElements(),
      gardenAreas: document.querySelectorAll(".garden-area"),
      creatureImage: document.querySelector(".creature-image"),
      creatureMessage: document.getElementById("creature-message"),
      questionText: document.getElementById("question-text"),
      visualArea: document.getElementById("visual-area"),
      answerOptions: document.getElementById("answer-options"),
      feedbackArea: document.getElementById("feedback-area"),
      gardenCanvas: document.getElementById("garden-canvas"),
      starCounts: document.querySelectorAll("#star-count, #activity-star-count"),
      levelDisplay: document.getElementById("level-display"),
      gardenPreview: document.querySelector(".garden-preview"),
      particlesContainer: document.getElementById("particles-container"),
      castleButton: document.getElementById("castle-button"),
      difficultySelect: document.getElementById("difficulty-select"),
      inputModeSelect: document.getElementById("input-mode-select"),
      visualHintsSelect: document.getElementById("visual-hints-select"),
      questionsPerLevelSelect: document.getElementById("questions-per-level-select"),
      soundEffectsSelect: document.getElementById("sound-effects-select"),
      castleBackButton: document.getElementById("castle-back-button"),
      castleScreenTitle: document.getElementById("castle-screen-title"),
      castleDescription: document.getElementById("castle-description"),
      castleProgressText: document.getElementById("castle-progress-text"),
      castleSvgContainer: document.getElementById("castle-svg-container"),
      castlePiecesDisplay: document.getElementById("castle-pieces-display"),
      castleNotification: document.getElementById("castle-notification"),
      projectProgressModal: document.getElementById("project-progress-modal"),
      projectModalTitle: document.getElementById("project-modal-title"),
      projectVisual: document.getElementById("project-visual"),
      projectProgressText: document.getElementById("project-progress-text"),
      continueFromProject: document.getElementById("continue-from-project"),
    }
  }

  /**
   * Update stats display
   * @param {Object} stats - Game stats object
   */
  updateStats(stats) {
    this.elements.starCounts.forEach((el) => {
      el.textContent = stats.stars
    })
    if (this.elements.levelDisplay) {
      this.elements.levelDisplay.textContent = `Level ${stats.currentLevel}`
    }
  }

  /**
   * Update progress bar
   * @param {number} current - Current progress
   * @param {number} total - Total required
   */
  updateProgressBar(current, total) {
    super.updateProgressBar(current, total, MATH.PERCENT_MULTIPLIER)
  }

  /**
   * Display an activity
   * @param {Object} activity - Activity object
   * @param {string} inputMode - Input mode ("multipleChoice" or "keyboard")
   * @param {string} visualHints - Visual hints setting
   */
  displayActivity(activity, inputMode = "multipleChoice", visualHints = "on") {
    // Blur any focused element to prevent focus issues on mobile
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur()
    }

    // Remove focus from any previously focused answer buttons
    this.elements.answerOptions.querySelectorAll(".answer-button").forEach((btn) => {
      btn.blur()
      btn.classList.remove("focus-visible")
    })

    // Update creature image if provided
    if (activity.creature && this.elements.creatureImage) {
      this.elements.creatureImage.textContent = activity.creature
    }

    // Only update creature message if element exists (it's hidden in simplified mode)
    if (this.elements.creatureMessage) {
      this.elements.creatureMessage.textContent = activity.creatureMessage
    }

    this.elements.questionText.textContent = activity.question

    // Determine if visual is essential (required to answer the question)
    const isEssentialVisual =
      activity.visual &&
      activity.visual.length > 0 &&
      (activity.visual.some((item) => item && item.html) || // Clock, ruler, scale visuals are HTML
        activity.type === "pattern") // Pattern visuals are essential for the question

    // Display visual items based on hints setting
    // Essential visuals (like clock faces, rulers) are always shown
    const shouldShowVisual = isEssentialVisual || visualHints === "on"

    if (shouldShowVisual) {
      this.displayVisualItems(activity.visual)
    } else {
      this.elements.visualArea.innerHTML = ""
    }

    // Display answer input based on mode
    if (inputMode === "keyboard") {
      this.displayKeyboardInput(activity.correctAnswer)
    } else {
      this.displayAnswerOptions(activity.options, activity.correctAnswer)
    }

    this.elements.feedbackArea.classList.add("hidden")
  }

  /**
   * Display visual items with animation
   * @param {Array} visualItems - Array of visual items
   */
  displayVisualItems(visualItems) {
    this.elements.visualArea.innerHTML = ""

    if (visualItems && visualItems.length > 0) {
      visualItems.forEach((item, index) => {
        setTimeout(() => {
          const visualItem = document.createElement("div")
          visualItem.className = "visual-item"

          if (typeof item === "object") {
            if (item.html) {
              // Handle HTML/SVG content
              visualItem.innerHTML = item.html
              visualItem.style.display = "inline-block"
            } else if (item.crossed) {
              visualItem.classList.add("crossed-out")
              visualItem.textContent = item.emoji
            } else if (item.separator) {
              visualItem.classList.add("separator")
              visualItem.textContent = item.emoji
            }
          } else {
            visualItem.textContent = item
          }

          this.elements.visualArea.appendChild(visualItem)
        }, index * VISUAL_ITEM_ANIMATION_DELAY_MS)
      })
    }
  }

  /**
   * Display answer option buttons
   * @param {Array<number|string>} options - Answer options
   * @param {number|string} correctAnswer - The correct answer
   */
  displayAnswerOptions(options, correctAnswer) {
    this.elements.answerOptions.innerHTML = ""

    options.forEach((option, index) => {
      const button = document.createElement("button")
      button.className = "answer-button"
      button.textContent = option
      button.dataset.answer = option
      button.dataset.correct = option == correctAnswer ? "true" : "false"
      button.dataset.keyboardHint = `${index + 1}`
      button.setAttribute("aria-label", `Answer ${index + 1}: ${option}`)
      button.setAttribute("tabindex", "0")
      this.elements.answerOptions.appendChild(button)
    })
  }

  /**
   * Display keyboard input for answer
   * @param {number|string} correctAnswer - The correct answer
   */
  displayKeyboardInput(correctAnswer) {
    this.elements.answerOptions.innerHTML = ""

    const container = document.createElement("div")
    container.className = "answer-input-container"

    const input = document.createElement("input")
    // Check if answer is time format or number
    if (typeof correctAnswer === "string" && correctAnswer.includes(":")) {
      input.type = "text"
      input.placeholder = "0:00"
    } else {
      input.type = "number"
      input.placeholder = "?"
    }
    input.className = "answer-input"
    input.id = "answer-input-field"
    input.dataset.correct = correctAnswer

    const submitButton = document.createElement("button")
    submitButton.className = "submit-answer-button"
    submitButton.textContent = "Submit Answer"
    submitButton.id = "submit-answer-btn"

    container.appendChild(input)
    container.appendChild(submitButton)
    this.elements.answerOptions.appendChild(container)

    // Auto-focus the input
    setTimeout(() => input.focus(), 100)
  }

  /**
   * Show feedback message with structured display
   * @param {string} message - Feedback message
   * @param {string} type - Feedback type (correct, incorrect, encourage)
   * @param {Object} options - Additional options
   * @param {string} options.correctAnswer - The correct answer to show (for incorrect)
   * @param {string} options.explanation - Optional explanation text
   */
  showFeedback(message, type, options = {}) {
    const feedbackArea = this.elements.feedbackArea
    if (!feedbackArea) return

    // Determine icon based on type
    const icons = {
      correct: "✨",
      incorrect: "🔍",
      encourage: "💫",
    }
    const icon = icons[type] || "💡"

    // Build structured feedback HTML
    let feedbackHTML = `
      <div class="feedback ${type}">
        <div class="feedback-icon">${icon}</div>
        <h3>${message}</h3>
    `

    // Add correct answer for incorrect responses
    if (type === "incorrect" && options.correctAnswer) {
      feedbackHTML += `<p>The answer is: <strong>${options.correctAnswer}</strong></p>`
    }

    // Add explanation if provided
    if (options.explanation) {
      feedbackHTML += `<p class="feedback-explanation">${options.explanation}</p>`
    }

    feedbackHTML += `</div>`

    feedbackArea.innerHTML = feedbackHTML
    feedbackArea.classList.remove("hidden")
  }

  /**
   * Shake a button to indicate wrong answer
   * @param {HTMLElement} button - The button element
   */
  shakeButton(button) {
    button.style.animation = "shake 0.5s"
    setTimeout(() => {
      button.style.animation = ""
    }, 500)
  }

  /**
   * Disable all answer buttons
   */
  disableAnswerButtons() {
    this.elements.answerOptions.querySelectorAll(".answer-button").forEach((btn) => {
      btn.classList.add("disabled")
    })
  }

  /**
   * Enable all answer buttons
   */
  enableAnswerButtons() {
    this.elements.answerOptions.querySelectorAll(".answer-button").forEach((btn) => {
      btn.classList.remove("disabled")
    })
  }

  /**
   * Render the garden with collected flowers
   * @param {Array} garden - Array of flower objects
   */
  renderGarden(garden) {
    this.elements.gardenCanvas.innerHTML = ""

    garden.forEach((flower, index) => {
      setTimeout(() => {
        const flowerElement = document.createElement("div")
        flowerElement.className = `garden-item flower flower-${flower.color}`
        flowerElement.textContent = flower.emoji
        this.elements.gardenCanvas.appendChild(flowerElement)
      }, index * 100)
    })
  }

  /**
   * Update visual progression based on area theme and progress
   * @param {string} areaId - Current area ID
   * @param {Object} areaThemes - Area themes configuration
   * @param {number} progressPercent - Progress percentage
   */
  updateVisualProgression(areaId, areaThemes, progressPercent) {
    if (!this.elements.gardenPreview || !areaId) return

    const theme = areaThemes[areaId]
    if (!theme) return

    // Find the appropriate stage
    let currentStage = theme.stages[0]
    for (const stage of theme.stages) {
      if (progressPercent >= stage.percent) {
        currentStage = stage
      }
    }

    // Apply the background color and image to garden preview
    this.elements.gardenPreview.style.backgroundColor = currentStage.background
    this.elements.gardenPreview.style.backgroundSize = "auto"
    this.elements.gardenPreview.style.backgroundRepeat = "repeat"
    if (currentStage.backgroundImage) {
      this.elements.gardenPreview.style.backgroundImage = currentStage.backgroundImage
    } else {
      this.elements.gardenPreview.style.backgroundImage = "none"
    }

    // Apply theme to body background
    document.body.style.backgroundColor = currentStage.background
    document.body.style.backgroundSize = "auto"
    document.body.style.backgroundRepeat = "repeat"
    if (currentStage.backgroundImage) {
      document.body.style.backgroundImage = currentStage.backgroundImage
    } else {
      document.body.style.backgroundImage = "none"
    }

    // Set CSS custom properties for theme colors
    document.documentElement.style.setProperty("--theme-primary", theme.primaryColor)
    document.documentElement.style.setProperty("--theme-accent", theme.accentColor)

    // Add decorations based on progress
    const numDecorations = Math.floor((progressPercent / 100) * theme.decorations.length * 2)
    const existingDecorations = this.elements.gardenCanvas.querySelectorAll(".decoration")

    if (existingDecorations.length < numDecorations) {
      for (let i = existingDecorations.length; i < numDecorations; i++) {
        const decoration = document.createElement("div")
        decoration.className = "decoration"
        decoration.textContent = theme.decorations[i % theme.decorations.length]
        decoration.style.opacity = "0.4"
        decoration.style.fontSize = "24px"
        this.elements.gardenCanvas.insertBefore(decoration, this.elements.gardenCanvas.firstChild)
      }
    }
  }

  /**
   * Get button coordinates for particle effects
   * @param {HTMLElement} button - The button element
   * @returns {{x: number, y: number}} Center coordinates
   */
  getButtonCenter(button) {
    const rect = button.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  /**
   * Get particles container element
   * @returns {HTMLElement} Particles container
   */
  getParticlesContainer() {
    return this.elements.particlesContainer
  }

  /**
   * Update area unlock status in the garden hub
   * @param {Set<string>} unlockedAreas - Set of unlocked area IDs
   */
  updateAreaLocks(unlockedAreas) {
    this.elements.gardenAreas.forEach((area) => {
      const areaId = area.dataset.area
      if (unlockedAreas.has(areaId)) {
        area.classList.remove("locked")
        area.classList.add("unlocked")
      } else {
        area.classList.add("locked")
        area.classList.remove("unlocked")
      }
    })
  }

  updateSettingsUI(settings) {
    if (this.elements.difficultySelect) {
      this.elements.difficultySelect.value = settings.difficulty || "adventurer"
    }
    if (this.elements.inputModeSelect) {
      this.elements.inputModeSelect.value = settings.inputMode || "multipleChoice"
    }
    if (this.elements.visualHintsSelect) {
      this.elements.visualHintsSelect.value = settings.visualHints || "on"
    }
    if (this.elements.soundEffectsSelect) {
      this.elements.soundEffectsSelect.value = settings.soundEffects || "on"
    }
  }
}
