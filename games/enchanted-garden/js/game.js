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
      onHome: () => this.showScreen("title-screen"),
      onAreaEnter: (areaId) => this.enterArea(areaId),
      onAnswerSelected: (answer, isCorrect, button) => this.checkAnswer(isCorrect, button),
      onSettingsOpen: () => this.openSettings(),
      onSettingsClose: () => this.closeSettings(),
      onSettingChange: (key, value) => this.updateSetting(key, value),
      onCastleView: () => this.viewCastle(),
      onCastleBack: () => this.showScreen("garden-hub"),
    })

    this.events.initializeEventListeners()
    this.ui.updateStats(this.state.stats)
    this.ui.updateSettingsUI(this.state.settings)

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
        this.state.unlockArea("time-temple")
        this.state.unlockArea("measurement-market")
        this.state.unlockArea("pattern-path")
        console.log("🔓 All areas unlocked for testing")
      } else {
        this.state.unlockArea(unlockParam)
        console.log(`🔓 Unlocked ${unlockParam} for testing`)
      }
    }
  }

  /**
   * Open settings modal
   */
  openSettings() {
    this.ui.updateSettingsUI(this.state.settings)
    this.ui.showSettings()
  }

  /**
   * Close settings modal
   */
  closeSettings() {
    this.ui.hideSettings()
  }

  /**
   * Update a setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  updateSetting(key, value) {
    this.state.updateSetting(key, value)
  }

  /**
   * View castle screen
   */
  viewCastle() {
    this.showScreen("castle-screen")
    this.ui.updateCastleProgress(this.state.getCompletedAreasCount(), 6)
    this.ui.displayCastlePieces(this.state.completedAreas)
    this.renderCastle()
  }

  /**
   * Render the castle SVG based on progress
   */
  renderCastle() {
    const container = this.ui.elements.castleSvgContainer
    if (!container) return

    const completed = this.state.getCompletedAreasCount()
    const castleSvg = this.createCastleSVG(completed)
    container.innerHTML = castleSvg
  }

  /**
   * Create castle SVG with progressive building
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  createCastleSVG(pieces) {
    // Castle SVG that builds piece by piece (6 total pieces)
    return `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <!-- Sky background -->
        <rect width="400" height="400" fill="${pieces >= 6 ? "#87CEEB" : "#e0e0e0"}" />

        ${pieces >= 1 ? `
        <!-- Foundation -->
        <rect x="100" y="320" width="200" height="60" fill="#8B7355" stroke="#654321" stroke-width="2"/>
        ` : ""}

        ${pieces >= 2 ? `
        <!-- Main walls -->
        <rect x="120" y="220" width="160" height="100" fill="#D3D3D3" stroke="#808080" stroke-width="2"/>
        ` : ""}

        ${pieces >= 3 ? `
        <!-- Towers -->
        <rect x="80" y="180" width="60" height="140" fill="#C0C0C0" stroke="#808080" stroke-width="2"/>
        <polygon points="80,180 110,140 140,180" fill="#8B0000" stroke="#654321" stroke-width="2"/>
        <rect x="260" y="180" width="60" height="140" fill="#C0C0C0" stroke="#808080" stroke-width="2"/>
        <polygon points="260,180 290,140 320,180" fill="#8B0000" stroke="#654321" stroke-width="2"/>
        ` : ""}

        ${pieces >= 4 ? `
        <!-- Door and windows -->
        <rect x="175" y="260" width="50" height="60" fill="#654321" stroke="#4a2f1a" stroke-width="2"/>
        <circle cx="150" cy="250" r="12" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
        <circle cx="250" cy="250" r="12" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
        ` : ""}

        ${pieces >= 5 ? `
        <!-- Center tower -->
        <rect x="180" y="120" width="40" height="100" fill="#B8B8B8" stroke="#808080" stroke-width="2"/>
        <polygon points="180,120 200,80 220,120" fill="#8B0000" stroke="#654321" stroke-width="2"/>
        ` : ""}

        ${pieces >= 6 ? `
        <!-- Victory flag and sparkles -->
        <line x1="200" y1="80" x2="200" y2="50" stroke="#654321" stroke-width="3"/>
        <polygon points="200,50 240,60 200,70" fill="#FFD700" stroke="#DAA520" stroke-width="1"/>
        <text x="210" y="65" font-size="20">🏆</text>

        <!-- Sparkles all around -->
        <text x="50" y="100" font-size="30">✨</text>
        <text x="330" y="100" font-size="30">✨</text>
        <text x="70" y="300" font-size="30">⭐</text>
        <text x="310" y="300" font-size="30">⭐</text>
        <text x="200" y="30" font-size="25">🎉</text>
        ` : ""}

        ${pieces < 6 ? `
        <!-- Construction message -->
        <text x="200" y="390" text-anchor="middle" font-size="16" fill="#666" font-family="Arial">
          ${pieces}/6 pieces complete
        </text>
        ` : `
        <!-- Completion message -->
        <text x="200" y="390" text-anchor="middle" font-size="18" fill="#FFD700" font-family="Arial" font-weight="bold">
          Castle Complete! 🎊
        </text>
        `}
      </svg>
    `
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
    this.ui.updateProgressBar(this.state.stats.currentLevelProgress, this.state.settings.questionsPerLevel)
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
    this.ui.displayActivity(activity, this.state.settings.inputMode, this.state.settings.visualHints)
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
    this.ui.updateProgressBar(this.state.stats.currentLevelProgress, this.state.settings.questionsPerLevel)
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
