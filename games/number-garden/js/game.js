import { GameState } from "./GameState.js"
import { GameUI } from "./GameUI.js"
import { ParticleSystem } from "./ParticleSystem.js"
import { ProgressionManager } from "./ProgressionManager.js"
import { EventManager } from "./EventManager.js"
import { StorageManager } from "./storage.js"
import { RewardSystem } from "./rewards.js"
import { ActivityGenerator } from "./activities.js"
import { SoundManager } from "./SoundManager.js"
import { ProjectVisuals } from "./ProjectVisuals.js"
import { TIMING } from "./constants.js"

/**
 * Main game controller for Enchanted Garden
 * Orchestrates all game systems and handles game flow
 */
class EnchantedGarden {
  /**
   * Project type configuration
   * @private
   */
  static PROJECT_CONFIG = {
    castle: { icon: "🏰", title: "Build a Castle", pieceName: "Castle Piece" },
    garden: { icon: "🌻", title: "Grow a Garden", pieceName: "Garden Section" },
    robot: { icon: "🤖", title: "Build a Robot", pieceName: "Robot Part" },
    spaceship: { icon: "🚀", title: "Build a Rocket", pieceName: "Rocket Part" },
  }

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
    this.state = new GameState(this.storageManager)
    this.activityGenerator = activityGenerator || new ActivityGenerator(this.state)
    this.ui = new GameUI()
    this.particles = new ParticleSystem()
    this.progression = new ProgressionManager()
    this.sounds = new SoundManager()

    // Update sound manager based on settings
    this.sounds.setEnabled(this.state.settings.soundEffects === "on")

    // Initialize event manager with callbacks
    this.events = new EventManager(this.ui, {
      onStart: () => this.showScreen("project-selection"),
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
      onProjectSelect: (projectType) => this.selectProject(projectType),
      onProjectBack: () => this.showScreen("title-screen"),
      onContinueFromProject: () => this.ui.hideProjectProgress(),
      onContinueFromLevelComplete: () => this.showScreen("garden-hub"),
      onReturnToHub: () => this.showScreen("garden-hub"),
    })

    this.events.initializeEventListeners()
    this.ui.updateStats(this.state.stats)
    this.ui.updateSettingsUI(this.state.settings)
    this.ui.updateCastleBadge(this.state.getCompletedAreasCount())

    // Update project UI on load
    this.updateProjectUI()

    // Update title screen based on saved progress
    this.updateTitleScreen()

    // Handle query parameters for testing
    this.handleQueryParameters()
  }

  /**
   * Select project type
   */
  selectProject(projectType) {
    this.state.setProjectType(projectType)
    this.updateProjectUI()
    this.showScreen("garden-hub")
  }

  /**
   * Update UI to reflect selected project
   */
  updateProjectUI() {
    const info = this.getProjectInfo()

    // Update project icon in header
    const projectIconEl = document.getElementById("project-icon")
    if (projectIconEl) {
      projectIconEl.textContent = info.icon
    }

    // Update project icon in activity screen
    const activityProjectIconEl = document.getElementById("activity-project-icon")
    if (activityProjectIconEl) {
      activityProjectIconEl.textContent = info.icon
    }

    // Update project title
    const projectTitleEl = document.getElementById("project-title")
    if (projectTitleEl) {
      projectTitleEl.textContent = info.title
    }
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

    // Update sound manager if sound setting changed
    if (key === "soundEffects") {
      this.sounds.setEnabled(value === "on")
    }
  }

  /**
   * View castle screen
   */
  viewCastle() {
    const projectInfo = this.getProjectInfo()
    this.showScreen("castle-screen")
    this.ui.updateCastleScreen(projectInfo)
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
    const projectSvg = this.createProjectSVG(completed)
    container.innerHTML = projectSvg
  }

  /**
   * Create project SVG based on project type
   * Delegates to ProjectVisuals for SVG generation
   * @param {number} pieces - Number of completed pieces (0-6)
   * @returns {string} SVG markup
   */
  createProjectSVG(pieces) {
    const projectType = this.state.projectType
    switch (projectType) {
      case "garden":
        return ProjectVisuals.createGarden(pieces)
      case "robot":
        return ProjectVisuals.createRobot(pieces)
      case "spaceship":
        return ProjectVisuals.createSpaceship(pieces)
      case "castle":
      default:
        return ProjectVisuals.createCastle(pieces)
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
    this.ui.updateProgressBar(
      this.state.stats.currentLevelProgress,
      this.state.settings.questionsPerLevel,
    )
    this.generateActivity()
    this.ui.renderGarden(this.state.garden)
  }

  /**
   * Generate a new activity
   */
  generateActivity() {
    this.events.resetAnswerProcessing()
    const activity = this.activityGenerator.generateActivity(
      this.state.stats.activitiesCompleted,
      this.state.currentArea,
    )
    this.state.setActivity(activity)
    this.ui.displayActivity(
      activity,
      this.state.settings.inputMode,
      this.state.settings.visualHints,
    )
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
    this.ui.showFeedback("Correct!", "correct")

    // Play correct sound
    this.sounds.playCorrect()

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
      setTimeout(() => this.showLevelComplete(), TIMING.LEVEL_COMPLETE_DELAY)
    } else {
      setTimeout(() => this.generateActivity(), TIMING.NEXT_ACTIVITY_DELAY)
    }
  }

  /**
   * Handle wrong answer
   * @param {HTMLElement} button - The clicked button
   */
  handleWrongAnswer(button) {
    this.ui.shakeButton(button)
    this.ui.showFeedback("Try again!", "encourage")

    // Play incorrect sound
    this.sounds.playIncorrect()

    setTimeout(() => {
      this.ui.enableAnswerButtons()
    }, TIMING.RETRY_DELAY)
  }

  /**
   * Update all UI displays
   */
  updateAllDisplays() {
    this.ui.updateStats(this.state.stats)
    this.ui.updateProgressBar(
      this.state.stats.currentLevelProgress,
      this.state.settings.questionsPerLevel,
    )
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
    const wasAreaJustCompleted =
      this.state.currentArea && !this.state.completedAreas.has(this.state.currentArea)
    const questionsCompleted = this.state.settings.questionsPerLevel

    this.state.completeLevel()

    // Play celebration sound
    this.sounds.playCelebration()

    // Update displays
    this.ui.updateStats(this.state.stats)
    this.ui.updateVisualProgression(
      this.state.currentArea,
      this.progression.getAreaThemes(),
      this.state.getProgressPercent(),
    )
    this.ui.renderGarden(this.state.garden)
    this.state.saveProgress()

    // Show level-complete screen with celebration
    this.showScreen("level-complete-screen")
    this.ui.updateLevelCompleteScreen(
      questionsCompleted,
      questionsCompleted,
      wasAreaJustCompleted,
      this.state.projectType,
      this.state.getCompletedAreasCount(),
    )
  }

  /**
   * Get project information for the current project type
   * @returns {Object} Project info with icon, title, and pieceName
   */
  getProjectInfo() {
    return (
      EnchantedGarden.PROJECT_CONFIG[this.state.projectType] ||
      EnchantedGarden.PROJECT_CONFIG.castle
    )
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
      "pattern-path": "Pattern Path",
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
