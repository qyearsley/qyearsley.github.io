import { BaseGameUI } from "../../common/js/BaseGameUI.js"

/**
 * Game UI Manager for Word Quest
 * Handles rendering of all game screens and UI elements
 */
export class GameUI extends BaseGameUI {
  constructor(gameState, activityGenerator) {
    super()
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
    // Call parent's screen switching logic
    super.showScreen(screenId)

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
      case "word-gallery-screen":
        this.updateWordGallery()
        break
    }
  }

  /**
   * Update title screen based on saved progress
   */
  updateTitleScreen() {
    this.updateTitleButtons(this.gameState.hasSavedProgress())
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
    const questCreature = document.getElementById("quest-creature")
    const creatureNarrative = document.getElementById("creature-narrative")

    // Update header
    const theme = this.activityGenerator.getQuestTheme(this.gameState.currentQuest)
    if (questName) questName.textContent = `${theme.icon} ${theme.name}`
    if (activityProgress)
      activityProgress.textContent = `Question ${currentQuestion} of ${totalQuestions}`
    if (activityStars) activityStars.textContent = `⭐ ${this.gameState.stats.stars}`

    // Update creature and narrative
    if (questCreature) questCreature.textContent = theme.creature || "🦊"
    if (creatureNarrative) creatureNarrative.textContent = theme.narrative || "Let's learn!"

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
          activity.audioWord &&
          this.gameState.settings.audioHints &&
          this.soundManager?.isSpeechAvailable()
            ? `<button class="audio-button" onclick="window.game.soundManager.playWord('${activity.audioWord}')" aria-label="Hear the word pronounced">
             🔊 Hear it
           </button>`
            : activity.audioWord &&
                this.gameState.settings.audioHints &&
                !this.soundManager?.isSpeechAvailable()
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
          .map((choice, index) => {
            // Determine keyboard shortcut
            let keyboardHint = ""
            let shortcutData = ""
            if (activity.type === "vowel-sound") {
              // Use 's' and 'l' for short/long
              if (choice === "short") {
                keyboardHint = "S"
                shortcutData = ` data-shortcut="s"`
              } else if (choice === "long") {
                keyboardHint = "L"
                shortcutData = ` data-shortcut="l"`
              }
            } else {
              // Use numbers 1-4
              keyboardHint = `${index + 1}`
            }

            return `
          <button class="choice-button" data-value="${choice}"${shortcutData} data-keyboard-hint="${keyboardHint}" role="radio" aria-checked="false" aria-label="Choice ${index + 1}: ${choice}">
            ${choice}
          </button>
        `
          })
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

    // Auto-play audio for listening-focused questions
    if (
      activity.autoPlayAudio &&
      activity.audioWord &&
      this.gameState.settings.audioHints &&
      this.soundManager?.isSpeechAvailable()
    ) {
      // Delay slightly to ensure UI is rendered
      setTimeout(() => {
        this.soundManager.playWord(activity.audioWord)
      }, 300)
    }
  }

  /**
   * Show feedback after answer
   * @param {boolean} isCorrect - Whether answer was correct
   */
  showFeedback(isCorrect) {
    const feedbackArea = document.getElementById("activity-feedback")
    if (!feedbackArea) return

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
          <h3>Try again!</h3>
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

  /**
   * Update word gallery with mastered words
   */
  updateWordGallery() {
    const wordsCount = document.getElementById("gallery-words-count")
    const questsCount = document.getElementById("gallery-quests-count")
    const starsCount = document.getElementById("gallery-stars-count")
    const wordCardsGrid = document.getElementById("word-cards-grid")

    if (!wordCardsGrid) return

    // Update stats
    if (wordsCount) wordsCount.textContent = this.gameState.masteredWords.size
    if (questsCount) questsCount.textContent = this.gameState.completedQuests.size
    if (starsCount) starsCount.textContent = this.gameState.stats.stars

    // Clear existing cards
    wordCardsGrid.innerHTML = ""

    // Check if there are any mastered words
    if (this.gameState.masteredWords.size === 0) {
      wordCardsGrid.innerHTML = `
        <div class="empty-gallery">
          <div class="empty-gallery-icon">📚</div>
          <h3>No Words Yet!</h3>
          <p>Complete quests to start collecting words in your gallery.</p>
        </div>
      `
      return
    }

    // Convert Set to Array
    const words = Array.from(this.gameState.masteredWords)

    // Group words by word families
    const wordBank = this.activityGenerator.wordBank
    const wordFamilyGroups = {}
    const uncategorizedWords = []

    // Check all difficulty levels for word families
    words.forEach((word) => {
      let foundFamily = false
      for (const difficulty of ["explorer", "adventurer", "master"]) {
        const families = wordBank.getAllWordFamilies(difficulty)
        for (const [familyName, familyWords] of Object.entries(families)) {
          if (familyWords.includes(word)) {
            if (!wordFamilyGroups[familyName]) {
              wordFamilyGroups[familyName] = []
            }
            wordFamilyGroups[familyName].push(word)
            foundFamily = true
            break
          }
        }
        if (foundFamily) break
      }
      if (!foundFamily) {
        uncategorizedWords.push(word)
      }
    })

    // Create family sections
    const familyKeys = Object.keys(wordFamilyGroups).sort()

    familyKeys.forEach((familyName) => {
      const familyWords = wordFamilyGroups[familyName].sort()

      // Create family section
      const familySection = document.createElement("div")
      familySection.className = "word-family-section"

      const familyHeader = document.createElement("h3")
      familyHeader.className = "word-family-header"
      familyHeader.textContent = `-${familyName} family (${familyWords.length} word${familyWords.length > 1 ? "s" : ""})`
      familySection.appendChild(familyHeader)

      const familyGrid = document.createElement("div")
      familyGrid.className = "word-family-grid"

      familyWords.forEach((word) => {
        const card = this.createWordCard(word)
        familyGrid.appendChild(card)
      })

      familySection.appendChild(familyGrid)
      wordCardsGrid.appendChild(familySection)
    })

    // Add uncategorized words if any
    if (uncategorizedWords.length > 0) {
      const otherSection = document.createElement("div")
      otherSection.className = "word-family-section"

      const otherHeader = document.createElement("h3")
      otherHeader.className = "word-family-header"
      otherHeader.textContent = `Other Words (${uncategorizedWords.length})`
      otherSection.appendChild(otherHeader)

      const otherGrid = document.createElement("div")
      otherGrid.className = "word-family-grid"

      uncategorizedWords.sort().forEach((word) => {
        const card = this.createWordCard(word)
        otherGrid.appendChild(card)
      })

      otherSection.appendChild(otherGrid)
      wordCardsGrid.appendChild(otherSection)
    }
  }

  /**
   * Create a word card element
   * @param {string} word - The word to create a card for
   * @returns {HTMLElement} The card element
   */
  createWordCard(word) {
    const wordBank = this.activityGenerator.wordBank
    const card = document.createElement("div")
    card.className = "word-card"
    card.setAttribute("role", "button")
    card.setAttribute("tabindex", "0")
    card.setAttribute("aria-label", `Word: ${word}`)

    // Try to find a picture for this word
    let picture = null
    for (const difficulty of ["explorer", "adventurer", "master"]) {
      picture = wordBank.getPictureForWord(difficulty, word)
      if (picture) break
    }

    card.innerHTML = `
      ${picture ? `<div class="word-card-picture">${picture}</div>` : ""}
      <div class="word-card-word">${word}</div>
      <div class="word-card-badge">✓</div>
    `

    // Add click to play sound and show animation
    card.addEventListener("click", () => {
      // Play sound if available
      if (this.soundManager) {
        this.soundManager.playWord(word)
      }

      // Add flip animation
      card.classList.add("flipped")
      setTimeout(() => {
        card.classList.remove("flipped")
      }, 600)
    })

    return card
  }
}
