import { describe, test, expect, beforeEach } from "@jest/globals"
import { LifeGardenStorage } from "../js/storage.js"

describe("LifeGardenStorage", () => {
  let storage

  beforeEach(() => {
    localStorage.clear()
    storage = new LifeGardenStorage()
  })

  test("saves and loads progress", () => {
    const settings = { speed: "fast" }
    storage.saveProgress(settings)

    expect(storage.loadProgress().settings).toEqual(settings)
  })

  test("returns null when no saved data", () => {
    expect(storage.loadProgress()).toBeNull()
  })

  test("clears progress", () => {
    storage.saveProgress({})
    storage.clearProgress()
    expect(storage.loadProgress()).toBeNull()
  })

  test("hasGameState returns true when data exists", () => {
    storage.saveProgress({})
    expect(storage.hasGameState()).toBe(true)
  })

  test("hasGameState returns false when no data", () => {
    expect(storage.hasGameState()).toBe(false)
  })

  test("loads a save written before completedPuzzles was dropped", () => {
    // Players who saved under the old shape keep their settings.
    localStorage.setItem(
      "lifeGardenProgress",
      JSON.stringify({
        version: "2.0",
        lastPlayed: Date.now(),
        completedPuzzles: { sandbox: { stars: 3 } },
        settings: { speed: "fast", showGrid: false },
      }),
    )
    expect(storage.loadProgress().settings).toEqual({ speed: "fast", showGrid: false })
  })

  test("loads a save that has no completedPuzzles", () => {
    localStorage.setItem(
      "lifeGardenProgress",
      JSON.stringify({ version: "2.0", lastPlayed: Date.now(), settings: { speed: "slow" } }),
    )
    expect(storage.loadProgress().settings).toEqual({ speed: "slow" })
  })

  test("discards a save written before the species list changed", () => {
    // Species ids were renumbered when flowers became a life stage of grass,
    // so anything written under the old version has to be thrown away.
    localStorage.setItem(
      "lifeGardenProgress",
      JSON.stringify({
        version: "1.0",
        lastPlayed: Date.now(),
        completedPuzzles: { sandbox: { stars: 3 } },
        settings: { speed: "fast" },
      }),
    )
    expect(storage.loadProgress()).toBeNull()
  })

  test("stores no species ids, so nothing can put a dead species back", () => {
    storage.saveProgress({ speed: "fast", showGrid: true })
    const raw = JSON.parse(localStorage.getItem("lifeGardenProgress"))
    expect(Object.keys(raw).sort()).toEqual(["lastPlayed", "settings", "version"])
  })
})
