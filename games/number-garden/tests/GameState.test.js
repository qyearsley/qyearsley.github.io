import { GameState } from "../js/GameState.js"

// Mock storage manager
const mockStorageManager = {
  saveProgress: function () {},
  loadProgress: function () {
    return null
  },
  clearProgress: function () {},
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

    test("initializes with default settings", () => {
      expect(gameState.settings.questionsPerLevel).toBe(5)
      expect(gameState.settings.inputMode).toBe("multipleChoice")
      expect(gameState.settings.visualHints).toBe("always")
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

    test("returns 40 for 2 out of 5 questions", () => {
      gameState.stats.currentLevelProgress = 2
      expect(gameState.getProgressPercent()).toBe(40)
    })

    test("returns 100 for complete progress", () => {
      gameState.stats.currentLevelProgress = 5
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

  describe("unlockArea", () => {
    test("unlocks specified area", () => {
      expect(gameState.isAreaUnlocked("crystal-cave")).toBe(false)
      gameState.unlockArea("crystal-cave")
      expect(gameState.isAreaUnlocked("crystal-cave")).toBe(true)
    })
  })

  describe("resetProgress", () => {
    test("resets all stats to defaults", () => {
      gameState.stats.stars = 50
      gameState.stats.currentLevel = 5
      gameState.garden = [{ color: "red", emoji: "🌹" }]
      gameState.unlockArea("crystal-cave")

      gameState.resetProgress()

      expect(gameState.stats.stars).toBe(0)
      expect(gameState.stats.flowers).toBe(0)
      expect(gameState.stats.currentLevel).toBe(1)
      expect(gameState.garden).toEqual([])
      expect(gameState.unlockedAreas.size).toBe(1)
      expect(gameState.unlockedAreas.has("flower-meadow")).toBe(true)
    })
  })

  describe("updateSetting", () => {
    test("updates setting value", () => {
      gameState.updateSetting("inputMode", "keyboard")
      expect(gameState.settings.inputMode).toBe("keyboard")
    })

    test("calls saveProgress after updating", () => {
      let saveCalled = false
      mockStorageManager.saveProgress = function () {
        saveCalled = true
      }

      gameState.updateSetting("questionsPerLevel", 10)

      expect(saveCalled).toBe(true)
    })
  })

  describe("getCompletedAreasCount", () => {
    test("returns 0 for no completed areas", () => {
      expect(gameState.getCompletedAreasCount()).toBe(0)
    })

    test("returns correct count after completing areas", () => {
      gameState.currentArea = "flower-meadow"
      gameState.completeLevel()
      expect(gameState.getCompletedAreasCount()).toBe(1)

      gameState.currentArea = "crystal-cave"
      gameState.completeLevel()
      expect(gameState.getCompletedAreasCount()).toBe(2)
    })
  })

  describe("isCastleComplete", () => {
    test("returns false when castle not complete", () => {
      expect(gameState.isCastleComplete()).toBe(false)
    })

    test("returns true when all 6 areas completed", () => {
      gameState.completedAreas.add("flower-meadow")
      gameState.completedAreas.add("crystal-cave")
      gameState.completedAreas.add("enchanted-forest")
      gameState.completedAreas.add("time-temple")
      gameState.completedAreas.add("measurement-market")
      gameState.completedAreas.add("pattern-path")

      expect(gameState.isCastleComplete()).toBe(true)
    })
  })

  describe("setProjectType", () => {
    test("sets project type", () => {
      gameState.setProjectType("garden")
      expect(gameState.projectType).toBe("garden")
    })

    test("calls saveProgress after setting", () => {
      let saveCalled = false
      mockStorageManager.saveProgress = function () {
        saveCalled = true
      }

      gameState.setProjectType("robot")

      expect(saveCalled).toBe(true)
    })
  })

  describe("completeLevel - area unlocking", () => {
    test("marks current area as completed", () => {
      gameState.currentArea = "flower-meadow"
      gameState.completeLevel()

      expect(gameState.completedAreas.has("flower-meadow")).toBe(true)
    })

    test("unlocks time-temple at level 4", () => {
      gameState.stats.currentLevel = 3
      gameState.completeLevel()

      expect(gameState.unlockedAreas.has("time-temple")).toBe(true)
    })

    test("unlocks measurement-market at level 5", () => {
      gameState.stats.currentLevel = 4
      gameState.completeLevel()

      expect(gameState.unlockedAreas.has("measurement-market")).toBe(true)
    })

    test("unlocks pattern-path at level 6", () => {
      gameState.stats.currentLevel = 5
      gameState.completeLevel()

      expect(gameState.unlockedAreas.has("pattern-path")).toBe(true)
    })
  })

  describe("loadProgress - with settings", () => {
    test("loads custom settings from storage", () => {
      mockStorageManager.loadProgress = function () {
        return {
          stats: { stars: 10 },
          garden: [],
          unlockedAreas: ["flower-meadow"],
          settings: {
            inputMode: "keyboard",
            visualHints: "sometimes",
            questionsPerLevel: 10,
          },
        }
      }

      const newGameState = new GameState(mockStorageManager)

      expect(newGameState.settings.inputMode).toBe("keyboard")
      expect(newGameState.settings.visualHints).toBe("sometimes")
      expect(newGameState.settings.questionsPerLevel).toBe(10)
    })

    test("uses default settings when not provided", () => {
      mockStorageManager.loadProgress = function () {
        return {
          stats: { stars: 10 },
          garden: [],
          unlockedAreas: ["flower-meadow"],
          // No settings
        }
      }

      const newGameState = new GameState(mockStorageManager)

      expect(newGameState.settings.inputMode).toBe("multipleChoice")
      expect(newGameState.settings.visualHints).toBe("always")
      expect(newGameState.settings.questionsPerLevel).toBe(5)
    })

    test("loads project type from storage", () => {
      mockStorageManager.loadProgress = function () {
        return {
          stats: { stars: 10 },
          garden: [],
          unlockedAreas: ["flower-meadow"],
          projectType: "spaceship",
        }
      }

      const newGameState = new GameState(mockStorageManager)

      expect(newGameState.projectType).toBe("spaceship")
    })

    test("loads completed areas from storage", () => {
      mockStorageManager.loadProgress = function () {
        return {
          stats: { stars: 10 },
          garden: [],
          unlockedAreas: ["flower-meadow"],
          completedAreas: ["flower-meadow", "crystal-cave"],
        }
      }

      const newGameState = new GameState(mockStorageManager)

      expect(newGameState.completedAreas.has("flower-meadow")).toBe(true)
      expect(newGameState.completedAreas.has("crystal-cave")).toBe(true)
      expect(newGameState.getCompletedAreasCount()).toBe(2)
    })
  })
})
