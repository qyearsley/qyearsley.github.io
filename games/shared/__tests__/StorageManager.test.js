import { jest } from "@jest/globals"
import { StorageManager } from "../StorageManager.js"

describe("StorageManager", () => {
  let sm

  beforeEach(() => {
    localStorage.clear()
    sm = new StorageManager("test-game", "1.0")
    jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  describe("constructor", () => {
    it("stores gameKey and version", () => {
      expect(sm.gameKey).toBe("test-game")
      expect(sm.version).toBe("1.0")
    })

    it("defaults version to 1.0", () => {
      const s = new StorageManager("key")
      expect(s.version).toBe("1.0")
    })
  })

  describe("saveGameState", () => {
    it("saves data with version and timestamp", () => {
      const result = sm.saveGameState({ score: 42 })
      expect(result).toBe(true)
      const saved = JSON.parse(localStorage.getItem("test-game"))
      expect(saved.score).toBe(42)
      expect(saved.version).toBe("1.0")
      expect(saved.lastPlayed).toBeGreaterThan(0)
    })

    it("returns false if localStorage throws", () => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = () => {
        throw new Error("quota exceeded")
      }
      expect(sm.saveGameState({ x: 1 })).toBe(false)
      Storage.prototype.setItem = original
    })
  })

  describe("loadGameState", () => {
    it("returns null when no data exists", () => {
      expect(sm.loadGameState()).toBeNull()
    })

    it("loads valid data", () => {
      localStorage.setItem("test-game", JSON.stringify({ score: 10, version: "1.0" }))
      const data = sm.loadGameState()
      expect(data.score).toBe(10)
    })

    it("returns null and clears on version mismatch", () => {
      localStorage.setItem("test-game", JSON.stringify({ score: 10, version: "0.9" }))
      expect(sm.loadGameState()).toBeNull()
      expect(localStorage.getItem("test-game")).toBeNull()
    })

    it("returns null on corrupted JSON", () => {
      localStorage.setItem("test-game", "not valid json{{")
      expect(sm.loadGameState()).toBeNull()
    })
  })

  describe("clearGameState", () => {
    it("removes the key", () => {
      localStorage.setItem("test-game", "something")
      expect(sm.clearGameState()).toBe(true)
      expect(localStorage.getItem("test-game")).toBeNull()
    })
  })

  describe("hasGameState", () => {
    it("returns false when no data", () => {
      expect(sm.hasGameState()).toBe(false)
    })

    it("returns true when data exists", () => {
      localStorage.setItem("test-game", "{}")
      expect(sm.hasGameState()).toBe(true)
    })
  })

  describe("exportGameState", () => {
    it("returns null when no data", () => {
      expect(sm.exportGameState()).toBeNull()
    })

    it("returns formatted JSON string", () => {
      localStorage.setItem("test-game", JSON.stringify({ score: 5, version: "1.0" }))
      const exported = sm.exportGameState()
      expect(typeof exported).toBe("string")
      expect(JSON.parse(exported).score).toBe(5)
    })
  })

  describe("importGameState", () => {
    it("imports valid data", () => {
      const json = JSON.stringify({ score: 99, version: "1.0" })
      expect(sm.importGameState(json)).toBe(true)
      expect(localStorage.getItem("test-game")).toBe(json)
    })

    it("rejects version mismatch", () => {
      const json = JSON.stringify({ score: 99, version: "2.0" })
      expect(sm.importGameState(json)).toBe(false)
    })

    it("rejects invalid JSON", () => {
      expect(sm.importGameState("not json")).toBe(false)
    })
  })
})
