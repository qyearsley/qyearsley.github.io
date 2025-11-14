/**
 * Handles all DOM manipulation and UI updates for Enchanted Garden
 */
export class GameUI {
  constructor() {
    this.elements = this.cacheElements()
  }

  /**
   * Cache DOM elements to avoid repeated queries
   * @returns {Object} Object containing cached DOM elements
   */
  cacheElements() {
    return {
      screens: document.querySelectorAll(".screen"),
      startButton: document.getElementById("start-button"),
      continueButton: document.getElementById("continue-button"),
      startFreshButton: document.getElementById("start-fresh-button"),
      backButton: document.getElementById("back-button"),
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
      progressBar: document.getElementById("progress-bar"),
      progressText: document.getElementById("progress-text"),
      gardenPreview: document.querySelector(".garden-preview"),
      particlesContainer: document.getElementById("particles-container"),
      settingsButton: document.getElementById("settings-button"),
      castleButton: document.getElementById("castle-button"),
      settingsModal: document.getElementById("settings-modal"),
      closeSettings: document.getElementById("close-settings"),
      inputModeSelect: document.getElementById("input-mode-select"),
      visualHintsSelect: document.getElementById("visual-hints-select"),
      questionsPerLevelSelect: document.getElementById("questions-per-level-select"),
      castleBackButton: document.getElementById("castle-back-button"),
      castleProgressText: document.getElementById("castle-progress-text"),
      castleSvgContainer: document.getElementById("castle-svg-container"),
      castlePiecesDisplay: document.getElementById("castle-pieces-display"),
    }
  }

  /**
   * Show a specific screen
   * @param {string} screenId - Screen identifier
   */
  showScreen(screenId) {
    this.elements.screens.forEach((screen) => screen.classList.remove("active"))
    const targetScreen = document.getElementById(screenId)
    if (targetScreen) {
      targetScreen.classList.add("active")
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
    if (this.elements.progressBar) {
      const percent = (current / total) * 100
      this.elements.progressBar.style.width = `${percent}%`
    }
    if (this.elements.progressText) {
      this.elements.progressText.textContent = `${current}/${total}`
    }
  }

  /**
   * Display an activity
   * @param {Object} activity - Activity object
   * @param {string} inputMode - Input mode ("multipleChoice" or "keyboard")
   * @param {string} visualHints - Visual hints setting
   */
  displayActivity(activity, inputMode = "multipleChoice", visualHints = "always") {
    // Update creature image if provided
    if (activity.creature && this.elements.creatureImage) {
      this.elements.creatureImage.textContent = activity.creature
    }

    this.elements.creatureMessage.textContent = activity.creatureMessage
    this.elements.questionText.textContent = activity.question

    // Display visual items based on hints setting
    const shouldShowVisual = visualHints === "always" ||
      (visualHints === "sometimes" && Math.random() < 0.5)

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
        }, index * 100)
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
      button.dataset.correct = (option == correctAnswer) ? "true" : "false"
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
   * Show feedback message
   * @param {string} message - Feedback message
   * @param {string} type - Feedback type (correct, encourage)
   */
  showFeedback(message, type) {
    this.elements.feedbackArea.textContent = message
    this.elements.feedbackArea.className = `feedback-area ${type}`
    this.elements.feedbackArea.classList.remove("hidden")
  }

  /**
   * Mark an answer button as correct
   * @param {HTMLElement} button - The button element
   */
  markButtonCorrect(button) {
    button.classList.add("correct")
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
    document.querySelectorAll(".answer-button").forEach((btn) => {
      btn.classList.add("disabled")
    })
  }

  /**
   * Enable all answer buttons
   */
  enableAnswerButtons() {
    document.querySelectorAll(".answer-button").forEach((btn) => {
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

  /**
   * Update title screen buttons based on saved progress
   * @param {boolean} hasSavedProgress - Whether there is saved progress
   */
  updateTitleButtons(hasSavedProgress) {
    if (hasSavedProgress) {
      // Show continue and start fresh buttons, hide start button
      this.elements.startButton.classList.add("hidden")
      this.elements.continueButton.classList.remove("hidden")
      this.elements.startFreshButton.classList.remove("hidden")
    } else {
      // Show only start button
      this.elements.startButton.classList.remove("hidden")
      this.elements.continueButton.classList.add("hidden")
      this.elements.startFreshButton.classList.add("hidden")
    }
  }

  /**
   * Update settings UI with current values
   * @param {Object} settings - Settings object
   */
  updateSettingsUI(settings) {
    if (this.elements.inputModeSelect) {
      this.elements.inputModeSelect.value = settings.inputMode || "multipleChoice"
    }
    if (this.elements.visualHintsSelect) {
      this.elements.visualHintsSelect.value = settings.visualHints || "always"
    }
    if (this.elements.questionsPerLevelSelect) {
      this.elements.questionsPerLevelSelect.value = settings.questionsPerLevel || 5
    }
  }

  /**
   * Show settings modal
   */
  showSettings() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.classList.remove("hidden")
    }
  }

  /**
   * Hide settings modal
   */
  hideSettings() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.classList.add("hidden")
    }
  }

  /**
   * Update castle progress display
   * @param {number} completed - Number of completed areas
   * @param {number} total - Total number of areas
   */
  updateCastleProgress(completed, total) {
    if (this.elements.castleProgressText) {
      this.elements.castleProgressText.textContent = `Pieces: ${completed}/${total}`
    }
  }

  /**
   * Display castle pieces indicators
   * @param {Set<string>} completedAreas - Set of completed area IDs
   */
  displayCastlePieces(completedAreas) {
    if (!this.elements.castlePiecesDisplay) return

    const areaNames = {
      "flower-meadow": "🦄",
      "crystal-cave": "🔮",
      "enchanted-forest": "🧚",
      "time-temple": "🕰️",
      "measurement-market": "🦊",
      "pattern-path": "🦋",
    }

    this.elements.castlePiecesDisplay.innerHTML = ""

    Object.entries(areaNames).forEach(([areaId, emoji]) => {
      const piece = document.createElement("div")
      piece.className = "castle-piece"
      piece.textContent = emoji

      if (completedAreas.has(areaId)) {
        piece.classList.add("completed")
      } else {
        piece.classList.add("locked")
      }

      this.elements.castlePiecesDisplay.appendChild(piece)
    })
  }
}
