/**
 * Times Trail Storage - game-specific persistence plus the canonical save shape
 * Extends the shared StorageManager with the Times Trail save state, and owns
 * the defaults and normalization for that whole state.
 *
 * Architecture: this is the game-specific storage layer.
 * - Extends games/shared/StorageManager.js, which owns every localStorage call,
 *   the version stamp, and the version-mismatch-clears-the-key policy. Nothing
 *   in this file touches localStorage directly.
 * - Game code imports THIS class (`import { StorageManager } from "./storage.js"`),
 *   never the base class. The base is aliased on import as `BaseStorageManager`
 *   so the subclass can keep the plain name.
 * - This file also owns the persisted-state shape, because Times Trail has no
 *   GameState class: the live state is a plain object held by game.js and every
 *   transition on it happens in a tested pure module. `defaultProgress()` and
 *   `normalizeProgress()` are therefore exported pure functions -- no storage,
 *   no clock, no mutation of their input -- so the shape can be tested on its
 *   own and game.js can normalize an in-memory state without a round trip.
 * - Deliberately does NOT import Settings.js or Scoring.js. `settings` and
 *   `daily` are normalized structurally here and semantically by their owning
 *   classes in game.js. The one cost of that independence is that
 *   `defaultProgress().daily` duplicates `Scoring.createDaily()`'s literal;
 *   storage.test.js cross-checks the two so the copies cannot drift.
 * - The base class writes `version` and `lastPlayed` on every save. This file
 *   never sets them; `normalizeProgress` only carries them through when the
 *   input already had them, and never invents them.
 * - `exportGameState` / `importGameState` are inherited unchanged. There are
 *   deliberately no `exportProgress` / `importProgress` wrappers.
 *
 * Error Handling: follows the base class's contract exactly.
 * - `saveProgress` and `clearProgress` return a boolean: true on success, false
 *   when localStorage refuses (quota, private browsing). They never throw.
 * - `loadProgress` returns null on any failure -- nothing stored, corrupt JSON,
 *   a version mismatch (the base clears the key), or a payload missing `facts`
 *   or `totals`.
 * - Every failure is logged through the base class's `_logError`, which is the
 *   only console path in this layer.
 * - `defaultProgress` and `normalizeProgress` never throw for any input. The
 *   persisted data comes off a real device and can be any shape, so every field
 *   is coerced rather than trusted, and unknown keys are dropped rather than
 *   copied through.
 */

import { StorageManager as BaseStorageManager } from "../../shared/StorageManager.js"
import { GEM_MILESTONES, STORAGE, TRAIL } from "./constants.js"
import { normalizeRecord } from "./MasteryModel.js"

/**
 * A canonical fact id: both operands 2-9, smaller operand first. The "x" is
 * baked into the pattern here and in facts.js rather than shared as a constant,
 * because a shared separator constant would be a lie only one call site honored.
 * @private
 */
const FACT_ID_PATTERN = /^([2-9])x([2-9])$/

/**
 * A local date key, "YYYY-MM-DD". Anything else in a date field becomes null.
 * @private
 */
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Ids of the milestones that still exist. Awarded ids from a save written by an
 * earlier build are filtered against this, so a deleted milestone's id cannot
 * suppress a milestone that is still in the table.
 * @private
 * @type {Set<string>}
 */
const MILESTONE_IDS = new Set(GEM_MILESTONES.map((milestone) => milestone.id))

/**
 * Per-fact memory state; see MasteryModel.js, which owns the coercion.
 * @typedef {import("./MasteryModel.js").MasteryRecord} MasteryRecord
 */

/**
 * Lifetime counters. Five fields: there is deliberately no `secondsPracticed`,
 * because the daily goal counts facts only.
 *
 * @typedef {Object} Totals
 * @property {number} starsTotal        - Stars ever earned, default 0
 * @property {number} gemsTotal         - Gems ever earned (never spent), default 0
 * @property {number} factsAnswered     - Questions ever answered, default 0
 * @property {number} factsCorrect      - Of those, correct; never above factsAnswered, default 0
 * @property {number} sessionsCompleted - Sessions ever finished, default 0
 */

/**
 * The token's position on the trail. One field: there is deliberately no
 * `lapsCompleted`, because space 39 is the end of the trail. Journey.js is the
 * semantic authority for this shape; the pass here is structural.
 *
 * @typedef {Object} Trail
 * @property {number} space - 0-based space index, 0 .. TRAIL.TOTAL_SPACES - 1, default 0
 */

/**
 * Daily-goal and streak state. Seven fields, mirroring `Scoring.createDaily()`
 * exactly; there is deliberately no `secondsToday`.
 *
 * @typedef {Object} Daily
 * @property {string|null} todayDate    - Local date key "YYYY-MM-DD" for the counters below
 * @property {number} factsToday        - Facts answered today
 * @property {boolean} goalMetToday     - Whether today's goal is already met
 * @property {string|null} lastGoalDate - Local date key on which the goal was last met
 * @property {number} streakDays        - Current daily streak
 * @property {number} bestStreakDays    - High-water mark; never below streakDays
 * @property {boolean} flameDimmed      - A grace day was used; the flame shows one stage down
 */

/**
 * The whole persisted save state. Exactly these six keys, plus the `version` and
 * `lastPlayed` the base class stamps on every save.
 *
 * @typedef {Object} SaveState
 * @property {Object<string, MasteryRecord>} facts - Canonical fact id -> record, default {}
 * @property {Totals} totals                       - Lifetime counters, default all zeros
 * @property {Trail} trail                         - Token position, default {space: 0}
 * @property {Daily} daily                         - Daily goal and streak, default per Daily above
 * @property {Object} settings                     - Raw settings, default {}; Settings fills its own defaults
 * @property {string[]} awardedMilestoneIds        - Milestone ids already paid out, default []
 * @property {string} [version]                    - Written by the base class; carried through, never invented
 * @property {number} [lastPlayed]                 - Written by the base class; carried through, never invented
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
 * Read an untrusted date field as a "YYYY-MM-DD" key, else null.
 * @private
 * @param {unknown} value - Value from a persisted payload
 * @returns {string|null} The date key, or null
 */
function _dateKey(value) {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value) ? value : null
}

/**
 * Whether a key is a canonical fact id: matches the pattern AND has its smaller
 * operand first. `"8x7"` matches the pattern but is not canonical, so it is not
 * a key any well-formed save contains and it is dropped on load.
 * @private
 * @param {string} key - A key from a persisted facts map
 * @returns {boolean} True for a canonical id
 */
function _isCanonicalFactId(key) {
  const match = FACT_ID_PATTERN.exec(key)
  return match !== null && Number(match[1]) <= Number(match[2])
}

/**
 * Coerce an untrusted facts map. Non-canonical keys are dropped; every surviving
 * value goes through `normalizeRecord`, which is the single authority on a
 * record's shape.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Object<string, MasteryRecord>} A new map of valid records
 */
function _normalizeFacts(raw) {
  /** @type {Object<string, MasteryRecord>} */
  const facts = {}
  if (!_isPlainObject(raw)) return facts
  for (const key of Object.keys(/** @type {Object} */ (raw))) {
    if (_isCanonicalFactId(key)) {
      facts[key] = normalizeRecord(/** @type {Object} */ (raw)[key])
    }
  }
  return facts
}

/**
 * Coerce untrusted lifetime counters. Unknown keys (a legacy `secondsPracticed`)
 * are dropped rather than copied through.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Totals} A new, valid Totals
 */
function _normalizeTotals(raw) {
  const source = _isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  const factsAnswered = _nonNegativeInt(source.factsAnswered)
  return {
    starsTotal: _nonNegativeInt(source.starsTotal),
    gemsTotal: _nonNegativeInt(source.gemsTotal),
    factsAnswered,
    // Correct answers can never outnumber the questions they came from.
    factsCorrect: Math.min(_nonNegativeInt(source.factsCorrect), factsAnswered),
    sessionsCompleted: _nonNegativeInt(source.sessionsCompleted),
  }
}

/**
 * Coerce an untrusted trail position. Structural only: `Journey.normalizeTrail`
 * is the semantic authority and game.js runs it too. A legacy `lapsCompleted`
 * key is dropped.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Trail} A new, valid Trail
 */
function _normalizeTrail(raw) {
  const source = _isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  if (!Number.isFinite(source.space)) return { space: 0 }
  const space = Math.floor(source.space)
  return { space: Math.min(TRAIL.TOTAL_SPACES - 1, Math.max(0, space)) }
}

/**
 * Coerce untrusted daily-goal state. Booleans are strict (`=== true`), so a
 * truthy `1` from a hand-edited save reads as false rather than silently
 * granting today's goal. A legacy `secondsToday` key is dropped.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {Daily} A new, valid Daily
 */
function _normalizeDaily(raw) {
  const source = _isPlainObject(raw) ? /** @type {Object} */ (raw) : {}
  const streakDays = _nonNegativeInt(source.streakDays)
  return {
    todayDate: _dateKey(source.todayDate),
    factsToday: _nonNegativeInt(source.factsToday),
    goalMetToday: source.goalMetToday === true,
    lastGoalDate: _dateKey(source.lastGoalDate),
    streakDays,
    // A high-water mark can never sit below the value it is tracking.
    bestStreakDays: Math.max(_nonNegativeInt(source.bestStreakDays), streakDays),
    flameDimmed: source.flameDimmed === true,
  }
}

/**
 * Coerce untrusted awarded-milestone ids: strings only, filtered to ids that
 * still exist in GEM_MILESTONES, deduplicated, input order preserved.
 * @private
 * @param {unknown} raw - Persisted value of unknown shape
 * @returns {string[]} A new array of known milestone ids
 */
function _normalizeMilestoneIds(raw) {
  if (!Array.isArray(raw)) return []
  /** @type {string[]} */
  const ids = []
  for (const value of raw) {
    if (typeof value === "string" && MILESTONE_IDS.has(value) && !ids.includes(value)) {
      ids.push(value)
    }
  }
  return ids
}

/**
 * A fresh save state at documented defaults. A new object every call, safe for
 * the caller to mutate.
 *
 * `daily` is a verbatim copy of `Scoring.createDaily()`'s literal. This module
 * cannot import Scoring (see the file header), so the object is written out here
 * and storage.test.js asserts the two are deep-equal.
 *
 * @returns {SaveState} A new state with exactly the six documented keys
 */
export function defaultProgress() {
  return {
    facts: {},
    totals: {
      starsTotal: 0,
      gemsTotal: 0,
      factsAnswered: 0,
      factsCorrect: 0,
      sessionsCompleted: 0,
    },
    trail: { space: 0 },
    daily: {
      todayDate: null,
      factsToday: 0,
      goalMetToday: false,
      lastGoalDate: null,
      streakDays: 0,
      bestStreakDays: 0,
      flameDimmed: false,
    },
    settings: {},
    awardedMilestoneIds: [],
  }
}

/**
 * Coerce anything at all into a valid save state. Never throws, never mutates
 * `raw`, and always returns a fresh object.
 *
 * Every branch is a coercion rather than a rejection, because this data comes
 * off a real device: a browser extension, a half-written save, or a build from
 * six months ago can all produce a payload that is nearly right. Unknown keys
 * are dropped rather than copied through, so fields cut from the design
 * (`Totals.secondsPracticed`, `Daily.secondsToday`, `Trail.lapsCompleted`,
 * `unlockedCosmeticIds`, `activeCosmetics`) disappear on load. `version` and
 * `lastPlayed` are the only keys carried through beyond the documented six, and
 * only when the input already had them -- this function never invents them.
 *
 * @param {unknown} raw - Anything at all, typically a parsed JSON payload
 * @returns {SaveState} A new, valid save state
 */
export function normalizeProgress(raw) {
  if (!_isPlainObject(raw)) return defaultProgress()
  const source = /** @type {Object} */ (raw)

  /** @type {SaveState} */
  const state = {
    facts: _normalizeFacts(source.facts),
    totals: _normalizeTotals(source.totals),
    trail: _normalizeTrail(source.trail),
    daily: _normalizeDaily(source.daily),
    // Structural only: Settings drops unknown keys itself, so a legacy
    // `inputMode` survives here and dies there.
    settings: _isPlainObject(source.settings) ? source.settings : {},
    awardedMilestoneIds: _normalizeMilestoneIds(source.awardedMilestoneIds),
  }

  if ("version" in source) state.version = source.version
  if ("lastPlayed" in source) state.lastPlayed = source.lastPlayed
  return state
}

/**
 * Times Trail's storage. This is the class game code imports; the shared base
 * class is an implementation detail of this file.
 */
export class StorageManager extends BaseStorageManager {
  constructor() {
    super(STORAGE.KEY, STORAGE.VERSION)
  }

  /**
   * Normalize and save the whole save state. The base class adds `version` and
   * `lastPlayed`. Passing null saves a default state rather than writing
   * garbage over a good key -- a corrupted in-memory state should cost her the
   * current session, not her whole trail.
   * @param {SaveState|null} state - The live state; anything invalid is coerced
   * @returns {boolean} True if the save succeeded
   */
  saveProgress(state) {
    return this.saveGameState(normalizeProgress(state))
  }

  /**
   * Load and normalize the save state.
   * @returns {SaveState|null} The state, or null if absent, corrupt, or a
   *   version mismatch (which the base class also clears)
   */
  loadProgress() {
    const data = this.loadGameState()
    if (!data) {
      return null
    }

    // A payload without these two is not a Times Trail save; normalizing it
    // would invent a pristine trail and quietly discard whatever was there.
    if (!_isPlainObject(data.facts) || !_isPlainObject(data.totals)) {
      this._logError(
        "loadProgress",
        "Invalid data structure: missing required fields (facts and/or totals)",
      )
      return null
    }

    return normalizeProgress(data)
  }

  /**
   * Clear the save state.
   * @returns {boolean} True if the clear succeeded
   */
  clearProgress() {
    return this.clearGameState()
  }
}
