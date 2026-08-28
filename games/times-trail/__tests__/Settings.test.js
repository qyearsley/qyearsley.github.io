/**
 * Tests for Settings -- difficulty presets, the custom table picker, and the
 * pool and entry mode derived from them.
 *
 * Two things are deliberate here. First, every expected pool size is
 * cross-checked against `factIdsForTables` from `facts.js` rather than trusting
 * a number written in prose: an earlier draft of the spec claimed the custom
 * `[6, 7]` pool had 13 facts when it has 15, and a hardcoded literal would have
 * enshrined the wrong one. The literals below are asserted *alongside* the
 * computed values, so a drift in either direction fails.
 *
 * Second, the constructor's input is treated as hostile throughout, because it
 * comes straight out of `localStorage`: unknown difficulty strings, `null`,
 * table lists containing 0, 1, 10, duplicates, floats, and strings, and keys
 * (`inputMode`, `scaffolds`, `reducedMotion`) that a save written by an earlier
 * build could still carry.
 */

import { describe, expect, jest, test } from "@jest/globals"
import { Settings } from "../js/Settings.js"
import {
  DEFAULT_CUSTOM_TABLES,
  DEFAULT_DIFFICULTY,
  DIFFICULTY,
  DIFFICULTY_PRESETS,
  INPUT_MODE,
  STRENGTH,
} from "../js/constants.js"
import { FACT_IDS, factIdsForTables, getFact } from "../js/facts.js"

/** Every strength the model can produce, for exhaustive entry-mode coverage. */
const ALL_STRENGTHS = [0, 1, 2, 3, 4, 5]

/** Pool sizes computed from facts.js, never hardcoded in the assertions below. */
const COMPUTED = {
  explorer: factIdsForTables([2, 3, 4, 5], "both").length,
  adventurer: factIdsForTables([2, 3, 4, 5, 6, 7], "both").length,
  master: factIdsForTables([2, 3, 4, 5, 6, 7, 8, 9], "both").length,
  custom67: factIdsForTables([6, 7], "either").length,
  custom67Both: factIdsForTables([6, 7], "both").length,
  custom7: factIdsForTables([7], "either").length,
}

/**
 * Both operands of a fact id, via `facts.js` so the test never re-parses ids.
 * @param {string} id - Canonical fact id
 * @returns {number[]} `[a, b]`
 */
function operandsOf(id) {
  const fact = getFact(id)
  return [fact.a, fact.b]
}

describe("Settings", () => {
  describe("defaults", () => {
    test("matches the three documented defaults exactly", () => {
      expect(Settings.defaults()).toEqual({
        difficulty: "adventurer",
        customTables: [6, 7],
        sound: "on",
      })
    })

    test("agrees with the constants it is built from", () => {
      const defaults = Settings.defaults()
      expect(defaults.difficulty).toBe(DEFAULT_DIFFICULTY)
      expect(defaults.customTables).toEqual([...DEFAULT_CUSTOM_TABLES])
    })

    test("has exactly three keys, and none of the cut ones", () => {
      expect(Object.keys(Settings.defaults()).sort()).toEqual([
        "customTables",
        "difficulty",
        "sound",
      ])
    })

    test("returns a fresh object each call", () => {
      const first = Settings.defaults()
      const second = Settings.defaults()
      expect(first).not.toBe(second)
      expect(first.customTables).not.toBe(second.customTables)
      first.difficulty = "master"
      first.customTables.push(9)
      expect(second.difficulty).toBe("adventurer")
      expect(second.customTables).toEqual([6, 7])
    })

    test("does not alias the frozen DEFAULT_CUSTOM_TABLES", () => {
      expect(Settings.defaults().customTables).not.toBe(DEFAULT_CUSTOM_TABLES)
    })
  })

  describe("constructor", () => {
    test("no argument gives the defaults", () => {
      expect(new Settings().toJSON()).toEqual(Settings.defaults())
    })

    test("non-object input gives the defaults without throwing", () => {
      for (const raw of [null, undefined, "x", 42, true, NaN]) {
        expect(new Settings(raw).toJSON()).toEqual(Settings.defaults())
      }
    })

    test("an array gives the defaults (its index keys are not settings keys)", () => {
      expect(new Settings(["master", [8, 9]]).toJSON()).toEqual(Settings.defaults())
    })

    test("adopts every valid key", () => {
      const settings = new Settings({ difficulty: "master", customTables: [8, 9], sound: "off" })
      expect(settings.toJSON()).toEqual({
        difficulty: "master",
        customTables: [8, 9],
        sound: "off",
      })
    })

    test("drops unknown keys", () => {
      const settings = new Settings({ difficulty: "explorer", nope: 1, theme: "dark" })
      expect(settings.toJSON()).toEqual({
        difficulty: "explorer",
        customTables: [6, 7],
        sound: "on",
      })
      expect("nope" in settings.toJSON()).toBe(false)
      expect("theme" in settings.toJSON()).toBe(false)
    })

    test("an unknown difficulty string falls back to the default", () => {
      for (const difficulty of ["wizard", "", "Master", "EXPLORER", null, 3, ["master"]]) {
        expect(new Settings({ difficulty }).difficulty).toBe("adventurer")
      }
    })

    test("filters junk out of customTables", () => {
      expect(new Settings({ customTables: [1, 7, 12, "8", 7.5] }).toJSON().customTables).toEqual([
        7,
      ])
    })

    test("rejects 0, 1, and 10 as tables", () => {
      expect(new Settings({ customTables: [0, 1, 10, 5] }).toJSON().customTables).toEqual([5])
    })

    test("an all-invalid customTables falls back to [6, 7]", () => {
      for (const customTables of [[], [0, 1, 10], ["6", "7"], [null], "6,7", 67, null]) {
        expect(new Settings({ customTables }).toJSON().customTables).toEqual([6, 7])
      }
    })

    test("sorts and deduplicates customTables", () => {
      expect(new Settings({ customTables: [9, 2, 5, 2] }).toJSON().customTables).toEqual([2, 5, 9])
    })

    test("an invalid sound falls back to on", () => {
      for (const sound of ["loud", "ON", true, 1, null]) {
        expect(new Settings({ sound }).toJSON().sound).toBe("on")
      }
    })

    test("keeps the valid keys of a partly-invalid save", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [0, 1], sound: "quiet" })
      expect(settings.toJSON()).toEqual({
        difficulty: "custom",
        customTables: [6, 7],
        sound: "on",
      })
    })

    test("does not mutate or alias the raw object it was given", () => {
      const raw = { difficulty: "custom", customTables: [9, 2, 2], sound: "off" }
      const settings = new Settings(raw)
      expect(raw).toEqual({ difficulty: "custom", customTables: [9, 2, 2], sound: "off" })
      expect(settings.toJSON().customTables).not.toBe(raw.customTables)
      raw.customTables.push(3)
      expect(settings.toJSON().customTables).toEqual([2, 9])
    })
  })

  describe("legacy and cut settings", () => {
    test("inputMode, scaffolds, and reducedMotion never reach the data", () => {
      const settings = new Settings({
        difficulty: "explorer",
        inputMode: "keypad",
        scaffolds: "off",
        reducedMotion: "on",
      })
      const json = settings.toJSON()
      expect("inputMode" in json).toBe(false)
      expect("scaffolds" in json).toBe(false)
      expect("reducedMotion" in json).toBe(false)
      expect(Object.keys(json).sort()).toEqual(["customTables", "difficulty", "sound"])
    })

    test("a persisted inputMode cannot override the preset's entry mode", () => {
      const settings = new Settings({ inputMode: "tiles", difficulty: "explorer" })
      expect("inputMode" in settings.toJSON()).toBe(false)
      expect(settings.inputModeFor(5)).toBe(INPUT_MODE.KEYPAD)
    })
  })

  describe("isValidKey", () => {
    test("accepts the three real keys", () => {
      for (const key of ["difficulty", "customTables", "sound"]) {
        expect(Settings.isValidKey(key)).toBe(true)
      }
    })

    test("rejects the three cut keys", () => {
      for (const key of ["inputMode", "scaffolds", "reducedMotion"]) {
        expect(Settings.isValidKey(key)).toBe(false)
      }
    })

    test("rejects unknown and non-string keys", () => {
      for (const key of ["", "Difficulty", "nope", null, undefined, 0, [], {}]) {
        expect(Settings.isValidKey(key)).toBe(false)
      }
    })

    test("rejects inherited Object.prototype names", () => {
      for (const key of ["toString", "constructor", "hasOwnProperty"]) {
        expect(Settings.isValidKey(key)).toBe(false)
      }
    })
  })

  describe("validate", () => {
    test("difficulty accepts exactly the DIFFICULTY values", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        expect(Settings.validate("difficulty", difficulty)).toBe(true)
      }
      for (const difficulty of ["wizard", "", null, undefined, 1, ["master"]]) {
        expect(Settings.validate("difficulty", difficulty)).toBe(false)
      }
    })

    test("customTables accepts a list with at least one table in range", () => {
      expect(Settings.validate("customTables", [2])).toBe(true)
      expect(Settings.validate("customTables", [1, 7, 12])).toBe(true)
      expect(Settings.validate("customTables", [9, 2, 2])).toBe(true)
    })

    test("customTables rejects a list with nothing in range", () => {
      for (const value of [[], [0], [1], [10], [1.5], ["7"], [null], null, "7", 7, {}]) {
        expect(Settings.validate("customTables", value)).toBe(false)
      }
    })

    test("sound accepts on and off only", () => {
      expect(Settings.validate("sound", "on")).toBe(true)
      expect(Settings.validate("sound", "off")).toBe(true)
      for (const value of ["loud", "ON", "", true, false, 0, null, undefined]) {
        expect(Settings.validate("sound", value)).toBe(false)
      }
    })

    test("any other key is invalid whatever the value", () => {
      for (const key of ["inputMode", "scaffolds", "reducedMotion", "nope"]) {
        expect(Settings.validate(key, "on")).toBe(false)
        expect(Settings.validate(key, true)).toBe(false)
        expect(Settings.validate(key, [7])).toBe(false)
      }
    })

    test("does not mutate the value it was handed", () => {
      const tables = [9, 2, 2, 0]
      Settings.validate("customTables", tables)
      expect(tables).toEqual([9, 2, 2, 0])
    })
  })

  describe("preset / enabledTables / tableMode", () => {
    test("preset is the DIFFICULTY_PRESETS entry for the current difficulty", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        expect(new Settings({ difficulty }).preset).toBe(DIFFICULTY_PRESETS[difficulty])
      }
    })

    test("enabledTables is the preset's list for the three presets", () => {
      expect(new Settings({ difficulty: "explorer" }).enabledTables).toEqual([2, 3, 4, 5])
      expect(new Settings({ difficulty: "adventurer" }).enabledTables).toEqual([2, 3, 4, 5, 6, 7])
      expect(new Settings({ difficulty: "master" }).enabledTables).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
    })

    test("enabledTables is the player's list under custom", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [9, 3] })
      expect(settings.enabledTables).toEqual([3, 9])
    })

    test("enabledTables returns a copy that cannot reshape the settings", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [6, 7] })
      const tables = settings.enabledTables
      tables.push(9)
      expect(settings.enabledTables).toEqual([6, 7])
      expect(settings.factCount).toBe(COMPUTED.custom67)
    })

    test("tableMode is both for the presets and either for custom", () => {
      expect(new Settings({ difficulty: "explorer" }).tableMode).toBe("both")
      expect(new Settings({ difficulty: "adventurer" }).tableMode).toBe("both")
      expect(new Settings({ difficulty: "master" }).tableMode).toBe("both")
      expect(new Settings({ difficulty: "custom" }).tableMode).toBe("either")
    })
  })

  describe("factPool", () => {
    test("explorer holds 10 facts, none with an operand above 5", () => {
      const pool = new Settings({ difficulty: "explorer" }).factPool
      expect(pool).toHaveLength(10)
      expect(pool).toHaveLength(COMPUTED.explorer)
      for (const id of pool) {
        for (const operand of operandsOf(id)) {
          expect(operand).toBeLessThanOrEqual(5)
        }
      }
    })

    test("adventurer holds 21 facts, none with an operand above 7", () => {
      const pool = new Settings({ difficulty: "adventurer" }).factPool
      expect(pool).toHaveLength(21)
      expect(pool).toHaveLength(COMPUTED.adventurer)
      for (const id of pool) {
        for (const operand of operandsOf(id)) {
          expect(operand).toBeLessThanOrEqual(7)
        }
      }
    })

    test("master holds all 36 facts", () => {
      const pool = new Settings({ difficulty: "master" }).factPool
      expect(pool).toHaveLength(36)
      expect(pool).toHaveLength(COMPUTED.master)
      expect([...pool].sort()).toEqual([...FACT_IDS].sort())
    })

    test("every preset pool matches its declared poolSize", () => {
      for (const difficulty of ["explorer", "adventurer", "master"]) {
        expect(new Settings({ difficulty }).factCount).toBe(DIFFICULTY_PRESETS[difficulty].poolSize)
      }
    })

    test("custom [6, 7] holds 15 facts under either-semantics", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [6, 7] })
      const pool = settings.factPool
      expect(pool).toHaveLength(15)
      expect(pool).toHaveLength(COMPUTED.custom67)
      expect(pool).toEqual([
        "2x6",
        "2x7",
        "3x6",
        "3x7",
        "4x6",
        "4x7",
        "5x6",
        "5x7",
        "6x6",
        "6x7",
        "6x8",
        "6x9",
        "7x7",
        "7x8",
        "7x9",
      ])
      for (const id of pool) {
        expect(operandsOf(id).some((operand) => operand === 6 || operand === 7)).toBe(true)
      }
    })

    test("either-semantics is strictly wider than both-semantics for [6, 7]", () => {
      expect(COMPUTED.custom67).toBeGreaterThan(COMPUTED.custom67Both)
      expect(COMPUTED.custom67Both).toBe(3)
    })

    test("custom with one table holds that whole table family", () => {
      const pool = new Settings({ difficulty: "custom", customTables: [7] }).factPool
      expect(pool).toHaveLength(8)
      expect(pool).toHaveLength(COMPUTED.custom7)
      for (const id of pool) {
        expect(operandsOf(id)).toContain(7)
      }
    })

    test("custom with every table holds all 36 facts", () => {
      const settings = new Settings({
        difficulty: "custom",
        customTables: [2, 3, 4, 5, 6, 7, 8, 9],
      })
      expect([...settings.factPool].sort()).toEqual([...FACT_IDS].sort())
    })

    test("custom with no valid tables keeps the default pool rather than emptying it", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [] })
      expect(settings.enabledTables).toEqual([6, 7])
      expect(settings.factCount).toBe(COMPUTED.custom67)
    })

    test("the pool is never empty for any reachable configuration", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        for (const customTables of [[2], [9], [2, 9], [2, 3, 4, 5, 6, 7, 8, 9]]) {
          const settings = new Settings({ difficulty, customTables })
          expect(settings.factCount).toBeGreaterThan(0)
        }
      }
    })

    test("ids come back in FACTS order", () => {
      const pool = new Settings({ difficulty: "master" }).factPool
      expect(pool).toEqual([...FACT_IDS])
      const custom = new Settings({ difficulty: "custom", customTables: [6, 7] }).factPool
      const positions = custom.map((id) => FACT_IDS.indexOf(id))
      expect(positions).toEqual([...positions].sort((left, right) => left - right))
    })

    test("the returned array is a copy, so mutating it cannot corrupt a later read", () => {
      const settings = new Settings({ difficulty: "adventurer" })
      const first = settings.factPool
      first.push("9x9")
      first[0] = "nope"
      expect(settings.factPool).toHaveLength(21)
      expect(settings.factPool[0]).toBe("2x2")
      expect(settings.factPool).not.toBe(first)
      expect(settings.factPool).not.toBe(settings.factPool)
    })

    test("changing difficulty invalidates the memo", () => {
      const settings = new Settings({ difficulty: "explorer" })
      expect(settings.factCount).toBe(10)
      settings.setDifficulty("master")
      expect(settings.factCount).toBe(36)
      settings.setDifficulty("explorer")
      expect(settings.factCount).toBe(10)
    })

    test("changing customTables invalidates the memo", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [7] })
      expect(settings.factCount).toBe(COMPUTED.custom7)
      settings.setCustomTables([6, 7])
      expect(settings.factCount).toBe(COMPUTED.custom67)
    })

    test("a rejected customTables change leaves the memoized pool alone", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [7] })
      expect(settings.factCount).toBe(COMPUTED.custom7)
      expect(settings.setCustomTables([])).toBe(false)
      expect(settings.factCount).toBe(COMPUTED.custom7)
    })

    test("falls back to the adventurer pool if the tables somehow come out empty", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      try {
        const settings = new Settings({ difficulty: "custom" })
        settings.data.customTables = []
        expect(settings.factCount).toBe(COMPUTED.adventurer)
        expect(warn).toHaveBeenCalled()
      } finally {
        warn.mockRestore()
      }
    })

    test("factCount always equals factPool.length", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        const settings = new Settings({ difficulty, customTables: [3, 8] })
        expect(settings.factCount).toBe(settings.factPool.length)
      }
    })
  })

  describe("inputModeFor", () => {
    // Keypad-only trial (2026-08-27): every preset has keypadMinStrength 0, so
    // the tiles path is unreachable. The threshold-agnostic test below is what
    // keeps this honest if the presets are restored.
    test("every preset uses the keypad at every strength", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        const settings = new Settings({ difficulty })
        for (const strength of ALL_STRENGTHS) {
          expect(settings.inputModeFor(strength)).toBe(INPUT_MODE.KEYPAD)
        }
      }
    })

    test("every preset agrees with its own keypadMinStrength at every strength", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        const settings = new Settings({ difficulty })
        const min = settings.preset.keypadMinStrength
        for (const strength of ALL_STRENGTHS) {
          const expected = min !== null && strength >= min ? INPUT_MODE.KEYPAD : INPUT_MODE.TILES
          expect(settings.inputModeFor(strength)).toBe(expected)
        }
      }
    })

    // COVERAGE LOSS, keypad-only trial (2026-08-27): the rounding and
    // non-finite-to-0 behaviour of inputModeFor used to be observable through
    // the tiles/keypad boundary. With every preset at keypadMinStrength 0 the
    // return value can no longer distinguish a sanitised input from an
    // unsanitised one, so these assert only that odd input is handled without
    // throwing. Restoring the presets should restore the two tests that were
    // here: "rounds fractional strengths" (2.4 -> tiles, 2.5 -> keypad) and
    // "a non-finite strength is treated as 0".
    test("handles fractional, out-of-range, and non-finite strengths", () => {
      const inputs = [2.4, 2.5, -99, -1, 99, STRENGTH.MAX + 1, NaN, Infinity, -Infinity, "5", {}]
      for (const difficulty of Object.values(DIFFICULTY)) {
        const settings = new Settings({ difficulty })
        for (const strength of inputs) {
          expect(settings.inputModeFor(strength)).toBe(INPUT_MODE.KEYPAD)
        }
      }
    })

    test("only ever returns tiles or keypad, never grid", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        const settings = new Settings({ difficulty })
        for (const strength of ALL_STRENGTHS) {
          expect([INPUT_MODE.TILES, INPUT_MODE.KEYPAD]).toContain(settings.inputModeFor(strength))
        }
      }
    })
  })

  describe("update", () => {
    test("sets sound and reflects it in toJSON", () => {
      const settings = new Settings()
      expect(settings.update("sound", "off")).toBe(true)
      expect(settings.toJSON().sound).toBe("off")
      expect(settings.update("sound", "on")).toBe(true)
      expect(settings.toJSON().sound).toBe("on")
    })

    test("rejects an invalid sound and changes nothing", () => {
      const settings = new Settings()
      expect(settings.update("sound", "loud")).toBe(false)
      expect(settings.toJSON()).toEqual(Settings.defaults())
    })

    test("rejects an unknown key", () => {
      const settings = new Settings()
      expect(settings.update("nope", 1)).toBe(false)
      expect(settings.toJSON()).toEqual(Settings.defaults())
    })

    test("rejects the three cut keys and never persists them", () => {
      const settings = new Settings()
      expect(settings.update("inputMode", "keypad")).toBe(false)
      expect(settings.update("scaffolds", "off")).toBe(false)
      expect(settings.update("reducedMotion", "on")).toBe(false)
      expect(Object.keys(settings.toJSON()).sort()).toEqual(["customTables", "difficulty", "sound"])
    })

    test("routes difficulty through setDifficulty", () => {
      const settings = new Settings()
      expect(settings.update("difficulty", "master")).toBe(true)
      expect(settings.difficulty).toBe("master")
      expect(settings.factCount).toBe(36)
      expect(settings.update("difficulty", "wizard")).toBe(false)
      expect(settings.difficulty).toBe("master")
    })

    test("routes customTables through setCustomTables and leaves difficulty alone", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [2] })
      expect(settings.update("customTables", [8, 9])).toBe(true)
      expect(settings.difficulty).toBe("custom")
      expect(settings.toJSON().customTables).toEqual([8, 9])
      expect(settings.factCount).toBe(factIdsForTables([8, 9], "either").length)
    })

    test("does not mutate the value it was handed", () => {
      const settings = new Settings({ difficulty: "custom" })
      const tables = [9, 6, 6]
      expect(settings.update("customTables", tables)).toBe(true)
      expect(tables).toEqual([9, 6, 6])
      expect(settings.toJSON().customTables).toEqual([6, 9])
    })
  })

  describe("setDifficulty", () => {
    test("accepts every DIFFICULTY value", () => {
      const settings = new Settings()
      for (const difficulty of Object.values(DIFFICULTY)) {
        expect(settings.setDifficulty(difficulty)).toBe(true)
        expect(settings.difficulty).toBe(difficulty)
      }
    })

    test("rejects anything else and keeps the current value", () => {
      const settings = new Settings({ difficulty: "explorer" })
      for (const difficulty of ["wizard", "", null, undefined, 2, ["master"]]) {
        expect(settings.setDifficulty(difficulty)).toBe(false)
      }
      expect(settings.difficulty).toBe("explorer")
      expect(settings.factCount).toBe(10)
    })

    test("preserves the custom table list across a round trip", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [8, 9] })
      settings.setDifficulty("explorer")
      expect(settings.toJSON().customTables).toEqual([8, 9])
      settings.setDifficulty("custom")
      expect(settings.enabledTables).toEqual([8, 9])
    })

    test("switching to custom re-reads the same tables under either-semantics", () => {
      const settings = new Settings({ difficulty: "adventurer", customTables: [6, 7] })
      expect(settings.setDifficulty("custom")).toBe(true)
      expect(settings.tableMode).toBe("either")
      expect(settings.factCount).toBe(COMPUTED.custom67)
      expect(settings.factCount).toBe(15)
      expect(settings.factCount).toBeGreaterThan(COMPUTED.custom67Both)
    })
  })

  describe("setCustomTables", () => {
    test("normalizes to a sorted, deduplicated, in-range list", () => {
      const settings = new Settings({ difficulty: "custom" })
      expect(settings.setCustomTables([9, 2, 2, 1, 10, "3", 4.5])).toBe(true)
      expect(settings.toJSON().customTables).toEqual([2, 9])
    })

    test("one table is a legal selection", () => {
      const settings = new Settings({ difficulty: "custom" })
      expect(settings.setCustomTables([6])).toBe(true)
      expect(settings.enabledTables).toEqual([6])
      expect(settings.factCount).toBe(factIdsForTables([6], "either").length)
    })

    test("all eight tables is a legal selection", () => {
      const settings = new Settings({ difficulty: "custom" })
      expect(settings.setCustomTables([2, 3, 4, 5, 6, 7, 8, 9])).toBe(true)
      expect(settings.factCount).toBe(36)
    })

    test("no tables selected is rejected and the previous list is retained", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [8, 9] })
      expect(settings.setCustomTables([])).toBe(false)
      expect(settings.toJSON().customTables).toEqual([8, 9])
    })

    test("a list with nothing in range is rejected", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [8, 9] })
      for (const tables of [[0], [1], [10], [1, 10], ["6"], [null], null, undefined, 6, {}]) {
        expect(settings.setCustomTables(tables)).toBe(false)
      }
      expect(settings.toJSON().customTables).toEqual([8, 9])
    })

    test("does not mutate or alias the array it was given", () => {
      const settings = new Settings({ difficulty: "custom" })
      const tables = [9, 2, 2]
      settings.setCustomTables(tables)
      expect(tables).toEqual([9, 2, 2])
      tables.push(3)
      expect(settings.enabledTables).toEqual([2, 9])
      expect(settings.toJSON().customTables).not.toBe(tables)
    })

    test("takes effect while a preset is active, without changing difficulty", () => {
      const settings = new Settings({ difficulty: "explorer" })
      expect(settings.setCustomTables([8, 9])).toBe(true)
      expect(settings.difficulty).toBe("explorer")
      expect(settings.factCount).toBe(10)
      settings.setDifficulty("custom")
      expect(settings.enabledTables).toEqual([8, 9])
    })
  })

  describe("toJSON", () => {
    test("returns exactly the three documented keys", () => {
      const json = new Settings({ difficulty: "custom", customTables: [3], sound: "off" }).toJSON()
      expect(Object.keys(json).sort()).toEqual(["customTables", "difficulty", "sound"])
      expect(json).toEqual({ difficulty: "custom", customTables: [3], sound: "off" })
    })

    test("mutating the result does not affect the instance", () => {
      const settings = new Settings({ difficulty: "custom", customTables: [6, 7] })
      const json = settings.toJSON()
      json.difficulty = "master"
      json.sound = "off"
      json.customTables.push(9)
      json.extra = true
      expect(settings.difficulty).toBe("custom")
      expect(settings.toJSON()).toEqual({
        difficulty: "custom",
        customTables: [6, 7],
        sound: "on",
      })
    })

    test("two calls return distinct objects and distinct arrays", () => {
      const settings = new Settings()
      expect(settings.toJSON()).not.toBe(settings.toJSON())
      expect(settings.toJSON().customTables).not.toBe(settings.toJSON().customTables)
    })

    test("round-trips through JSON into an equivalent Settings", () => {
      const original = new Settings({ difficulty: "custom", customTables: [3, 8], sound: "off" })
      const revived = new Settings(JSON.parse(JSON.stringify(original)))
      expect(revived.toJSON()).toEqual(original.toJSON())
      expect(revived.factPool).toEqual(original.factPool)
      expect(revived.inputModeFor(3)).toBe(original.inputModeFor(3))
    })

    test("round-trips every difficulty", () => {
      for (const difficulty of Object.values(DIFFICULTY)) {
        const original = new Settings({ difficulty, customTables: [2, 5, 9], sound: "off" })
        const revived = new Settings(JSON.parse(JSON.stringify(original.toJSON())))
        expect(revived.toJSON()).toEqual(original.toJSON())
        expect(revived.factCount).toBe(original.factCount)
      }
    })

    test("a legacy save round-trips into a three-key object", () => {
      const legacy = {
        difficulty: "master",
        customTables: [6, 7],
        sound: "off",
        inputMode: "tiles",
        scaffolds: "always",
        reducedMotion: "off",
      }
      const json = new Settings(legacy).toJSON()
      expect(json).toEqual({ difficulty: "master", customTables: [6, 7], sound: "off" })
      expect(new Settings(json).toJSON()).toEqual(json)
    })
  })
})
