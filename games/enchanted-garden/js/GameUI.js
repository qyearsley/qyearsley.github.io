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
      flowerCount: document.getElementById("flower-count"),
      levelDisplay: document.getElementById("level-display"),
      progressBar: document.getElementById("progress-bar"),
      progressText: document.getElementById("progress-text"),
      gardenPreview: document.querySelector(".garden-preview"),
      particlesContainer: document.getElementById("particles-container"),
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
    if (this.elements.flowerCount) {
      this.elements.flowerCount.textContent = stats.flowers
    }
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
   */
  displayActivity(activity) {
    // Update creature image if provided
    if (activity.creature && this.elements.creatureImage) {
      this.elements.creatureImage.textContent = activity.creature
    }

    this.elements.creatureMessage.textContent = activity.creatureMessage
    this.elements.questionText.textContent = activity.question

    this.displayVisualItems(activity.visual)
    this.displayAnswerOptions(activity.options, activity.correctAnswer)
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
            if (item.crossed) {
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
   * @param {Array<number>} options - Answer options
   * @param {number} correctAnswer - The correct answer
   */
  displayAnswerOptions(options, correctAnswer) {
    this.elements.answerOptions.innerHTML = ""

    options.forEach((option) => {
      const button = document.createElement("button")
      button.className = "answer-button"
      button.textContent = option
      button.dataset.answer = option
      button.dataset.correct = option === correctAnswer ? "true" : "false"
      this.elements.answerOptions.appendChild(button)
    })
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
    if (currentStage.backgroundImage) {
      this.elements.gardenPreview.style.backgroundImage = currentStage.backgroundImage
    }

    // Apply theme to body background
    document.body.style.backgroundColor = currentStage.background
    if (currentStage.backgroundImage) {
      document.body.style.backgroundImage = currentStage.backgroundImage
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
}
