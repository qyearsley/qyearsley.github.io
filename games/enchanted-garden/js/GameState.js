/**
 * @typedef {Object} Stats
 * @property {number} stars - Total stars earned
 * @property {number} flowers - Total flowers collected
 * @property {number} activitiesCompleted - Number of activities completed
 * @property {number} currentLevel - Current level number
 * @property {number} currentLevelProgress - Progress in current level
 */

/**
 * @typedef {Object} Flower
 * @property {string} color - Flower color
 * @property {string} emoji - Flower emoji
 * @property {string} name - Flower name
 * @property {number} timestamp - When flower was earned
 */

/**
 * Manages the game state for Enchanted Garden
 */
export class GameState {
  /**
   * @param {Object} storageManager - Storage manager for persistence
   */
  constructor(storageManager) {
    this.storageManager = storageManager

    /** @type {string} */
    this.currentScreen = "title"

    /** @type {string|null} */
    this.currentArea = null

    /** @type {Object|null} */
    this.currentActivity = null

    /** @type {string} */
    this.projectType = "castle" // "castle", "garden", "robot", "spaceship"

    /** @type {Stats} */
    this.stats = {
      stars: 0,
      flowers: 0,
      activitiesCompleted: 0,
      currentLevel: 1,
      currentLevelProgress: 0,
    }

    /** @type {Set<string>} */
    this.unlockedAreas = new Set(["flower-meadow"])

    /** @type {Flower[]} */
    this.garden = []

    /** @type {Object} */
    this.settings = {
      inputMode: "multipleChoice", // "multipleChoice" or "keyboard"
      visualHints: "always", // "always", "sometimes", "never"
      questionsPerLevel: 5, // number of questions per level
    }

    /** @type {Set<string>} */
    this.completedAreas = new Set()

    this.loadProgress()
  }

  /**
   * Reset level progress when entering a new area
   * @param {string} areaId - The area identifier
   */
  enterArea(areaId) {
    this.currentArea = areaId
    this.stats.currentLevelProgress = 0
  }

  /**
   * Set the current activity
   * @param {Object} activity - The activity object
   */
  setActivity(activity) {
    this.currentActivity = activity
  }

  /**
   * Record a correct answer and update stats
   * @param {Flower} flower - The flower reward
   * @returns {boolean} True if level is complete
   */
  recordCorrectAnswer(flower) {
    this.stats.stars += 1
    this.stats.flowers += 1
    this.stats.activitiesCompleted += 1
    this.stats.currentLevelProgress += 1
    this.garden.push(flower)

    return this.stats.currentLevelProgress >= this.settings.questionsPerLevel
  }

  /**
   * Complete the current level and advance
   */
  completeLevel() {
    this.stats.currentLevel += 1
    this.stats.currentLevelProgress = 0

    // Mark current area as complete (for castle pieces)
    if (this.currentArea) {
      this.completedAreas.add(this.currentArea)
    }

    // Unlock next area based on level
    if (this.stats.currentLevel === 2) {
      this.unlockedAreas.add("crystal-cave")
    } else if (this.stats.currentLevel === 3) {
      this.unlockedAreas.add("enchanted-forest")
    } else if (this.stats.currentLevel === 4) {
      this.unlockedAreas.add("time-temple")
    } else if (this.stats.currentLevel === 5) {
      this.unlockedAreas.add("measurement-market")
    } else if (this.stats.currentLevel === 6) {
      this.unlockedAreas.add("pattern-path")
    }
  }

  /**
   * Check if an area is unlocked
   * @param {string} areaId - Area identifier
   * @returns {boolean} True if area is unlocked
   */
  isAreaUnlocked(areaId) {
    return this.unlockedAreas.has(areaId)
  }

  /**
   * Unlock an area (for testing purposes)
   * @param {string} areaId - Area identifier
   */
  unlockArea(areaId) {
    this.unlockedAreas.add(areaId)
  }

  /**
   * Reset all progress
   */
  resetProgress() {
    this.stats = {
      stars: 0,
      flowers: 0,
      activitiesCompleted: 0,
      currentLevel: 1,
      currentLevelProgress: 0,
    }
    this.garden = []
    this.unlockedAreas = new Set(["flower-meadow"])
    this.completedAreas = new Set()
    this.currentArea = null
    this.currentActivity = null
    this.storageManager.clearProgress()
  }

  /**
   * Update a setting
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  updateSetting(key, value) {
    this.settings[key] = value
    this.saveProgress()
  }

  /**
   * Get number of completed areas (for castle pieces)
   * @returns {number} Number of completed areas
   */
  getCompletedAreasCount() {
    return this.completedAreas.size
  }

  /**
   * Check if castle is complete (all 6 areas done)
   * @returns {boolean} True if all areas completed
   */
  isCastleComplete() {
    return this.completedAreas.size >= 6
  }

  /**
   * Get progress percentage for current level
   * @returns {number} Progress as percentage (0-100)
   */
  getProgressPercent() {
    return (this.stats.currentLevelProgress / this.settings.questionsPerLevel) * 100
  }

  /**
   * Save progress to storage
   */
  saveProgress() {
    this.storageManager.saveProgress(
      this.stats,
      this.garden,
      Array.from(this.unlockedAreas),
      Array.from(this.completedAreas),
      this.settings,
      this.projectType,
    )
  }

  /**
   * Load progress from storage
   */
  loadProgress() {
    const saved = this.storageManager.loadProgress()
    if (saved) {
      this.stats = {
        stars: saved.stats.stars || 0,
        flowers: saved.stats.flowers || 0,
        activitiesCompleted: saved.stats.activitiesCompleted || 0,
        currentLevel: saved.stats.currentLevel || 1,
        currentLevelProgress: saved.stats.currentLevelProgress || 0,
      }
      this.garden = saved.garden || []
      this.unlockedAreas = new Set(saved.unlockedAreas || ["flower-meadow"])
      this.completedAreas = new Set(saved.completedAreas || [])
      this.projectType = saved.projectType || "castle"
      if (saved.settings) {
        this.settings = {
          inputMode: saved.settings.inputMode || "multipleChoice",
          visualHints: saved.settings.visualHints || "always",
          questionsPerLevel: saved.settings.questionsPerLevel || 5,
        }
      }
    }
  }

  /**
   * Set project type
   * @param {string} projectType - Project type identifier
   */
  setProjectType(projectType) {
    this.projectType = projectType
    this.saveProgress()
  }

  /**
   * Set the current screen
   * @param {string} screenId - Screen identifier
   */
  setScreen(screenId) {
    this.currentScreen = screenId
  }
}
