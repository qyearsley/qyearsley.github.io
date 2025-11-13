import { GameState } from "./GameState.js"
import { GameUI } from "./GameUI.js"
import { ParticleSystem } from "./ParticleSystem.js"
import { ProgressionManager } from "./ProgressionManager.js"
import { EventManager } from "./EventManager.js"
import { StorageManager } from "./storage.js"
import { RewardSystem } from "./rewards.js"
import { ActivityGenerator } from "./activities.js"

/**
 * Main game controller for Enchanted Garden
 * Orchestrates all game systems and handles game flow
 */
class EnchantedGarden {
  /**
   * @param {Object} options - Configuration options
   * @param {StorageManager} options.storageManager - Storage manager instance
   * @param {RewardSystem} options.rewardSystem - Reward system instance
   * @param {ActivityGenerator} options.activityGenerator - Activity generator instance
   */
  constructor({ storageManager, rewardSystem, activityGenerator } = {}) {
    // Initialize subsystems with dependency injection
    this.storageManager = storageManager || new StorageManager()
    this.rewardSystem = rewardSystem || new RewardSystem()
    this.activityGenerator = activityGenerator || new ActivityGenerator()

    this.state = new GameState(this.storageManager)
    this.ui = new GameUI()
    this.particles = new ParticleSystem()
    this.progression = new ProgressionManager()

    // Initialize event manager with callbacks
    this.events = new EventManager(this.ui, {
      onStart: () => this.showScreen("garden-hub"),
      onContinue: () => this.showScreen("garden-hub"),
      onStartFresh: () => this.startFresh(),
      onBack: () => this.showScreen("garden-hub"),
      onAreaEnter: (areaId) => this.enterArea(areaId),
      onAnswerSelected: (answer, isCorrect, button) => this.checkAnswer(isCorrect, button),
    })

    this.events.initializeEventListeners()
    this.ui.updateStats(this.state.stats)

    // Update title screen based on saved progress
    this.updateTitleScreen()

    // Handle query parameters for testing
    this.handleQueryParameters()
  }

  /**
   * Update title screen buttons based on saved progress
   */
  updateTitleScreen() {
    const hasSavedProgress = this.storageManager.loadProgress() !== null
    this.ui.updateTitleButtons(hasSavedProgress)
  }

  /**
   * Start fresh (reset progress and go to garden hub)
   */
  startFresh() {
    if (confirm("Start fresh? This will reset all your progress!")) {
      this.state.resetProgress()
      this.ui.updateStats(this.state.stats)
      this.ui.updateTitleButtons(false)
      this.showScreen("garden-hub")
      console.log("🔄 Started fresh")
    }
  }

  /**
   * Handle query parameters for testing
   */
  handleQueryParameters() {
    const params = new URLSearchParams(window.location.search)

    // Unlock specific areas: ?unlock=crystal-cave or ?unlock=all
    const unlockParam = params.get("unlock")
    if (unlockParam) {
      if (unlockParam === "all") {
        this.state.unlockArea("crystal-cave")
        this.state.unlockArea("enchanted-forest")
        console.log("🔓 All areas unlocked for testing")
      } else {
        this.state.unlockArea(unlockParam)
        console.log(`🔓 Unlocked ${unlockParam} for testing`)
      }
    }
  }

  /**
   * Show a specific screen
   * @param {string} screenId - Screen identifier
   */
  showScreen(screenId) {
    this.state.setScreen(screenId)
    this.ui.showScreen(screenId)

    // Update area locks when showing garden hub
    if (screenId === "garden-hub") {
      this.ui.updateAreaLocks(this.state.unlockedAreas)
    }
  }

  /**
   * Enter a garden area
   * @param {string} areaId - Area identifier
   */
  enterArea(areaId) {
    this.state.enterArea(areaId)
    this.showScreen("activity-screen")
    this.ui.updateProgressBar(this.state.stats.currentLevelProgress, this.state.QUESTIONS_PER_LEVEL)
    this.generateActivity()
    this.ui.renderGarden(this.state.garden)
  }

  /**
   * Generate a new activity
   */
  generateActivity() {
    const activity = this.activityGenerator.generateActivity(
      this.state.stats.activitiesCompleted,
      this.state.currentArea
    )
    this.state.setActivity(activity)
    this.ui.displayActivity(activity)
  }

  /**
   * Check if answer is correct and handle result
   * @param {boolean} isCorrect - Whether answer is correct
   * @param {HTMLElement} button - The clicked button
   */
  checkAnswer(isCorrect, button) {
    this.ui.disableAnswerButtons()

    if (isCorrect) {
      this.handleCorrectAnswer(button)
    } else {
      this.handleWrongAnswer(button)
    }
  }

  /**
   * Handle correct answer
   * @param {HTMLElement} button - The clicked button
   */
  handleCorrectAnswer(button) {
    this.ui.markButtonCorrect(button)
    this.ui.showFeedback("Correct! 🌟", "correct")

    // Create celebration particles
    const center = this.ui.getButtonCenter(button)
    this.particles.createParticles(center.x, center.y, this.ui.getParticlesContainer())

    // Update game state - pass current area for area-specific rewards
    const flower = this.rewardSystem.generateFlower(this.state.currentArea)
    const levelComplete = this.state.recordCorrectAnswer(flower)

    // Update UI
    this.updateAllDisplays()

    // Handle level completion or continue
    if (levelComplete) {
      setTimeout(() => this.showLevelComplete(), 1500)
    } else {
      setTimeout(() => this.generateActivity(), 1500)
    }
  }

  /**
   * Handle wrong answer
   * @param {HTMLElement} button - The clicked button
   */
  handleWrongAnswer(button) {
    this.ui.shakeButton(button)
    this.ui.showFeedback("Try again! 💫", "encourage")

    setTimeout(() => {
      this.ui.enableAnswerButtons()
    }, 1000)
  }

  /**
   * Update all UI displays
   */
  updateAllDisplays() {
    this.ui.updateStats(this.state.stats)
    this.ui.updateProgressBar(this.state.stats.currentLevelProgress, this.state.QUESTIONS_PER_LEVEL)
    this.ui.updateVisualProgression(
      this.state.currentArea,
      this.progression.getAreaThemes(),
      this.state.getProgressPercent(),
    )
    this.ui.renderGarden(this.state.garden)
    this.state.saveProgress()
  }

  /**
   * Show level complete celebration
   */
  showLevelComplete() {
    this.ui.showFeedback(`🎉 Level ${this.state.stats.currentLevel} Complete! 🎉`, "correct")

    this.state.completeLevel()
    this.updateAllDisplays()

    // Return to garden hub after completing a level
    setTimeout(() => {
      this.showScreen("garden-hub")
    }, 2500)
  }
}

// Initialize game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Create instances with dependency injection
  const storageManager = new StorageManager()
  const rewardSystem = new RewardSystem()
  const activityGenerator = new ActivityGenerator()

  window.game = new EnchantedGarden({
    storageManager,
    rewardSystem,
    activityGenerator,
  })
})
