/**
 * Tests for Settings -- the table picker, the session length, and the pool and
 * entry mode derived from them.
 *
 * Three things are deliberate here.
 *
 * First, every expected pool size is cross-checked against `factIdsForTables`
 * from `facts.js` rather than trusting a number written in prose: an earlier
 * draft of the spec claimed the `[6, 7]` pool had 13 facts when it has 15, and a
 * hardcoded literal would have enshrined the wrong one. The literals below are
 * asserted *alongside* the computed values, so a drift in either direction fails.
 *
 * Second, the constructor's input is treated as hostile throughout, because it
 * comes straight out of `localStorage`: table lists containing 0, 1, 10,
 * duplicates, floats, and strings; session lengths that were never offered; and
 * keys that a save written by an earlier build could still carry.
 *
 * Third, `difficulty` and `customTables` are tested as RETIRED keys, not as
 * absent ones. A save from the preset era is a real file on a real iPad, and what
 * it does on load -- get ignored, leaving all eight tables on -- is behaviour
 * worth pinning rather than leaving to chance.
 */

import { describe, expect, jest, test } from "@jest/globals"
import { Settings } from "../js/Settings.js"
import {
  ALL_TABLES,
  DEFAULT_TABLES,
  INPUT_MODE,
  KEYPAD_MIN_STRENGTH,
  SESSION,
  STRENGTH,
} from "../js/constants.js"
import { FACT_IDS, factIdsForTables, getFact } from "../js/facts.js"

/** Every strength the model can produce, for exhaustive entry-mode coverage. */
const ALL_STRENGTHS = [0, 1, 2, 3, 4, 5]

/** Pool sizes computed from facts.js, never hardcoded in the assertions below. */
const COMPUTED = {
  all: factIdsForTables([...ALL_TABLES]).length,
  sixSeven: factIdsForTables([6, 7]).length,
  sevens: factIdsForTables([7]).length,
  twos: factIdsForTables([2]).length,
}

/** A session length that is NOT in SESSION.LENGTH_OPTIONS, for rejection tests. */
const UNOFFERED_LENGTH = Math.max(...SESSION.LENGTH_OPTIONS) + 7

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
        tables: [2, 3, 4, 5, 6, 7, 8, 9],
        sessionLength: 20,
        sound: "on",
      })
    })

    test("agrees with the constants it is built from", () => {
      const defaults = Settings.defaults()
      expect(defaults.tables).toEqual([...DEFAULT_TABLES])
      expect(defaults.sessionLength).toBe(SESSION.DEFAULT_LENGTH)
    })

    test("has exactly three keys, and none of the retired ones", () => {
      expect(Object.keys(Settings.defaults()).sort()).toEqual(["sessionLength", "sound", "tables"])
    })

    // The point of retiring the presets: a new player practises the whole fact
    // set and the toggles narrow it, rather than the reverse.
    test("starts with every table on", () => {
      expect(Settings.defaults().tables).toEqual([...ALL_TABLES])
      expect(new Settings().factCount).toBe(COMPUTED.all)
    })

    test("returns a fresh object each call", () => {
      const first = Settings.defaults()
      const second = Settings.defaults()
      expect(first).not.toBe(second)
      expect(first.tables).not.toBe(second.tables)
      first.sessionLength = 10
      first.tables.push(99)
      expect(second.sessionLength).toBe(SESSION.DEFAULT_LENGTH)
      expect(second.tables).toEqual([...ALL_TABLES])
    })

    test("does not alias the frozen DEFAULT_TABLES", () => {
      expect(Settings.defaults().tables).not.toBe(DEFAULT_TABLES)
    })
  })

  describe("constructor", () => {
    test("no argument gives the defaults", () => {
      expect(new Settings().toJSON()).toEqual(Settings.defaults())
    })

    test("non-object input gives the defaults without throwing", () => {
      for (const raw of [null, undefined, "x", 42, true, NaN]) {
        expect(() => new Settings(raw)).not.toThrow()
        expect(new Settings(raw).toJSON()).toEqual(Settings.defaults())
      }
    })

    test("reads all three keys off a well-formed save", () => {
      const settings = new Settings({ tables: [8, 9], sessionLength: 30, sound: "off" })
      expect(settings.toJSON()).toEqual({
        tables: [8, 9],
        sessionLength: 30,
        sound: "off",
      })
    })

    test("ignores unknown keys", () => {
      const settings = new Settings({ tables: [3], nope: 1, theme: "dark" })
      expect(settings.toJSON()).toEqual({
        tables: [3],
        sessionLength: SESSION.DEFAULT_LENGTH,
        sound: "on",
      })
    })

    test("filters junk out of tables", () => {
      expect(new Settings({ tables: [1, 7, 12, "8", 7.5] }).toJSON().tables).toEqual([7])
      expect(new Settings({ tables: [0, 1, 10, 5] }).toJSON().tables).toEqual([5])
    })

    test("an all-invalid tables list falls back to every table", () => {
      for (const tables of [[], [0, 1, 10], ["6", "7"], [null], "6,7", 67, null]) {
        expect(new Settings({ tables }).toJSON().tables).toEqual([...ALL_TABLES])
      }
    })

    test("sorts and deduplicates tables", () => {
      expect(new Settings({ tables: [9, 2, 5, 2] }).toJSON().tables).toEqual([2, 5, 9])
    })

    test("an unoffered session length falls back to the default", () => {
      for (const sessionLength of [UNOFFERED_LENGTH, 0, -20, 20.5, "20", null, [20], NaN]) {
        expect(new Settings({ sessionLength }).sessionLength).toBe(SESSION.DEFAULT_LENGTH)
      }
    })

    test("accepts every offered session length", () => {
      for (const sessionLength of SESSION.LENGTH_OPTIONS) {
        expect(new Settings({ sessionLength }).sessionLength).toBe(sessionLength)
      }
    })

    test("one bad key does not discard the good ones", () => {
      const settings = new Settings({ tables: [0, 1], sessionLength: 10, sound: "quiet" })
      expect(settings.toJSON()).toEqual({
        tables: [...ALL_TABLES],
        sessionLength: 10,
        sound: "on",
      })
    })

    test("never mutates or aliases the raw object it was given", () => {
      const raw = { tables: [9, 2, 2], sessionLength: 30, sound: "off" }
      const settings = new Settings(raw)
      expect(raw).toEqual({ tables: [9, 2, 2], sessionLength: 30, sound: "off" })
      expect(settings.toJSON().tables).not.toBe(raw.tables)
      raw.tables.push(3)
      expect(settings.toJSON().tables).toEqual([2, 9])
    })
  })

  describe("legacy and cut settings", () => {
    // These keys were real in shipped saves. `difficulty` and `customTables` are
    // the preset era; `inputMode`, `scaffolds`, and `reducedMotion` predate it.
    test("no retired key reaches the data", () => {
      const settings = new Settings({
        difficulty: "explorer",
        customTables: [6, 7],
        inputMode: "keypad",
        scaffolds: "off",
        reducedMotion: "on",
      })
      const json = settings.toJSON()
      for (const key of ["difficulty", "customTables", "inputMode", "scaffolds", "reducedMotion"]) {
        expect(key in json).toBe(false)
      }
      expect(Object.keys(json).sort()).toEqual(["sessionLength", "sound", "tables"])
    })

    // Deliberately a reset of scope rather than a migration: `customTables` only
    // meant anything alongside `difficulty === "custom"`, so honouring it in
    // isolation would silently narrow the pool for a player who was on a preset.
    test("a preset-era save loads with every table on, not with its customTables", () => {
      const settings = new Settings({ difficulty: "explorer", customTables: [6, 7] })
      expect(settings.enabledTables).toEqual([...ALL_TABLES])
      expect(settings.factCount).toBe(COMPUTED.all)
    })

    test("a persisted inputMode cannot override the derived entry mode", () => {
      const settings = new Settings({ inputMode: "tiles" })
      expect("inputMode" in settings.toJSON()).toBe(false)
      expect(settings.inputModeFor(5)).toBe(INPUT_MODE.KEYPAD)
    })
  })

  describe("isValidKey", () => {
    test("accepts the three real keys", () => {
      for (const key of ["tables", "sessionLength", "sound"]) {
        expect(Settings.isValidKey(key)).toBe(true)
      }
    })

    test("rejects every retired key", () => {
      for (const key of ["difficulty", "customTables", "inputMode", "scaffolds", "reducedMotion"]) {
        expect(Settings.isValidKey(key)).toBe(false)
      }
    })

    test("rejects unknown and non-string keys", () => {
      for (const key of ["", "Tables", "nope", null, undefined, 0, [], {}]) {
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
    test("tables accepts a list with at least one table in range", () => {
      expect(Settings.validate("tables", [2])).toBe(true)
      expect(Settings.validate("tables", [1, 7, 12])).toBe(true)
      expect(Settings.validate("tables", [9, 2, 2])).toBe(true)
    })

    test("tables rejects a list with nothing in range", () => {
      for (const value of [[], [0], [1], [10], [1.5], ["7"], [null], null, "7", 7, {}]) {
        expect(Settings.validate("tables", value)).toBe(false)
      }
    })

    test("sessionLength accepts exactly the offered options", () => {
      for (const length of SESSION.LENGTH_OPTIONS) {
        expect(Settings.validate("sessionLength", length)).toBe(true)
      }
      for (const length of [UNOFFERED_LENGTH, 0, -10, 20.5, "20", null, undefined, [20]]) {
        expect(Settings.validate("sessionLength", length)).toBe(false)
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
      for (const key of ["difficulty", "customTables", "inputMode", "nope"]) {
        expect(Settings.validate(key, "on")).toBe(false)
        expect(Settings.validate(key, true)).toBe(false)
        expect(Settings.validate(key, [7])).toBe(false)
      }
    })

    test("does not mutate the value it was handed", () => {
      const tables = [9, 2, 2, 0]
      Settings.validate("tables", tables)
      expect(tables).toEqual([9, 2, 2, 0])
    })
  })

  describe("enabledTables", () => {
    test("is the persisted list, ascending", () => {
      expect(new Settings({ tables: [9, 3] }).enabledTables).toEqual([3, 9])
    })

    test("is a copy, so mutating it cannot reshape the pool", () => {
      const settings = new Settings({ tables: [6, 7] })
      const tables = settings.enabledTables
      tables.push(9)
      tables[0] = 99
      expect(settings.enabledTables).toEqual([6, 7])
      expect(settings.factCount).toBe(COMPUTED.sixSeven)
    })
  })

  describe("factPool", () => {
    test("every table on holds all 36 facts, in FACTS order", () => {
      const pool = new Settings().factPool
      expect(pool).toHaveLength(36)
      expect(pool).toHaveLength(COMPUTED.all)
      expect(pool).toEqual([...FACT_IDS])
    })

    test("[6, 7] holds 15 facts: two families of eight sharing 6x7", () => {
      const pool = new Settings({ tables: [6, 7] }).factPool
      expect(pool).toHaveLength(15)
      expect(pool).toHaveLength(COMPUTED.sixSeven)
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

    test("one table holds that whole family, high partners included", () => {
      const pool = new Settings({ tables: [7] }).factPool
      expect(pool).toHaveLength(8)
      expect(pool).toHaveLength(COMPUTED.sevens)
      for (const id of pool) {
        expect(operandsOf(id)).toContain(7)
      }
      // The behaviour the old "both" ceiling would have denied: picking the 2s
      // still asks 2x9, because 2x9 is in the 2 times table.
      expect(new Settings({ tables: [2] }).factPool).toContain("2x9")
      expect(new Settings({ tables: [2] }).factCount).toBe(COMPUTED.twos)
    })

    test("a low range is not a ceiling", () => {
      const pool = new Settings({ tables: [2, 3, 4, 5] }).factPool
      expect(pool).toContain("4x8")
      expect(pool.length).toBeGreaterThan(10)
    })

    test("the pool is never empty for any reachable table selection", () => {
      for (const tables of [[2], [9], [2, 9], [...ALL_TABLES]]) {
        expect(new Settings({ tables }).factCount).toBeGreaterThan(0)
      }
    })

    test("the returned array is a copy, so mutating it cannot corrupt a later read", () => {
      const settings = new Settings({ tables: [6, 7] })
      const first = settings.factPool
      first.push("9x9")
      first[0] = "nope"
      expect(settings.factPool).toHaveLength(COMPUTED.sixSeven)
      expect(settings.factPool[0]).toBe("2x6")
      expect(settings.factPool).not.toBe(first)
      expect(settings.factPool).not.toBe(settings.factPool)
    })

    test("changing tables invalidates the memo", () => {
      const settings = new Settings({ tables: [7] })
      expect(settings.factCount).toBe(COMPUTED.sevens)
      settings.setTables([...ALL_TABLES])
      expect(settings.factCount).toBe(COMPUTED.all)
      settings.setTables([6, 7])
      expect(settings.factCount).toBe(COMPUTED.sixSeven)
    })

    test("changing the session length does not invalidate the memo's contents", () => {
      const settings = new Settings({ tables: [7] })
      expect(settings.factCount).toBe(COMPUTED.sevens)
      settings.setSessionLength(30)
      expect(settings.factCount).toBe(COMPUTED.sevens)
    })

    test("a rejected tables change leaves the memoized pool alone", () => {
      const settings = new Settings({ tables: [7] })
      expect(settings.factCount).toBe(COMPUTED.sevens)
      expect(settings.setTables([])).toBe(false)
      expect(settings.factCount).toBe(COMPUTED.sevens)
    })

    test("falls back to every table if the tables somehow come out empty", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      try {
        const settings = new Settings()
        settings.data.tables = []
        expect(settings.factCount).toBe(COMPUTED.all)
        expect(warn).toHaveBeenCalled()
      } finally {
        warn.mockRestore()
      }
    })

    test("factCount always equals factPool.length", () => {
      for (const tables of [[2], [3, 8], [...ALL_TABLES]]) {
        const settings = new Settings({ tables })
        expect(settings.factCount).toBe(settings.factPool.length)
      }
    })
  })

  describe("sessionLength", () => {
    test("defaults to SESSION.DEFAULT_LENGTH", () => {
      expect(new Settings().sessionLength).toBe(SESSION.DEFAULT_LENGTH)
    })

    test("reads back whatever was persisted", () => {
      for (const length of SESSION.LENGTH_OPTIONS) {
        expect(new Settings({ sessionLength: length }).sessionLength).toBe(length)
      }
    })
  })

  describe("inputModeFor", () => {
    // Keypad-only trial (2026-08-27): KEYPAD_MIN_STRENGTH is 0, so the tiles path
    // is unreachable. The threshold-agnostic test below is what keeps this honest
    // if the threshold is raised.
    test("uses the keypad at every strength", () => {
      const settings = new Settings()
      for (const strength of ALL_STRENGTHS) {
        expect(settings.inputModeFor(strength)).toBe(INPUT_MODE.KEYPAD)
      }
    })

    test("agrees with KEYPAD_MIN_STRENGTH at every strength", () => {
      const settings = new Settings()
      for (const strength of ALL_STRENGTHS) {
        const expected =
          KEYPAD_MIN_STRENGTH !== null && strength >= KEYPAD_MIN_STRENGTH
            ? INPUT_MODE.KEYPAD
            : INPUT_MODE.TILES
        expect(settings.inputModeFor(strength)).toBe(expected)
      }
    })

    test("does not vary with the tables in play", () => {
      for (const tables of [[2], [9], [...ALL_TABLES]]) {
        const settings = new Settings({ tables })
        for (const strength of ALL_STRENGTHS) {
          expect(settings.inputModeFor(strength)).toBe(new Settings().inputModeFor(strength))
        }
      }
    })

    // COVERAGE LOSS, keypad-only trial (2026-08-27): the rounding and
    // non-finite-to-0 behaviour of inputModeFor used to be observable through
    // the tiles/keypad boundary. With KEYPAD_MIN_STRENGTH at 0 the return value
    // can no longer distinguish a sanitised input from an unsanitised one, so
    // these assert only that odd input is handled without throwing. Raising the
    // threshold should restore the two tests that were here: "rounds fractional
    // strengths" (2.4 -> tiles, 2.5 -> keypad) and "a non-finite strength is
    // treated as 0".
    test("handles fractional, out-of-range, and non-finite strengths", () => {
      const inputs = [2.4, 2.5, -99, -1, 99, STRENGTH.MAX + 1, NaN, Infinity, -Infinity, "5", {}]
      const settings = new Settings()
      for (const strength of inputs) {
        expect(settings.inputModeFor(strength)).toBe(INPUT_MODE.KEYPAD)
      }
    })

    test("only ever returns tiles or keypad, never grid", () => {
      const settings = new Settings()
      for (const strength of ALL_STRENGTHS) {
        expect([INPUT_MODE.TILES, INPUT_MODE.KEYPAD]).toContain(settings.inputModeFor(strength))
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
      expect(settings.toJSON().sound).toBe("on")
    })

    test("rejects every retired and unknown key", () => {
      const settings = new Settings()
      const before = settings.toJSON()
      for (const key of ["difficulty", "customTables", "inputMode", "nope", "", null, 7]) {
        expect(settings.update(key, "master")).toBe(false)
      }
      expect(settings.toJSON()).toEqual(before)
    })

    test("keeps toJSON at exactly three keys whatever is thrown at it", () => {
      const settings = new Settings()
      settings.update("difficulty", "master")
      settings.update("customTables", [2])
      settings.update("nope", 1)
      expect(Object.keys(settings.toJSON()).sort()).toEqual(["sessionLength", "sound", "tables"])
    })

    test("routes tables through setTables", () => {
      const settings = new Settings({ tables: [2] })
      expect(settings.update("tables", [8, 9])).toBe(true)
      expect(settings.enabledTables).toEqual([8, 9])
      expect(settings.factCount).toBe(factIdsForTables([8, 9]).length)

      expect(settings.update("tables", [])).toBe(false)
      expect(settings.enabledTables).toEqual([8, 9])
    })

    test("routes sessionLength through setSessionLength", () => {
      const settings = new Settings()
      expect(settings.update("sessionLength", 10)).toBe(true)
      expect(settings.sessionLength).toBe(10)

      expect(settings.update("sessionLength", UNOFFERED_LENGTH)).toBe(false)
      expect(settings.sessionLength).toBe(10)
    })

    test("normalizes on the way in", () => {
      const settings = new Settings()
      expect(settings.update("tables", [9, 6, 6, 0, 1])).toBe(true)
      expect(settings.enabledTables).toEqual([6, 9])
    })
  })

  describe("setTables", () => {
    test("replaces the list and invalidates the pool", () => {
      const settings = new Settings({ tables: [8, 9] })
      expect(settings.setTables([6, 7])).toBe(true)
      expect(settings.enabledTables).toEqual([6, 7])
      expect(settings.factCount).toBe(COMPUTED.sixSeven)
    })

    test("normalizes, sorting and deduplicating", () => {
      const settings = new Settings()
      expect(settings.setTables([9, 2, 2, 9])).toBe(true)
      expect(settings.enabledTables).toEqual([2, 9])
    })

    test("rejects an empty result rather than resetting to a surprise default", () => {
      // "No tables selected" is a UI state the player can produce by unticking
      // the last toggle, and the previous list is the better answer.
      const settings = new Settings({ tables: [8, 9] })
      for (const value of [[], [0, 1, 10], null, "6,7", 7]) {
        expect(settings.setTables(value)).toBe(false)
        expect(settings.enabledTables).toEqual([8, 9])
      }
    })

    test("does not alias the caller's array", () => {
      const settings = new Settings()
      const tables = [6, 7]
      settings.setTables(tables)
      tables.push(9)
      expect(settings.enabledTables).toEqual([6, 7])
      expect(settings.toJSON().tables).not.toBe(tables)
    })

    test("leaves the session length and sound alone", () => {
      const settings = new Settings({ sessionLength: 30, sound: "off" })
      settings.setTables([3])
      expect(settings.sessionLength).toBe(30)
      expect(settings.toJSON().sound).toBe("off")
    })
  })

  describe("setSessionLength", () => {
    test("accepts every offered option", () => {
      const settings = new Settings()
      for (const length of SESSION.LENGTH_OPTIONS) {
        expect(settings.setSessionLength(length)).toBe(true)
        expect(settings.sessionLength).toBe(length)
      }
    })

    // A hand-edited save must not be able to produce a 500-question session.
    test("rejects anything not offered and changes nothing", () => {
      const settings = new Settings({ sessionLength: 10 })
      for (const length of [UNOFFERED_LENGTH, 0, -10, 20.5, "20", null, undefined, [20], NaN]) {
        expect(settings.setSessionLength(length)).toBe(false)
        expect(settings.sessionLength).toBe(10)
      }
    })

    test("leaves the tables and sound alone", () => {
      const settings = new Settings({ tables: [6, 7], sound: "off" })
      settings.setSessionLength(30)
      expect(settings.enabledTables).toEqual([6, 7])
      expect(settings.toJSON().sound).toBe("off")
    })
  })

  describe("toJSON", () => {
    test("has exactly the three documented keys", () => {
      const json = new Settings({ tables: [3], sessionLength: 30, sound: "off" }).toJSON()
      expect(Object.keys(json).sort()).toEqual(["sessionLength", "sound", "tables"])
      expect(json).toEqual({ tables: [3], sessionLength: 30, sound: "off" })
    })

    test("is a deep copy: mutating it does not reach the instance", () => {
      const settings = new Settings({ tables: [6, 7] })
      const json = settings.toJSON()
      json.sessionLength = 30
      json.sound = "off"
      json.tables.push(9)
      expect(settings.sessionLength).toBe(SESSION.DEFAULT_LENGTH)
      expect(settings.toJSON()).toEqual({
        tables: [6, 7],
        sessionLength: SESSION.DEFAULT_LENGTH,
        sound: "on",
      })
    })

    test("returns a new array each call", () => {
      const settings = new Settings()
      expect(settings.toJSON().tables).not.toBe(settings.toJSON().tables)
    })

    test("round-trips through the constructor", () => {
      const original = new Settings({ tables: [3, 8], sessionLength: 30, sound: "off" })
      const restored = new Settings(original.toJSON())
      expect(restored.toJSON()).toEqual(original.toJSON())
      expect(restored.factPool).toEqual(original.factPool)
    })

    test("round-trips every session length", () => {
      for (const sessionLength of SESSION.LENGTH_OPTIONS) {
        const original = new Settings({ tables: [2, 5, 9], sessionLength, sound: "off" })
        expect(new Settings(original.toJSON()).toJSON()).toEqual(original.toJSON())
      }
    })

    test("survives a round trip through JSON.stringify", () => {
      const original = new Settings({ tables: [6, 7], sessionLength: 10, sound: "off" })
      const json = JSON.parse(JSON.stringify(original.toJSON()))
      expect(new Settings(json).toJSON()).toEqual(original.toJSON())
    })
  })
})
