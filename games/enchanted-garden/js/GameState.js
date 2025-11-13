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
    this.QUESTIONS_PER_LEVEL = 6

    /** @type {string} */
    this.currentScreen = "title"

    /** @type {string|null} */
    this.currentArea = null

    /** @type {Object|null} */
    this.currentActivity = null

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

    return this.stats.currentLevelProgress >= this.QUESTIONS_PER_LEVEL
  }

  /**
   * Complete the current level and advance
   */
  completeLevel() {
    this.stats.currentLevel += 1
    this.stats.currentLevelProgress = 0

    // Unlock next area based on level
    if (this.stats.currentLevel === 2) {
      this.unlockedAreas.add("crystal-cave")
    } else if (this.stats.currentLevel === 3) {
      this.unlockedAreas.add("enchanted-forest")
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
    this.currentArea = null
    this.currentActivity = null
    this.storageManager.clearProgress()
  }

  /**
   * Get progress percentage for current level
   * @returns {number} Progress as percentage (0-100)
   */
  getProgressPercent() {
    return (this.stats.currentLevelProgress / this.QUESTIONS_PER_LEVEL) * 100
  }

  /**
   * Save progress to storage
   */
  saveProgress() {
    this.storageManager.saveProgress(this.stats, this.garden, Array.from(this.unlockedAreas))
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
    }
  }

  /**
   * Set the current screen
   * @param {string} screenId - Screen identifier
   */
  setScreen(screenId) {
    this.currentScreen = screenId
  }
}
