import { describe, test, expect, beforeEach } from "@jest/globals"
import { PHASE, SPECIES } from "../js/constants.js"
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

const samplePuzzle = {
  id: "test-puzzle",
  budget: { [SPECIES.GRASS]: 5, [SPECIES.FLOWER]: 3 },
  unlockAfter: null,
  starThresholds: { 1: 100, 2: 75, 3: 50 },
}

describe("GameState", () => {
  let state

  beforeEach(() => {
    state = new GameState(mockStorage)
  })

  test("starts in placing phase", () => {
    state.startPuzzle(samplePuzzle)
    expect(state.phase).toBe(PHASE.PLACING)
    expect(state.generation).toBe(0)
  })

  test("tracks budget usage", () => {
    state.startPuzzle(samplePuzzle)
    expect(state.getRemainingBudget(SPECIES.GRASS)).toBe(5)

    state.useBudget(SPECIES.GRASS)
    expect(state.getRemainingBudget(SPECIES.GRASS)).toBe(4)

    state.returnBudget(SPECIES.GRASS)
    expect(state.getRemainingBudget(SPECIES.GRASS)).toBe(5)
  })

  test("returnBudget does not go below zero", () => {
    state.startPuzzle(samplePuzzle)
    state.returnBudget(SPECIES.GRASS)
    expect(state.getRemainingBudget(SPECIES.GRASS)).toBe(5)
  })

  describe("puzzle unlock", () => {
    test("puzzle with null unlockAfter is always unlocked", () => {
      expect(state.isPuzzleUnlocked({ unlockAfter: null })).toBe(true)
    })

    test("puzzle locked if prerequisite not completed", () => {
      expect(state.isPuzzleUnlocked({ unlockAfter: "first-seeds" })).toBe(false)
    })

    test("puzzle unlocked when prerequisite completed", () => {
      state.completedPuzzles["first-seeds"] = { stars: 1 }
      expect(state.isPuzzleUnlocked({ unlockAfter: "first-seeds" })).toBe(true)
    })
  })

  describe("completePuzzle", () => {
    test("records completion with stars", () => {
      state.completePuzzle("test", 2)
      expect(state.getStars("test")).toBe(2)
    })

    test("keeps higher star rating", () => {
      state.completePuzzle("test", 2)
      state.completePuzzle("test", 1)
      expect(state.getStars("test")).toBe(2)
    })

    test("upgrades star rating", () => {
      state.completePuzzle("test", 1)
      state.completePuzzle("test", 3)
      expect(state.getStars("test")).toBe(3)
    })
  })

  describe("calculateStars", () => {
    test("3 stars for low budget usage", () => {
      state.startPuzzle(samplePuzzle)
      // Total budget = 8. Use 3 = 37.5% <= 50% -> 3 stars
      state.budgetUsed = { [SPECIES.GRASS]: 2, [SPECIES.FLOWER]: 1 }
      expect(state.calculateStars(samplePuzzle)).toBe(3)
    })

    test("2 stars for moderate budget usage", () => {
      state.startPuzzle(samplePuzzle)
      // Total = 8. Use 5 = 62.5% <= 75% -> 2 stars
      state.budgetUsed = { [SPECIES.GRASS]: 3, [SPECIES.FLOWER]: 2 }
      expect(state.calculateStars(samplePuzzle)).toBe(2)
    })

    test("1 star for full budget usage", () => {
      state.startPuzzle(samplePuzzle)
      // Total = 8. Use 8 = 100% <= 100% -> 1 star
      state.budgetUsed = { [SPECIES.GRASS]: 5, [SPECIES.FLOWER]: 3 }
      expect(state.calculateStars(samplePuzzle)).toBe(1)
    })
  })
})
