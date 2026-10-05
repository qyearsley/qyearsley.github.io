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
    this.settings = { speed: "normal", showGrid: true }
    this.phase = PHASE.PLACING
    this.generation = 0
  }

  loadProgress() {
    // Older saves also carry a `completedPuzzles` map. Nothing reads it any
    // more, so it is ignored here and dropped on the next save.
    const data = this.storage.loadProgress()
    if (!data) return
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
    this.storage.saveProgress(this.settings)
  }

  clearProgress() {
    this.storage.clearProgress()
  }

  /** Back to generation 0, ready for the player to place things. */
  startOver() {
    this.phase = PHASE.PLACING
    this.generation = 0
  }
}
