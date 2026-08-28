/**
 * Settings for Times Trail -- which tables are in play, how long a session is,
 * and the fact pool and entry mode derived from them.
 *
 * There are exactly three settings: `tables`, `sessionLength`, and `sound`.
 *
 * Philosophy (why the shape is this small):
 *
 * 1. **No knob defeats the design.** Entry mode is derived from a fact's
 *    strength (`inputModeFor`), never chosen by the player: a strength-5 fact
 *    answered by picking one of four tiles is a 25%-guess data point, so an
 *    `inputMode` override would corrupt the mastery signal the whole game runs
 *    on. Scaffolds fire after every miss and never after a correct answer, so
 *    there is no `scaffolds` setting either -- `game.js` reads `!correct` at
 *    the call site. Reduced motion is an OS preference handled entirely by
 *    `@media (prefers-reduced-motion: reduce)` in `main.css`, so there is
 *    nothing to persist and no `matchMedia` call anywhere in this codebase.
 *
 * 2. **No difficulty presets.** There used to be four -- Explorer, Adventurer,
 *    Master, Custom -- in front of the table list, plus a second table picker
 *    behind Custom. Once every preset shared the same `keypadMinStrength` the
 *    only thing a preset changed was the table list, so it was a table picker
 *    under a vaguer name. `tables` is now the one control, and `DEFAULT_TABLES`
 *    turns all eight on: the spaced-repetition draw is what makes practice
 *    easier or harder question by question, and the table toggles are for
 *    scoping ("we are on the 7s in class this week"), not for difficulty.
 *
 * 3. **One table semantic.** `tables` reads as families: enabling 7 puts 7x2
 *    through 7x9 in the pool. The old ceiling semantic ("2s through 5s" must
 *    exclude 4x8) existed only for the presets, and keeping both would just be a
 *    way for the modal and the pool to disagree. See `facts.factsForTables`.
 *
 * 4. **`sound` is persisted but has no control.** Phase 1 ships no sound
 *    manager, and a settings control that changes nothing is worse than no
 *    control. The key stays in the save file so Phase 2 can pick it up without a
 *    migration.
 *
 * Architecture: pure. No `document`, `window`, `localStorage`, or `setTimeout`,
 * and no clock. Persisted input is untrusted, so nothing here throws: an unknown
 * key, a junk table list, or an unoffered session length is rejected and the
 * previous (or default) value is kept. No method mutates its argument, and every
 * getter that hands back an array or object hands back a copy, so a caller
 * cannot reach in and reshape the settings or the memoized pool.
 *
 * Error Handling: `update`, `setTables`, and `setSessionLength` return a boolean
 * -- `false` means rejected and nothing changed. The one logged path is a fact
 * pool that came out empty, which the public API cannot produce; it warns and
 * falls back to every table rather than handing the game an unplayable session.
 */

import {
  ALL_TABLES,
  DEFAULT_TABLES,
  INPUT_MODE,
  KEYPAD_MIN_STRENGTH,
  OPERAND_MAX,
  OPERAND_MIN,
  SESSION,
  STRENGTH,
} from "./constants.js"
import { factIdsForTables } from "./facts.js"

/**
 * @typedef {Object} SettingsData
 * @property {number[]} tables - Ascending, deduplicated tables in [2, 9]; default
 *   all eight. Never empty -- clearing the last one is rejected.
 * @property {number} sessionLength - Questions per session; one of
 *   `SESSION.LENGTH_OPTIONS`, default `SESSION.DEFAULT_LENGTH`.
 * @property {"on"|"off"} sound - Default "on". Persisted; no control yet.
 */

/**
 * The settings keys that exist. Anything else is dropped on load and rejected
 * by `update`, which is what retires `difficulty` and `customTables` from saves
 * written by an earlier build -- along with `inputMode`, `scaffolds`, and
 * `reducedMotion` from the build before that.
 *
 * A save from the preset era therefore loads as all-eight-tables rather than as
 * whatever its preset meant. That is a deliberate one-time reset of scope, not a
 * migration: `customTables` only ever meant anything alongside
 * `difficulty === "custom"`, so honouring it in isolation would silently narrow
 * the pool for players who were on a preset. Mastery records, stars, gems, and
 * trail position are untouched -- see `storage.js`.
 * @private
 * @type {readonly string[]}
 */
const _KEYS = Object.freeze(["tables", "sessionLength", "sound"])

/**
 * Legal values of `sound`.
 * @private
 * @type {readonly string[]}
 */
const _SOUND_VALUES = Object.freeze(["on", "off"])

/**
 * True when `value` is an integer inside the fact set's operand bounds, i.e. a
 * real table the game covers.
 * @private
 * @param {unknown} value - Candidate table
 * @returns {boolean} Whether the value is an integer in [OPERAND_MIN, OPERAND_MAX]
 */
function _isTable(value) {
  return Number.isInteger(value) && value >= OPERAND_MIN && value <= OPERAND_MAX
}

/**
 * Clean a player- or save-supplied table list: keep only integers in range,
 * drop duplicates, sort ascending. Never throws; a non-array yields `[]`.
 * @private
 * @param {unknown} tables - Candidate table list
 * @returns {number[]} A new ascending, deduplicated array; `[]` if nothing survived
 */
function _normalizeTables(tables) {
  if (!Array.isArray(tables)) return []
  const kept = new Set(tables.filter(_isTable))
  return [...kept].sort((left, right) => left - right)
}

/**
 * The tables in play, the session length, and the fact pool and entry mode
 * derived from them. Construct from untrusted persisted data; `toJSON()` gives
 * the plain object to persist back.
 */
export class Settings {
  /**
   * @param {Object} [raw] - Persisted (untrusted) settings. Unknown keys, junk
   *   table lists, and unoffered session lengths are ignored, leaving the
   *   default for that key. A non-object `raw` (`null`, `"x"`, `42`) yields pure
   *   defaults. Never throws, and `raw` is never mutated.
   */
  constructor(raw = {}) {
    /** @type {SettingsData} The validated settings. */
    this.data = Settings.defaults()

    /**
     * Memoized fact pool, or `null` when it must be recomputed. Invalidated by
     * every mutator that can change `tables`.
     * @private
     * @type {string[]|null}
     */
    this._pool = null

    const source = raw !== null && typeof raw === "object" ? raw : {}
    for (const key of Object.keys(source)) {
      this.update(key, source[key])
    }
  }

  /**
   * The documented defaults, as a fresh object every call (so a caller can
   * mutate the result without affecting anyone else's defaults).
   * @returns {SettingsData} A new settings object at its default values
   */
  static defaults() {
    return {
      tables: [...DEFAULT_TABLES],
      sessionLength: SESSION.DEFAULT_LENGTH,
      sound: "on",
    }
  }

  /**
   * Whether `key` is one of the three settings that exist.
   * @param {unknown} key - Candidate settings key
   * @returns {boolean} True for "tables", "sessionLength", "sound"
   */
  static isValidKey(key) {
    return typeof key === "string" && _KEYS.includes(key)
  }

  /**
   * Whether `value` is a legal value for `key`. `false` for an unknown key, so
   * this is safe to call on raw persisted data without checking the key first.
   * @param {unknown} key - Settings key
   * @param {unknown} value - Candidate value
   * @returns {boolean} Whether the pair would be accepted
   */
  static validate(key, value) {
    if (!Settings.isValidKey(key)) return false
    if (key === "tables") {
      return _normalizeTables(value).length > 0
    }
    if (key === "sessionLength") {
      return SESSION.LENGTH_OPTIONS.includes(value)
    }
    return _SOUND_VALUES.includes(value)
  }

  /**
   * The tables currently in play. A new array each call, ascending.
   * @returns {number[]} Ascending table list, never empty
   */
  get enabledTables() {
    return [...this.data.tables]
  }

  /**
   * How many questions a session asks.
   * @returns {number} One of `SESSION.LENGTH_OPTIONS`
   */
  get sessionLength() {
    return this.data.sessionLength
  }

  /**
   * The canonical fact ids currently being practiced, in `FACTS` order.
   * Recomputed only when the tables change; the memo is private, so this returns
   * a copy the caller may sort or splice freely.
   * @returns {string[]} A new array of canonical fact ids, never empty
   */
  get factPool() {
    return [...this._resolvePool()]
  }

  /**
   * How many facts are in the active pool.
   * @returns {number} `factPool.length`, without copying the array
   */
  get factCount() {
    return this._resolvePool().length
  }

  /**
   * Set one setting. `"tables"` and `"sessionLength"` route through their
   * dedicated setters, so validation and memo invalidation cannot diverge.
   * @param {unknown} key - Settings key; unknown keys are rejected
   * @param {unknown} value - Candidate value
   * @returns {boolean} `true` if applied; `false` if rejected, in which case
   *   nothing changed
   */
  update(key, value) {
    if (key === "tables") return this.setTables(value)
    if (key === "sessionLength") return this.setSessionLength(value)
    if (!Settings.validate(key, value)) return false
    this.data = { ...this.data, [key]: value }
    return true
  }

  /**
   * Replace the table list. The argument is normalized (integers in [2, 9],
   * deduplicated, ascending) and copied, never aliased or mutated -- so a later
   * change to the caller's array cannot reshape the pool. An empty result is
   * rejected rather than silently reset, because "no tables selected" is a UI
   * state the player can produce and the previous list is the better answer than
   * a surprise default.
   * @param {unknown} tables - Candidate table list, e.g. `[8, 9]`
   * @returns {boolean} `true` if applied, `false` if nothing valid was in it
   */
  setTables(tables) {
    const normalized = _normalizeTables(tables)
    if (normalized.length === 0) return false
    this.data = { ...this.data, tables: normalized }
    this._pool = null
    return true
  }

  /**
   * Set the number of questions per session. Rejects anything not offered in
   * `SESSION.LENGTH_OPTIONS`, so a hand-edited save cannot produce a
   * 500-question session.
   * @param {unknown} length - Candidate session length
   * @returns {boolean} `true` if applied, `false` if rejected
   */
  setSessionLength(length) {
    if (!Settings.validate("sessionLength", length)) return false
    this.data = { ...this.data, sessionLength: /** @type {number} */ (length) }
    return true
  }

  /**
   * The entry mode a fact of this strength gets. Always adaptive: weak facts
   * get tiles so a wrong answer is recoverable, and stronger facts get the
   * keypad so the answer has to come from recall rather than recognition. There
   * is no override to check first.
   * @param {number} strength - The fact's (decayed) strength; rounded and
   *   clamped to [0, 5], and a non-finite value is treated as 0
   * @returns {"tiles"|"keypad"} `INPUT_MODE.KEYPAD` once `strength` reaches
   *   `KEYPAD_MIN_STRENGTH`, else `INPUT_MODE.TILES`
   */
  inputModeFor(strength) {
    if (KEYPAD_MIN_STRENGTH === null) return INPUT_MODE.TILES
    const clamped = Number.isFinite(strength)
      ? Math.min(STRENGTH.MAX, Math.max(STRENGTH.MIN, Math.round(strength)))
      : STRENGTH.MIN
    return clamped >= KEYPAD_MIN_STRENGTH ? INPUT_MODE.KEYPAD : INPUT_MODE.TILES
  }

  /**
   * A plain, deeply-copied snapshot with exactly the three documented keys,
   * safe to hand to `JSON.stringify` or to storage. Mutating the result does
   * not affect this instance.
   * @returns {SettingsData} A new settings object
   */
  toJSON() {
    return {
      tables: [...this.data.tables],
      sessionLength: this.data.sessionLength,
      sound: this.data.sound,
    }
  }

  /**
   * The memoized pool array itself. Private because it is the live memo:
   * `factPool` copies it before handing it out.
   * @private
   * @returns {string[]} The active pool in `FACTS` order, never empty
   */
  _resolvePool() {
    if (this._pool === null) {
      this._pool = this._computePool()
    }
    return this._pool
  }

  /**
   * Derive the pool from the current tables.
   *
   * The empty-pool branch is unreachable through the public API -- `setTables`
   * guarantees a non-empty, in-range list -- but an empty pool would hand
   * `FactSelector` nothing to draw and stall the game, so it warns and falls
   * back to every table instead of failing silently.
   * @private
   * @returns {string[]} A new array of canonical fact ids in `FACTS` order
   */
  _computePool() {
    const pool = factIdsForTables(this.enabledTables)
    if (pool.length === 0) {
      console.warn("Settings: empty fact pool, falling back to every table")
      return factIdsForTables([...ALL_TABLES])
    }
    return pool
  }
}
