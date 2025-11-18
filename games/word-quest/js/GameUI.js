/**
 * Game UI Manager for Word Quest
 * Handles rendering of all game screens and UI elements
 */
export class GameUI {
  constructor(gameState, activityGenerator) {
    this.gameState = gameState
    this.activityGenerator = activityGenerator
    this.soundManager = null // Will be set by game.js
  }

  /**
   * Set the sound manager reference
   * @param {SoundManager} soundManager - Sound manager instance
   */
  setSoundManager(soundManager) {
    this.soundManager = soundManager
  }

  /**
   * Show a specific screen
   * @param {string} screenId - Screen identifier
   */
  showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active")
    })

    const screen = document.getElementById(screenId)
    if (screen) {
      screen.classList.add("active")
    }

    // Update screen-specific UI
    switch (screenId) {
      case "title-screen":
        this.updateTitleScreen()
        break
      case "quest-map":
        this.updateQuestMap()
        break
      case "level-complete":
        this.updateLevelCompleteScreen()
        break
    }
  }

  /**
   * Update title screen based on saved progress
   */
  updateTitleScreen() {
    const continueButton = document.getElementById("continue-button")
    const startFreshButton = document.getElementById("start-fresh-button")

    if (this.gameState.hasSavedProgress()) {
      continueButton?.classList.remove("hidden")
      startFreshButton?.classList.remove("hidden")
    } else {
      continueButton?.classList.add("hidden")
      startFreshButton?.classList.add("hidden")
    }
  }

  /**
   * Update quest map with available quests
   */
  updateQuestMap() {
    const rankDisplay = document.getElementById("rank-display")
    const starsDisplay = document.getElementById("stars-display")

    if (rankDisplay) {
      rankDisplay.textContent = this.gameState.getDecoderRank()
    }
    if (starsDisplay) {
      starsDisplay.textContent = `⭐ ${this.gameState.stats.stars} Stars`
    }

    // Render quest cards
    const questPaths = document.querySelector(".quest-paths")
    if (!questPaths) return

    const quests = [
      "sound-cipher",
      "blending-workshop",
      "speed-vault",
      "pattern-archive",
      "spell-forge",
      "story-vault",
    ]

    questPaths.innerHTML = quests
      .map((questId) => {
        const theme = this.activityGenerator.getQuestTheme(questId)
        const isUnlocked = this.gameState.isQuestUnlocked(questId)
        const isCompleted = this.gameState.isQuestCompleted(questId)
        const progress = this.gameState.getQuestProgress(questId)

        let statusText = ""
        let statusClass = ""

        if (isCompleted) {
          statusText = `✓ Complete (${progress.stars} ⭐)`
          statusClass = "completed"
        } else if (isUnlocked) {
          statusText = "Start Quest →"
          statusClass = "unlocked"
        } else {
          statusText = "🔒 Locked"
          statusClass = "locked"
        }

        const ariaLabel = isUnlocked
          ? `${theme.name}: ${theme.description}. ${isCompleted ? "Completed" : "Ready to start"}. Click to start.`
          : `${theme.name}: Locked. Complete previous quest to unlock.`

        return `
        <div class="quest-card ${statusClass}" data-quest-id="${questId}" role="listitem" ${isUnlocked ? 'tabindex="0"' : ""} aria-label="${ariaLabel}">
          <div class="quest-icon" aria-hidden="true">${theme.icon}</div>
          <div class="quest-info">
            <h3>${theme.name}</h3>
            <p class="quest-description">${theme.description}</p>
            <div class="quest-status">${statusText}</div>
          </div>
        </div>
      `
      })
      .join("")
  }

  /**
   * Render an activity
   * @param {Object} activity - Activity object
   * @param {number} currentQuestion - Current question number
   * @param {number} totalQuestions - Total questions
   */
  renderActivity(activity, currentQuestion, totalQuestions) {
    const questName = document.getElementById("quest-name")
    const activityProgress = document.getElementById("activity-progress")
    const activityStars = document.getElementById("activity-stars")
    const questionArea = document.getElementById("activity-question")
    const choicesArea = document.getElementById("activity-choices")
    const feedbackArea = document.getElementById("activity-feedback")

    // Update header
    const theme = this.activityGenerator.getQuestTheme(this.gameState.currentQuest)
    if (questName) questName.textContent = `${theme.icon} ${theme.name}`
    if (activityProgress) activityProgress.textContent = `Question ${currentQuestion} of ${totalQuestions}`
    if (activityStars) activityStars.textContent = `⭐ ${this.gameState.stats.stars}`

    // Render question
    if (questionArea) {
      let visualHTML = ""
      if (activity.showPicture && activity.visual) {
        visualHTML = `<div class="picture-visual">${activity.visual}</div>`
      } else if (activity.visual) {
        visualHTML = `<div class="text-visual">${activity.visual}</div>`
      }

      questionArea.innerHTML = `
        <h3>${activity.question}</h3>
        ${visualHTML}
        ${
          activity.audioWord && this.gameState.settings.audioHints && this.soundManager?.isSpeechAvailable()
            ? `<button class="audio-button" onclick="window.game.soundManager.playWord('${activity.audioWord}')" aria-label="Hear the word pronounced">
             🔊 Hear it
           </button>`
            : activity.audioWord && this.gameState.settings.audioHints && !this.soundManager?.isSpeechAvailable()
              ? `<div class="audio-unavailable" role="status" aria-live="polite">
             <small>🔇 Audio not available in this browser</small>
           </div>`
              : ""
        }
      `
    }

    // Render choices
    if (choicesArea) {
      const inputMode = this.gameState.settings.inputMode

      if (inputMode === "keyboard") {
        // Keyboard input mode - show text input
        choicesArea.innerHTML = `
          <div class="keyboard-input-container">
            <input
              type="text"
              id="answer-input"
              class="answer-input"
              placeholder="Type your answer..."
              autocomplete="off"
              autocapitalize="off"
              aria-label="Type your answer"
            />
            <button id="submit-answer-button" class="big-button" aria-label="Submit your answer">
              Submit
            </button>
          </div>
        `
      } else {
        // Multiple choice mode - show buttons
        choicesArea.innerHTML = activity.choices
          .map(
            (choice, index) => {
              // Determine keyboard shortcut
              let shortcut = ""
              let shortcutData = ""
              if (activity.type === "vowel-sound") {
                // Use 's' and 'l' for short/long
                if (choice === "short") {
                  shortcut = " (S)"
                  shortcutData = ` data-shortcut="s"`
                } else if (choice === "long") {
                  shortcut = " (L)"
                  shortcutData = ` data-shortcut="l"`
                }
              } else {
                // Use numbers 1-4
                shortcut = ` (${index + 1})`
              }

              return `
          <button class="choice-button" data-value="${choice}"${shortcutData} role="radio" aria-checked="false" aria-label="Choice ${index + 1}: ${choice}">
            ${choice}<span class="keyboard-hint">${shortcut}</span>
          </button>
        `
            },
          )
          .join("")
      }
    }

    // Reset feedback
    if (feedbackArea) {
      feedbackArea.classList.add("hidden")
      feedbackArea.innerHTML = ""
    }

    // Reset buttons
    const submitButton = document.getElementById("submit-answer")
    const nextButton = document.getElementById("next-activity")
    if (submitButton) {
      submitButton.classList.add("hidden") // Always hidden for multiple choice
    }
    if (nextButton) {
      nextButton.classList.add("hidden")
    }
  }

  /**
   * Show feedback after answer
   * @param {boolean} isCorrect - Whether answer was correct
   */
  showFeedback(isCorrect) {
    const feedbackArea = document.getElementById("activity-feedback")
    if (!feedbackArea) return

    const activity = this.gameState.currentActivity

    if (isCorrect) {
      feedbackArea.innerHTML = `
        <div class="feedback correct">
          <div class="feedback-icon">✨</div>
          <h3>Correct!</h3>
        </div>
      `
    } else {
      feedbackArea.innerHTML = `
        <div class="feedback incorrect">
          <div class="feedback-icon">🔍</div>
          <h3>Not quite!</h3>
          <p>The answer is: <strong>${activity.correctAnswer}</strong></p>
        </div>
      `
    }

    feedbackArea.classList.remove("hidden")
  }

  /**
   * Update level complete screen
   */
  updateLevelCompleteScreen() {
    const completionMessage = document.getElementById("completion-message")
    const rewardsDisplay = document.getElementById("rewards-display")

    if (completionMessage) {
      const questTheme = this.activityGenerator.getQuestTheme(this.gameState.currentQuest)
      completionMessage.innerHTML = `
        <h3>Quest Complete! 🎉</h3>
        <p>You mastered ${questTheme.name}!</p>
      `
    }

    if (rewardsDisplay) {
      const totalCompleted = Array.from(this.gameState.completedQuests).length
      rewardsDisplay.innerHTML = `
        <div class="reward-stats">
          <div class="stat">
            <span class="stat-value">${totalCompleted}</span>
            <span class="stat-label">Quests Complete</span>
          </div>
          <div class="stat">
            <span class="stat-value">${this.gameState.stats.stars}</span>
            <span class="stat-label">Total Stars</span>
          </div>
          <div class="stat">
            <span class="stat-value">${this.gameState.stats.wordsLearned}</span>
            <span class="stat-label">Words Learned</span>
          </div>
        </div>
      `
    }
  }
}
