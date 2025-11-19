import { MATH } from "./constants.js"
import { BaseGameUI } from "../../common/js/BaseGameUI.js"

/**
 * Handles all DOM manipulation and UI updates for Number Garden
 */
export class GameUI extends BaseGameUI {
  constructor() {
    super()
    this.elements = this.cacheElements()
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
  displayActivity(activity, inputMode = "multipleChoice", visualHints = "always") {
    // Blur any focused element to prevent focus issues on mobile
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur()
    }

    // Remove focus from any previously focused answer buttons
    document.querySelectorAll(".answer-button").forEach((btn) => {
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
    const shouldShowVisual =
      isEssentialVisual ||
      visualHints === "always" ||
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
   * Update settings UI with current values
   * @param {Object} settings - Settings object
   */
  updateSettingsUI(settings) {
    if (this.elements.difficultySelect) {
      this.elements.difficultySelect.value = settings.difficulty || "adventurer"
    }
    if (this.elements.inputModeSelect) {
      this.elements.inputModeSelect.value = settings.inputMode || "multipleChoice"
    }
    if (this.elements.visualHintsSelect) {
      this.elements.visualHintsSelect.value = settings.visualHints || "always"
    }
    if (this.elements.questionsPerLevelSelect) {
      this.elements.questionsPerLevelSelect.value = settings.questionsPerLevel || 5
    }
    if (this.elements.soundEffectsSelect) {
      this.elements.soundEffectsSelect.value = settings.soundEffects || "on"
    }
  }

  /**
   * Update castle screen for the selected project
   * @param {Object} projectInfo - Project configuration with title, icon, and pieceName
   */
  updateCastleScreen(projectInfo) {
    if (this.elements.castleScreenTitle) {
      this.elements.castleScreenTitle.textContent = projectInfo.title
    }
    if (this.elements.castleDescription) {
      // Generate a description based on the project type
      const descriptions = {
        "Build a Castle": "Complete all areas to build the castle!",
        "Grow a Garden": "Complete all areas to grow your garden!",
        "Build a Robot": "Complete all areas to build your robot!",
        "Build a Rocket": "Complete all areas to build your rocket!",
      }
      this.elements.castleDescription.textContent =
        descriptions[projectInfo.title] ||
        `Complete all areas to build your ${projectInfo.title.toLowerCase()}!`
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

  /**
   * Update castle badge on castle button
   * @param {number} completedCount - Number of completed areas
   */
  updateCastleBadge(completedCount) {
    if (!this.elements.castleButton) return

    // Remove existing badge if any
    const existingBadge = this.elements.castleButton.querySelector(".castle-badge")
    if (existingBadge) {
      existingBadge.remove()
    }

    // Add badge if any areas completed
    if (completedCount > 0) {
      const badge = document.createElement("span")
      badge.className = "castle-badge"
      badge.textContent = completedCount
      this.elements.castleButton.appendChild(badge)
    }
  }

  /**
   * Show castle piece notification
   * @param {string} areaName - Name of completed area
   * @param {number} totalPieces - Total pieces collected
   * @param {Object} projectInfo - Project information with icon and pieceName
   */
  showCastleNotification(
    areaName,
    totalPieces,
    projectInfo = { icon: "🏰", pieceName: "Castle Piece" },
  ) {
    if (!this.elements.castleNotification) return

    this.elements.castleNotification.innerHTML = `
      <div class="castle-notification-content">
        <div class="castle-notification-icon">${projectInfo.icon}</div>
        <div class="castle-notification-text">
          <strong>${areaName} Complete!</strong>
          <span>${projectInfo.pieceName} ${totalPieces}/6 collected!</span>
        </div>
      </div>
    `

    this.elements.castleNotification.classList.add("show")

    // Hide after 3 seconds
    setTimeout(() => {
      this.elements.castleNotification.classList.remove("show")
    }, 2500)
  }

  /**
   * Show project progress modal
   * @param {string} projectType - Type of project (castle, garden, robot, spaceship)
   * @param {number} completedCount - Number of completed areas
   * @param {boolean} isComplete - Whether the project is fully complete
   */
  showProjectProgress(projectType, completedCount, isComplete = false) {
    if (!this.elements.projectProgressModal) return

    // Define project visualizations based on progress
    const projectVisuals = {
      castle: ["🧱", "🧱🧱", "🧱🧱🧱", "🏰🧱", "🏰🏰", "🏰✨"],
      garden: ["🌱", "🌱🌱", "🌻", "🌻🌸", "🌻🌸🌺", "🌻🌸🌺🌷"],
      robot: ["🔧", "🔧⚙️", "🦾", "🦿🦾", "🤖", "🤖✨"],
      spaceship: ["🔩", "🔩🔧", "🛸", "🛸⚡", "🚀", "🚀✨"],
    }

    const projectTitles = {
      castle: "Building Your Castle!",
      garden: "Growing Your Garden!",
      robot: "Building Your Robot!",
      spaceship: "Building Your Rocket!",
    }

    const visual = projectVisuals[projectType]?.[completedCount - 1] || "🎯"
    const title = isComplete
      ? projectTitles[projectType]?.replace("Building", "Completed") ||
        projectTitles[projectType]?.replace("Growing", "Grew")
      : projectTitles[projectType]

    this.elements.projectModalTitle.textContent = title
    this.elements.projectVisual.textContent = visual
    this.elements.projectProgressText.textContent = isComplete
      ? "🎉 All areas complete! 🎉"
      : `Progress: ${completedCount}/6 areas complete`

    this.elements.projectProgressModal.classList.remove("hidden")
  }

  /**
   * Hide project progress modal
   */
  hideProjectProgress() {
    if (this.elements.projectProgressModal) {
      this.elements.projectProgressModal.classList.add("hidden")
    }
  }

  /**
   * Update level complete screen with rewards and progress
   * @param {number} starsEarned - Number of stars earned this level
   * @param {number} flowersEarned - Number of flowers earned this level
   * @param {boolean} wasAreaCompleted - Whether this level completed an area
   * @param {string} projectType - Type of project (castle, garden, robot, spaceship)
   * @param {number} completedAreasCount - Total number of completed areas
   */
  updateLevelCompleteScreen(
    starsEarned,
    flowersEarned,
    wasAreaCompleted,
    projectType,
    completedAreasCount,
  ) {
    // Update stars earned text
    const starsText = document.getElementById("level-stars-earned")
    if (starsText) {
      starsText.textContent = `${starsEarned} stars earned!`
    }

    // Update flowers earned text
    const flowersText = document.getElementById("level-flowers-earned")
    if (flowersText) {
      flowersText.textContent = `${flowersEarned} flowers collected!`
    }

    // Show/hide project progress based on whether area was completed
    const projectProgressContainer = document.getElementById("level-project-progress-container")
    if (projectProgressContainer) {
      if (wasAreaCompleted) {
        projectProgressContainer.classList.remove("hidden")

        // Update project icon and message
        const projectIcon = document.getElementById("level-project-icon")
        const projectMessage = document.getElementById("level-project-message")

        // Define project visuals data
        const projectVisuals = {
          castle: { icon: "🏰", pieceName: "Castle Piece" },
          garden: { icon: "🌻", pieceName: "Garden Section" },
          robot: { icon: "🤖", pieceName: "Robot Part" },
          spaceship: { icon: "🚀", pieceName: "Rocket Part" },
        }

        const projectInfo = projectVisuals[projectType] || projectVisuals.castle

        if (projectIcon) {
          projectIcon.textContent = projectInfo.icon
        }
        if (projectMessage) {
          projectMessage.textContent = `You earned a new ${projectInfo.pieceName.toLowerCase()}! (${completedAreasCount}/6)`
        }
      } else {
        projectProgressContainer.classList.add("hidden")
      }
    }
  }
}
