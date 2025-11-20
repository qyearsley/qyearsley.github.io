/**
 * @jest-environment jsdom
 */
import { WordActivityGenerator } from "../js/WordActivityGenerator.js"
import { WordBank } from "../js/WordBank.js"
import { getStoriesForDifficulty } from "../data/stories.js"

describe("WordActivityGenerator", () => {
  let generator
  let wordBank

  beforeEach(() => {
    wordBank = new WordBank()
    generator = new WordActivityGenerator(wordBank)
  })

  describe("initialization", () => {
    test("should initialize with word bank", () => {
      expect(generator.wordBank).toBe(wordBank)
    })

    test("should have generators defined", () => {
      expect(generator.generators).toBeDefined()
      expect(generator.generators["sound-cipher"]).toBeDefined()
      expect(generator.generators["blending-workshop"]).toBeDefined()
    })
  })

  describe("generateActivity", () => {
    test("should generate sound-cipher activity", () => {
      const activity = generator.generateActivity(1, "sound-cipher", "explorer")

      expect(activity).toBeDefined()
      expect(activity.type).toBeDefined()
      expect(activity.question).toBeDefined()
      expect(activity.correctAnswer).toBeDefined()
      expect(activity.choices).toBeInstanceOf(Array)
    })

    test("should generate blending-workshop (spelling) activity", () => {
      const activity = generator.generateActivity(1, "blending-workshop", "explorer")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("spell-beginning")
      expect(activity.word).toBeDefined()
    })

    test("should generate speed-vault activity", () => {
      const activity = generator.generateActivity(1, "speed-vault", "adventurer")

      expect(activity).toBeDefined()
      expect(["rhyme-matching", "odd-one-out"]).toContain(activity.type)
      expect(activity.correctAnswer).toBeDefined()
    })

    test("should generate pattern-archive activity", () => {
      const activity = generator.generateActivity(1, "pattern-archive", "explorer")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("word-family")
      expect(activity.pattern).toBeDefined()
    })

    test("should generate spell-forge activity", () => {
      const activity = generator.generateActivity(1, "spell-forge", "explorer")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("spelling")
      expect(activity.fullWord).toBeDefined()
    })

    test("should generate story-vault activity", () => {
      const activity = generator.generateActivity(1, "story-vault", "explorer")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("story")
      expect(activity.story).toBeDefined()
    })
  })

  describe("generateBeginningSound", () => {
    test("should generate beginning sound activity", () => {
      const soundGenerator = generator.generators["sound-cipher"]
      const activity = soundGenerator.generateBeginningSound(1)

      expect(activity.type).toBe("beginning-sound")
      expect(activity.correctAnswer).toMatch(/^[a-z]$/)
      expect(activity.choices).toHaveLength(3)
      expect(activity.choices).toContain(activity.correctAnswer)
      expect(activity.word).toBeDefined()
    })

    test("should use pictures when available", () => {
      const soundGenerator = generator.generators["sound-cipher"]
      // Find a word with a picture
      const wordsWithPics = wordBank
        .getWords("explorer", "cvc")
        .filter((w) => wordBank.hasPicture("explorer", w))

      if (wordsWithPics.length > 0) {
        const activity = soundGenerator.generateBeginningSound(0)
        if (activity.showPicture) {
          expect(activity.visual).toBeTruthy()
        }
      }
    })
  })

  describe("generateSimilarWords", () => {
    test("should generate similar words with correct answer included", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const words = baseGenerator.generateSimilarWords("cat", "explorer", 4)

      expect(words).toHaveLength(4)
      expect(words).toContain("cat")
    })

    test("should work for adventurer level with cvce words", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const words = baseGenerator.generateSimilarWords("bike", "adventurer", 4)

      expect(words).toHaveLength(4)
      expect(words).toContain("bike")
    })

    test("should handle explorer level without cvce words", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const words = baseGenerator.generateSimilarWords("cat", "explorer", 3)

      expect(words).toHaveLength(3)
      expect(words).toContain("cat")
    })
  })

  describe("breakIntoPhonemes", () => {
    test("should break simple words into phonemes", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const phonemes = baseGenerator.breakIntoPhonemes("cat")
      expect(phonemes).toEqual(["c", "a", "t"])
    })

    test("should handle digraphs", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const phonemes = baseGenerator.breakIntoPhonemes("shop")
      expect(phonemes).toEqual(["sh", "o", "p"])
    })

    test("should handle multiple digraphs", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const phonemes = baseGenerator.breakIntoPhonemes("check")
      expect(phonemes).toEqual(["ch", "e", "ck"])
    })

    test("should handle words without digraphs", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const phonemes = baseGenerator.breakIntoPhonemes("dog")
      expect(phonemes).toEqual(["d", "o", "g"])
    })
  })

  describe("breakIntoSyllables", () => {
    test("should break multi-syllable words", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const syllables = baseGenerator.breakIntoSyllables("rabbit")
      expect(syllables).toBeInstanceOf(Array)
      expect(syllables.length).toBeGreaterThan(1)
    })

    test("should handle single syllable words", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const syllables = baseGenerator.breakIntoSyllables("cat")
      expect(syllables).toHaveLength(1)
      expect(syllables[0]).toBe("cat")
    })

    test("should not return empty array", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const syllables = baseGenerator.breakIntoSyllables("window")
      expect(syllables.length).toBeGreaterThan(0)
    })
  })

  describe("getRandomItems", () => {
    test("should return requested number of items", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const items = ["a", "b", "c", "d", "e"]
      const result = baseGenerator.getRandomItems(items, 3)

      expect(result).toHaveLength(3)
    })

    test("should return all items if count exceeds array length", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const items = ["a", "b"]
      const result = baseGenerator.getRandomItems(items, 5)

      expect(result.length).toBeLessThanOrEqual(2)
    })

    test("should return unique items from array", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const items = ["a", "b", "c", "d"]
      const result = baseGenerator.getRandomItems(items, 3)

      const unique = new Set(result)
      expect(unique.size).toBe(result.length)
    })
  })

  describe("shuffleArray", () => {
    test("should return array with same length", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const arr = [1, 2, 3, 4, 5]
      const shuffled = baseGenerator.shuffleArray(arr)

      expect(shuffled).toHaveLength(arr.length)
    })

    test("should contain all original elements", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const arr = ["a", "b", "c", "d"]
      const shuffled = baseGenerator.shuffleArray(arr)

      arr.forEach((item) => {
        expect(shuffled).toContain(item)
      })
    })

    test("should not mutate original array", () => {
      const baseGenerator = generator.generators["sound-cipher"]
      const arr = [1, 2, 3]
      const original = [...arr]
      baseGenerator.shuffleArray(arr)

      expect(arr).toEqual(original)
    })
  })

  describe("getQuestTheme", () => {
    test("should return theme for valid quest", () => {
      const theme = generator.getQuestTheme("sound-cipher")

      expect(theme).toBeDefined()
      expect(theme.icon).toBeDefined()
      expect(theme.name).toBeDefined()
      expect(theme.description).toBeDefined()
    })

    test("should return default theme for invalid quest", () => {
      const theme = generator.getQuestTheme("invalid-quest")

      expect(theme).toBeDefined()
      expect(theme.name).toBe("Sound Code")
    })

    test("should have themes for all quests", () => {
      const quests = [
        "sound-cipher",
        "blending-workshop",
        "speed-vault",
        "pattern-archive",
        "spell-forge",
        "story-vault",
      ]

      quests.forEach((quest) => {
        const theme = generator.getQuestTheme(quest)
        expect(theme).toBeDefined()
        expect(theme.icon).toBeTruthy()
      })
    })
  })

  describe("activity variation by difficulty", () => {
    test("should generate different activities for different difficulties", () => {
      const explorer = generator.generateActivity(1, "sound-cipher", "explorer")
      const adventurer = generator.generateActivity(1, "sound-cipher", "adventurer")
      const master = generator.generateActivity(1, "sound-cipher", "master")

      // They should have different types or complexity
      expect([explorer.type, adventurer.type, master.type]).not.toEqual([
        explorer.type,
        explorer.type,
        explorer.type,
      ])
    })

    test("should generate appropriate complexity for master level", () => {
      const activity = generator.generateActivity(1, "sound-cipher", "master")

      // Master level should have more complex activity types
      expect(["r-controlled", "silent-letter", "vowel-team"]).toContain(activity.type)
    })
  })

  describe("getDecodableStories", () => {
    test("should return stories for explorer level", () => {
      const stories = getStoriesForDifficulty("explorer")

      expect(stories).toBeInstanceOf(Array)
      expect(stories.length).toBeGreaterThan(0)
      expect(stories[0]).toHaveProperty("text")
      expect(stories[0]).toHaveProperty("question")
      expect(stories[0]).toHaveProperty("answer")
      expect(stories[0]).toHaveProperty("choices")
    })

    test("should have progressively longer stories for higher levels", () => {
      const explorer = getStoriesForDifficulty("explorer")
      const master = getStoriesForDifficulty("master")

      const avgExplorerLength = explorer[0].text.length
      const avgMasterLength = master[0].text.length

      expect(avgMasterLength).toBeGreaterThan(avgExplorerLength)
    })
  })
})
