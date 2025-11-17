/**
 * @jest-environment jsdom
 */
import { GameState } from "../js/GameState.js"
import { StorageManager } from "../js/storage.js"

describe("GameState", () => {
  let gameState
  let storageManager

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()

    storageManager = new StorageManager("wordQuest_test")
    gameState = new GameState(storageManager)
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe("initialization", () => {
    test("should initialize with default values", () => {
      expect(gameState.currentScreen).toBe("title")
      expect(gameState.currentQuest).toBeNull()
      expect(gameState.difficulty).toBe("explorer")
      expect(gameState.stats.stars).toBe(0)
      expect(gameState.stats.wordsLearned).toBe(0)
      expect(gameState.stats.currentLevel).toBe(1)
    })

    test("should have sound-cipher unlocked by default", () => {
      expect(gameState.isQuestUnlocked("sound-cipher")).toBe(true)
    })

    test("should have other quests locked by default", () => {
      expect(gameState.isQuestUnlocked("blending-workshop")).toBe(false)
      expect(gameState.isQuestUnlocked("speed-vault")).toBe(false)
    })

    test("should load saved progress if available", () => {
      const savedData = {
        difficulty: "adventurer",
        stats: { stars: 50, wordsLearned: 25, activitiesCompleted: 30, currentLevel: 5, currentLevelProgress: 2 },
        unlockedQuests: ["sound-cipher", "blending-workshop"],
        masteredWords: ["cat", "dog", "sun"],
        settings: { difficulty: "adventurer", questionsPerLevel: 8, inputMode: "keyboard", audioHints: false },
        completedQuests: ["sound-cipher"],
        questProgress: {
          "sound-cipher": { completed: 5, stars: 25 },
        },
        currentQuest: "blending-workshop",
      }

      storageManager.saveGameState(savedData)
      const newGameState = new GameState(storageManager)

      expect(newGameState.difficulty).toBe("adventurer")
      expect(newGameState.stats.stars).toBe(50)
      expect(newGameState.isQuestUnlocked("blending-workshop")).toBe(true)
      expect(newGameState.stats.wordsLearned).toBe(25)
    })
  })

  describe("enterQuest", () => {
    test("should set current quest and reset level progress", () => {
      gameState.enterQuest("sound-cipher")
      expect(gameState.currentQuest).toBe("sound-cipher")
      expect(gameState.stats.currentLevelProgress).toBe(0)
    })
  })

  describe("setCurrentActivity", () => {
    test("should set the current activity", () => {
      const activity = { type: "test", question: "Test question" }
      gameState.setCurrentActivity(activity)
      expect(gameState.currentActivity).toEqual(activity)
    })
  })

  describe("recordCorrectAnswer", () => {
    test("should increment stars and progress", () => {
      const initialStars = gameState.stats.stars
      const initialProgress = gameState.stats.currentLevelProgress

      gameState.recordCorrectAnswer()

      expect(gameState.stats.stars).toBe(initialStars + 1)
      expect(gameState.stats.currentLevelProgress).toBe(initialProgress + 1)
    })

    test("should add word to mastered words", () => {
      gameState.recordCorrectAnswer("cat")

      expect(gameState.masteredWords.has("cat")).toBe(true)
      expect(gameState.stats.wordsLearned).toBe(1)
    })

    test("should not duplicate mastered words", () => {
      gameState.recordCorrectAnswer("cat")
      gameState.recordCorrectAnswer("cat")

      expect(gameState.stats.wordsLearned).toBe(1)
    })

    test("should persist to storage", () => {
      gameState.recordCorrectAnswer("cat")

      const savedState = storageManager.loadGameState()
      expect(savedState).not.toBeNull()
      expect(savedState.stats.stars).toBeGreaterThan(0)
    })
  })

  describe("completeActivity", () => {
    test("should increment activities completed", () => {
      const initial = gameState.stats.activitiesCompleted

      gameState.completeActivity()

      expect(gameState.stats.activitiesCompleted).toBe(initial + 1)
    })

    test("should persist to storage", () => {
      gameState.completeActivity()

      const savedState = storageManager.loadGameState()
      expect(savedState.stats.activitiesCompleted).toBeGreaterThan(0)
    })
  })

  describe("completeLevel", () => {
    test("should increment level and reset progress", () => {
      gameState.stats.currentLevel = 1
      gameState.stats.currentLevelProgress = 5

      gameState.completeLevel()

      expect(gameState.stats.currentLevel).toBe(2)
      expect(gameState.stats.currentLevelProgress).toBe(0)
    })

    test("should update quest progress", () => {
      gameState.currentQuest = "sound-cipher"
      gameState.settings.questionsPerLevel = 5

      const initialCompleted = gameState.questProgress["sound-cipher"].completed

      gameState.completeLevel()

      expect(gameState.questProgress["sound-cipher"].completed).toBe(initialCompleted + 1)
      expect(gameState.questProgress["sound-cipher"].stars).toBeGreaterThan(0)
    })
  })

  describe("checkUnlocks", () => {
    test("should unlock next quest after 5 completions", () => {
      gameState.currentQuest = "sound-cipher"
      gameState.questProgress["sound-cipher"].completed = 5

      gameState.checkUnlocks()

      expect(gameState.isQuestUnlocked("blending-workshop")).toBe(true)
    })

    test("should not unlock if less than 5 completions", () => {
      gameState.currentQuest = "sound-cipher"
      gameState.questProgress["sound-cipher"].completed = 3

      gameState.checkUnlocks()

      expect(gameState.isQuestUnlocked("blending-workshop")).toBe(false)
    })
  })

  describe("setDifficulty", () => {
    test("should update difficulty setting", () => {
      gameState.setDifficulty("adventurer")

      expect(gameState.difficulty).toBe("adventurer")
      expect(gameState.settings.difficulty).toBe("adventurer")
    })

    test("should persist to storage", () => {
      gameState.setDifficulty("master")

      const savedState = storageManager.loadGameState()
      expect(savedState.difficulty).toBe("master")
    })
  })

  describe("updateSettings", () => {
    test("should merge new settings", () => {
      gameState.updateSettings({
        questionsPerLevel: 8,
        audioHints: false,
      })

      expect(gameState.settings.questionsPerLevel).toBe(8)
      expect(gameState.settings.audioHints).toBe(false)
      expect(gameState.settings.inputMode).toBe("multipleChoice") // Unchanged
    })

    test("should persist to storage", () => {
      gameState.updateSettings({ questionsPerLevel: 8 })

      const savedState = storageManager.loadGameState()
      expect(savedState.settings.questionsPerLevel).toBe(8)
    })
  })

  describe("getDecoderRank", () => {
    test("should return Apprentice Decoder for < 20 stars", () => {
      gameState.stats.stars = 10
      expect(gameState.getDecoderRank()).toBe("Apprentice Decoder")
    })

    test("should return Journeyman Decoder for 20-49 stars", () => {
      gameState.stats.stars = 30
      expect(gameState.getDecoderRank()).toBe("Journeyman Decoder")
    })

    test("should return Expert Decoder for 50-99 stars", () => {
      gameState.stats.stars = 75
      expect(gameState.getDecoderRank()).toBe("Expert Decoder")
    })

    test("should return Master Decoder for 100-199 stars", () => {
      gameState.stats.stars = 150
      expect(gameState.getDecoderRank()).toBe("Master Decoder")
    })

    test("should return Grand Decoder for 200+ stars", () => {
      gameState.stats.stars = 250
      expect(gameState.getDecoderRank()).toBe("Grand Decoder")
    })
  })

  describe("getQuestProgress", () => {
    test("should return quest progress", () => {
      gameState.questProgress["sound-cipher"].completed = 3
      gameState.questProgress["sound-cipher"].stars = 15

      const progress = gameState.getQuestProgress("sound-cipher")

      expect(progress.completed).toBe(3)
      expect(progress.stars).toBe(15)
    })

    test("should return default progress for unknown quest", () => {
      const progress = gameState.getQuestProgress("unknown-quest")

      expect(progress.completed).toBe(0)
      expect(progress.stars).toBe(0)
    })
  })

  describe("resetProgress", () => {
    test("should reset all stats to defaults", () => {
      // Set some progress
      gameState.stats.stars = 100
      gameState.stats.wordsLearned = 50
      gameState.masteredWords.add("cat")
      gameState.unlockedQuests.add("blending-workshop")
      gameState.currentQuest = "blending-workshop"

      gameState.resetProgress()

      expect(gameState.stats.stars).toBe(0)
      expect(gameState.stats.wordsLearned).toBe(0)
      expect(gameState.masteredWords.size).toBe(0)
      expect(gameState.unlockedQuests.size).toBe(1)
      expect(gameState.isQuestUnlocked("sound-cipher")).toBe(true)
      expect(gameState.isQuestUnlocked("blending-workshop")).toBe(false)
      expect(gameState.currentQuest).toBeNull()
    })

    test("should clear storage", () => {
      gameState.stats.stars = 100
      gameState.saveProgress()

      gameState.resetProgress()

      expect(storageManager.hasGameState()).toBe(false)
    })
  })

  describe("hasSavedProgress", () => {
    test("should return false when no saved data", () => {
      expect(gameState.hasSavedProgress()).toBe(false)
    })

    test("should return true when saved data exists", () => {
      gameState.saveProgress()
      expect(gameState.hasSavedProgress()).toBe(true)
    })
  })
})
