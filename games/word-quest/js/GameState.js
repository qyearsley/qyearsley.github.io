/**
 * @typedef {Object} Stats
 * @property {number} stars - Total stars earned
 * @property {number} wordsLearned - Total words learned
 * @property {number} activitiesCompleted - Number of activities completed
 * @property {number} currentLevel - Current level number
 * @property {number} currentLevelProgress - Progress in current level
 */

/**
 * Manages the game state for Word Quest
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
    this.currentQuest = null

    /** @type {Object|null} */
    this.currentActivity = null

    /** @type {string} */
    this.difficulty = "explorer" // "explorer", "adventurer", "master"

    /** @type {Stats} */
    this.stats = {
      stars: 0,
      wordsLearned: 0,
      activitiesCompleted: 0,
      currentLevel: 1,
      currentLevelProgress: 0,
    }

    /** @type {Set<string>} */
    this.unlockedQuests = new Set(["sound-cipher"])

    /** @type {Set<string>} */
    this.masteredWords = new Set()

    /** @type {Object} */
    this.settings = {
      difficulty: "explorer",
      inputMode: "multipleChoice", // "multipleChoice" or "keyboard"
      questionsPerLevel: 5, // number of questions per level
      audioHints: true, // whether to play audio hints
    }

    /** @type {Set<string>} */
    this.completedQuests = new Set()

    /** @type {Object} */
    this.questProgress = {
      "sound-cipher": { completed: 0, stars: 0 },
      "blending-workshop": { completed: 0, stars: 0 },
      "speed-vault": { completed: 0, stars: 0 },
      "pattern-archive": { completed: 0, stars: 0 },
      "spell-forge": { completed: 0, stars: 0 },
      "story-vault": { completed: 0, stars: 0 },
    }

    this.loadProgress()
  }

  /**
   * Reset level progress when entering a new quest
   * @param {string} questId - The quest identifier
   */
  enterQuest(questId) {
    this.currentQuest = questId
    this.stats.currentLevelProgress = 0
  }

  /**
   * Set the current activity
   * @param {Object} activity - The activity object
   */
  setCurrentActivity(activity) {
    this.currentActivity = activity
  }

  /**
   * Record a correct answer
   * @param {string} word - The word that was learned
   */
  recordCorrectAnswer(word = null) {
    this.stats.stars++
    this.stats.currentLevelProgress++

    if (word) {
      this.masteredWords.add(word)
      this.stats.wordsLearned = this.masteredWords.size
    }

    this.saveProgress()
  }

  /**
   * Complete current activity
   */
  completeActivity() {
    this.stats.activitiesCompleted++

    // Check if level is complete
    if (this.stats.currentLevelProgress >= this.settings.questionsPerLevel) {
      this.completeLevel()
    }

    this.saveProgress()
  }

  /**
   * Complete current level
   */
  completeLevel() {
    // Mark quest as completed
    if (this.currentQuest) {
      this.completedQuests.add(this.currentQuest)
      this.questProgress[this.currentQuest].completed = 1
      this.questProgress[this.currentQuest].stars = this.settings.questionsPerLevel
    }

    // Check if we should unlock next quest
    this.checkUnlocks()

    this.saveProgress()
  }

  /**
   * Check if new quests should be unlocked
   */
  checkUnlocks() {
    const quests = [
      "sound-cipher",
      "blending-workshop",
      "speed-vault",
      "pattern-archive",
      "spell-forge",
      "story-vault",
    ]

    // Unlock next quest after completing current quest
    const currentIndex = quests.indexOf(this.currentQuest)
    if (currentIndex >= 0 && currentIndex < quests.length - 1) {
      if (this.completedQuests.has(this.currentQuest)) {
        this.unlockedQuests.add(quests[currentIndex + 1])
      }
    }
  }

  /**
   * Update difficulty setting
   * @param {string} difficulty - New difficulty level
   */
  setDifficulty(difficulty) {
    this.difficulty = difficulty
    this.settings.difficulty = difficulty
    this.saveProgress()
  }

  /**
   * Update settings
   * @param {Object} newSettings - Settings to update
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings }
    this.saveProgress()
  }

  /**
   * Get decoder rank based on total stars
   * @returns {string} Rank name
   */
  getDecoderRank() {
    const stars = this.stats.stars
    if (stars < 20) return "Apprentice Decoder"
    if (stars < 50) return "Journeyman Decoder"
    if (stars < 100) return "Expert Decoder"
    if (stars < 200) return "Master Decoder"
    return "Grand Decoder"
  }

  /**
   * Check if a quest is unlocked
   * @param {string} questId - Quest identifier
   * @returns {boolean} True if unlocked
   */
  isQuestUnlocked(questId) {
    return this.unlockedQuests.has(questId)
  }

  /**
   * Check if a quest is completed
   * @param {string} questId - Quest identifier
   * @returns {boolean} True if completed
   */
  isQuestCompleted(questId) {
    return this.completedQuests.has(questId)
  }

  /**
   * Get progress for a specific quest
   * @param {string} questId - Quest identifier
   * @returns {Object} Progress object
   */
  getQuestProgress(questId) {
    return this.questProgress[questId] || { completed: 0, stars: 0 }
  }

  /**
   * Save progress to storage
   */
  saveProgress() {
    const data = {
      difficulty: this.difficulty,
      stats: this.stats,
      unlockedQuests: Array.from(this.unlockedQuests),
      masteredWords: Array.from(this.masteredWords),
      settings: this.settings,
      completedQuests: Array.from(this.completedQuests),
      questProgress: this.questProgress,
      currentQuest: this.currentQuest,
    }

    this.storageManager.saveGameState(data)
  }

  /**
   * Load progress from storage
   */
  loadProgress() {
    const data = this.storageManager.loadGameState()

    if (data) {
      this.difficulty = data.difficulty || "explorer"
      this.stats = data.stats || this.stats
      this.unlockedQuests = new Set(data.unlockedQuests || ["sound-cipher"])
      this.masteredWords = new Set(data.masteredWords || [])
      this.settings = data.settings || this.settings
      this.completedQuests = new Set(data.completedQuests || [])
      this.questProgress = data.questProgress || this.questProgress
      this.currentQuest = data.currentQuest || null
    }
  }

  /**
   * Reset all progress
   */
  resetProgress() {
    this.stats = {
      stars: 0,
      wordsLearned: 0,
      activitiesCompleted: 0,
      currentLevel: 1,
      currentLevelProgress: 0,
    }
    this.unlockedQuests = new Set(["sound-cipher"])
    this.masteredWords = new Set()
    this.completedQuests = new Set()
    this.questProgress = {
      "sound-cipher": { completed: 0, stars: 0 },
      "blending-workshop": { completed: 0, stars: 0 },
      "speed-vault": { completed: 0, stars: 0 },
      "pattern-archive": { completed: 0, stars: 0 },
      "spell-forge": { completed: 0, stars: 0 },
      "story-vault": { completed: 0, stars: 0 },
    }
    this.currentQuest = null
    this.currentActivity = null
    this.storageManager.clearGameState()
  }

  /**
   * Check if there is saved progress
   * @returns {boolean} True if there is saved progress
   */
  hasSavedProgress() {
    return this.storageManager.hasGameState()
  }
}
