import { DEFAULTS, AREAS } from "./constants.js"

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

/** Project types `setProjectType` accepts, for coercing a persisted value. */
const PROJECT_TYPES = ["castle", "garden", "robot", "spaceship"]

/** The two answer-entry modes the settings modal offers. */
const INPUT_MODES = ["multipleChoice", "keyboard"]

/** The values of the two on/off settings. */
const ON_OFF = ["on", "off"]

/** The three difficulty levels the settings modal offers. */
const DIFFICULTIES = ["explorer", "adventurer", "master"]

/** Every area id, for coercing a persisted unlock list. */
const AREA_IDS = new Set(Object.values(AREAS))

/**
 * Whether a value can be read as a keyed object. Arrays are rejected: a
 * persisted array where a map was expected is corruption, not data.
 * @param {unknown} value - Value to test
 * @returns {boolean} True for a non-null, non-array object
 */
function _isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * A persisted value read as a keyed object, or an empty one.
 * @param {unknown} value - Value from a persisted payload
 * @returns {Object} The object, or `{}`
 */
function _asObject(value) {
  return _isPlainObject(value) ? value : {}
}

/**
 * A persisted counter read as a non-negative integer.
 * @param {unknown} value - Value from a persisted payload
 * @param {number} [fallback] - What a non-numeric value becomes
 * @returns {number} A non-negative integer
 */
function _count(value, fallback = 0) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

/**
 * A persisted string read as one of a known set.
 * @param {unknown} value - Value from a persisted payload
 * @param {string[]} allowed - The values that exist
 * @param {string} fallback - What anything else becomes
 * @returns {string} A value from `allowed`
 */
function _oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

/**
 * A persisted area list read as a set of real area ids.
 * @param {unknown} value - Value from a persisted payload
 * @param {string[]} fallback - The set to build when nothing survives
 * @returns {Set<string>} A new set
 */
function _areaSet(value, fallback) {
  if (!Array.isArray(value)) return new Set(fallback)
  const kept = value.filter((id) => AREA_IDS.has(id))
  return new Set(kept.length > 0 ? kept : fallback)
}

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
    this.unlockedAreas = new Set([AREAS.FLOWER_MEADOW])

    /** @type {Flower[]} */
    this.garden = []

    /** @type {Object} */
    this.settings = {
      inputMode: "multipleChoice", // "multipleChoice" or "keyboard"
      visualHints: "on", // "on" or "off"
      soundEffects: "off", // "on" or "off"
      difficulty: "adventurer", // "explorer", "adventurer", "master"
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

    return this.stats.currentLevelProgress >= DEFAULTS.QUESTIONS_PER_LEVEL
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
      this.unlockedAreas.add(AREAS.CRYSTAL_CAVE)
    } else if (this.stats.currentLevel === 3) {
      this.unlockedAreas.add(AREAS.ENCHANTED_FOREST)
    } else if (this.stats.currentLevel === 4) {
      this.unlockedAreas.add(AREAS.TIME_TEMPLE)
    } else if (this.stats.currentLevel === 5) {
      this.unlockedAreas.add(AREAS.MEASUREMENT_MARKET)
    } else if (this.stats.currentLevel === 6) {
      this.unlockedAreas.add(AREAS.PATTERN_PATH)
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
    this.unlockedAreas = new Set([AREAS.FLOWER_MEADOW])
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
    return (this.stats.currentLevelProgress / DEFAULTS.QUESTIONS_PER_LEVEL) * 100
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
   * Load progress from storage.
   *
   * A saved payload is untrusted: it comes off a real device and may be
   * half-written, hand-edited, or from a build six months old. Every field is
   * therefore coerced back into range rather than taken as read, and anything
   * unrecognised is dropped.
   *
   * That was not always so, and the failure mode was the worst kind. `||` reads
   * as a default but only substitutes for a falsy value, so a saved `garden` of
   * `{}` survived and made `renderGarden`'s `forEach` throw, and a saved
   * `unlockedAreas` of `5` reached `new Set(5)`, which throws outright. Neither
   * throw was inside the `try` above -- that covers only the read -- so it
   * escaped the constructor and the game rendered "Game Failed to Load"
   * **permanently**, because nothing ever cleared the bad key. A save that
   * cannot be read must cost the progress, never the game.
   */
  loadProgress() {
    let saved
    try {
      saved = this.storageManager.loadProgress()
    } catch (error) {
      console.warn("Failed to load progress, starting fresh:", error)
      return
    }
    if (!saved || typeof saved !== "object") return

    const stats = _asObject(saved.stats)
    this.stats = {
      stars: _count(stats.stars),
      flowers: _count(stats.flowers),
      activitiesCompleted: _count(stats.activitiesCompleted),
      // A level is 1-based, and a progress bar divides by the questions per
      // level, so both need a floor of their own rather than zero.
      currentLevel: Math.max(1, _count(stats.currentLevel, 1)),
      currentLevelProgress: Math.min(
        DEFAULTS.QUESTIONS_PER_LEVEL,
        _count(stats.currentLevelProgress),
      ),
    }
    this.garden = Array.isArray(saved.garden) ? saved.garden.filter(_isPlainObject) : []
    this.unlockedAreas = _areaSet(saved.unlockedAreas, [AREAS.FLOWER_MEADOW])
    this.completedAreas = _areaSet(saved.completedAreas, [])
    this.projectType = PROJECT_TYPES.includes(saved.projectType) ? saved.projectType : "castle"

    const settings = _asObject(saved.settings)
    this.settings = {
      inputMode: _oneOf(settings.inputMode, INPUT_MODES, "multipleChoice"),
      // "always" and "never" are what an older build wrote for this key.
      visualHints: _oneOf(
        { always: "on", never: "off" }[settings.visualHints] ?? settings.visualHints,
        ON_OFF,
        "on",
      ),
      soundEffects: _oneOf(settings.soundEffects, ON_OFF, "off"),
      difficulty: _oneOf(settings.difficulty, DIFFICULTIES, "adventurer"),
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
