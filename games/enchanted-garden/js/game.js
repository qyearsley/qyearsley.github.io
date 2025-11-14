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
    this.ui.updateCastleBadge(this.state.getCompletedAreasCount())

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
        <!-- Sky background with gradient -->
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${pieces >= 6 ? "#87CEEB" : "#e8e8e8"};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${pieces >= 6 ? "#B0E0E6" : "#f0f0f0"};stop-opacity:1" />
          </linearGradient>
          <linearGradient id="stoneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#E8E8E8;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#C0C0C0;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="roofGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#DC143C;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8B0000;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>

        <rect width="400" height="400" fill="url(#skyGradient)" />

        ${pieces >= 1 ? `
        <!-- Foundation with texture -->
        <rect x="100" y="320" width="200" height="60" fill="#8B7355" stroke="#654321" stroke-width="3" filter="url(#shadow)"/>
        <line x1="100" y1="340" x2="300" y2="340" stroke="#654321" stroke-width="1" opacity="0.3"/>
        <line x1="100" y1="360" x2="300" y2="360" stroke="#654321" stroke-width="1" opacity="0.3"/>
        ` : ""}

        ${pieces >= 2 ? `
        <!-- Main walls with stone texture -->
        <rect x="120" y="220" width="160" height="100" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <!-- Stone blocks -->
        <line x1="120" y1="245" x2="280" y2="245" stroke="#A0A0A0" stroke-width="1" opacity="0.4"/>
        <line x1="120" y1="270" x2="280" y2="270" stroke="#A0A0A0" stroke-width="1" opacity="0.4"/>
        <line x1="120" y1="295" x2="280" y2="295" stroke="#A0A0A0" stroke-width="1" opacity="0.4"/>
        ` : ""}

        ${pieces >= 3 ? `
        <!-- Left tower -->
        <rect x="80" y="180" width="60" height="140" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <polygon points="80,180 110,140 140,180" fill="url(#roofGradient)" stroke="#654321" stroke-width="2" filter="url(#shadow)"/>
        <!-- Battlements -->
        <rect x="85" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="105" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="125" y="175" width="10" height="10" fill="#A0A0A0"/>

        <!-- Right tower -->
        <rect x="260" y="180" width="60" height="140" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <polygon points="260,180 290,140 320,180" fill="url(#roofGradient)" stroke="#654321" stroke-width="2" filter="url(#shadow)"/>
        <!-- Battlements -->
        <rect x="265" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="285" y="175" width="10" height="10" fill="#A0A0A0"/>
        <rect x="305" y="175" width="10" height="10" fill="#A0A0A0"/>
        ` : ""}

        ${pieces >= 4 ? `
        <!-- Door with arch -->
        <rect x="175" y="260" width="50" height="60" fill="#654321" stroke="#4a2f1a" stroke-width="3" rx="5" filter="url(#shadow)"/>
        <circle cx="200" cy="255" r="25" fill="#654321" stroke="#4a2f1a" stroke-width="3"/>
        <rect x="175" y="255" width="50" height="30" fill="#654321"/>
        <!-- Door details -->
        <circle cx="215" cy="285" r="3" fill="#8B7355"/>
        <line x1="200" y1="260" x2="200" y2="320" stroke="#4a2f1a" stroke-width="2"/>

        <!-- Windows with glow -->
        <circle cx="150" cy="250" r="14" fill="#FFD700" stroke="#DAA520" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="150" cy="250" r="10" fill="#FFED4E" opacity="0.8"/>
        <circle cx="250" cy="250" r="14" fill="#FFD700" stroke="#DAA520" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="250" cy="250" r="10" fill="#FFED4E" opacity="0.8"/>
        ` : ""}

        ${pieces >= 5 ? `
        <!-- Center tower (taller) -->
        <rect x="175" y="120" width="50" height="100" fill="url(#stoneGradient)" stroke="#808080" stroke-width="3" filter="url(#shadow)"/>
        <polygon points="175,120 200,75 225,120" fill="url(#roofGradient)" stroke="#654321" stroke-width="2" filter="url(#shadow)"/>
        <!-- Battlements -->
        <rect x="180" y="115" width="8" height="8" fill="#A0A0A0"/>
        <rect x="196" y="115" width="8" height="8" fill="#A0A0A0"/>
        <rect x="212" y="115" width="8" height="8" fill="#A0A0A0"/>
        <!-- Window -->
        <circle cx="200" cy="165" r="8" fill="#4A5568" stroke="#2D3748" stroke-width="2"/>
        ` : ""}

        ${pieces >= 6 ? `
        <!-- Victory flag with wave effect -->
        <line x1="200" y1="75" x2="200" y2="45" stroke="#654321" stroke-width="4" filter="url(#shadow)"/>
        <path d="M 200 45 Q 220 50, 240 48 Q 235 53, 240 57 Q 220 59, 200 55 Z" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
        <text x="210" y="58" font-size="16">🏆</text>

        <!-- Sparkles with glow -->
        <text x="50" y="100" font-size="35" filter="url(#shadow)">✨</text>
        <text x="330" y="100" font-size="35" filter="url(#shadow)">✨</text>
        <text x="70" y="300" font-size="35" filter="url(#shadow)">⭐</text>
        <text x="310" y="300" font-size="35" filter="url(#shadow)">⭐</text>
        <text x="190" y="25" font-size="30" filter="url(#shadow)">🎉</text>

        <!-- Rays of light -->
        <line x1="200" y1="50" x2="150" y2="20" stroke="#FFD700" stroke-width="2" opacity="0.6"/>
        <line x1="200" y1="50" x2="250" y2="20" stroke="#FFD700" stroke-width="2" opacity="0.6"/>
        <line x1="200" y1="50" x2="200" y2="10" stroke="#FFD700" stroke-width="3" opacity="0.6"/>
        ` : ""}

        ${pieces < 6 ? `
        <!-- Construction message -->
        <text x="200" y="390" text-anchor="middle" font-size="18" fill="#666" font-family="Arial" font-weight="bold">
          ${pieces}/6 pieces complete
        </text>
        ` : `
        <!-- Completion message -->
        <text x="200" y="390" text-anchor="middle" font-size="20" fill="#FFD700" font-family="Arial" font-weight="bold" filter="url(#shadow)">
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
      this.ui.updateCastleBadge(this.state.getCompletedAreasCount())
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
    const wasAreaJustCompleted = this.state.currentArea && !this.state.completedAreas.has(this.state.currentArea)
    const areaName = this.getAreaName(this.state.currentArea)

    this.ui.showFeedback(`🎉 Level ${this.state.stats.currentLevel} Complete! 🎉`, "correct")

    this.state.completeLevel()

    // Update displays but skip progress bar to avoid reset animation
    this.ui.updateStats(this.state.stats)
    this.ui.updateVisualProgression(
      this.state.currentArea,
      this.progression.getAreaThemes(),
      this.state.getProgressPercent(),
    )
    this.ui.renderGarden(this.state.garden)
    this.state.saveProgress()

    // Show castle piece notification if area was just completed
    if (wasAreaJustCompleted) {
      setTimeout(() => {
        this.ui.showCastleNotification(areaName, this.state.getCompletedAreasCount())
        this.ui.updateCastleBadge(this.state.getCompletedAreasCount())
      }, 1500)
    }

    // Return to garden hub after completing a level
    setTimeout(() => {
      this.showScreen("garden-hub")
    }, wasAreaJustCompleted ? 4000 : 2500)
  }

  /**
   * Get readable area name
   * @param {string} areaId - Area identifier
   * @returns {string} Area name
   */
  getAreaName(areaId) {
    const names = {
      "flower-meadow": "Flower Meadow",
      "crystal-cave": "Crystal Cave",
      "enchanted-forest": "Enchanted Forest",
      "time-temple": "Time Temple",
      "measurement-market": "Measurement Market",
      "pattern-path": "Pattern Path"
    }
    return names[areaId] || areaId
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
