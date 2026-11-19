import { ANSWER_KEYS } from "./constants.js"
import { keyIsNotForGame, closeSettingsOnEscape } from "../../shared/keyboardGuard.js"

// [element id, callback name]: each button calls its callback, if there is one.
const CLICK_BUTTONS = [
  ["start-button", "onStart"],
  ["continue-button", "onContinue"],
  ["start-fresh-button", "onStartFresh"],
  ["back-button", "onBack"],
  ["home-button", "onHome"],
  ["settings-button", "onSettingsOpen"],
  ["activity-settings-button", "onSettingsOpen"],
  ["close-settings", "onSettingsClose"],
  ["castle-button", "onCastleView"],
  ["activity-castle-button", "onCastleView"],
  ["castle-back-button", "onCastleBack"],
  ["project-back-button", "onProjectBack"],
  ["continue-from-project", "onContinueFromProject"],
  ["continue-playing-button", "onContinueFromLevelComplete"],
  ["return-to-hub-button", "onReturnToHub"],
]

// [element id, setting name]: each select calls onSettingChange(setting, value).
const SETTING_SELECTS = [
  ["difficulty-select", "difficulty"],
  ["input-mode-select", "inputMode"],
  ["visual-hints-select", "visualHints"],
  ["sound-effects-select", "soundEffects"],
]

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
    CLICK_BUTTONS.forEach(([id, callbackName]) => {
      document.getElementById(id)?.addEventListener("click", () => this.callbacks[callbackName]?.())
    })
    SETTING_SELECTS.forEach(([id, setting]) => {
      document.getElementById(id)?.addEventListener("change", (e) => {
        this.callbacks.onSettingChange?.(setting, e.target.value)
      })
    })
    this.setupGardenAreas()
    this.setupAnswerButtons()
    this.setupKeyboardInput()
    this.setupKeyboardShortcuts()
    this.setupProjectOptions()
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
          // `.disabled` is a class here, not the property -- disabling the
          // focused element would drop focus to `<body>`. CSS gives the class
          // `pointer-events: none`, which stops a tap but not Enter or Space on
          // a focused button, so the guard has to be in JS as well. Without it,
          // two fast Enters on one question scored twice: two stars, two
          // flowers, and two advance timeouts.
          if (e.target.classList.contains("disabled") || this.isProcessingAnswer) return
          this.isProcessingAnswer = true
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
   * Whether the settings modal is covering the screen.
   * @private
   * @returns {boolean} True while the modal is open
   */
  _settingsOpen() {
    return document.getElementById("settings-modal")?.classList.contains("hidden") === false
  }

  /**
   * Reset answer processing flag (called when a new question is loaded, and
   * after a wrong answer hands the controls back)
   */
  resetAnswerProcessing() {
    this.isProcessingAnswer = false
  }

  /**
   * Setup keyboard shortcuts (a-d for answer buttons)
   */
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Escape closes the settings modal. Without it the modal was a keyboard
      // trap: the only way out was to Tab all the way to Done. Handled before
      // the activity-screen gate, because settings opens from the hub too.
      const closed = closeSettingsOnEscape(e, {
        isOpen: () => this._settingsOpen(),
        close: () => this.callbacks.onSettingsClose?.(),
      })
      if (closed) return

      // Only handle if we're on the activity screen
      const activityScreen = document.getElementById("activity-screen")
      if (!activityScreen || !activityScreen.classList.contains("active")) {
        return
      }

      // Modifiers, the help overlay, and text fields and selects (the settings
      // modal is four of them) keep their keys; so does anything else the
      // modal covers.
      if (keyIsNotForGame(e) || this._settingsOpen()) {
        return
      }

      // Handle letter keys a-d. Letters read as a name for the choice, where a
      // digit would look like one more number in a game full of them.
      const buttonIndex = ANSWER_KEYS.indexOf(e.key.toLowerCase())
      if (buttonIndex === -1) {
        return
      }

      e.preventDefault()
      const answerButtons = document.querySelectorAll(".answer-button")

      if (
        answerButtons[buttonIndex] &&
        !answerButtons[buttonIndex].classList.contains("disabled")
      ) {
        answerButtons[buttonIndex].click()
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
}
