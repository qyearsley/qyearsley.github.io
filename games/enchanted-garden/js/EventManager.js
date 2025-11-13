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
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    this.setupStartButton()
    this.setupContinueButton()
    this.setupStartFreshButton()
    this.setupBackButton()
    this.setupGardenAreas()
    this.setupAnswerButtons()
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
   * Setup garden area listeners
   */
  setupGardenAreas() {
    this.ui.elements.gardenAreas.forEach((area) => {
      area.addEventListener("click", (e) => {
        const currentArea = e.currentTarget

        // Only allow entering unlocked areas
        if (currentArea.classList.contains("locked")) {
          return
        }

        const areaId = currentArea.dataset.area
        if (this.callbacks.onAreaEnter) {
          this.callbacks.onAreaEnter(areaId)
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
          const selectedAnswer = parseInt(e.target.dataset.answer, 10)
          const isCorrect = e.target.dataset.correct === "true"
          if (this.callbacks.onAnswerSelected) {
            this.callbacks.onAnswerSelected(selectedAnswer, isCorrect, e.target)
          }
        }
      })
    }
  }
}
