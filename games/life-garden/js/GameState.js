import { PHASE } from "./constants.js"

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
    if (data) {
      this.completedPuzzles = data.completedPuzzles || {}
      if (data.settings) this.settings = { ...this.settings, ...data.settings }
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
