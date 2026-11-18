/**
 * Settings for Times Trail -- how long a session is, and whether sound is on.
 *
 * There are exactly two settings: `sessionLength` and `sound`.
 *
 * Philosophy (why the shape is this small):
 *
 * 1. **No knob defeats the design.** Every answer is typed, with no entry mode
 *    to choose: a multiple-choice override would be a 25%-guess data point and
 *    would corrupt the mastery signal the whole game runs on. Scaffolds fire after every miss and never after a correct answer, so
 *    there is no `scaffolds` setting either -- `game.js` reads `!correct` at
 *    the call site. Reduced motion is an OS preference handled entirely by
 *    `@media (prefers-reduced-motion: reduce)` in `main.css`, so there is
 *    nothing to persist and no `matchMedia` call anywhere in this codebase.
 *
 * 2. **No difficulty presets and no table picker.** There used to be four
 *    presets, then a row of eight table toggles that scoped the fact pool. A
 *    trail is a fixed set of facts and always uses all of them, so nothing reads
 *    a table list any more, and a narrowed pool could only make a trail ask the
 *    same question over and over. A `tables` key in an old save is dropped on
 *    load, like `difficulty` and `customTables` before it. The
 *    spaced-repetition draw is what makes practice easier or harder question by
 *    question.
 *
 * 3. **`sound` is persisted but has no control.** Phase 1 ships no sound
 *    manager, and a settings control that changes nothing is worse than no
 *    control. The key stays in the save file so Phase 2 can pick it up without a
 *    migration.
 *
 * Architecture: pure. No `document`, `window`, `localStorage`, or `setTimeout`,
 * and no clock. Persisted input is untrusted, so nothing here throws: an unknown
 * key or an unoffered session length is rejected and the previous (or default)
 * value is kept. No method mutates its argument, and `toJSON` hands back a copy.
 *
 * Error Handling: `update` and `setSessionLength` return a boolean -- `false`
 * means rejected and nothing changed.
 */

import { SESSION } from "./constants.js"

/**
 * @typedef {Object} SettingsData
 * @property {number} sessionLength - Questions per session; one of
 *   `SESSION.LENGTH_OPTIONS`, default `SESSION.DEFAULT_LENGTH`.
 * @property {"on"|"off"} sound - Default "on". Persisted; no control yet.
 */

/**
 * The settings keys that exist. Anything else is dropped on load and rejected
 * by `update`, which is what retires `tables`, `difficulty` and `customTables`
 * from saves written by an earlier build -- along with `inputMode`, `scaffolds`,
 * and `reducedMotion` from the build before that. Mastery records, stars, gems,
 * and trail position are untouched -- see `storage.js`.
 * @private
 * @type {readonly string[]}
 */
const _KEYS = Object.freeze(["sessionLength", "sound"])

/**
 * Legal values of `sound`.
 * @private
 * @type {readonly string[]}
 */
const _SOUND_VALUES = Object.freeze(["on", "off"])

/**
 * The session length and the sound switch. Construct from untrusted persisted
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
      sound: "on",
    }
  }

  /**
   * Whether `key` is one of the two settings that exist.
   * @param {unknown} key - Candidate settings key
   * @returns {boolean} True for "sessionLength" and "sound"
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
    if (key === "sessionLength") {
      return SESSION.LENGTH_OPTIONS.includes(value)
    }
    return _SOUND_VALUES.includes(value)
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
   * A plain snapshot with exactly the two documented keys, safe to hand to
   * `JSON.stringify` or to storage. Mutating the result does not affect this
   * instance.
   * @returns {SettingsData} A new settings object
   */
  toJSON() {
    return {
      sessionLength: this.data.sessionLength,
      sound: this.data.sound,
    }
  }
}
