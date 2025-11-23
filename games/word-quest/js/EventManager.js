/**
 * Event Manager for Word Quest
 * Handles all UI event listeners and interactions
 */
export class EventManager {
  constructor(game) {
    this.game = game
    this.setupEventListeners()
  }

  setupEventListeners() {
    // Title screen buttons
    document.getElementById("start-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    document.getElementById("continue-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    document.getElementById("start-fresh-button")?.addEventListener("click", () => {
      if (confirm("Are you sure you want to start a new quest? This will reset all progress.")) {
        this.game.gameState.resetProgress()
        this.game.showScreen("quest-map")
      }
    })

    // Settings modal buttons
    document.getElementById("settings-button")?.addEventListener("click", () => {
      this.openSettingsModal()
    })

    document.getElementById("activity-settings-button")?.addEventListener("click", () => {
      this.openSettingsModal()
    })

    document.getElementById("close-settings")?.addEventListener("click", () => {
      this.closeSettingsModal()
    })

    // Close modal when clicking outside
    document.getElementById("settings-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "settings-modal") {
        this.closeSettingsModal()
      }
    })

    // Quest map buttons
    document.getElementById("home-button")?.addEventListener("click", () => {
      this.game.showScreen("title-screen")
    })

    // Word gallery button
    document.getElementById("word-gallery-button")?.addEventListener("click", () => {
      this.game.showScreen("word-gallery-screen")
    })

    // Word gallery back button
    document.getElementById("gallery-back-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    // Activity screen buttons
    document.getElementById("back-to-map-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    // Handle keyboard input submission (delegate to handle submit-answer-button)
    document.addEventListener("click", (e) => {
      if (e.target.id === "submit-answer-button") {
        this.handleKeyboardSubmit()
      }
    })

    // Handle Enter key in text input
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const answerInput = document.getElementById("answer-input")
        if (answerInput && document.activeElement === answerInput) {
          e.preventDefault()
          this.handleKeyboardSubmit()
        }
      }
    })

    document.getElementById("submit-answer")?.addEventListener("click", () => {
      this.handleSubmitAnswer()
    })

    document.getElementById("next-activity")?.addEventListener("click", () => {
      this.game.nextActivity()
    })

    // Level complete buttons
    document.getElementById("continue-quest-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    document.getElementById("return-to-map-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    // Handle choice selection in activities
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("choice-button")) {
        this.handleChoiceClick(e.target)
      }
    })

    // Handle quest selection on map
    document.addEventListener("click", (e) => {
      if (e.target.closest(".quest-card")) {
        const questCard = e.target.closest(".quest-card")
        const questId = questCard.dataset.questId
        if (questCard.classList.contains("unlocked")) {
          this.game.startLevel(questId)
        }
      }
    })

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      this.handleKeyboardShortcuts(e)
    })
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboardShortcuts(e) {
    const currentScreen = this.game.gameState.currentScreen

    // Escape key - close modal or go back
    if (e.key === "Escape") {
      e.preventDefault()
      const modal = document.getElementById("settings-modal")
      if (modal && !modal.classList.contains("hidden")) {
        this.closeSettingsModal()
        return
      }
      if (currentScreen === "activity-screen") {
        this.game.showScreen("quest-map")
      } else if (currentScreen === "quest-map") {
        this.game.showScreen("title-screen")
      } else if (currentScreen === "level-complete") {
        this.game.showScreen("quest-map")
      }
      return
    }

    // Activity screen shortcuts
    if (currentScreen === "activity-screen") {
      // Check if user is typing in an input field
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return
      }

      // Number keys 1-4 to select choices (only if not already answered)
      if (!this.answered && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        const choiceIndex = parseInt(e.key) - 1
        const choices = document.querySelectorAll(".choice-button")
        if (choices[choiceIndex] && !choices[choiceIndex].disabled) {
          this.handleChoiceClick(choices[choiceIndex])
        }
        return
      }

      // Support for letter shortcuts (s/l for short/long)
      if (!this.answered) {
        const choices = document.querySelectorAll(".choice-button")
        for (const choice of choices) {
          const shortcut = choice.dataset.shortcut
          if (shortcut && e.key.toLowerCase() === shortcut.toLowerCase()) {
            e.preventDefault()
            if (!choice.disabled) {
              this.handleChoiceClick(choice)
            }
            return
          }
        }
      }
    }

    // Quest map - Enter to select focused quest
    if (currentScreen === "quest-map" && e.key === "Enter") {
      const focusedCard = document.activeElement
      if (
        focusedCard?.classList.contains("quest-card") &&
        focusedCard.classList.contains("unlocked")
      ) {
        e.preventDefault()
        const questId = focusedCard.dataset.questId
        this.game.startLevel(questId)
      }
    }
  }

  /**
   * Open settings modal
   */
  openSettingsModal() {
    const modal = document.getElementById("settings-modal")
    if (!modal) return

    // Populate current settings
    const settings = this.game.gameState.settings

    const difficultySelect = document.getElementById("difficulty-select")
    const questionsSelect = document.getElementById("questions-per-level-select")
    const inputModeSelect = document.getElementById("input-mode-select")
    const audioHintsSelect = document.getElementById("audio-hints-select")

    if (difficultySelect) difficultySelect.value = settings.difficulty
    if (questionsSelect) questionsSelect.value = settings.questionsPerLevel.toString()
    if (inputModeSelect) inputModeSelect.value = settings.inputMode
    if (audioHintsSelect) audioHintsSelect.value = settings.audioHints.toString()

    modal.classList.remove("hidden")
  }

  /**
   * Close settings modal and save settings
   */
  closeSettingsModal() {
    const modal = document.getElementById("settings-modal")
    if (!modal) return

    // Save settings
    const difficulty = document.getElementById("difficulty-select")?.value || "explorer"
    const questionsPerLevel =
      parseInt(document.getElementById("questions-per-level-select")?.value) || 5
    const inputMode = document.getElementById("input-mode-select")?.value || "multipleChoice"
    const audioHints = document.getElementById("audio-hints-select")?.value === "true"

    this.game.gameState.setDifficulty(difficulty)
    this.game.gameState.updateSettings({
      difficulty,
      questionsPerLevel,
      inputMode,
      audioHints,
    })

    // Update sound manager
    this.game.soundManager.setEnabled(audioHints)

    modal.classList.add("hidden")
  }

  /**
   * Handle choice button click
   */
  handleChoiceClick(button) {
    // Ignore if already answered
    if (this.answered) return

    // Store selected answer
    this.selectedAnswer = button.dataset.value

    const activity = this.game.gameState.currentActivity
    const isCorrect = this.selectedAnswer === activity.correctAnswer

    // Mark this choice as selected
    button.classList.add("selected")

    // Show feedback immediately
    this.game.showFeedback(isCorrect)

    if (isCorrect) {
      // Play correct sound
      this.game.soundManager.playCorrect()

      // Mark as fully answered
      this.answered = true
      this.game.gameState.recordCorrectAnswer(activity.word)

      // Disable all choices and show correct
      document.querySelectorAll(".choice-button").forEach((btn) => {
        btn.disabled = true
        if (btn.dataset.value === activity.correctAnswer) {
          btn.classList.add("correct")
        }
      })

      // Auto-advance to next question after a short delay
      setTimeout(() => {
        this.game.nextActivity()
      }, 1000)
    } else {
      // Play incorrect sound
      this.game.soundManager.playIncorrect()

      // Wrong answer - allow retry like Number Garden
      button.classList.add("incorrect")

      // Wait briefly, then clear the incorrect marking and allow retry
      setTimeout(() => {
        button.classList.remove("selected", "incorrect")
      }, 800)
    }
  }

  /**
   * Handle keyboard input submission
   */
  handleKeyboardSubmit() {
    // Ignore if already answered
    if (this.answered) return

    const answerInput = document.getElementById("answer-input")
    if (!answerInput) return

    const userAnswer = answerInput.value.trim().toLowerCase()
    if (!userAnswer) return

    // Mark as answered
    this.answered = true

    const activity = this.game.gameState.currentActivity
    const correctAnswer = activity.correctAnswer.toString().toLowerCase()
    const isCorrect = userAnswer === correctAnswer

    // Disable input
    answerInput.disabled = true
    const submitButton = document.getElementById("submit-answer-button")
    if (submitButton) submitButton.disabled = true

    // Show feedback
    this.game.showFeedback(isCorrect)

    if (isCorrect) {
      // Play correct sound
      this.game.soundManager.playCorrect()
      this.game.gameState.recordCorrectAnswer(activity.word)
      answerInput.classList.add("correct")
    } else {
      // Play incorrect sound
      this.game.soundManager.playIncorrect()
      answerInput.classList.add("incorrect")
    }

    // Auto-advance to next question after a short delay
    setTimeout(() => {
      this.game.nextActivity()
    }, 1000)
  }

  /**
   * Handle answer submission (kept for compatibility)
   */
  handleSubmitAnswer() {
    // This is now handled by handleChoiceClick or handleKeyboardSubmit
  }

  /**
   * Clear selected answer
   */
  clearSelection() {
    this.selectedAnswer = null
    this.answered = false
    document.querySelectorAll(".choice-button").forEach((btn) => {
      btn.classList.remove("selected", "correct", "incorrect")
      btn.disabled = false
    })

    // Clear keyboard input if present
    const answerInput = document.getElementById("answer-input")
    if (answerInput) {
      answerInput.value = ""
      answerInput.disabled = false
      answerInput.classList.remove("correct", "incorrect")
    }
    const submitButton = document.getElementById("submit-answer-button")
    if (submitButton) {
      submitButton.disabled = false
    }
  }
}
