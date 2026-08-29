/**
 * Seasons storage -- persistence, plus the canonical save shape.
 *
 * Architecture: the game-specific storage layer, following the same split Times
 * Trail uses.
 * - Extends games/shared/StorageManager.js, which owns every localStorage call,
 *   the version stamp, and the version-mismatch-clears-the-key policy. Nothing
 *   in this file touches localStorage directly. The base is aliased on import
 *   as `BaseStorageManager` so the subclass can keep the plain name; game code
 *   imports *this* class, never the base.
 * - `defaultSave` and `normalizeSave` are exported pure functions -- no
 *   storage, no clock, no mutation of their input -- so the shape can be tested
 *   on its own and game.js can normalize an in-memory value without a round
 *   trip through the browser.
 * - The saved run deliberately omits `question`. A question is a pure function
 *   of the seed, the season, and `questionsAsked` (see GameState), so persisting
 *   it would store a value that could contradict the fields it derives from.
 *   `GameState.rehydrate` regenerates it on load instead.
 * - `position` is only *structurally* normalized here. Journey.normalizePosition
 *   is the semantic authority, because it needs the season, and
 *   `GameState.rehydrate` applies it on load. This file cannot import Journey
 *   without a cycle through seasons.js.
 *
 * Error Handling: follows the base class's contract exactly.
 * - `saveRun` and `clearRun` return a boolean and never throw.
 * - `loadRun` returns null when nothing is stored, the JSON is corrupt, or the
 *   version has moved on (the base clears the key in that case).
 * - `defaultSave` and `normalizeSave` never throw for any input. Saved data
 *   comes off a real device -- a half-written save, a hand-edited one, or one
 *   from a build six months old -- so every field is coerced back into range
 *   rather than trusted, and unknown keys are dropped rather than copied
 *   through.
 */

import { StorageManager as BaseStorageManager } from "../../shared/StorageManager.js"
import { CHARACTER_IDS, DEFAULT_CHARACTER } from "./characters.js"
import { PHASE, SEASON_ORDER, STORAGE } from "./constants.js"

/**
 * Every valid phase value, for coercing a persisted `phase`.
 * @private
 * @type {Set<string>}
 */
const PHASE_VALUES = new Set(Object.values(PHASE))

/**
 * Every valid season id.
 * @private
 * @type {Set<string>}
 */
const SEASON_IDS = new Set(SEASON_ORDER)

/**
 * The persisted run: a GameState minus its `question`.
 *
 * @typedef {Object} SavedRun
 * @property {string} phase
 * @property {string} characterId
 * @property {string|null} seasonId
 * @property {number} seed
 * @property {number} position
 * @property {number} items
 * @property {number} wilting
 * @property {number} lost
 * @property {number} forgivenessLeft
 * @property {boolean} lastWasWrong
 * @property {number} streak
 * @property {number} bestStreak
 * @property {number} questionsAsked
 * @property {number} correctCount
 * @property {Object<string, number>} collected
 * @property {boolean} runOver
 */

/**
 * The whole save. Exactly these three keys, plus the `version` and `lastPlayed`
 * the base class stamps on every write.
 *
 * @typedef {Object} SaveState
 * @property {SavedRun} run       - The run in progress
 * @property {string[]} unlocked  - Season ids reachable from the season picker
 * @property {Object} totals      - Lifetime counters
 */

/**
 * Whether a value can be read as a keyed object. Arrays are rejected: a
 * persisted array where a map was expected is corruption, not data.
 * @private
 * @param {unknown} value - Value to test
 * @returns {boolean} True for a non-null, non-array object
 */
function _isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * Read an untrusted counter as a non-negative integer, defaulting to 0.
 * @private
 * @param {unknown} value - Value from a persisted payload
 * @returns {number} A non-negative integer
 */
function _nonNegativeInt(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(/** @type {number} */ (value)))
}

/**
 * Coerce the per-season delivery record: known season ids only, non-negative
 * counts. A season id that has since been renamed drops out rather than
 * lingering in the summary.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Object<string, number>} A new map
 */
function _normalizeCollected(raw) {
  /** @type {Object<string, number>} */
  const collected = {}
  if (!_isPlainObject(raw)) return collected
  for (const key of Object.keys(/** @type {Object} */ (raw))) {
    if (SEASON_IDS.has(key)) {
      collected[key] = _nonNegativeInt(/** @type {Object} */ (raw)[key])
    }
  }
  return collected
}

/**
 * Coerce the unlocked-season list: known ids only, deduplicated, and always
 * containing the first season so the game can never become unstartable.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {string[]} Unlocked ids in play order
 */
function _normalizeUnlocked(raw) {
  const ids = new Set([SEASON_ORDER[0]])
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (SEASON_IDS.has(value)) ids.add(value)
    }
  }
  // Return in play order rather than insertion order, so the picker is stable.
  return SEASON_ORDER.filter((id) => ids.has(id))
}

/**
 * Coerce an untrusted run.
 *
 * `position` is clamped to non-negative but not to the season's length; only
 * Journey knows that bound. Booleans are strict (`=== true`) so a truthy `1`
 * from a hand-edited save cannot silently grant `runOver`.
 *
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {SavedRun} A new, valid run
 */
function _normalizeRun(raw) {
  const source = _isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  const questionsAsked = _nonNegativeInt(source.questionsAsked)
  const streak = _nonNegativeInt(source.streak)
  return {
    phase: PHASE_VALUES.has(source.phase) ? source.phase : PHASE.CHARACTER_SELECT,
    characterId: CHARACTER_IDS.has(source.characterId) ? source.characterId : DEFAULT_CHARACTER.id,
    seasonId: SEASON_IDS.has(source.seasonId) ? source.seasonId : null,
    seed: _nonNegativeInt(source.seed) || 1,
    position: _nonNegativeInt(source.position),
    items: _nonNegativeInt(source.items),
    wilting: _nonNegativeInt(source.wilting),
    lost: _nonNegativeInt(source.lost),
    forgivenessLeft: _nonNegativeInt(source.forgivenessLeft),
    lastWasWrong: source.lastWasWrong === true,
    streak,
    // A high-water mark can never sit below the value it tracks.
    bestStreak: Math.max(_nonNegativeInt(source.bestStreak), streak),
    questionsAsked,
    // Correct answers can never outnumber the questions they came from.
    correctCount: Math.min(_nonNegativeInt(source.correctCount), questionsAsked),
    collected: _normalizeCollected(source.collected),
    runOver: source.runOver === true,
  }
}

/**
 * Coerce untrusted lifetime counters.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Object} A new, valid totals object
 */
function _normalizeTotals(raw) {
  const source = _isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  const questionsAnswered = _nonNegativeInt(source.questionsAnswered)
  return {
    runsCompleted: _nonNegativeInt(source.runsCompleted),
    seasonsCleared: _nonNegativeInt(source.seasonsCleared),
    questionsAnswered,
    questionsCorrect: Math.min(_nonNegativeInt(source.questionsCorrect), questionsAnswered),
  }
}

/**
 * A fresh save at documented defaults. A new object every call, safe for the
 * caller to mutate.
 *
 * @returns {SaveState} A new save with exactly the three documented keys
 */
export function defaultSave() {
  return {
    run: _normalizeRun(null),
    unlocked: [SEASON_ORDER[0]],
    totals: {
      runsCompleted: 0,
      seasonsCleared: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
    },
  }
}

/**
 * Coerce anything at all into a valid save. Never throws, never mutates `raw`,
 * and always returns a fresh object.
 *
 * Unknown keys are dropped rather than copied through, so a field cut from the
 * design disappears on load instead of accumulating. `version` and `lastPlayed`
 * are the only keys carried beyond the documented three, and only when the
 * input already had them -- this function never invents them.
 *
 * @param {unknown} raw - Anything at all, typically a parsed JSON payload
 * @returns {SaveState} A new, valid save
 */
export function normalizeSave(raw) {
  if (!_isPlainObject(raw)) return defaultSave()
  const source = /** @type {Object} */ (raw)

  /** @type {SaveState} */
  const save = {
    run: _normalizeRun(source.run),
    unlocked: _normalizeUnlocked(source.unlocked),
    totals: _normalizeTotals(source.totals),
  }

  if ("version" in source) save.version = source.version
  if ("lastPlayed" in source) save.lastPlayed = source.lastPlayed
  return save
}

/**
 * Strip a live GameState down to the persisted shape.
 *
 * `question` needs no special handling: `_normalizeRun` builds its result from
 * a fixed list of keys, so anything not in SavedRun is dropped by construction.
 *
 * @param {Object} state - A live GameState
 * @returns {SavedRun} The run, ready to save
 */
export function toSavedRun(state) {
  return _normalizeRun(state)
}

/**
 * Seasons' storage. This is the class game code imports; the shared base class
 * is an implementation detail of this file.
 */
export class StorageManager extends BaseStorageManager {
  constructor() {
    super(STORAGE.KEY, STORAGE.VERSION)
  }

  /**
   * Normalize and save. Passing null writes a default save rather than garbage
   * over a good key -- a corrupted in-memory state should cost the current
   * season, not the whole run.
   * @param {SaveState|null} save - The save to write; anything invalid is coerced
   * @returns {boolean} True if the write succeeded
   */
  saveRun(save) {
    return this.saveGameState(normalizeSave(save))
  }

  /**
   * Load and normalize the save.
   * @returns {SaveState|null} The save, or null if absent, corrupt, or a
   *   version mismatch (which the base class also clears)
   */
  loadRun() {
    const data = this.loadGameState()
    if (!data) return null
    // A payload without a run is not a Seasons save; normalizing it would
    // invent a pristine run and quietly discard whatever was really there.
    if (!_isPlainObject(data.run)) {
      this._logError("loadRun", "Invalid data structure: missing required field (run)")
      return null
    }
    return normalizeSave(data)
  }

  /**
   * Erase the save.
   * @returns {boolean} True if the clear succeeded
   */
  clearRun() {
    return this.clearGameState()
  }
}
