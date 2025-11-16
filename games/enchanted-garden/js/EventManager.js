/**
 * Manages event listeners and callbacks for the game
 */
export class EventManager {
  /**
   * @param {Object} ui - GameUI instance
   * @param {Object} callbacks - Object containing callback functions
   */
  constructor(ui, callbacks) {
    this.ui = ui
    this.callbacks = callbacks
    this.isProcessingAnswer = false
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    this.setupStartButton()
    this.setupContinueButton()
    this.setupStartFreshButton()
    this.setupBackButton()
    this.setupHomeButton()
    this.setupGardenAreas()
    this.setupAnswerButtons()
    this.setupSettingsButton()
    this.setupActivitySettingsButton()
    this.setupCloseSettingsButton()
    this.setupSettingsSelects()
    this.setupCastleButton()
    this.setupActivityCastleButton()
    this.setupCastleBackButton()
    this.setupKeyboardInput()
    this.setupKeyboardShortcuts()
    this.setupProjectOptions()
    this.setupProjectBackButton()
  }

  /**
   * Setup start button listener
   */
  setupStartButton() {
    const startButton = this.ui.elements.startButton
    if (startButton) {
      startButton.addEventListener("click", () => {
        if (this.callbacks.onStart) {
          this.callbacks.onStart()
        }
      })
    }
  }

  /**
   * Setup continue button listener
   */
  setupContinueButton() {
    const continueButton = this.ui.elements.continueButton
    if (continueButton) {
      continueButton.addEventListener("click", () => {
        if (this.callbacks.onContinue) {
          this.callbacks.onContinue()
        }
      })
    }
  }

  /**
   * Setup start fresh button listener
   */
  setupStartFreshButton() {
    const startFreshButton = this.ui.elements.startFreshButton
    if (startFreshButton) {
      startFreshButton.addEventListener("click", () => {
        if (this.callbacks.onStartFresh) {
          this.callbacks.onStartFresh()
        }
      })
    }
  }

  /**
   * Setup back button listener
   */
  setupBackButton() {
    const backButton = this.ui.elements.backButton
    if (backButton) {
      backButton.addEventListener("click", () => {
        if (this.callbacks.onBack) {
          this.callbacks.onBack()
        }
      })
    }
  }

  /**
   * Setup home button listener
   */
  setupHomeButton() {
    const homeButton = document.getElementById("home-button")
    if (homeButton) {
      homeButton.addEventListener("click", () => {
        if (this.callbacks.onHome) {
          this.callbacks.onHome()
        }
      })
    }
  }

  /**
   * Setup garden area listeners
   */
  setupGardenAreas() {
    this.ui.elements.gardenAreas.forEach((area) => {
      // Make areas keyboard accessible
      area.setAttribute("tabindex", "0")
      area.setAttribute("role", "button")

      const clickHandler = (e) => {
        const currentArea = e.currentTarget

        // Only allow entering unlocked areas
        if (currentArea.classList.contains("locked")) {
          return
        }

        const areaId = currentArea.dataset.area
        if (this.callbacks.onAreaEnter) {
          this.callbacks.onAreaEnter(areaId)
        }
      }

      area.addEventListener("click", clickHandler)

      // Add keyboard support
      area.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          clickHandler(e)
        }
      })
    })
  }

  /**
   * Setup answer button listeners (using delegation)
   */
  setupAnswerButtons() {
    if (this.ui.elements.answerOptions) {
      this.ui.elements.answerOptions.addEventListener("click", (e) => {
        if (e.target.classList.contains("answer-button")) {
          const selectedAnswer = e.target.dataset.answer
          // Try to parse as number if possible, otherwise keep as string
          const parsedAnswer = isNaN(selectedAnswer) ? selectedAnswer : parseInt(selectedAnswer, 10)
          const isCorrect = e.target.dataset.correct === "true"
          if (this.callbacks.onAnswerSelected) {
            this.callbacks.onAnswerSelected(parsedAnswer, isCorrect, e.target)
          }
        }
      })
    }
  }

  /**
   * Setup settings button listener
   */
  setupSettingsButton() {
    const settingsButton = this.ui.elements.settingsButton
    if (settingsButton) {
      settingsButton.addEventListener("click", () => {
        if (this.callbacks.onSettingsOpen) {
          this.callbacks.onSettingsOpen()
        }
      })
    }
  }

  /**
   * Setup activity settings button listener
   */
  setupActivitySettingsButton() {
    const activitySettingsButton = document.getElementById("activity-settings-button")
    if (activitySettingsButton) {
      activitySettingsButton.addEventListener("click", () => {
        if (this.callbacks.onSettingsOpen) {
          this.callbacks.onSettingsOpen()
        }
      })
    }
  }

  /**
   * Setup close settings button listener
   */
  setupCloseSettingsButton() {
    const closeButton = this.ui.elements.closeSettings
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        if (this.callbacks.onSettingsClose) {
          this.callbacks.onSettingsClose()
        }
      })
    }
  }

  /**
   * Setup settings select listeners
   */
  setupSettingsSelects() {
    if (this.ui.elements.inputModeSelect) {
      this.ui.elements.inputModeSelect.addEventListener("change", (e) => {
        if (this.callbacks.onSettingChange) {
          this.callbacks.onSettingChange("inputMode", e.target.value)
        }
      })
    }

    if (this.ui.elements.visualHintsSelect) {
      this.ui.elements.visualHintsSelect.addEventListener("change", (e) => {
        if (this.callbacks.onSettingChange) {
          this.callbacks.onSettingChange("visualHints", e.target.value)
        }
      })
    }

    if (this.ui.elements.questionsPerLevelSelect) {
      this.ui.elements.questionsPerLevelSelect.addEventListener("change", (e) => {
        if (this.callbacks.onSettingChange) {
          this.callbacks.onSettingChange("questionsPerLevel", parseInt(e.target.value))
        }
      })
    }

    if (this.ui.elements.soundEffectsSelect) {
      this.ui.elements.soundEffectsSelect.addEventListener("change", (e) => {
        if (this.callbacks.onSettingChange) {
          this.callbacks.onSettingChange("soundEffects", e.target.value)
        }
      })
    }
  }

  /**
   * Setup castle button listener
   */
  setupCastleButton() {
    const castleButton = this.ui.elements.castleButton
    if (castleButton) {
      castleButton.addEventListener("click", () => {
        if (this.callbacks.onCastleView) {
          this.callbacks.onCastleView()
        }
      })
    }
  }

  /**
   * Setup activity castle button listener
   */
  setupActivityCastleButton() {
    const activityCastleButton = document.getElementById("activity-castle-button")
    if (activityCastleButton) {
      activityCastleButton.addEventListener("click", () => {
        if (this.callbacks.onCastleView) {
          this.callbacks.onCastleView()
        }
      })
    }
  }

  /**
   * Setup castle back button listener
   */
  setupCastleBackButton() {
    const castleBackButton = this.ui.elements.castleBackButton
    if (castleBackButton) {
      castleBackButton.addEventListener("click", () => {
        if (this.callbacks.onCastleBack) {
          this.callbacks.onCastleBack()
        }
      })
    }
  }

  /**
   * Setup keyboard input listeners
   */
  setupKeyboardInput() {
    if (this.ui.elements.answerOptions) {
      // Handle submit button click
      this.ui.elements.answerOptions.addEventListener("click", (e) => {
        if (e.target.id === "submit-answer-btn") {
          this.handleKeyboardSubmit()
        }
      })

      // Handle Enter key press
      this.ui.elements.answerOptions.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && e.target.id === "answer-input-field") {
          this.handleKeyboardSubmit()
        }
      })
    }
  }

  /**
   * Handle keyboard answer submission
   */
  handleKeyboardSubmit() {
    if (this.isProcessingAnswer) return

    const input = document.getElementById("answer-input-field")
    if (!input) return

    const userAnswer = input.value.trim()
    const correctAnswer = input.dataset.correct

    if (userAnswer === "") {
      return // Don't submit if empty
    }

    // Disable input field to prevent double submission
    input.disabled = true
    const submitBtn = document.getElementById("submit-answer-btn")
    if (submitBtn) submitBtn.disabled = true

    this.isProcessingAnswer = true

    // Compare as numbers if both can be parsed as numbers, otherwise compare as strings
    let isCorrect
    const userNum = parseFloat(userAnswer)
    const correctNum = parseFloat(correctAnswer)

    if (!isNaN(userNum) && !isNaN(correctNum)) {
      isCorrect = userNum === correctNum
    } else {
      isCorrect = userAnswer === correctAnswer
    }

    if (this.callbacks.onAnswerSelected) {
      this.callbacks.onAnswerSelected(userAnswer, isCorrect, input)
    }
  }

  /**
   * Reset answer processing flag (called when new question is loaded)
   */
  resetAnswerProcessing() {
    this.isProcessingAnswer = false
  }

  /**
   * Setup keyboard shortcuts (1-4 for answer buttons)
   */
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Only handle if we're on the activity screen
      const activityScreen = document.getElementById("activity-screen")
      if (!activityScreen || !activityScreen.classList.contains("active")) {
        return
      }

      // Check if user is typing in an input field
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return
      }

      // Handle number keys 1-4
      if (e.key >= "1" && e.key <= "4") {
        e.preventDefault()
        const buttonIndex = parseInt(e.key) - 1
        const answerButtons = document.querySelectorAll(".answer-button")

        if (
          answerButtons[buttonIndex] &&
          !answerButtons[buttonIndex].classList.contains("disabled")
        ) {
          answerButtons[buttonIndex].click()
        }
      }
    })
  }

  /**
   * Setup project option listeners
   */
  setupProjectOptions() {
    const projectOptions = document.querySelectorAll(".project-option")
    projectOptions.forEach((option) => {
      option.setAttribute("tabindex", "0")
      option.setAttribute("role", "button")

      const clickHandler = (e) => {
        const projectType = e.currentTarget.dataset.project
        if (this.callbacks.onProjectSelect) {
          this.callbacks.onProjectSelect(projectType)
        }
      }

      option.addEventListener("click", clickHandler)

      // Add keyboard support
      option.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          clickHandler(e)
        }
      })
    })
  }

  /**
   * Setup project back button listener
   */
  setupProjectBackButton() {
    const projectBackButton = document.getElementById("project-back-button")
    if (projectBackButton) {
      projectBackButton.addEventListener("click", () => {
        if (this.callbacks.onProjectBack) {
          this.callbacks.onProjectBack()
        }
      })
    }
  }
}
