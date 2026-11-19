/**
 * Tests for Settings -- the session length.
 *
 * The constructor's input is treated as hostile throughout, because it comes
 * straight out of `localStorage`: session lengths that were never offered, and
 * keys that a save written by an earlier build could still carry.
 *
 * `tables`, `difficulty` and `customTables` are tested as RETIRED keys, not as
 * absent ones. A save from an earlier build is a real file on a real iPad, and
 * what it does on load -- get ignored without an error -- is behaviour worth
 * pinning rather than leaving to chance.
 */

import { describe, expect, test } from "@jest/globals"
import { Settings } from "../js/Settings.js"
import { SESSION } from "../js/constants.js"

/** A session length that is NOT in SESSION.LENGTH_OPTIONS, for rejection tests. */
const UNOFFERED_LENGTH = Math.max(...SESSION.LENGTH_OPTIONS) + 7

const RETIRED_KEYS = [
  "tables",
  "difficulty",
  "customTables",
  "inputMode",
  "scaffolds",
  "reducedMotion",
  "sound",
]

describe("Settings", () => {
  describe("defaults", () => {
    test("matches the documented defaults exactly", () => {
      expect(Settings.defaults()).toEqual({ sessionLength: SESSION.DEFAULT_LENGTH })
    })

    test("returns a fresh object each call", () => {
      const first = Settings.defaults()
      first.sessionLength = 30
      expect(Settings.defaults().sessionLength).toBe(SESSION.DEFAULT_LENGTH)
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

    test("reads the session length off a well-formed save", () => {
      expect(new Settings({ sessionLength: 30 }).toJSON()).toEqual({ sessionLength: 30 })
    })

    test("ignores unknown keys", () => {
      const settings = new Settings({ nope: 1, theme: "dark" })
      expect(settings.toJSON()).toEqual({ sessionLength: SESSION.DEFAULT_LENGTH })
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

    test("never mutates the raw object it was given", () => {
      const raw = { sessionLength: 30, tables: [9, 2] }
      new Settings(raw)
      expect(raw).toEqual({ sessionLength: 30, tables: [9, 2] })
    })
  })

  describe("retired settings", () => {
    // Real keys in shipped saves. `tables` is the newest to go: a trail uses all
    // of its own facts, so nothing reads it.
    test("an old save carrying them loads without error and keeps the live keys", () => {
      const raw = { tables: [6, 7], sessionLength: 20, sound: "off" }
      for (const key of RETIRED_KEYS) raw[key] = raw[key] ?? "x"
      expect(() => new Settings(raw)).not.toThrow()
      const json = new Settings(raw).toJSON()
      expect(json).toEqual({ sessionLength: 20 })
    })
  })

  describe("isValidKey", () => {
    test("accepts the real key", () => {
      expect(Settings.isValidKey("sessionLength")).toBe(true)
    })

    test("rejects every retired key", () => {
      for (const key of RETIRED_KEYS) {
        expect(Settings.isValidKey(key)).toBe(false)
      }
    })

    test("rejects unknown and non-string keys", () => {
      for (const key of ["", "SessionLength", "nope", null, undefined, 0, [], {}]) {
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
    test("sessionLength accepts exactly the offered options", () => {
      for (const length of SESSION.LENGTH_OPTIONS) {
        expect(Settings.validate("sessionLength", length)).toBe(true)
      }
      for (const length of [UNOFFERED_LENGTH, 0, -10, 20.5, "20", null, undefined, [20]]) {
        expect(Settings.validate("sessionLength", length)).toBe(false)
      }
    })

    test("any other key is invalid whatever the value", () => {
      for (const key of [...RETIRED_KEYS, "nope"]) {
        expect(Settings.validate(key, "on")).toBe(false)
        expect(Settings.validate(key, true)).toBe(false)
        expect(Settings.validate(key, [7])).toBe(false)
      }
    })
  })

  describe("sessionLength", () => {
    test("defaults to SESSION.DEFAULT_LENGTH", () => {
      expect(new Settings().sessionLength).toBe(SESSION.DEFAULT_LENGTH)
    })
  })

  describe("update", () => {
    test("rejects every retired and unknown key", () => {
      const settings = new Settings()
      const before = settings.toJSON()
      for (const key of [...RETIRED_KEYS, "nope", "", null, 7]) {
        expect(settings.update(key, "master")).toBe(false)
      }
      expect(settings.toJSON()).toEqual(before)
    })

    test("routes sessionLength through setSessionLength", () => {
      const settings = new Settings()
      expect(settings.update("sessionLength", 20)).toBe(true)
      expect(settings.sessionLength).toBe(20)

      expect(settings.update("sessionLength", UNOFFERED_LENGTH)).toBe(false)
      expect(settings.sessionLength).toBe(20)
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
      const settings = new Settings({ sessionLength: 20 })
      for (const length of [UNOFFERED_LENGTH, 0, -10, 20.5, "20", null, undefined, [20], NaN]) {
        expect(settings.setSessionLength(length)).toBe(false)
        expect(settings.sessionLength).toBe(20)
      }
    })
  })

  describe("toJSON", () => {
    test("has exactly the documented key", () => {
      const json = new Settings({ sessionLength: 30 }).toJSON()
      expect(Object.keys(json)).toEqual(["sessionLength"])
    })

    test("is a copy: mutating it does not reach the instance", () => {
      const settings = new Settings()
      const json = settings.toJSON()
      json.sessionLength = 30
      expect(settings.toJSON()).toEqual(Settings.defaults())
    })

    test("round-trips through the constructor and JSON.stringify", () => {
      for (const sessionLength of SESSION.LENGTH_OPTIONS) {
        const original = new Settings({ sessionLength })
        const json = JSON.parse(JSON.stringify(original.toJSON()))
        expect(new Settings(json).toJSON()).toEqual(original.toJSON())
      }
    })
  })
})
