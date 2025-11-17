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
      if (this.game.gameState.hasSavedProgress()) {
        this.game.showScreen("settings-screen")
      } else {
        this.game.showScreen("settings-screen")
      }
    })

    document.getElementById("continue-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    document.getElementById("start-fresh-button")?.addEventListener("click", () => {
      if (confirm("Are you sure you want to start a new quest? This will reset all progress.")) {
        this.game.gameState.resetProgress()
        this.game.showScreen("settings-screen")
      }
    })

    // Settings screen
    document.getElementById("settings-start-button")?.addEventListener("click", () => {
      this.handleSettingsSubmit()
    })

    // Quest map buttons
    document.getElementById("home-button")?.addEventListener("click", () => {
      this.game.showScreen("title-screen")
    })

    document.getElementById("settings-button")?.addEventListener("click", () => {
      this.game.showScreen("settings-screen")
    })

    // Activity screen buttons
    document.getElementById("back-to-map-button")?.addEventListener("click", () => {
      this.game.showScreen("quest-map")
    })

    document.getElementById("submit-answer")?.addEventListener("click", () => {
      this.handleSubmitAnswer()
    })

    document.getElementById("next-activity")?.addEventListener("click", () => {
      this.game.nextActivity()
    })

    // Level complete buttons
    document.getElementById("continue-quest-button")?.addEventListener("click", () => {
      this.game.startLevel(this.game.gameState.currentQuest)
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

    // Escape key - go back/cancel
    if (e.key === "Escape") {
      e.preventDefault()
      if (currentScreen === "activity-screen") {
        this.game.showScreen("quest-map")
      } else if (currentScreen === "quest-map") {
        this.game.showScreen("title-screen")
      } else if (currentScreen === "settings-screen") {
        this.game.showScreen("title-screen")
      } else if (currentScreen === "level-complete") {
        this.game.showScreen("quest-map")
      }
      return
    }

    // Activity screen shortcuts
    if (currentScreen === "activity-screen") {
      // Number keys 1-4 to select choices (only if not already answered)
      if (!this.answered && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        const choiceIndex = parseInt(e.key) - 1
        const choices = document.querySelectorAll(".choice-button")
        if (choices[choiceIndex]) {
          this.handleChoiceClick(choices[choiceIndex])
        }
        return
      }

      // Enter key to proceed to next
      if (e.key === "Enter" && this.answered) {
        e.preventDefault()
        const nextButton = document.getElementById("next-activity")
        if (nextButton && !nextButton.classList.contains("hidden")) {
          this.game.nextActivity()
        }
        return
      }
    }

    // Quest map - Enter to select focused quest
    if (currentScreen === "quest-map" && e.key === "Enter") {
      const focusedCard = document.activeElement
      if (focusedCard?.classList.contains("quest-card") && focusedCard.classList.contains("unlocked")) {
        e.preventDefault()
        const questId = focusedCard.dataset.questId
        this.game.startLevel(questId)
      }
    }
  }

  /**
   * Handle settings form submission
   */
  handleSettingsSubmit() {
    const difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || "explorer"
    const questionsPerLevel =
      parseInt(document.querySelector('input[name="questionsPerLevel"]:checked')?.value) || 5
    const inputMode = document.querySelector('input[name="inputMode"]:checked')?.value || "multipleChoice"
    const audioHints = document.querySelector('input[name="audioHints"]')?.checked ?? true

    this.game.gameState.setDifficulty(difficulty)
    this.game.gameState.updateSettings({
      difficulty,
      questionsPerLevel,
      inputMode,
      audioHints,
    })

    this.game.showScreen("quest-map")
  }

  /**
   * Handle choice button click
   */
  handleChoiceClick(button) {
    // Ignore if already answered
    if (this.answered) return

    // Mark as answered
    this.answered = true

    // Store selected answer
    this.selectedAnswer = button.dataset.value

    const activity = this.game.gameState.currentActivity
    const isCorrect = this.selectedAnswer === activity.correctAnswer

    // Mark this choice as selected
    button.classList.add("selected")

    // Show feedback immediately
    this.game.showFeedback(isCorrect)

    if (isCorrect) {
      this.game.gameState.recordCorrectAnswer(activity.word)
    }

    // Disable all choices and show correct/incorrect
    document.querySelectorAll(".choice-button").forEach((btn) => {
      btn.disabled = true
      if (btn.dataset.value === activity.correctAnswer) {
        btn.classList.add("correct")
      } else if (btn.dataset.value === this.selectedAnswer && !isCorrect) {
        btn.classList.add("incorrect")
      }
    })

    // Hide submit button, show next button
    document.getElementById("submit-answer")?.classList.add("hidden")
    document.getElementById("next-activity")?.classList.remove("hidden")
  }

  /**
   * Handle answer submission (kept for compatibility)
   */
  handleSubmitAnswer() {
    // This is now handled by handleChoiceClick
    // Kept for any keyboard input mode in the future
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
  }
}
