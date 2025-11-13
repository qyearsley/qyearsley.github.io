import { GameState } from "../enchanted-garden/js/GameState.js"

// Mock storage manager
const mockStorageManager = {
  saveProgress: function () {},
  loadProgress: function () {
    return null
  },
  _savedData: null,
}

describe("GameState", () => {
  let gameState

  beforeEach(() => {
    // Reset mock data
    mockStorageManager._savedData = null
    mockStorageManager.saveProgress = function (stats, garden, unlockedAreas) {
      mockStorageManager._savedData = { stats, garden, unlockedAreas }
    }
    mockStorageManager.loadProgress = function () {
      return null
    }

    gameState = new GameState(mockStorageManager)
  })

  describe("initialization", () => {
    test("initializes with default values", () => {
      expect(gameState.currentScreen).toBe("title")
      expect(gameState.currentArea).toBeNull()
      expect(gameState.currentActivity).toBeNull()
      expect(gameState.stats.stars).toBe(0)
      expect(gameState.stats.flowers).toBe(0)
      expect(gameState.garden).toEqual([])
      expect(gameState.unlockedAreas.has("flower-meadow")).toBe(true)
      expect(gameState.unlockedAreas.size).toBe(1)
    })

    test("sets QUESTIONS_PER_LEVEL constant", () => {
      expect(gameState.QUESTIONS_PER_LEVEL).toBe(6)
    })
  })

  describe("enterArea", () => {
    test("sets current area", () => {
      gameState.enterArea("flower-meadow")
      expect(gameState.currentArea).toBe("flower-meadow")
    })

    test("resets level progress", () => {
      gameState.stats.currentLevelProgress = 5
      gameState.enterArea("flower-meadow")
      expect(gameState.stats.currentLevelProgress).toBe(0)
    })
  })

  describe("setActivity", () => {
    test("sets current activity", () => {
      const activity = { type: "addition", question: "1+1=?", correctAnswer: 2 }
      gameState.setActivity(activity)
      expect(gameState.currentActivity).toEqual(activity)
    })
  })

  describe("recordCorrectAnswer", () => {
    test("increments stats", () => {
      const flower = { color: "red", emoji: "🌹", name: "Rose", timestamp: Date.now() }
      gameState.recordCorrectAnswer(flower)

      expect(gameState.stats.stars).toBe(1)
      expect(gameState.stats.flowers).toBe(1)
      expect(gameState.stats.activitiesCompleted).toBe(1)
      expect(gameState.stats.currentLevelProgress).toBe(1)
    })

    test("adds flower to garden", () => {
      const flower = { color: "red", emoji: "🌹", name: "Rose", timestamp: Date.now() }
      gameState.recordCorrectAnswer(flower)

      expect(gameState.garden).toHaveLength(1)
      expect(gameState.garden[0]).toEqual(flower)
    })

    test("returns false when level not complete", () => {
      const flower = { color: "red", emoji: "🌹", name: "Rose", timestamp: Date.now() }
      const levelComplete = gameState.recordCorrectAnswer(flower)

      expect(levelComplete).toBe(false)
    })

    test("returns true when level complete", () => {
      const flower = { color: "red", emoji: "🌹", name: "Rose", timestamp: Date.now() }
      gameState.stats.currentLevelProgress = 5

      const levelComplete = gameState.recordCorrectAnswer(flower)

      expect(levelComplete).toBe(true)
      expect(gameState.stats.currentLevelProgress).toBe(6)
    })
  })

  describe("completeLevel", () => {
    test("increments level and resets progress", () => {
      gameState.stats.currentLevel = 1
      gameState.stats.currentLevelProgress = 6

      gameState.completeLevel()

      expect(gameState.stats.currentLevel).toBe(2)
      expect(gameState.stats.currentLevelProgress).toBe(0)
    })

    test("unlocks crystal cave at level 2", () => {
      gameState.stats.currentLevel = 1
      gameState.completeLevel()

      expect(gameState.unlockedAreas.has("crystal-cave")).toBe(true)
    })

    test("unlocks enchanted forest at level 3", () => {
      gameState.stats.currentLevel = 2
      gameState.completeLevel()

      expect(gameState.unlockedAreas.has("enchanted-forest")).toBe(true)
    })
  })

  describe("getProgressPercent", () => {
    test("returns 0 for no progress", () => {
      expect(gameState.getProgressPercent()).toBe(0)
    })

    test("returns 50 for half progress", () => {
      gameState.stats.currentLevelProgress = 3
      expect(gameState.getProgressPercent()).toBe(50)
    })

    test("returns 100 for complete progress", () => {
      gameState.stats.currentLevelProgress = 6
      expect(gameState.getProgressPercent()).toBe(100)
    })
  })

  describe("saveProgress", () => {
    test("calls storage manager saveProgress", () => {
      gameState.saveProgress()
      expect(mockStorageManager._savedData).toBeTruthy()
      expect(mockStorageManager._savedData.stats).toEqual(gameState.stats)
      expect(mockStorageManager._savedData.garden).toEqual(gameState.garden)
      expect(mockStorageManager._savedData.unlockedAreas).toEqual(["flower-meadow"])
    })
  })

  describe("isAreaUnlocked", () => {
    test("returns true for unlocked areas", () => {
      expect(gameState.isAreaUnlocked("flower-meadow")).toBe(true)
    })

    test("returns false for locked areas", () => {
      expect(gameState.isAreaUnlocked("crystal-cave")).toBe(false)
    })
  })

  describe("loadProgress", () => {
    test("loads stats from storage", () => {
      mockStorageManager.loadProgress = function () {
        return {
          stats: {
            stars: 10,
            flowers: 5,
            activitiesCompleted: 8,
            currentLevel: 2,
            currentLevelProgress: 3,
          },
          garden: [{ color: "red", emoji: "🌹" }],
          unlockedAreas: ["flower-meadow", "crystal-cave"],
        }
      }

      const newGameState = new GameState(mockStorageManager)

      expect(newGameState.stats.stars).toBe(10)
      expect(newGameState.stats.flowers).toBe(5)
      expect(newGameState.stats.currentLevel).toBe(2)
      expect(newGameState.garden).toHaveLength(1)
      expect(newGameState.unlockedAreas.has("crystal-cave")).toBe(true)
    })

    test("handles null saved data", () => {
      mockStorageManager.loadProgress = function () {
        return null
      }
      const newGameState = new GameState(mockStorageManager)

      expect(newGameState.stats.stars).toBe(0)
      expect(newGameState.unlockedAreas.has("flower-meadow")).toBe(true)
      expect(newGameState.unlockedAreas.size).toBe(1)
    })

    test("handles missing fields with defaults", () => {
      mockStorageManager.loadProgress = function () {
        return {
          stats: { stars: 5 },
          garden: [],
        }
      }

      const newGameState = new GameState(mockStorageManager)

      expect(newGameState.stats.stars).toBe(5)
      expect(newGameState.stats.flowers).toBe(0)
      expect(newGameState.stats.currentLevel).toBe(1)
      expect(newGameState.unlockedAreas.has("flower-meadow")).toBe(true)
    })
  })

  describe("setScreen", () => {
    test("sets current screen", () => {
      gameState.setScreen("garden-hub")
      expect(gameState.currentScreen).toBe("garden-hub")
    })
  })
})
