/**
 * Main Game Controller for Word Quest
 */
import { StorageManager } from "./storage.js"
import { WordBank } from "./WordBank.js"
import { GameState } from "./GameState.js"
import { WordActivityGenerator } from "./WordActivityGenerator.js"
import { GameUI } from "./GameUI.js"
import { SoundManager } from "./SoundManager.js"
import { EventManager } from "./EventManager.js"

class Game {
  constructor() {
    // Initialize core systems
    this.storageManager = new StorageManager("wordQuest")
    this.wordBank = new WordBank()
    this.gameState = new GameState(this.storageManager)
    this.activityGenerator = new WordActivityGenerator(this.wordBank)
    this.soundManager = new SoundManager()
    this.gameUI = new GameUI(this.gameState, this.activityGenerator)
    this.eventManager = new EventManager(this)

    // Pass sound manager to UI for availability checks
    this.gameUI.setSoundManager(this.soundManager)

    // Game state
    this.currentActivity = null
    this.currentQuestionNumber = 1

    // Initialize
    this.init()
  }

  /**
   * Initialize the game
   */
  init() {
    // Update sound manager based on settings
    this.soundManager.setEnabled(this.gameState.settings.audioHints)

    // Check for URL parameters (e.g., ?unlock=all)
    const params = new URLSearchParams(window.location.search)
    const unlockParam = params.get("unlock")
    if (unlockParam === "all") {
      this.gameState.unlockedQuests.add("sound-cipher")
      this.gameState.unlockedQuests.add("blending-workshop")
      this.gameState.unlockedQuests.add("speed-vault")
      this.gameState.unlockedQuests.add("pattern-archive")
      this.gameState.unlockedQuests.add("spell-forge")
      this.gameState.unlockedQuests.add("story-vault")
    }

    // Show appropriate starting screen
    if (this.gameState.hasSavedProgress()) {
      this.showScreen("title-screen")
    } else {
      this.showScreen("title-screen")
    }

    // Make game accessible globally for audio buttons
    window.game = this
  }

  /**
   * Show a specific screen
   * @param {string} screenId - Screen identifier
   */
  showScreen(screenId) {
    this.gameState.currentScreen = screenId
    this.gameUI.showScreen(screenId)
  }

  /**
   * Start a level for a specific quest
   * @param {string} questId - Quest identifier
   */
  startLevel(questId) {
    if (!this.gameState.isQuestUnlocked(questId)) {
      alert("This quest is locked! Complete previous quests to unlock it.")
      return
    }

    this.gameState.enterQuest(questId)
    this.currentQuestionNumber = 1
    this.showScreen("activity-screen")
    this.loadNextActivity()
  }

  /**
   * Load the next activity
   */
  loadNextActivity() {
    const totalQuestions = this.gameState.settings.questionsPerLevel

    // Check if level is complete
    if (this.currentQuestionNumber > totalQuestions) {
      this.completeLevel()
      return
    }

    // Generate new activity
    const activity = this.activityGenerator.generateActivity(
      this.currentQuestionNumber,
      this.gameState.currentQuest,
      this.gameState.difficulty,
    )

    this.gameState.setCurrentActivity(activity)
    this.currentActivity = activity

    // Render activity
    this.gameUI.renderActivity(activity, this.currentQuestionNumber, totalQuestions)

    // Clear event manager selection
    this.eventManager.clearSelection()
  }

  /**
   * Move to next activity
   */
  nextActivity() {
    this.gameState.completeActivity()
    this.currentQuestionNumber++
    this.loadNextActivity()
  }

  /**
   * Show feedback after answer
   * @param {boolean} isCorrect - Whether answer was correct
   */
  showFeedback(isCorrect) {
    this.gameUI.showFeedback(isCorrect)

    // Play sound for correct/incorrect
    if (isCorrect) {
      // Could add celebration sound
    }
  }

  /**
   * Complete the current level
   */
  completeLevel() {
    this.gameState.completeLevel()
    this.showScreen("level-complete")
  }
}

// Start the game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new Game()
})
