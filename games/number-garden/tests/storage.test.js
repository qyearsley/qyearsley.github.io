import { jest } from "@jest/globals"
import { StorageManager } from "../js/storage.js"

describe("StorageManager", () => {
  let storageManager
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    storageManager = new StorageManager()

    // Suppress expected console messages
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation()
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    localStorage.clear()

    // Restore console methods
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe("initialization", () => {
    test("initializes with correct storage key and version", () => {
      expect(storageManager.gameKey).toBe("numberGardenProgress")
      expect(storageManager.version).toBe("3.0")
    })
  })

  describe("saveProgress", () => {
    test("saves progress to localStorage", () => {
      const stats = {
        stars: 10,
        flowers: 5,
        activitiesCompleted: 8,
        currentLevel: 2,
        currentLevelProgress: 3,
      }
      const garden = [{ color: "red", emoji: "🌹", name: "Rose" }]
      const unlockedAreas = ["flower-meadow", "crystal-cave"]
      const completedAreas = ["flower-meadow"]
      const settings = { inputMode: "keyboard", visualHints: "always" }
      const projectType = "castle"

      const result = storageManager.saveProgress(
        stats,
        garden,
        unlockedAreas,
        completedAreas,
        settings,
        projectType,
      )

      expect(result).toBe(true)
      const saved = JSON.parse(localStorage.getItem("numberGardenProgress"))
      expect(saved.stats).toEqual(stats)
      expect(saved.garden).toEqual(garden)
      expect(saved.unlockedAreas).toEqual(unlockedAreas)
      expect(saved.completedAreas).toEqual(completedAreas)
      expect(saved.settings).toEqual(settings)
      expect(saved.projectType).toBe(projectType)
      expect(saved.version).toBe("3.0")
      expect(saved.lastPlayed).toBeDefined()
    })

    test("uses default values for optional parameters", () => {
      const stats = { stars: 5 }
      const garden = []
      const unlockedAreas = null

      storageManager.saveProgress(stats, garden, unlockedAreas)

      const saved = JSON.parse(localStorage.getItem("numberGardenProgress"))
      expect(saved.unlockedAreas).toEqual(["flower-meadow"])
      expect(saved.completedAreas).toEqual([])
      // When settings is undefined, the default parameter {} is used, not the || fallback
      expect(saved.settings).toEqual({})
      expect(saved.projectType).toBe("castle")
    })

    test("saves empty settings object when explicitly provided", () => {
      const stats = { stars: 5 }
      const garden = []
      const unlockedAreas = ["flower-meadow"]
      const completedAreas = []
      const settings = {} // Explicitly empty

      storageManager.saveProgress(stats, garden, unlockedAreas, completedAreas, settings)

      const saved = JSON.parse(localStorage.getItem("numberGardenProgress"))
      expect(saved.settings).toEqual({})
    })
  })

  describe("loadProgress", () => {
    test("loads saved progress from localStorage", () => {
      const stats = { stars: 10, flowers: 5 }
      const garden = [{ color: "red", emoji: "🌹" }]
      const unlockedAreas = ["flower-meadow"]

      storageManager.saveProgress(stats, garden, unlockedAreas)
      const loaded = storageManager.loadProgress()

      expect(loaded.stats).toEqual(stats)
      expect(loaded.garden).toEqual(garden)
      expect(loaded.unlockedAreas).toEqual(unlockedAreas)
      expect(loaded.version).toBe("3.0")
    })

    test("returns null when no saved data exists", () => {
      const loaded = storageManager.loadProgress()
      expect(loaded).toBeNull()
    })

    test("clears and returns null for old version data", () => {
      const oldData = {
        stats: { stars: 10 },
        garden: [],
        version: "2.0", // Old version
      }
      localStorage.setItem("numberGardenProgress", JSON.stringify(oldData))

      const loaded = storageManager.loadProgress()

      expect(loaded).toBeNull()
      expect(localStorage.getItem("numberGardenProgress")).toBeNull()
    })

    test("returns null for data missing version", () => {
      const dataNoVersion = {
        stats: { stars: 10 },
        garden: [],
        // No version field
      }
      localStorage.setItem("numberGardenProgress", JSON.stringify(dataNoVersion))

      const loaded = storageManager.loadProgress()

      expect(loaded).toBeNull()
    })

    test("returns null for invalid data structure", () => {
      const invalidData = {
        version: "3.0",
        // Missing stats and garden
      }
      localStorage.setItem("numberGardenProgress", JSON.stringify(invalidData))

      const loaded = storageManager.loadProgress()

      expect(loaded).toBeNull()
    })

    test("returns null for corrupted JSON", () => {
      localStorage.setItem("numberGardenProgress", "not valid json {")

      const loaded = storageManager.loadProgress()

      expect(loaded).toBeNull()
    })
  })

  describe("clearProgress", () => {
    test("removes saved progress from localStorage", () => {
      const stats = { stars: 10 }
      const garden = []
      storageManager.saveProgress(stats, garden, [])

      expect(localStorage.getItem("numberGardenProgress")).not.toBeNull()

      const result = storageManager.clearProgress()

      expect(result).toBe(true)
      expect(localStorage.getItem("numberGardenProgress")).toBeNull()
    })

    test("returns true even when no data exists", () => {
      const result = storageManager.clearProgress()
      expect(result).toBe(true)
    })
  })

  describe("exportProgress", () => {
    test("exports progress as formatted JSON string", () => {
      const stats = { stars: 10, flowers: 5 }
      const garden = [{ color: "red", emoji: "🌹" }]
      storageManager.saveProgress(stats, garden, ["flower-meadow"])

      const exported = storageManager.exportProgress()

      expect(typeof exported).toBe("string")
      const parsed = JSON.parse(exported)
      expect(parsed.stats).toEqual(stats)
      expect(parsed.garden).toEqual(garden)
    })

    test("returns null when no saved data exists", () => {
      const exported = storageManager.exportProgress()
      expect(exported).toBeNull()
    })
  })

  describe("importProgress", () => {
    test("imports valid progress data", () => {
      const data = {
        stats: { stars: 20, flowers: 10 },
        garden: [{ color: "blue", emoji: "🌸" }],
        unlockedAreas: ["flower-meadow", "crystal-cave"],
        version: "3.0",
      }
      const jsonString = JSON.stringify(data)

      const result = storageManager.importProgress(jsonString)

      expect(result).toBe(true)
      const loaded = storageManager.loadProgress()
      expect(loaded.stats).toEqual(data.stats)
      expect(loaded.garden).toEqual(data.garden)
    })

    test("rejects invalid JSON", () => {
      const result = storageManager.importProgress("not valid json")
      expect(result).toBe(false)
    })

    test("rejects data missing required fields", () => {
      const invalidData = {
        version: "3.0",
        // Missing stats and garden
      }
      const jsonString = JSON.stringify(invalidData)

      const result = storageManager.importProgress(jsonString)

      expect(result).toBe(false)
    })

    test("accepts data with stats and garden even if missing other fields", () => {
      const minimalData = {
        stats: { stars: 5 },
        garden: [],
      }
      const jsonString = JSON.stringify(minimalData)

      const result = storageManager.importProgress(jsonString)

      expect(result).toBe(true)
    })
  })
})
