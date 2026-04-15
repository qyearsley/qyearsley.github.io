import { describe, test, expect, beforeEach } from "@jest/globals"
import { LifeGardenStorage } from "../js/storage.js"

describe("LifeGardenStorage", () => {
  let storage

  beforeEach(() => {
    localStorage.clear()
    storage = new LifeGardenStorage()
  })

  test("saves and loads progress", () => {
    const puzzles = { "first-seeds": { stars: 2 } }
    const settings = { speed: "fast" }
    storage.saveProgress(puzzles, settings)

    const loaded = storage.loadProgress()
    expect(loaded.completedPuzzles).toEqual(puzzles)
    expect(loaded.settings).toEqual(settings)
  })

  test("returns null when no saved data", () => {
    expect(storage.loadProgress()).toBeNull()
  })

  test("clears progress", () => {
    storage.saveProgress({ test: { stars: 1 } }, {})
    storage.clearProgress()
    expect(storage.loadProgress()).toBeNull()
  })

  test("hasGameState returns true when data exists", () => {
    storage.saveProgress({}, {})
    expect(storage.hasGameState()).toBe(true)
  })

  test("hasGameState returns false when no data", () => {
    expect(storage.hasGameState()).toBe(false)
  })

  test("returns null for invalid structure", () => {
    // Save raw data without completedPuzzles field
    localStorage.setItem(
      "lifeGardenProgress",
      JSON.stringify({ version: "1.0", lastPlayed: Date.now() }),
    )
    expect(storage.loadProgress()).toBeNull()
  })
})
