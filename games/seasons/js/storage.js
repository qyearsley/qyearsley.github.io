/**
 * Seasons storage -- persistence, plus the canonical save shape.
 *
 * The game-specific layer over games/shared/StorageManager.js, which owns every
 * localStorage call, the version stamp, and the version-mismatch-clears-the-key
 * policy. Nothing here touches localStorage directly. Game code imports this
 * `StorageManager`, never the base (aliased `BaseStorageManager` here).
 *
 * - `defaultSave` and `normalizeSave` are pure: no storage, no clock, no
 *   mutation of their input.
 * - The saved run omits `question`. It is a pure function of the seed, season,
 *   attempt and `questionsAsked`, so saving it could contradict those fields.
 *   `GameState.rehydrate` regenerates it on load.
 * - `position` is only structurally normalized here (a non-negative integer).
 *   The semantic bound needs the season, so `Journey.normalizePosition` applies
 *   it in `GameState.rehydrate`. The persistence layer holds no rules.
 *
 * Error handling follows the base class:
 * - `saveRun` returns a boolean and never throws.
 * - `loadRun` returns null when nothing is stored, the JSON is corrupt, or the
 *   version has moved on (the base clears the key in that case).
 * - `defaultSave` and `normalizeSave` never throw. A save can be half-written,
 *   hand-edited or from an old build, so every field is coerced into range and
 *   unknown keys are dropped.
 */

import { StorageManager as BaseStorageManager } from "../../shared/StorageManager.js"
import { isPlainObject, nonNegativeInt } from "../../shared/validate.js"
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
 * @property {number} attempt
 * @property {number} position
 * @property {number} items
 * @property {boolean} retrying
 * @property {number} owed
 * @property {number} extrasDone
 * @property {number} hintsLeft
 * @property {number} streak
 * @property {number} bestStreak
 * @property {number} slips
 * @property {number} questionsAsked
 * @property {number} correctCount
 * @property {Object<string, number>} collected
 */

/**
 * The whole save. Exactly these four keys, plus the `version` and `lastPlayed`
 * the base class stamps on every write.
 *
 * @typedef {Object} SaveState
 * @property {SavedRun} run       - The run in progress
 * @property {string[]} unlocked  - Season ids cleared so far. game.js appends
 *                                to it, but nothing shows it to the player --
 *                                there is no season picker yet. Kept because
 *                                the ledger is cheap and a picker is the
 *                                obvious next feature.
 * @property {Object} totals      - Lifetime counters
 * @property {Settings} settings  - Player preferences; see `Settings`
 */

/**
 * What the player has asked for. Kept beside the run rather than inside it,
 * because a preference outlives the season it was set in: turning the clock off
 * and then losing autumn should not turn it back on.
 *
 * @typedef {Object} Settings
 * @property {boolean} timer - Whether a timed season runs its countdown.
 *   Default false. False makes every question untimed, whatever the season's
 *   `timerSeconds` says -- the questions are unchanged, only the clock goes.
 */

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
  if (!isPlainObject(raw)) return collected
  for (const key of Object.keys(/** @type {Object} */ (raw))) {
    if (SEASON_IDS.has(key)) {
      collected[key] = nonNegativeInt(/** @type {Object} */ (raw)[key])
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
  // Return in play order rather than insertion order, so the list is stable.
  return SEASON_ORDER.filter((id) => ids.has(id))
}

/**
 * Coerce an untrusted run.
 *
 * `position` is clamped to non-negative but not to the season's length; only
 * Journey knows that bound. Booleans are strict (`=== true`) so a truthy `1`
 * from a hand-edited save cannot silently grant one.
 *
 * `owed` and `extrasDone` are clamped to 0 or 1 rather than merely to
 * non-negative. Both are flags the rules read as "is there one outstanding",
 * and a hand-edited `owed: 40` would owe forty extra questions at a single
 * hill -- which the retry loop would happily serve.
 *
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {SavedRun} A new, valid run
 */
function _normalizeRun(raw) {
  const source = isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  const questionsAsked = nonNegativeInt(source.questionsAsked)
  const streak = nonNegativeInt(source.streak)
  return {
    phase: PHASE_VALUES.has(source.phase) ? source.phase : PHASE.CHARACTER_SELECT,
    characterId: CHARACTER_IDS.has(source.characterId) ? source.characterId : DEFAULT_CHARACTER.id,
    seasonId: SEASON_IDS.has(source.seasonId) ? source.seasonId : null,
    seed: nonNegativeInt(source.seed) || 1,
    attempt: nonNegativeInt(source.attempt),
    position: nonNegativeInt(source.position),
    items: nonNegativeInt(source.items),
    retrying: source.retrying === true,
    owed: Math.min(1, nonNegativeInt(source.owed)),
    extrasDone: Math.min(1, nonNegativeInt(source.extrasDone)),
    hintsLeft: nonNegativeInt(source.hintsLeft),
    streak,
    // A high-water mark can never sit below the value it tracks.
    bestStreak: Math.max(nonNegativeInt(source.bestStreak), streak),
    slips: nonNegativeInt(source.slips),
    questionsAsked,
    // Correct answers can never outnumber the questions they came from.
    correctCount: Math.min(nonNegativeInt(source.correctCount), questionsAsked),
    collected: _normalizeCollected(source.collected),
  }
}

/**
 * Coerce untrusted lifetime counters.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Object} A new, valid totals object
 */
function _normalizeTotals(raw) {
  const source = isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  const questionsAnswered = nonNegativeInt(source.questionsAnswered)
  return {
    runsCompleted: nonNegativeInt(source.runsCompleted),
    seasonsCleared: nonNegativeInt(source.seasonsCleared),
    questionsAnswered,
    questionsCorrect: Math.min(nonNegativeInt(source.questionsCorrect), questionsAnswered),
  }
}

/**
 * Coerce untrusted preferences.
 *
 * `timer` defaults to false and only a literal `true` turns it on, so a save
 * with no `timer` key loads untimed.
 *
 * A truthy `1` or `"yes"` from a hand-edited save is not an answer either way,
 * so it leaves the default.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Settings} A new, valid settings object
 */
function _normalizeSettings(raw) {
  const source = isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  return { timer: source.timer === true }
}

/**
 * A fresh save at documented defaults. A new object every call, safe for the
 * caller to mutate.
 *
 * @returns {SaveState} A new save with exactly the four documented keys
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
    settings: _normalizeSettings(null),
  }
}

/**
 * Coerce anything at all into a valid save. Never throws, never mutates `raw`,
 * and always returns a fresh object.
 *
 * Unknown keys are dropped rather than copied through, so a field cut from the
 * design disappears on load instead of accumulating. `version` and `lastPlayed`
 * are the only keys carried beyond the documented four, and only when the
 * input already had them -- this function never invents them.
 *
 * @param {unknown} raw - Anything at all, typically a parsed JSON payload
 * @returns {SaveState} A new, valid save
 */
export function normalizeSave(raw) {
  if (!isPlainObject(raw)) return defaultSave()
  const source = /** @type {Object} */ (raw)

  /** @type {SaveState} */
  const save = {
    run: _normalizeRun(source.run),
    unlocked: _normalizeUnlocked(source.unlocked),
    totals: _normalizeTotals(source.totals),
    settings: _normalizeSettings(source.settings),
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
    if (!isPlainObject(data.run)) {
      this._logError("loadRun", "Invalid data structure: missing required field (run)")
      return null
    }
    return normalizeSave(data)
  }
}
