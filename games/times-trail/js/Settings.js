/**
 * Settings for Times Trail: one setting, `sessionLength`.
 *
 * Why it is this small:
 *
 * 1. **No knob defeats the design.** Every answer is typed: a multiple-choice
 *    override would be a 25%-guess data point and would corrupt the mastery
 *    signal. Scaffolds fire after every miss, so there is no `scaffolds` setting.
 *    Reduced motion is handled by `@media (prefers-reduced-motion: reduce)` in
 *    `main.css`, so nothing is persisted.
 *
 * 2. **No difficulty presets and no table picker.** A trail is a fixed set of
 *    facts, and a narrowed pool could only make a trail repeat one question. The
 *    spaced-repetition draw is what makes practice easier or harder.
 *
 * 3. **Unknown keys are dropped on load.** Anything else in a saved settings
 *    object is ignored; the rest of the save is untouched.
 *
 * Pure: no `document`, `window`, `localStorage`, timer or clock. Persisted input
 * is untrusted, so nothing here throws: an unknown key or an unoffered session
 * length is rejected and the previous (or default) value is kept. No method
 * mutates its argument, and `toJSON` hands back a copy.
 *
 * `update` and `setSessionLength` return a boolean; `false` means rejected and
 * nothing changed.
 */

import { SESSION } from "./constants.js"

/**
 * @typedef {Object} SettingsData
 * @property {number} sessionLength - Questions per session; one of
 *   `SESSION.LENGTH_OPTIONS`, default `SESSION.DEFAULT_LENGTH`.
 */

/**
 * The settings keys that exist. Anything else is dropped on load and rejected
 * by `update`.
 * @private
 * @type {readonly string[]}
 */
const _KEYS = Object.freeze(["sessionLength"])

/**
 * The session length. Construct from untrusted persisted
 * data; `toJSON()` gives the plain object to persist back.
 */
export class Settings {
  /**
   * @param {Object} [raw] - Persisted (untrusted) settings. Unknown keys and
   *   unoffered session lengths are ignored, leaving the default for that key. A
   *   non-object `raw` (`null`, `"x"`, `42`) yields pure defaults. Never throws,
   *   and `raw` is never mutated.
   */
  constructor(raw = {}) {
    /** @type {SettingsData} The validated settings. */
    this.data = Settings.defaults()

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
      sessionLength: SESSION.DEFAULT_LENGTH,
    }
  }

  /**
   * Whether `key` is one of the settings that exist.
   * @param {unknown} key - Candidate settings key
   * @returns {boolean} True for "sessionLength"
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
    return SESSION.LENGTH_OPTIONS.includes(value)
  }

  /**
   * How many questions a session asks.
   * @returns {number} One of `SESSION.LENGTH_OPTIONS`
   */
  get sessionLength() {
    return this.data.sessionLength
  }

  /**
   * Set one setting. `"sessionLength"` routes through its dedicated setter, so
   * validation cannot diverge.
   * @param {unknown} key - Settings key; unknown keys are rejected
   * @param {unknown} value - Candidate value
   * @returns {boolean} `true` if applied; `false` if rejected, in which case
   *   nothing changed
   */
  update(key, value) {
    if (key === "sessionLength") return this.setSessionLength(value)
    if (!Settings.validate(key, value)) return false
    this.data = { ...this.data, [key]: value }
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
   * A plain snapshot with exactly the documented keys, safe to hand to
   * `JSON.stringify` or to storage. Mutating the result does not affect this
   * instance.
   * @returns {SettingsData} A new settings object
   */
  toJSON() {
    return {
      sessionLength: this.data.sessionLength,
    }
  }
}
