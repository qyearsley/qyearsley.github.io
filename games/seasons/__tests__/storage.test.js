/**
 * Tests for the Seasons save shape and its persistence.
 *
 * The philosophy under test is that saved data is untrusted. Every field is
 * coerced back into range rather than rejected, unknown keys are dropped rather
 * than carried through, and neither `defaultSave` nor `normalizeSave` ever
 * throws whatever it is handed -- a save comes off a real device, and it may be
 * half-written, hand-edited, or from a build six months old. The game still has
 * to start.
 *
 * StorageManager is exercised against the real shared base class rather than a
 * mock, because "nothing in this file touches localStorage directly" is only
 * true if a save written through the base class reads back through it.
 */

import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { StorageManager as BaseStorageManager } from "../../shared/StorageManager.js"
import { CHARACTERS, DEFAULT_CHARACTER } from "../js/characters.js"
import { PHASE, SEASON_ORDER, STORAGE } from "../js/constants.js"
import { defaultSave, normalizeSave, StorageManager, toSavedRun } from "../js/storage.js"

/** The three keys a save always has, before the base class stamps its two. */
const SAVE_KEYS = ["run", "unlocked", "totals"]

/** Every key of a SavedRun, in no particular order. */
const RUN_KEYS = [
  "phase",
  "characterId",
  "seasonId",
  "seed",
  "position",
  "items",
  "wilting",
  "lost",
  "forgivenessLeft",
  "lastWasWrong",
  "streak",
  "bestStreak",
  "questionsAsked",
  "correctCount",
  "collected",
  "runOver",
]

/**
 * A save with every field set to something non-default, so a round trip that
 * drops or resets a field fails instead of matching by coincidence.
 * @returns {Object} A fully populated, already-valid save
 */
function populatedSave() {
  return {
    run: {
      phase: PHASE.TRAIL,
      characterId: "phoenix",
      seasonId: "autumn",
      seed: 987654,
      position: 7,
      items: 12,
      wilting: 1,
      lost: 2,
      forgivenessLeft: 1,
      lastWasWrong: true,
      streak: 4,
      bestStreak: 9,
      questionsAsked: 20,
      correctCount: 16,
      collected: { spring: 11, summer: 15 },
      runOver: false,
    },
    unlocked: ["spring", "summer", "autumn"],
    totals: {
      runsCompleted: 3,
      seasonsCleared: 7,
      questionsAnswered: 210,
      questionsCorrect: 190,
    },
  }
}

/**
 * Write a payload straight to localStorage, bypassing saveRun, so a test can
 * plant data that saveRun would have cleaned up on the way in.
 * @param {Object|string} payload - Object to stringify, or a raw string
 * @returns {void}
 */
function writeRaw(payload) {
  const value = typeof payload === "string" ? payload : JSON.stringify(payload)
  localStorage.setItem(STORAGE.KEY, value)
}

/**
 * Build an object nested `depth` levels deep, to check nothing recurses.
 * @param {number} depth - How many levels to nest
 * @returns {Object} The outermost object
 */
function deeplyNested(depth) {
  let node = { end: true }
  for (let i = 0; i < depth; i += 1) node = { run: node, nested: node }
  return node
}

let manager
let consoleErrorSpy

beforeEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  manager = new StorageManager()
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
})

describe("defaultSave", () => {
  it("has exactly the three documented keys", () => {
    expect(Object.keys(defaultSave()).sort()).toEqual([...SAVE_KEYS].sort())
  })

  it("returns the documented defaults", () => {
    expect(defaultSave()).toEqual({
      run: {
        phase: PHASE.CHARACTER_SELECT,
        characterId: DEFAULT_CHARACTER.id,
        seasonId: null,
        seed: 1,
        position: 0,
        items: 0,
        wilting: 0,
        lost: 0,
        forgivenessLeft: 0,
        lastWasWrong: false,
        streak: 0,
        bestStreak: 0,
        questionsAsked: 0,
        correctCount: 0,
        collected: {},
        runOver: false,
      },
      unlocked: [SEASON_ORDER[0]],
      totals: {
        runsCompleted: 0,
        seasonsCleared: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
      },
    })
  })

  it("starts on the character select phase with no season chosen", () => {
    const { run } = defaultSave()
    expect(run.phase).toBe(PHASE.CHARACTER_SELECT)
    expect(run.seasonId).toBeNull()
    expect(run.runOver).toBe(false)
  })

  it("unlocks only the first season", () => {
    expect(defaultSave().unlocked).toEqual(["spring"])
  })

  it("has no version or lastPlayed (the base class writes those)", () => {
    const save = defaultSave()
    expect("version" in save).toBe(false)
    expect("lastPlayed" in save).toBe(false)
  })

  it("returns a fresh, independent object each call", () => {
    const first = defaultSave()
    const second = defaultSave()
    expect(first).not.toBe(second)
    expect(first.run).not.toBe(second.run)
    expect(first.run.collected).not.toBe(second.run.collected)
    expect(first.unlocked).not.toBe(second.unlocked)
    expect(first.totals).not.toBe(second.totals)

    first.run.items = 99
    first.run.collected.spring = 5
    first.unlocked.push("winter")
    first.totals.runsCompleted = 7
    expect(second.run.items).toBe(0)
    expect(second.run.collected).toEqual({})
    expect(second.unlocked).toEqual(["spring"])
    expect(second.totals.runsCompleted).toBe(0)
  })

  it("is already normalized", () => {
    expect(normalizeSave(defaultSave())).toEqual(defaultSave())
  })
})

describe("normalizeSave", () => {
  describe("hostile input", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["zero", 0],
      ["an empty string", ""],
      ["a string", "a string"],
      ["an empty array", []],
      ["a populated array", [1, 2, 3]],
      ["true", true],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["a function", () => 1],
      ["a Date", new Date(0)],
    ])("returns the default save for %s", (_label, input) => {
      expect(() => normalizeSave(input)).not.toThrow()
      expect(normalizeSave(input)).toEqual(defaultSave())
    })

    it.each([
      ["every key wrong", { run: 1, unlocked: 2, totals: 3 }],
      ["run as an array", { run: [] }],
      ["run as a string", { run: "trail" }],
      ["unlocked as an object", { unlocked: {} }],
      ["totals as an array", { totals: [] }],
      ["collected as a string", { run: { collected: "spring" } }],
      ["undefined values", { run: undefined, unlocked: undefined, totals: undefined }],
      ["a huge counter", { totals: { questionsAnswered: Number.MAX_SAFE_INTEGER } }],
      ["deeply nested junk", deeplyNested(50)],
    ])("never throws for %s", (_label, input) => {
      expect(() => normalizeSave(input)).not.toThrow()
      expect(Object.keys(normalizeSave(input)).sort()).toEqual([...SAVE_KEYS].sort())
    })

    it("never throws for a payload carrying prototype pollution keys", () => {
      // JSON.parse makes __proto__ an *own* property, which is exactly how such
      // a payload arrives from localStorage.
      const raw = JSON.parse(
        '{"__proto__": {"polluted": true}, "run": {"collected": {"__proto__": 5, "spring": 2}}}',
      )
      expect(() => normalizeSave(raw)).not.toThrow()
      const save = normalizeSave(raw)
      expect(Object.keys(save).sort()).toEqual([...SAVE_KEYS].sort())
      expect(save.run.collected).toEqual({ spring: 2 })
      expect({}.polluted).toBeUndefined()
      expect(Object.prototype.polluted).toBeUndefined()
    })

    it("does not carry a constructor key through", () => {
      const raw = JSON.parse('{"constructor": {"prototype": {"x": 1}}, "run": {}}')
      expect(Object.keys(normalizeSave(raw)).sort()).toEqual([...SAVE_KEYS].sort())
    })

    it("does not mutate its input", () => {
      const raw = {
        run: { position: -3, streak: 9, bestStreak: 1, collected: { spring: -2, bogus: 4 } },
        unlocked: ["winter", "made-up"],
        totals: { questionsAnswered: 2, questionsCorrect: 99 },
        highScore: 42,
      }
      const before = JSON.parse(JSON.stringify(raw))
      normalizeSave(raw)
      expect(raw).toEqual(before)
    })

    it("returns a fresh object rather than the input", () => {
      const raw = populatedSave()
      const save = normalizeSave(raw)
      expect(save).not.toBe(raw)
      expect(save.run).not.toBe(raw.run)
      expect(save.run.collected).not.toBe(raw.run.collected)
      expect(save.unlocked).not.toBe(raw.unlocked)
      expect(save.totals).not.toBe(raw.totals)
    })
  })

  describe("top-level keys", () => {
    it("drops unknown keys", () => {
      const save = normalizeSave({
        run: {},
        unlocked: [],
        totals: {},
        highScore: 42,
        mode: "quick",
        settings: { sound: "off" },
      })
      expect(Object.keys(save).sort()).toEqual([...SAVE_KEYS].sort())
    })

    it("adds missing keys at their defaults", () => {
      const save = normalizeSave({ totals: { runsCompleted: 3 } })
      expect(save.run).toEqual(defaultSave().run)
      expect(save.unlocked).toEqual(["spring"])
      expect(save.totals.runsCompleted).toBe(3)
    })

    it("carries version and lastPlayed through only when present", () => {
      const bare = normalizeSave({ run: {} })
      expect("version" in bare).toBe(false)
      expect("lastPlayed" in bare).toBe(false)

      const stamped = normalizeSave({ run: {}, version: "1.0", lastPlayed: 42 })
      expect(stamped.version).toBe("1.0")
      expect(stamped.lastPlayed).toBe(42)
      expect(Object.keys(stamped).sort()).toEqual([...SAVE_KEYS, "lastPlayed", "version"].sort())
    })

    it("carries a present-but-undefined version through rather than inventing one", () => {
      const save = normalizeSave({ run: {}, version: undefined })
      expect("version" in save).toBe(true)
      expect(save.version).toBeUndefined()
    })

    it("is idempotent", () => {
      const once = normalizeSave(populatedSave())
      expect(normalizeSave(once)).toEqual(once)
    })

    it("preserves a fully populated save unchanged", () => {
      expect(normalizeSave(populatedSave())).toEqual(populatedSave())
    })
  })

  describe("run coercion", () => {
    it("always returns exactly the SavedRun keys", () => {
      expect(Object.keys(normalizeSave({ run: {} }).run).sort()).toEqual([...RUN_KEYS].sort())
    })

    it("clamps negative counters to zero", () => {
      const { run } = normalizeSave({
        run: {
          position: -5,
          items: -1,
          wilting: -2,
          lost: -3,
          forgivenessLeft: -4,
          streak: -6,
          bestStreak: -7,
          questionsAsked: -8,
          correctCount: -9,
        },
      })
      expect(run).toMatchObject({
        position: 0,
        items: 0,
        wilting: 0,
        lost: 0,
        forgivenessLeft: 0,
        streak: 0,
        bestStreak: 0,
        questionsAsked: 0,
        correctCount: 0,
      })
    })

    it.each([
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["-Infinity", -Infinity],
      ["a string", "12"],
      ["null", null],
      ["undefined", undefined],
      ["an object", {}],
    ])("reads a non-finite %s counter as zero", (_label, value) => {
      expect(normalizeSave({ run: { position: value } }).run.position).toBe(0)
    })

    it("floors fractional counters", () => {
      const { run } = normalizeSave({ run: { position: 3.7, items: 9.99, questionsAsked: 2.5 } })
      expect(run.position).toBe(3)
      expect(run.items).toBe(9)
      expect(run.questionsAsked).toBe(2)
    })

    it.each([
      ["an unknown phase", "dancing"],
      ["a numeric phase", 3],
      ["a null phase", null],
      ["an empty phase", ""],
    ])("falls back to CHARACTER_SELECT for %s", (_label, phase) => {
      expect(normalizeSave({ run: { phase } }).run.phase).toBe(PHASE.CHARACTER_SELECT)
    })

    it.each(Object.values(PHASE))("keeps the valid phase %s", (phase) => {
      expect(normalizeSave({ run: { phase } }).run.phase).toBe(phase)
    })

    it.each([
      ["an unknown character", "unicorn"],
      ["a numeric character", 1],
      ["a null character", null],
    ])("falls back to the default character for %s", (_label, characterId) => {
      expect(normalizeSave({ run: { characterId } }).run.characterId).toBe(DEFAULT_CHARACTER.id)
    })

    it.each(CHARACTERS.map((character) => character.id))("keeps the valid character %s", (id) => {
      expect(normalizeSave({ run: { characterId: id } }).run.characterId).toBe(id)
    })

    it.each([
      ["an unknown season", "monsoon"],
      ["a numeric season", 2],
      ["an empty season", ""],
    ])("reads %s as no season at all", (_label, seasonId) => {
      expect(normalizeSave({ run: { seasonId } }).run.seasonId).toBeNull()
    })

    it.each(SEASON_ORDER)("keeps the valid season %s", (id) => {
      expect(normalizeSave({ run: { seasonId: id } }).run.seasonId).toBe(id)
    })

    it("never lets bestStreak sit below streak", () => {
      expect(normalizeSave({ run: { streak: 9, bestStreak: 1 } }).run).toMatchObject({
        streak: 9,
        bestStreak: 9,
      })
      expect(normalizeSave({ run: { streak: 2, bestStreak: 11 } }).run).toMatchObject({
        streak: 2,
        bestStreak: 11,
      })
      expect(normalizeSave({ run: { streak: 4 } }).run.bestStreak).toBe(4)
    })

    it("never lets correctCount exceed questionsAsked", () => {
      expect(normalizeSave({ run: { questionsAsked: 3, correctCount: 99 } }).run).toMatchObject({
        questionsAsked: 3,
        correctCount: 3,
      })
      expect(normalizeSave({ run: { questionsAsked: 10, correctCount: 4 } }).run).toMatchObject({
        questionsAsked: 10,
        correctCount: 4,
      })
      expect(normalizeSave({ run: { correctCount: 5 } }).run.correctCount).toBe(0)
    })

    it.each([
      ["1", 1],
      ["a non-empty string", "yes"],
      ["an object", {}],
      ["an array", []],
      ["'true'", "true"],
    ])("reads a merely truthy %s as false for runOver and lastWasWrong", (_label, value) => {
      const { run } = normalizeSave({ run: { runOver: value, lastWasWrong: value } })
      expect(run.runOver).toBe(false)
      expect(run.lastWasWrong).toBe(false)
    })

    it("keeps a strictly true runOver and lastWasWrong", () => {
      const { run } = normalizeSave({ run: { runOver: true, lastWasWrong: true } })
      expect(run.runOver).toBe(true)
      expect(run.lastWasWrong).toBe(true)
    })

    it.each([
      ["zero", 0],
      ["a negative seed", -12],
      ["NaN", NaN],
      ["a string", "42"],
      ["undefined", undefined],
      ["a fraction below one", 0.4],
    ])("replaces a %s seed with 1", (_label, seed) => {
      expect(normalizeSave({ run: { seed } }).run.seed).toBe(1)
    })

    it("keeps a usable seed", () => {
      expect(normalizeSave({ run: { seed: 987654 } }).run.seed).toBe(987654)
      expect(normalizeSave({ run: { seed: 12.9 } }).run.seed).toBe(12)
    })

    it("does not clamp position to the season length", () => {
      // Journey.normalizePosition is the semantic authority; this layer is
      // structural only.
      expect(normalizeSave({ run: { seasonId: "spring", position: 500 } }).run.position).toBe(500)
    })
  })

  describe("collected", () => {
    it("keeps only known season ids", () => {
      const { run } = normalizeSave({
        run: { collected: { spring: 4, winter: 2, monsoon: 9, "": 1 } },
      })
      expect(run.collected).toEqual({ spring: 4, winter: 2 })
    })

    it("coerces the counts", () => {
      const { run } = normalizeSave({
        run: { collected: { spring: -3, summer: 4.8, autumn: "7", winter: NaN } },
      })
      expect(run.collected).toEqual({ spring: 0, summer: 4, autumn: 0, winter: 0 })
    })

    it.each([
      ["missing", undefined],
      ["null", null],
      ["an array", []],
      ["a number", 5],
      ["a string", "spring"],
    ])("returns an empty map when collected is %s", (_label, collected) => {
      expect(normalizeSave({ run: { collected } }).run.collected).toEqual({})
    })
  })

  describe("unlocked", () => {
    it.each([
      ["missing", undefined],
      ["null", null],
      ["empty", []],
      ["an object", {}],
      ["a string", "winter"],
      ["a number", 3],
      ["all unknown ids", ["monsoon", "dry-season"]],
    ])("always contains the first season when the input is %s", (_label, unlocked) => {
      expect(normalizeSave({ unlocked }).unlocked).toEqual(["spring"])
    })

    it("drops unknown ids", () => {
      expect(normalizeSave({ unlocked: ["summer", "monsoon", 7, null] }).unlocked).toEqual([
        "spring",
        "summer",
      ])
    })

    it("deduplicates", () => {
      expect(
        normalizeSave({ unlocked: ["summer", "summer", "spring", "summer"] }).unlocked,
      ).toEqual(["spring", "summer"])
    })

    it("returns play order regardless of input order", () => {
      const reversed = [...SEASON_ORDER].reverse()
      expect(normalizeSave({ unlocked: reversed }).unlocked).toEqual([...SEASON_ORDER])
      expect(normalizeSave({ unlocked: ["winter", "summer"] }).unlocked).toEqual([
        "spring",
        "summer",
        "winter",
      ])
    })
  })

  describe("totals", () => {
    it("clamps to non-negative integers", () => {
      const { totals } = normalizeSave({
        totals: { runsCompleted: -1, seasonsCleared: 2.9, questionsAnswered: "x" },
      })
      expect(totals.runsCompleted).toBe(0)
      expect(totals.seasonsCleared).toBe(2)
      expect(totals.questionsAnswered).toBe(0)
    })

    it("never lets questionsCorrect exceed questionsAnswered", () => {
      const { totals } = normalizeSave({
        totals: { questionsAnswered: 5, questionsCorrect: 500 },
      })
      expect(totals).toMatchObject({ questionsAnswered: 5, questionsCorrect: 5 })
    })

    it("drops unknown totals", () => {
      const { totals } = normalizeSave({ totals: { secondsPlayed: 900, runsCompleted: 1 } })
      expect("secondsPlayed" in totals).toBe(false)
      expect(Object.keys(totals).sort()).toEqual([
        "questionsAnswered",
        "questionsCorrect",
        "runsCompleted",
        "seasonsCleared",
      ])
    })
  })
})

describe("toSavedRun", () => {
  it("drops a live state's question field", () => {
    const state = {
      ...populatedSave().run,
      question: { prompt: "6 x 7", answer: 42, choices: [42, 40, 48, 36] },
    }
    const saved = toSavedRun(state)
    expect("question" in saved).toBe(false)
    expect(Object.keys(saved).sort()).toEqual([...RUN_KEYS].sort())
  })

  it("returns a valid run that survives normalization unchanged", () => {
    const saved = toSavedRun({ ...populatedSave().run, question: { prompt: "1+1" } })
    expect(saved).toEqual(populatedSave().run)
    expect(normalizeSave({ run: saved }).run).toEqual(saved)
  })

  it("drops any other field the live state carries", () => {
    const saved = toSavedRun({ phase: PHASE.TRAIL, timerId: 7, ui: { shaking: true } })
    expect(Object.keys(saved).sort()).toEqual([...RUN_KEYS].sort())
    expect(saved.phase).toBe(PHASE.TRAIL)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "trail"],
  ])("returns the default run for %s", (_label, state) => {
    expect(toSavedRun(state)).toEqual(defaultSave().run)
  })

  it("does not alias the live state's collected map", () => {
    const state = { ...populatedSave().run }
    const saved = toSavedRun(state)
    expect(saved.collected).not.toBe(state.collected)
  })
})

describe("StorageManager", () => {
  it("uses the Seasons key and version", () => {
    expect(manager.gameKey).toBe(STORAGE.KEY)
    expect(manager.version).toBe(STORAGE.VERSION)
    expect(manager.gameKey).toBe("seasonsProgress")
  })

  it("extends the shared base class", () => {
    expect(manager).toBeInstanceOf(BaseStorageManager)
    expect(manager).toBeInstanceOf(StorageManager)
  })

  describe("saveRun", () => {
    it("returns true and stamps version and lastPlayed", () => {
      expect(manager.saveRun(populatedSave())).toBe(true)
      const stored = JSON.parse(localStorage.getItem(STORAGE.KEY))
      expect(stored.version).toBe(STORAGE.VERSION)
      expect(stored.lastPlayed).toBeGreaterThan(0)
    })

    it("normalizes on the way in", () => {
      expect(manager.saveRun({ run: { runOver: 1, streak: 9, bestStreak: 0 }, highScore: 5 })).toBe(
        true,
      )
      const stored = JSON.parse(localStorage.getItem(STORAGE.KEY))
      expect(stored.run.runOver).toBe(false)
      expect(stored.run.bestStreak).toBe(9)
      expect("highScore" in stored).toBe(false)
    })

    it("writes a default save for null rather than garbage", () => {
      expect(manager.saveRun(null)).toBe(true)
      expect(JSON.parse(localStorage.getItem(STORAGE.KEY))).toMatchObject(defaultSave())
    })

    it("returns false when localStorage refuses the write", () => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = () => {
        throw new Error("quota exceeded")
      }
      try {
        expect(manager.saveRun(defaultSave())).toBe(false)
      } finally {
        Storage.prototype.setItem = original
      }
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe("loadRun", () => {
    it("returns null when nothing is stored", () => {
      expect(manager.loadRun()).toBeNull()
      expect(manager.hasGameState()).toBe(false)
    })

    it("round-trips a fully populated save, preserving every field", () => {
      const save = populatedSave()
      expect(manager.saveRun(save)).toBe(true)

      const loaded = manager.loadRun()
      expect(loaded).not.toBeNull()
      expect(loaded).toEqual({
        ...save,
        version: STORAGE.VERSION,
        lastPlayed: loaded.lastPlayed,
      })
      expect(loaded.lastPlayed).toBeGreaterThan(0)
      expect(normalizeSave(loaded)).toEqual(loaded)
    })

    it("round-trips a mutated default save", () => {
      const save = defaultSave()
      save.run.phase = PHASE.BOSS
      save.run.characterId = "sloth"
      save.run.seasonId = "summer"
      save.run.position = 15
      save.run.items = 13
      save.run.collected.spring = 11
      save.unlocked = ["spring", "summer"]
      save.totals.runsCompleted = 1

      manager.saveRun(save)
      expect(manager.loadRun()).toMatchObject(save)
    })

    it("normalizes a hostile payload written straight to localStorage", () => {
      writeRaw({
        run: { runOver: 1, streak: 8, bestStreak: 2, collected: { spring: -4, monsoon: 3 } },
        unlocked: ["winter", "winter", "monsoon"],
        totals: { questionsAnswered: 2, questionsCorrect: 88 },
        highScore: 9,
        version: STORAGE.VERSION,
      })
      const loaded = manager.loadRun()
      expect(loaded.run.runOver).toBe(false)
      expect(loaded.run.bestStreak).toBe(8)
      expect(loaded.run.collected).toEqual({ spring: 0 })
      expect(loaded.unlocked).toEqual(["spring", "winter"])
      expect(loaded.totals.questionsCorrect).toBe(2)
      expect("highScore" in loaded).toBe(false)
    })

    it.each([
      ["run is missing", { unlocked: [], totals: {} }],
      ["run is null", { run: null }],
      ["run is an array", { run: [] }],
      ["run is a string", { run: "trail" }],
      ["run is a number", { run: 3 }],
    ])("returns null and logs when %s", (_label, payload) => {
      writeRaw({ ...payload, version: STORAGE.VERSION })
      expect(manager.loadRun()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it("does not clear the key when the payload merely lacks a run", () => {
      // Nothing was written by this build, but nothing is provably stale
      // either; only a version mismatch justifies deleting the save.
      writeRaw({ unlocked: [], totals: {}, version: STORAGE.VERSION })
      expect(manager.loadRun()).toBeNull()
      expect(localStorage.getItem(STORAGE.KEY)).not.toBeNull()
    })

    it("clears the key and returns null on a version mismatch", () => {
      writeRaw({ run: {}, version: "0.9" })
      expect(manager.loadRun()).toBeNull()
      expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it("returns null when the version is missing entirely", () => {
      writeRaw({ run: {} })
      expect(manager.loadRun()).toBeNull()
      expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
    })

    it("returns null for corrupt JSON without throwing", () => {
      writeRaw("not json {")
      expect(() => manager.loadRun()).not.toThrow()
      expect(manager.loadRun()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe("clearRun", () => {
    it("removes the key and returns true", () => {
      manager.saveRun(defaultSave())
      expect(localStorage.getItem(STORAGE.KEY)).not.toBeNull()
      expect(manager.clearRun()).toBe(true)
      expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
      expect(manager.loadRun()).toBeNull()
    })

    it("returns true when nothing was stored", () => {
      expect(manager.clearRun()).toBe(true)
    })

    it("leaves hasGameState false", () => {
      manager.saveRun(defaultSave())
      expect(manager.hasGameState()).toBe(true)
      manager.clearRun()
      expect(manager.hasGameState()).toBe(false)
    })
  })

  describe("delegation to the base class", () => {
    it("writes under the same key the base class reads", () => {
      // storage.js never calls localStorage itself; if it did, a plain base
      // manager on the same key and version could not read what it wrote.
      const base = new BaseStorageManager(STORAGE.KEY, STORAGE.VERSION)
      manager.saveRun(populatedSave())
      expect(base.loadGameState()).toMatchObject(populatedSave())
    })

    it("reads what the base class wrote", () => {
      const base = new BaseStorageManager(STORAGE.KEY, STORAGE.VERSION)
      expect(base.saveGameState(populatedSave())).toBe(true)
      expect(manager.loadRun()).toMatchObject(populatedSave())
    })

    it("defines no bespoke import or export wrapper", () => {
      expect(typeof manager.exportGameState).toBe("function")
      expect(typeof manager.importGameState).toBe("function")
      expect(manager.exportRun).toBeUndefined()
      expect(manager.importRun).toBeUndefined()
    })
  })
})
