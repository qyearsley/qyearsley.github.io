import { PHASE, SPEED } from "./constants.js"

/**
 * The speeds the buttons offer, lowercased to match `data-speed`. Derived from
 * `SPEED` so a fourth speed cannot be added to the constants and forgotten
 * here -- which would make it un-loadable from a save while still selectable.
 */
const SPEED_NAMES = Object.keys(SPEED).map((name) => name.toLowerCase())

/**
 * Whether a value can be read as a keyed object. Arrays are rejected: a
 * persisted array where a map was expected is corruption, not data.
 * @param {unknown} value - Value to test
 * @returns {boolean} True for a non-null, non-array object
 */
function _isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export class GameState {
  constructor(storage) {
    this.storage = storage
    this.completedPuzzles = {}
    this.settings = { speed: "normal", showGrid: true }
    this.currentPuzzle = null
    this.phase = PHASE.PLACING
    this.generation = 0
    this.budgetUsed = {}
    this.initialGrid = null
    this.goalsComplete = false
  }

  loadProgress() {
    const data = this.storage.loadProgress()
    if (!data) return
    this.completedPuzzles = _isPlainObject(data.completedPuzzles) ? data.completedPuzzles : {}
    // Coerced, not merged. A spread would carry a hand-edited `speed: 7`
    // straight through to `speed.toUpperCase()` in the simulation loop, and a
    // key the settings do not have into the object the next save writes back.
    const saved = _isPlainObject(data.settings) ? data.settings : {}
    this.settings = {
      speed: SPEED_NAMES.includes(saved.speed) ? saved.speed : this.settings.speed,
      showGrid: typeof saved.showGrid === "boolean" ? saved.showGrid : this.settings.showGrid,
    }
  }

  saveProgress() {
    this.storage.saveProgress(this.completedPuzzles, this.settings)
  }

  clearProgress() {
    this.completedPuzzles = {}
    this.storage.clearProgress()
  }

  hasSavedProgress() {
    return this.storage.hasGameState()
  }

  isPuzzleUnlocked(puzzle) {
    if (!puzzle.unlockAfter) return true
    return !!this.completedPuzzles[puzzle.unlockAfter]
  }

  isPuzzleCompleted(puzzleId) {
    return !!this.completedPuzzles[puzzleId]
  }

  getStars(puzzleId) {
    return this.completedPuzzles[puzzleId]?.stars || 0
  }

  completePuzzle(puzzleId, stars) {
    const existing = this.completedPuzzles[puzzleId]
    if (!existing || stars > existing.stars) {
      this.completedPuzzles[puzzleId] = { stars }
    }
    this.saveProgress()
  }

  /** Calculate star rating based on budget efficiency. */
  calculateStars(puzzle) {
    const totalBudget = Object.values(puzzle.budget).reduce((a, b) => a + b, 0)
    const totalUsed = Object.values(this.budgetUsed).reduce((a, b) => a + b, 0)
    const pctUsed = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 100
    const t = puzzle.starThresholds
    if (pctUsed <= t[3]) return 3
    if (pctUsed <= t[2]) return 2
    if (pctUsed <= t[1]) return 1
    return 1 // always at least 1 star for completing
  }

  startPuzzle(puzzle) {
    this.currentPuzzle = puzzle
    this.phase = PHASE.PLACING
    this.generation = 0
    this.goalsComplete = false
    this.budgetUsed = {}
    for (const speciesId of Object.keys(puzzle.budget)) {
      this.budgetUsed[speciesId] = 0
    }
  }

  getRemainingBudget(speciesId) {
    const total = this.currentPuzzle?.budget[speciesId] || 0
    const used = this.budgetUsed[speciesId] || 0
    return total - used
  }

  useBudget(speciesId) {
    this.budgetUsed[speciesId] = (this.budgetUsed[speciesId] || 0) + 1
  }

  returnBudget(speciesId) {
    if (this.budgetUsed[speciesId] > 0) {
      this.budgetUsed[speciesId]--
    }
  }
}
