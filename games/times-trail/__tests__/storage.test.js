import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals"
import { StorageManager as BaseStorageManager } from "../../shared/StorageManager.js"
import { GEM_MILESTONES, STORAGE, TRAIL } from "../js/constants.js"
// storage.js must never import Scoring; the test must, because the duplicated
// Daily literal is the whole risk. This is the only cross-check of the two.
import { Scoring } from "../js/Scoring.js"
import { defaultProgress, normalizeProgress, StorageManager } from "../js/storage.js"

/** The six keys a save state always has, in no particular order. */
const SAVE_STATE_KEYS = ["facts", "totals", "trail", "daily", "settings", "awardedMilestoneIds"]

/**
 * A save state with every field set to something non-default, so a round trip
 * that drops or resets a field fails instead of matching by coincidence.
 * @returns {Object} A fully populated save state
 */
function populatedState() {
  return {
    facts: {
      "6x7": {
        strength: 4,
        totalSeen: 9,
        totalCorrect: 7,
        lastSeen: 1700000000000,
        lastMs: 2400,
        dueAt: 1700604800000,
      },
      "9x9": {
        strength: 1,
        totalSeen: 3,
        totalCorrect: 1,
        lastSeen: 1699999999999,
        lastMs: 7200,
        dueAt: 1700000600000,
      },
    },
    totals: {
      starsTotal: 1234,
      gemsTotal: 5,
      factsAnswered: 200,
      factsCorrect: 180,
      sessionsCompleted: 11,
    },
    trail: { space: 17 },
    daily: {
      todayDate: "2026-08-26",
      factsToday: 12,
      goalMetToday: false,
      lastGoalDate: "2026-08-25",
      streakDays: 4,
      bestStreakDays: 9,
      flameDimmed: true,
    },
    settings: { difficulty: "master", customTables: [6, 7], sound: "off" },
    awardedMilestoneIds: ["facts-10", "facts-25", "mastered-5"],
  }
}

/**
 * Write a payload straight to localStorage, bypassing saveProgress, so a test
 * can plant data that saveProgress would have cleaned up.
 * @param {Object|string} payload - Object to stringify, or a raw string
 * @returns {void}
 */
function writeRaw(payload) {
  const value = typeof payload === "string" ? payload : JSON.stringify(payload)
  localStorage.setItem(STORAGE.KEY, value)
}

let manager
let consoleErrorSpy
let consoleWarnSpy

beforeEach(() => {
  localStorage.clear()
  manager = new StorageManager()
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
  consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
})

afterEach(() => {
  localStorage.clear()
  consoleErrorSpy.mockRestore()
  consoleWarnSpy.mockRestore()
})

describe("save state shape", () => {
  describe("defaultProgress", () => {
    test("has exactly the six documented keys", () => {
      expect(Object.keys(defaultProgress()).sort()).toEqual([...SAVE_STATE_KEYS].sort())
    })

    test("returns the documented defaults", () => {
      expect(defaultProgress()).toEqual({
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
      })
    })

    test("totals has no secondsPracticed key", () => {
      expect("secondsPracticed" in defaultProgress().totals).toBe(false)
    })

    test("trail has no lapsCompleted key", () => {
      const { trail } = defaultProgress()
      expect(trail).toEqual({ space: 0 })
      expect("lapsCompleted" in trail).toBe(false)
    })

    test("daily deep-equals Scoring.createDaily", () => {
      // The load-bearing cross-check: storage.js duplicates this literal because
      // it cannot import Scoring. If a field is added to Daily in one file only,
      // this is what fails.
      expect(defaultProgress().daily).toEqual(Scoring.createDaily())
      expect(Object.keys(defaultProgress().daily).sort()).toEqual(
        Object.keys(Scoring.createDaily()).sort(),
      )
    })

    test("has no cosmetics keys", () => {
      const state = defaultProgress()
      expect("unlockedCosmeticIds" in state).toBe(false)
      expect("activeCosmetics" in state).toBe(false)
    })

    test("returns a fresh, independent object each call", () => {
      const first = defaultProgress()
      const second = defaultProgress()
      expect(first).not.toBe(second)
      expect(first.facts).not.toBe(second.facts)

      first.facts["6x7"] = { strength: 5 }
      first.totals.starsTotal = 99
      first.awardedMilestoneIds.push("facts-10")
      expect(second.facts).toEqual({})
      expect(second.totals.starsTotal).toBe(0)
      expect(second.awardedMilestoneIds).toEqual([])
    })

    test("has no version or lastPlayed (the base class writes those)", () => {
      const state = defaultProgress()
      expect("version" in state).toBe(false)
      expect("lastPlayed" in state).toBe(false)
    })
  })

  describe("normalizeProgress", () => {
    test.each([
      ["null", null],
      ["undefined", undefined],
      ["a string", "x"],
      ["an array", []],
      ["a number", 7],
      ["a boolean", true],
      ["a function", () => 1],
    ])("returns defaults for %s", (_label, input) => {
      expect(normalizeProgress(input)).toEqual(defaultProgress())
    })

    test.each([
      ["a populated array", [1, 2, 3]],
      ["NaN", NaN],
      ["facts as an array", { facts: [], totals: {} }],
      ["facts as a string", { facts: "6x7", totals: {} }],
      ["totals as an array", { facts: {}, totals: [] }],
      ["a null record", { facts: { "6x7": null }, totals: {} }],
      ["a numeric record", { facts: { "6x7": 42 }, totals: {} }],
      ["trail as a string", { trail: "far" }],
      ["daily as an array", { daily: [] }],
      ["settings as a number", { settings: 7 }],
      ["awardedMilestoneIds as an object", { awardedMilestoneIds: {} }],
      ["deeply nested junk", { facts: { "6x7": { strength: {} } }, totals: { starsTotal: [] } }],
      ["every key wrong", { facts: 1, totals: 2, trail: 3, daily: 4, settings: 5 }],
      ["symbols and undefined values", { facts: undefined, totals: undefined }],
      ["a huge payload", { totals: { starsTotal: Number.MAX_SAFE_INTEGER } }],
    ])("never throws for %s", (_label, input) => {
      expect(() => normalizeProgress(input)).not.toThrow()
      expect(Object.keys(normalizeProgress(input)).sort()).toEqual([...SAVE_STATE_KEYS].sort())
    })

    test("does not mutate its input", () => {
      const raw = {
        facts: { "8x7": { strength: 3 }, "6x7": { strength: 99 } },
        totals: { starsTotal: -5, factsAnswered: 3, factsCorrect: 10, secondsPracticed: 900 },
        trail: { space: 500, lapsCompleted: 4 },
        daily: { streakDays: 9, bestStreakDays: 1, secondsToday: 500 },
        settings: { inputMode: "keypad" },
        awardedMilestoneIds: ["facts-25", "made-up"],
      }
      const before = JSON.parse(JSON.stringify(raw))
      normalizeProgress(raw)
      expect(raw).toEqual(before)
    })

    test("drops non-canonical and unknown fact ids", () => {
      const state = normalizeProgress({
        facts: {
          "6x7": { strength: 3 },
          "8x7": { strength: 3 },
          "1x1": { strength: 3 },
          "10x2": { strength: 3 },
          "7X8": { strength: 3 },
          nonsense: { strength: 3 },
          "": { strength: 3 },
        },
        totals: {},
      })
      expect(Object.keys(state.facts)).toEqual(["6x7"])
    })

    test("keeps a canonical square id", () => {
      expect(Object.keys(normalizeProgress({ facts: { "7x7": {} } }).facts)).toEqual(["7x7"])
    })

    test("runs each fact value through normalizeRecord", () => {
      const state = normalizeProgress({ facts: { "6x7": { strength: 99 } } })
      expect(state.facts["6x7"].strength).toBe(5)
      expect(state.facts["6x7"]).toEqual({
        strength: 5,
        totalSeen: 0,
        totalCorrect: 0,
        lastSeen: null,
        lastMs: null,
        dueAt: null,
      })
    })

    test("replaces a null record with a default record", () => {
      const state = normalizeProgress({ facts: { "6x7": null, "2x2": "nope" } })
      expect(state.facts["6x7"].strength).toBe(0)
      expect(state.facts["2x2"].totalSeen).toBe(0)
    })

    test("clamps totals to non-negative integers", () => {
      const state = normalizeProgress({
        totals: { starsTotal: -5, factsAnswered: 3, factsCorrect: 10 },
      })
      expect(state.totals.starsTotal).toBe(0)
      expect(state.totals.factsAnswered).toBe(3)
      expect(state.totals.factsCorrect).toBe(3)
    })

    test("floors fractional totals", () => {
      expect(normalizeProgress({ totals: { starsTotal: 1.9 } }).totals.starsTotal).toBe(1)
    })

    test("drops secondsPracticed from totals", () => {
      const state = normalizeProgress({ totals: { secondsPracticed: 900, starsTotal: 4 } })
      expect("secondsPracticed" in state.totals).toBe(false)
      expect(state.totals.starsTotal).toBe(4)
    })

    test("clamps trail.space into range", () => {
      expect(normalizeProgress({ trail: { space: 500 } }).trail.space).toBe(TRAIL.TOTAL_SPACES - 1)
      expect(normalizeProgress({ trail: { space: -5 } }).trail.space).toBe(0)
      expect(normalizeProgress({ trail: { space: "x" } }).trail.space).toBe(0)
      expect(normalizeProgress({ trail: { space: 3.7 } }).trail.space).toBe(3)
    })

    test("drops lapsCompleted from trail", () => {
      const { trail } = normalizeProgress({ trail: { space: 7, lapsCompleted: 4 } })
      expect(trail).toEqual({ space: 7 })
      expect("lapsCompleted" in trail).toBe(false)
    })

    test("coerces daily fields", () => {
      const { daily } = normalizeProgress({
        daily: { todayDate: 123, streakDays: -1, goalMetToday: 1, lastGoalDate: "2026-8-1" },
      })
      expect(daily.todayDate).toBeNull()
      expect(daily.streakDays).toBe(0)
      expect(daily.goalMetToday).toBe(false)
      expect(daily.lastGoalDate).toBeNull()
    })

    test("keeps well-formed date keys", () => {
      const { daily } = normalizeProgress({
        daily: { todayDate: "2026-08-26", lastGoalDate: "2026-08-25" },
      })
      expect(daily.todayDate).toBe("2026-08-26")
      expect(daily.lastGoalDate).toBe("2026-08-25")
    })

    test("raises bestStreakDays to at least streakDays", () => {
      expect(
        normalizeProgress({ daily: { streakDays: 9, bestStreakDays: 1 } }).daily,
      ).toMatchObject({ streakDays: 9, bestStreakDays: 9 })
    })

    test("drops secondsToday from daily", () => {
      const { daily } = normalizeProgress({ daily: { secondsToday: 500 } })
      expect("secondsToday" in daily).toBe(false)
      expect(Object.keys(daily).sort()).toEqual(Object.keys(Scoring.createDaily()).sort())
    })

    test("filters and deduplicates awardedMilestoneIds", () => {
      expect(
        normalizeProgress({ awardedMilestoneIds: ["facts-25", "facts-25", "made-up", 7] })
          .awardedMilestoneIds,
      ).toEqual(["facts-25"])
    })

    test("drops ids from milestones that no longer exist", () => {
      expect(
        normalizeProgress({
          awardedMilestoneIds: ["first-steps", "regions-8", "facts-250", "facts-10"],
        }).awardedMilestoneIds,
      ).toEqual(["facts-10"])
    })

    test("keeps every current milestone id in input order", () => {
      const ids = GEM_MILESTONES.map((milestone) => milestone.id)
      const reversed = [...ids].reverse()
      expect(normalizeProgress({ awardedMilestoneIds: reversed }).awardedMilestoneIds).toEqual(
        reversed,
      )
    })

    test("passes settings through structurally", () => {
      expect(normalizeProgress({ settings: [] }).settings).toEqual({})
      expect(normalizeProgress({ settings: { difficulty: "master" } }).settings).toEqual({
        difficulty: "master",
      })
      // Structural only: Settings drops the legacy key later.
      expect(normalizeProgress({ settings: { inputMode: "keypad" } }).settings).toEqual({
        inputMode: "keypad",
      })
    })

    test("drops cosmetics keys from a legacy payload", () => {
      const state = normalizeProgress({
        facts: {},
        totals: {},
        unlockedCosmeticIds: ["fox"],
        activeCosmetics: { token: "fox" },
      })
      expect("unlockedCosmeticIds" in state).toBe(false)
      expect("activeCosmetics" in state).toBe(false)
    })

    test("drops unknown top-level keys", () => {
      const state = normalizeProgress({ facts: {}, totals: {}, highScore: 42, mode: "quick" })
      expect(Object.keys(state).sort()).toEqual([...SAVE_STATE_KEYS].sort())
    })

    test("adds missing top-level keys at their defaults", () => {
      const state = normalizeProgress({ totals: { starsTotal: 3 } })
      expect(state.facts).toEqual({})
      expect(state.trail).toEqual({ space: 0 })
      expect(state.daily).toEqual(Scoring.createDaily())
      expect(state.settings).toEqual({})
      expect(state.awardedMilestoneIds).toEqual([])
      expect(state.totals.starsTotal).toBe(3)
    })

    test("carries version and lastPlayed through only when present", () => {
      const bare = normalizeProgress({ facts: {}, totals: {} })
      expect("version" in bare).toBe(false)
      expect("lastPlayed" in bare).toBe(false)

      const stamped = normalizeProgress({ facts: {}, totals: {}, version: "1.0", lastPlayed: 42 })
      expect(stamped.version).toBe("1.0")
      expect(stamped.lastPlayed).toBe(42)
      expect(Object.keys(stamped).sort()).toEqual(
        [...SAVE_STATE_KEYS, "lastPlayed", "version"].sort(),
      )
    })

    test("is idempotent on an already-normalized state", () => {
      const once = normalizeProgress(populatedState())
      expect(normalizeProgress(once)).toEqual(once)
    })

    test("preserves a fully populated state unchanged", () => {
      expect(normalizeProgress(populatedState())).toEqual(populatedState())
    })
  })
})

describe("StorageManager", () => {
  describe("initialization", () => {
    test("uses the Times Trail key and version", () => {
      expect(manager.gameKey).toBe("timesTrailProgress")
      expect(manager.version).toBe("1.0")
      expect(manager.gameKey).toBe(STORAGE.KEY)
      expect(manager.version).toBe(STORAGE.VERSION)
    })

    test("extends the shared base class", () => {
      expect(manager).toBeInstanceOf(BaseStorageManager)
      expect(manager).toBeInstanceOf(StorageManager)
    })

    test("defines no bespoke exportProgress or importProgress", () => {
      // The base class's exportGameState / importGameState are inherited
      // unchanged; a divergent wrapper here would silently drift from them.
      expect(manager.exportProgress).toBeUndefined()
      expect(manager.importProgress).toBeUndefined()
      expect(typeof manager.exportGameState).toBe("function")
      expect(typeof manager.importGameState).toBe("function")
    })
  })

  describe("saveProgress", () => {
    test("returns true and stamps version and lastPlayed", () => {
      expect(manager.saveProgress(populatedState())).toBe(true)
      const saved = JSON.parse(localStorage.getItem(STORAGE.KEY))
      expect(saved.version).toBe("1.0")
      expect(saved.lastPlayed).toBeGreaterThan(0)
    })

    test("stores every field of a populated state", () => {
      manager.saveProgress(populatedState())
      const saved = JSON.parse(localStorage.getItem(STORAGE.KEY))
      expect(saved).toMatchObject(populatedState())
    })

    test("normalizes on the way in", () => {
      expect(manager.saveProgress({ facts: { "8x7": {} }, totals: {} })).toBe(true)
      const saved = JSON.parse(localStorage.getItem(STORAGE.KEY))
      expect(saved.facts).toEqual({})
      expect("8x7" in saved.facts).toBe(false)
    })

    test("saves a default state for null", () => {
      expect(manager.saveProgress(null)).toBe(true)
      const saved = JSON.parse(localStorage.getItem(STORAGE.KEY))
      expect(saved).toMatchObject(defaultProgress())
    })

    test("returns false when localStorage refuses the write", () => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = () => {
        throw new Error("quota exceeded")
      }
      try {
        expect(manager.saveProgress(defaultProgress())).toBe(false)
      } finally {
        Storage.prototype.setItem = original
      }
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe("loadProgress", () => {
    test("returns null when nothing is stored", () => {
      expect(manager.loadProgress()).toBeNull()
    })

    test("round-trips a fully populated state, preserving every field", () => {
      const state = populatedState()
      expect(manager.saveProgress(state)).toBe(true)

      const loaded = manager.loadProgress()
      expect(loaded).not.toBeNull()
      expect(loaded).toEqual({
        ...state,
        version: "1.0",
        lastPlayed: loaded.lastPlayed,
      })
      expect(loaded.lastPlayed).toBeGreaterThan(0)
      // Normalizing a loaded state changes nothing.
      expect(normalizeProgress(loaded)).toEqual(loaded)
    })

    test("round-trips a mutated default state", () => {
      const state = defaultProgress()
      state.facts["6x7"] = {
        strength: 3,
        totalSeen: 4,
        totalCorrect: 3,
        lastSeen: 1700000000000,
        lastMs: 3100,
        dueAt: 1700259200000,
      }
      state.totals.starsTotal = 60
      state.totals.factsAnswered = 4
      state.totals.factsCorrect = 3
      state.trail.space = 6
      state.daily.factsToday = 4
      state.daily.streakDays = 2
      state.daily.bestStreakDays = 2
      state.settings = { difficulty: "explorer" }
      state.awardedMilestoneIds = ["facts-10"]

      manager.saveProgress(state)
      expect(manager.loadProgress()).toMatchObject(state)
    })

    test("returns null and clears the key on a version mismatch", () => {
      writeRaw({ facts: {}, totals: {}, version: "0.9" })
      expect(manager.loadProgress()).toBeNull()
      expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    test("returns null when version is missing", () => {
      writeRaw({ facts: {}, totals: {} })
      expect(manager.loadProgress()).toBeNull()
    })

    test("returns null and logs when facts is missing", () => {
      writeRaw({ totals: {}, version: "1.0" })
      expect(manager.loadProgress()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    test("returns null when totals is missing", () => {
      writeRaw({ facts: {}, version: "1.0" })
      expect(manager.loadProgress()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    test("returns null when facts is an array", () => {
      writeRaw({ facts: [], totals: {}, version: "1.0" })
      expect(manager.loadProgress()).toBeNull()
    })

    test("returns null when facts is null", () => {
      writeRaw({ facts: null, totals: {}, version: "1.0" })
      expect(manager.loadProgress()).toBeNull()
    })

    test("returns null for corrupt JSON without throwing", () => {
      writeRaw("not json {")
      expect(() => manager.loadProgress()).not.toThrow()
      expect(manager.loadProgress()).toBeNull()
    })

    test("normalizes hostile facts written straight to localStorage", () => {
      writeRaw({
        facts: {
          "6x7": { strength: 42 },
          "2x2": null,
          "3x4": "nope",
          "8x7": { strength: 5 },
          "1x1": { strength: 5 },
        },
        totals: { factsAnswered: 2, factsCorrect: 99 },
        version: "1.0",
      })
      const loaded = manager.loadProgress()
      expect(loaded.facts["6x7"].strength).toBe(5)
      expect(loaded.facts["2x2"].strength).toBe(0)
      expect(loaded.facts["3x4"].strength).toBe(0)
      expect(Object.keys(loaded.facts).sort()).toEqual(["2x2", "3x4", "6x7"])
      expect(loaded.totals.factsCorrect).toBe(2)
    })

    test("strips cut fields from a save written by an earlier build", () => {
      writeRaw({
        facts: { "6x7": { strength: 3, streak: 4, avgMs: 2500 } },
        totals: { starsTotal: 100, secondsPracticed: 900 },
        trail: { space: 12, lapsCompleted: 2 },
        daily: { streakDays: 3, secondsToday: 480 },
        settings: { difficulty: "master", reducedMotion: "on" },
        awardedMilestoneIds: ["facts-10", "first-steps"],
        unlockedCosmeticIds: ["fox"],
        activeCosmetics: { token: "fox" },
        version: "1.0",
        lastPlayed: 1700000000000,
      })

      const loaded = manager.loadProgress()
      expect(loaded).not.toBeNull()
      expect(Object.keys(loaded).sort()).toEqual(
        [...SAVE_STATE_KEYS, "lastPlayed", "version"].sort(),
      )
      expect("secondsPracticed" in loaded.totals).toBe(false)
      expect("lapsCompleted" in loaded.trail).toBe(false)
      expect("secondsToday" in loaded.daily).toBe(false)
      expect("streak" in loaded.facts["6x7"]).toBe(false)
      expect("avgMs" in loaded.facts["6x7"]).toBe(false)
      expect(loaded.awardedMilestoneIds).toEqual(["facts-10"])
      // Settings is structural here; the legacy key dies in Settings.
      expect(loaded.settings).toEqual({ difficulty: "master", reducedMotion: "on" })
      expect(loaded.trail.space).toBe(12)
      expect(loaded.lastPlayed).toBe(1700000000000)
    })
  })

  describe("clearProgress", () => {
    test("removes the key and returns true", () => {
      manager.saveProgress(defaultProgress())
      expect(localStorage.getItem(STORAGE.KEY)).not.toBeNull()
      expect(manager.clearProgress()).toBe(true)
      expect(localStorage.getItem(STORAGE.KEY)).toBeNull()
    })

    test("returns true when nothing was stored", () => {
      expect(manager.clearProgress()).toBe(true)
    })

    test("leaves hasGameState false", () => {
      manager.saveProgress(defaultProgress())
      expect(manager.hasGameState()).toBe(true)
      manager.clearProgress()
      expect(manager.hasGameState()).toBe(false)
    })
  })
})
