import { describe, test, expect, beforeEach } from "@jest/globals"
import { PHASE } from "../js/constants.js"
import { GameState } from "../js/GameState.js"

const mockStorage = {
  saveProgress() {},
  loadProgress() {
    return null
  },
  clearProgress() {},
  hasGameState() {
    return false
  },
}

describe("GameState", () => {
  let state

  beforeEach(() => {
    state = new GameState(mockStorage)
  })

  test("starts in placing phase at generation 0", () => {
    expect(state.phase).toBe(PHASE.PLACING)
    expect(state.generation).toBe(0)
  })

  test("startOver resets the phase and generation", () => {
    state.generation = 12
    state.phase = PHASE.SIMULATING

    state.startOver()

    expect(state.generation).toBe(0)
    expect(state.phase).toBe(PHASE.PLACING)
  })

  describe("persistence", () => {
    test("loadProgress restores settings and keeps defaults for the rest", () => {
      const loaded = new GameState({
        ...mockStorage,
        loadProgress: () => ({ settings: { speed: "fast" } }),
      })

      loaded.loadProgress()

      expect(loaded.settings.speed).toBe("fast")
      // showGrid wasn't saved, so the default must survive the merge.
      expect(loaded.settings.showGrid).toBe(true)
    })

    test("loadProgress ignores the completedPuzzles map of an older save", () => {
      const loaded = new GameState({
        ...mockStorage,
        loadProgress: () => ({
          completedPuzzles: { sandbox: { stars: 3 } },
          settings: { speed: "slow", showGrid: false },
        }),
      })

      loaded.loadProgress()

      expect(loaded.settings).toEqual({ speed: "slow", showGrid: false })
      expect(loaded.completedPuzzles).toBeUndefined()
    })

    test("loadProgress leaves defaults alone when nothing is saved", () => {
      state.loadProgress()
      expect(state.settings).toEqual({ speed: "normal", showGrid: true })
    })

    test("saveProgress hands the settings to the storage layer", () => {
      const saved = []
      const recording = new GameState({
        ...mockStorage,
        saveProgress: (settings) => saved.push(settings),
      })

      recording.saveProgress()

      expect(saved).toEqual([{ speed: "normal", showGrid: true }])
    })

    test("clearProgress tells storage", () => {
      let cleared = false
      const clearing = new GameState({ ...mockStorage, clearProgress: () => (cleared = true) })

      clearing.clearProgress()

      expect(cleared).toBe(true)
    })
  })
})

// The whole of this layer was dead code until 2026-09-05: nothing in game.js
// called loadProgress or saveProgress, so the speed you chose was forgotten on
// every reload and a save file was never written. Now that it is live, the
// data coming back is untrusted like any other save.
describe("loading an untrusted save", () => {
  const stateFrom = (payload) => {
    const state = new GameState({
      loadProgress: () => payload,
      saveProgress: () => true,
      clearProgress: () => true,
      hasGameState: () => true,
    })
    state.loadProgress()
    return state
  }

  test.each([
    ["a number", 7],
    ["a string", "fast!"],
    ["null", null],
    ["an unoffered speed", "ludicrous"],
    ["an array", []],
  ])("an invalid speed of %s falls back to the default", (_label, speed) => {
    // The simulation loop calls `speed.toUpperCase()`, so a non-string here is
    // a TypeError on the first tick rather than a wrong interval.
    const state = stateFrom({ settings: { speed } })
    expect(state.settings.speed).toBe("normal")
  })

  test.each(["slow", "normal", "fast"])("a real speed of %s is kept", (speed) => {
    expect(stateFrom({ settings: { speed } }).settings.speed).toBe(speed)
  })

  test("showGrid must be a boolean to survive", () => {
    expect(stateFrom({ settings: { showGrid: "yes" } }).settings.showGrid).toBe(true)
    expect(stateFrom({ settings: { showGrid: false } }).settings.showGrid).toBe(false)
  })

  test("an unknown setting is dropped rather than carried into the next save", () => {
    const state = stateFrom({ settings: { speed: "fast", colour: "puce" } })
    expect(Object.keys(state.settings).sort()).toEqual(["showGrid", "speed"])
  })

  test("a null payload leaves every default in place", () => {
    const state = stateFrom(null)
    expect(state.settings).toEqual({ speed: "normal", showGrid: true })
  })

  test.each([
    ["a number", 7],
    ["a string", "x"],
    ["missing", undefined],
  ])("a settings block that is %s leaves the defaults", (_label, settings) => {
    expect(stateFrom({ settings }).settings).toEqual({
      speed: "normal",
      showGrid: true,
    })
  })
})
