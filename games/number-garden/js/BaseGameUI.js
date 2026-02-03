/**
 * Base Game UI Manager
 * Provides common UI functionality shared across all games
 *
 * This class centralizes common DOM manipulation patterns to reduce
 * code duplication and ensure consistent UI behavior across games.
 *
 * Security Note: Game UI classes use innerHTML for dynamic content generation.
 * All content is generated from controlled game data (not user input), making it
 * safe from XSS attacks. User input is never directly inserted into the DOM.
 */
export class BaseGameUI {
  constructor() {
    this.elements = {}
  }

  /**
   * Show a specific screen by hiding all others and showing the target
   * @param {string} screenId - Screen identifier (DOM element ID)
   */
  showScreen(screenId) {
    // Hide all screens
    const allScreens = document.querySelectorAll(".screen")
    allScreens.forEach((screen) => screen.classList.remove("active"))

    // Show target screen
    const targetScreen = document.getElementById(screenId)
    if (targetScreen) {
      targetScreen.classList.add("active")
    } else {
      console.warn(`Screen not found: ${screenId}`)
    }
  }

  /**
   * Show a modal by adding the 'show' class
   * @param {HTMLElement|string} modal - Modal element or ID
   */
  showModal(modal) {
    const modalElement = typeof modal === "string" ? document.getElementById(modal) : modal
    if (modalElement) {
      modalElement.classList.add("show")
    }
  }

  /**
   * Hide a modal by removing the 'show' class
   * @param {HTMLElement|string} modal - Modal element or ID
   */
  hideModal(modal) {
    const modalElement = typeof modal === "string" ? document.getElementById(modal) : modal
    if (modalElement) {
      modalElement.classList.remove("show")
    }
  }

  /**
   * Toggle visibility of an element using the 'hidden' class
   * @param {HTMLElement|string} element - Element or ID
   * @param {boolean} visible - Whether to show (true) or hide (false)
   */
  setVisible(element, visible) {
    const el = typeof element === "string" ? document.getElementById(element) : element
    if (el) {
      if (visible) {
        el.classList.remove("hidden")
      } else {
        el.classList.add("hidden")
      }
    }
  }

  /**
   * Set text content of an element
   * @param {string} elementId - Element ID
   * @param {string} text - Text to set
   */
  setText(elementId, text) {
    const element = document.getElementById(elementId)
    if (element) {
      element.textContent = text
    }
  }

  /**
   * Set HTML content of an element
   * @param {string} elementId - Element ID
   * @param {string} html - HTML to set
   */
  setHTML(elementId, html) {
    const element = document.getElementById(elementId)
    if (element) {
      element.innerHTML = html
    }
  }

  /**
   * Add a CSS class to an element
   * @param {HTMLElement|string} element - Element or ID
   * @param {string} className - Class name to add
   */
  addClass(element, className) {
    const el = typeof element === "string" ? document.getElementById(element) : element
    if (el) {
      el.classList.add(className)
    }
  }

  /**
   * Remove a CSS class from an element
   * @param {HTMLElement|string} element - Element or ID
   * @param {string} className - Class name to remove
   */
  removeClass(element, className) {
    const el = typeof element === "string" ? document.getElementById(element) : element
    if (el) {
      el.classList.remove(className)
    }
  }

  /**
   * Show settings modal
   * Assumes a settings modal with standard ID
   * Implements focus trap for keyboard accessibility
   */
  showSettings() {
    const settingsModal = document.getElementById("settings-modal")
    if (settingsModal) {
      // Store the element that opened the modal to return focus later
      this.modalTriggerElement = document.activeElement

      settingsModal.classList.remove("hidden")

      // Set up focus trap
      this.setupFocusTrap(settingsModal)

      // Focus the first focusable element
      const focusableElements = this.getFocusableElements(settingsModal)
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      }
    }
  }

  /**
   * Hide settings modal
   * Assumes a settings modal with standard ID
   * Restores focus to the element that opened the modal
   */
  hideSettings() {
    const settingsModal = document.getElementById("settings-modal")
    if (settingsModal) {
      settingsModal.classList.add("hidden")

      // Remove focus trap
      this.removeFocusTrap(settingsModal)

      // Return focus to trigger element
      if (this.modalTriggerElement) {
        this.modalTriggerElement.focus()
        this.modalTriggerElement = null
      }
    }
  }

  /**
   * Get all focusable elements within a container
   * @param {HTMLElement} container - Container element
   * @returns {Array<HTMLElement>} Array of focusable elements
   */
  getFocusableElements(container) {
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return Array.from(container.querySelectorAll(selector))
  }

  /**
   * Set up focus trap for modal
   * @param {HTMLElement} modal - Modal element
   */
  setupFocusTrap(modal) {
    // Store handler for later removal
    this.focusTrapHandler = (e) => {
      if (e.key !== "Tab") return

      const focusableElements = this.getFocusableElements(modal)
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    modal.addEventListener("keydown", this.focusTrapHandler)
  }

  /**
   * Remove focus trap from modal
   * @param {HTMLElement} modal - Modal element
   */
  removeFocusTrap(modal) {
    if (this.focusTrapHandler) {
      modal.removeEventListener("keydown", this.focusTrapHandler)
      this.focusTrapHandler = null
    }
  }

  /**
   * Update title screen buttons based on saved progress
   * Shows/hides continue and start fresh buttons
   * @param {boolean} hasSavedProgress - Whether saved progress exists
   */
  updateTitleButtons(hasSavedProgress) {
    const continueButton = document.getElementById("continue-button")
    const startFreshButton = document.getElementById("start-fresh-button")

    this.setVisible(continueButton, hasSavedProgress)
    this.setVisible(startFreshButton, hasSavedProgress)
  }

  /**
   * Cache common DOM elements to avoid repeated queries
   * Games should extend this method to add their own specific elements
   * @returns {Object} Object containing cached DOM elements
   */
  cacheCommonElements() {
    return {
      screens: document.querySelectorAll(".screen"),
      settingsModal: document.getElementById("settings-modal"),
      settingsButton: document.getElementById("settings-button"),
      closeSettings: document.getElementById("close-settings"),
      startButton: document.getElementById("start-button"),
      continueButton: document.getElementById("continue-button"),
      startFreshButton: document.getElementById("start-fresh-button"),
      backButton: document.getElementById("back-button"),
    }
  }

  /**
   * Disable a button
   * @param {HTMLElement} button - Button element
   */
  disableButton(button) {
    if (button) {
      button.disabled = true
      button.classList.add("disabled")
    }
  }

  /**
   * Enable a button
   * @param {HTMLElement} button - Button element
   */
  enableButton(button) {
    if (button) {
      button.disabled = false
      button.classList.remove("disabled")
    }
  }

  /**
   * Disable all answer buttons
   * Assumes buttons with class 'answer-btn'
   */
  disableAnswerButtons() {
    const buttons = document.querySelectorAll(".answer-btn")
    buttons.forEach((btn) => this.disableButton(btn))
  }

  /**
   * Enable all answer buttons
   * Assumes buttons with class 'answer-btn'
   */
  enableAnswerButtons() {
    const buttons = document.querySelectorAll(".answer-btn")
    buttons.forEach((btn) => this.enableButton(btn))
  }

  /**
   * Show feedback message
   * @param {string} message - Feedback message
   * @param {string} type - Feedback type ('correct', 'incorrect', 'encourage')
   */
  showFeedback(message, type = "info") {
    const feedbackArea = document.getElementById("feedback-area")
    if (feedbackArea) {
      feedbackArea.textContent = message
      feedbackArea.className = `feedback ${type}`
      feedbackArea.style.opacity = "1"
    }
  }

  /**
   * Hide feedback message
   */
  hideFeedback() {
    const feedbackArea = document.getElementById("feedback-area")
    if (feedbackArea) {
      feedbackArea.style.opacity = "0"
    }
  }

  /**
   * Update progress bar
   * @param {number} current - Current progress value
   * @param {number} total - Total progress value
   * @param {number} percentMultiplier - Multiplier for percentage (default 100)
   */
  updateProgressBar(current, total, percentMultiplier = 100) {
    const progressBar = document.getElementById("progress-bar")
    const progressText = document.getElementById("progress-text")

    if (progressBar) {
      const percent = (current / total) * percentMultiplier
      progressBar.style.width = `${percent}%`
    }

    if (progressText) {
      progressText.textContent = `${current}/${total}`
    }
  }

  /**
   * Shake an element (for error feedback)
   * @param {HTMLElement} element - Element to shake
   * @param {number} duration - Duration in milliseconds (default 500)
   */
  shakeElement(element, duration = 500) {
    if (element) {
      element.classList.add("shake")
      setTimeout(() => {
        element.classList.remove("shake")
      }, duration)
    }
  }

  /**
   * Mark button as correct (visual feedback)
   * @param {HTMLElement} button - Button element
   */
  markButtonCorrect(button) {
    if (button) {
      button.classList.add("correct")
    }
  }

  /**
   * Mark button as incorrect (visual feedback)
   * @param {HTMLElement} button - Button element
   */
  markButtonIncorrect(button) {
    if (button) {
      button.classList.add("incorrect")
    }
  }

  /**
   * Shake a button (for wrong answer feedback)
   * @param {HTMLElement} button - Button element
   */
  shakeButton(button) {
    this.shakeElement(button)
  }
}
