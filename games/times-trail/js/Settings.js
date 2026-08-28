/**
 * Settings for Times Trail -- difficulty presets, the custom per-table picker,
 * and everything derived from them: the active fact pool and the entry mode a
 * given fact strength gets.
 *
 * There are exactly three settings: `difficulty`, `customTables`, and `sound`.
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
 * 2. **`sound` is persisted but has no Phase 1 control.** Phase 1 ships no
 *    sound manager, and a settings control that changes nothing is worse than
 *    no control. The key stays in the save file so Phase 2 can pick it up
 *    without a migration.
 *
 * 3. **Two table semantics, deliberately.** Presets mean a ceiling: Explorer's
 *    "2s through 5s" must not include `4x8`, so preset pools require *both*
 *    operands to be enabled. Custom means table families: ticking 7 means "the
 *    7 times table", so a custom pool includes a fact when *either* operand is
 *    enabled. `tableMode` on each preset carries which is which.
 *
 * Architecture: pure. No `document`, `window`, `localStorage`, or `setTimeout`,
 * and no clock. Persisted input is untrusted, so nothing here throws: an
 * unknown key, an unknown difficulty, or a junk table list is rejected and the
 * previous (or default) value is kept. No method mutates its argument, and
 * every getter that hands back an array or object hands back a copy, so a
 * caller cannot reach in and reshape the settings or the memoized pool.
 *
 * Error Handling: `update`, `setDifficulty`, and `setCustomTables` return a
 * boolean -- `false` means rejected and nothing changed. The one logged path is
 * a fact pool that came out empty, which the public API cannot produce; it
 * warns and falls back to the Adventurer pool rather than handing the game an
 * unplayable session.
 */

import {
  DEFAULT_CUSTOM_TABLES,
  DEFAULT_DIFFICULTY,
  DIFFICULTY,
  DIFFICULTY_PRESETS,
  INPUT_MODE,
  OPERAND_MAX,
  OPERAND_MIN,
  STRENGTH,
} from "./constants.js"
import { factIdsForTables } from "./facts.js"

/**
 * @typedef {Object} SettingsData
 * @property {"explorer"|"adventurer"|"master"|"custom"} difficulty - Preset id;
 *   default "adventurer"
 * @property {number[]} customTables - Ascending, deduplicated tables in [2, 9];
 *   default [6, 7]. Only meaningful when `difficulty === "custom"`, but always
 *   persisted so switching to Custom and back does not lose the picker state.
 * @property {"on"|"off"} sound - Default "on". Persisted; no Phase 1 control.
 */

/**
 * @typedef {Object} DifficultyPreset
 * @property {string} id
 * @property {string} label
 * @property {readonly number[]|null} tables - `null` for custom (player-chosen)
 * @property {"both"|"either"} tableMode
 * @property {number|null} keypadMinStrength - `null` means never use the keypad
 * @property {number|null} poolSize - Expected pool size; `null` for custom
 */

/**
 * The settings keys that exist. Anything else is dropped on load and rejected
 * by `update`, which is what retires `inputMode`, `scaffolds`, and
 * `reducedMotion` from saves written by an earlier build.
 * @private
 * @type {readonly string[]}
 */
const _KEYS = Object.freeze(["difficulty", "customTables", "sound"])

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
 * Difficulty, the custom table picker, and the pool and entry mode derived from
 * them. Construct from untrusted persisted data; `toJSON()` gives the plain
 * object to persist back.
 */
export class Settings {
  /**
   * @param {Object} [raw] - Persisted (untrusted) settings. Unknown keys,
   *   unknown difficulties, and junk table lists are ignored, leaving the
   *   default for that key. A non-object `raw` (`null`, `"x"`, `42`) yields
   *   pure defaults. Never throws, and `raw` is never mutated.
   */
  constructor(raw = {}) {
    /** @type {SettingsData} The validated settings. */
    this.data = Settings.defaults()

    /**
     * Memoized fact pool, or `null` when it must be recomputed. Invalidated by
     * every mutator that can change `difficulty` or `customTables`.
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
      difficulty: DEFAULT_DIFFICULTY,
      customTables: [...DEFAULT_CUSTOM_TABLES],
      sound: "on",
    }
  }

  /**
   * Whether `key` is one of the three settings that exist.
   * @param {unknown} key - Candidate settings key
   * @returns {boolean} True for "difficulty", "customTables", "sound"
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
    if (key === "difficulty") {
      return Object.values(DIFFICULTY).includes(value)
    }
    if (key === "customTables") {
      return _normalizeTables(value).length > 0
    }
    return _SOUND_VALUES.includes(value)
  }

  /**
   * The current difficulty id.
   * @returns {string} One of the `DIFFICULTY` values
   */
  get difficulty() {
    return this.data.difficulty
  }

  /**
   * The preset entry for the current difficulty. Always defined, because
   * `difficulty` is validated on the way in.
   * @returns {DifficultyPreset} The frozen `DIFFICULTY_PRESETS` entry
   */
  get preset() {
    return DIFFICULTY_PRESETS[this.data.difficulty]
  }

  /**
   * The tables currently in play: the preset's fixed list, or the player's
   * custom picks. A new array each call, ascending.
   * @returns {number[]} Ascending table list, never empty
   */
  get enabledTables() {
    const { tables } = this.preset
    return tables === null ? [...this.data.customTables] : [...tables]
  }

  /**
   * How `enabledTables` selects facts: `"both"` (preset ceiling) or `"either"`
   * (custom table families).
   * @returns {"both"|"either"} The current preset's table semantics
   */
  get tableMode() {
    return this.preset.tableMode
  }

  /**
   * The canonical fact ids currently being practiced, in `FACTS` order.
   * Recomputed only when difficulty or the custom tables change; the memo is
   * private, so this returns a copy the caller may sort or splice freely.
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
   * Set one setting. `"difficulty"` and `"customTables"` route through their
   * dedicated setters, so validation and memo invalidation cannot diverge.
   * @param {unknown} key - Settings key; unknown keys are rejected
   * @param {unknown} value - Candidate value
   * @returns {boolean} `true` if applied; `false` if rejected, in which case
   *   nothing changed
   */
  update(key, value) {
    if (key === "difficulty") return this.setDifficulty(value)
    if (key === "customTables") return this.setCustomTables(value)
    if (!Settings.validate(key, value)) return false
    this.data = { ...this.data, [key]: value }
    return true
  }

  /**
   * Switch difficulty. Rejects anything that is not a `DIFFICULTY` value; the
   * custom table list is left untouched either way, so switching to Custom and
   * back preserves the picker.
   * @param {unknown} difficulty - Candidate difficulty id
   * @returns {boolean} `true` if applied, `false` if rejected
   */
  setDifficulty(difficulty) {
    if (!Settings.validate("difficulty", difficulty)) return false
    this.data = { ...this.data, difficulty: /** @type {string} */ (difficulty) }
    this._pool = null
    return true
  }

  /**
   * Replace the custom table list. The argument is normalized (integers in
   * [2, 9], deduplicated, ascending) and copied, never aliased or mutated -- so
   * a later change to the caller's array cannot reshape the pool. An empty
   * result is rejected rather than silently reset, because "no tables selected"
   * is a UI state the player can produce and the previous list is the better
   * answer than a surprise default.
   * @param {unknown} tables - Candidate table list, e.g. `[8, 9]`
   * @returns {boolean} `true` if applied, `false` if nothing valid was in it
   */
  setCustomTables(tables) {
    const normalized = _normalizeTables(tables)
    if (normalized.length === 0) return false
    this.data = { ...this.data, customTables: normalized }
    this._pool = null
    return true
  }

  /**
   * The entry mode a fact of this strength gets. Always adaptive: weak facts
   * get tiles so a wrong answer is recoverable, and stronger facts get the
   * keypad so the answer has to come from recall rather than recognition. There
   * is no override to check first.
   * @param {number} strength - The fact's (decayed) strength; rounded and
   *   clamped to [0, 5], and a non-finite value is treated as 0
   * @returns {"tiles"|"keypad"} `INPUT_MODE.KEYPAD` once `strength` reaches the
   *   preset's `keypadMinStrength`, else `INPUT_MODE.TILES`
   */
  inputModeFor(strength) {
    const min = this.preset.keypadMinStrength
    if (min === null) return INPUT_MODE.TILES
    const clamped = Number.isFinite(strength)
      ? Math.min(STRENGTH.MAX, Math.max(STRENGTH.MIN, Math.round(strength)))
      : STRENGTH.MIN
    return clamped >= min ? INPUT_MODE.KEYPAD : INPUT_MODE.TILES
  }

  /**
   * A plain, deeply-copied snapshot with exactly the three documented keys,
   * safe to hand to `JSON.stringify` or to storage. Mutating the result does
   * not affect this instance.
   * @returns {SettingsData} A new settings object
   */
  toJSON() {
    return {
      difficulty: this.data.difficulty,
      customTables: [...this.data.customTables],
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
   * Derive the pool from the current tables and table mode.
   *
   * The empty-pool branch is unreachable through the public API -- both preset
   * and custom table lists are guaranteed non-empty -- but an empty pool would
   * hand `FactSelector` nothing to draw and stall the game, so it warns and
   * falls back to Adventurer instead of failing silently.
   * @private
   * @returns {string[]} A new array of canonical fact ids in `FACTS` order
   */
  _computePool() {
    const pool = factIdsForTables(this.enabledTables, this.tableMode)
    if (pool.length === 0) {
      console.warn("Settings: empty fact pool, falling back to adventurer")
      return factIdsForTables([...DIFFICULTY_PRESETS.adventurer.tables], "both")
    }
    return pool
  }
}
