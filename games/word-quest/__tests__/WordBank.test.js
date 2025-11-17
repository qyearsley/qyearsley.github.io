/**
 * @jest-environment jsdom
 */
import { WordBank } from "../js/WordBank.js"

describe("WordBank", () => {
  let wordBank

  beforeEach(() => {
    wordBank = new WordBank()
  })

  describe("getWords", () => {
    test("should return CVC words for explorer level", () => {
      const words = wordBank.getWords("explorer", "cvc")
      expect(words).toBeInstanceOf(Array)
      expect(words.length).toBeGreaterThan(0)
      expect(words).toContain("cat")
      expect(words).toContain("dog")
    })

    test("should return empty array for non-existent category", () => {
      const words = wordBank.getWords("explorer", "nonexistent")
      expect(words).toEqual([])
    })

    test("should return empty array for non-existent difficulty", () => {
      const words = wordBank.getWords("nonexistent", "cvc")
      expect(words).toEqual([])
    })

    test("should return CVCe words for adventurer level", () => {
      const words = wordBank.getWords("adventurer", "cvce")
      expect(words).toBeInstanceOf(Array)
      expect(words.length).toBeGreaterThan(0)
      expect(words).toContain("make")
      expect(words).toContain("bike")
    })

    test("should return multi-syllable words for master level", () => {
      const words = wordBank.getWords("master", "multiSyllable")
      expect(words).toBeInstanceOf(Array)
      expect(words.length).toBeGreaterThan(0)
      expect(words).toContain("rabbit")
      expect(words).toContain("pencil")
    })
  })

  describe("getRandomWord", () => {
    test("should return a word from the specified category", () => {
      const word = wordBank.getRandomWord("explorer", "cvc")
      const allWords = wordBank.getWords("explorer", "cvc")
      expect(allWords).toContain(word)
    })

    test("should exclude specified words", () => {
      const exclude = ["cat", "dog", "sun"]
      const word = wordBank.getRandomWord("explorer", "cvc", exclude)
      expect(exclude).not.toContain(word)
    })

    test("should return a word even if all words are excluded", () => {
      const allWords = wordBank.getWords("explorer", "cvc")
      const word = wordBank.getRandomWord("explorer", "cvc", allWords)
      expect(word).toBeDefined()
    })
  })

  describe("getWordFamily", () => {
    test("should return words from the 'at' family for explorer level", () => {
      const family = wordBank.getWordFamily("explorer", "at")
      expect(family).toBeInstanceOf(Array)
      expect(family).toContain("cat")
      expect(family).toContain("bat")
      expect(family).toContain("hat")
    })

    test("should return words from the 'ake' family for adventurer level", () => {
      const family = wordBank.getWordFamily("adventurer", "ake")
      expect(family).toBeInstanceOf(Array)
      expect(family).toContain("make")
      expect(family).toContain("cake")
    })

    test("should return empty array for non-existent family", () => {
      const family = wordBank.getWordFamily("explorer", "xyz")
      expect(family).toEqual([])
    })
  })

  describe("getAllWordFamilies", () => {
    test("should return all word families for explorer level", () => {
      const families = wordBank.getAllWordFamilies("explorer")
      expect(families).toBeInstanceOf(Object)
      expect(families.at).toBeDefined()
      expect(families.ig).toBeDefined()
      expect(families.op).toBeDefined()
    })

    test("should return empty object for non-existent difficulty", () => {
      const families = wordBank.getAllWordFamilies("nonexistent")
      expect(families).toEqual({})
    })
  })

  describe("getSightWords", () => {
    test("should return all sight words when count is null", () => {
      const words = wordBank.getSightWords("explorer")
      expect(words).toBeInstanceOf(Array)
      expect(words.length).toBeGreaterThan(0)
      expect(words).toContain("the")
      expect(words).toContain("and")
    })

    test("should return specified count of sight words", () => {
      const words = wordBank.getSightWords("explorer", 5)
      expect(words).toHaveLength(5)
    })

    test("should return sight words for adventurer level", () => {
      const words = wordBank.getSightWords("adventurer")
      expect(words).toBeInstanceOf(Array)
      expect(words.length).toBeGreaterThan(0)
      expect(words).toContain("all")
      expect(words).toContain("are")
    })
  })

  describe("getPictureForWord", () => {
    test("should return emoji for words with pictures", () => {
      const picture = wordBank.getPictureForWord("explorer", "cat")
      expect(picture).toBe("🐱")
    })

    test("should return emoji for dog", () => {
      const picture = wordBank.getPictureForWord("explorer", "dog")
      expect(picture).toBe("🐶")
    })

    test("should return null for words without pictures", () => {
      const picture = wordBank.getPictureForWord("explorer", "test")
      expect(picture).toBeNull()
    })

    test("should return pictures for adventurer level words", () => {
      const picture = wordBank.getPictureForWord("adventurer", "bike")
      expect(picture).toBe("🚲")
    })

    test("should return pictures for master level words", () => {
      const picture = wordBank.getPictureForWord("master", "rabbit")
      expect(picture).toBe("🐰")
    })
  })

  describe("hasPicture", () => {
    test("should return true for words with pictures", () => {
      expect(wordBank.hasPicture("explorer", "cat")).toBe(true)
      expect(wordBank.hasPicture("explorer", "dog")).toBe(true)
    })

    test("should return false for words without pictures", () => {
      expect(wordBank.hasPicture("explorer", "test")).toBe(false)
      expect(wordBank.hasPicture("explorer", "xyz")).toBe(false)
    })

    test("should work across difficulty levels", () => {
      expect(wordBank.hasPicture("adventurer", "bike")).toBe(true)
      expect(wordBank.hasPicture("master", "rabbit")).toBe(true)
    })
  })

  describe("letterSounds", () => {
    test("should have consonant sounds defined", () => {
      expect(wordBank.letterSounds.consonants).toBeDefined()
      expect(wordBank.letterSounds.consonants.b).toBe("/b/ as in bat")
      expect(wordBank.letterSounds.consonants.c).toBe("/k/ as in cat")
    })

    test("should have short vowel sounds defined", () => {
      expect(wordBank.letterSounds.shortVowels).toBeDefined()
      expect(wordBank.letterSounds.shortVowels.a).toBe("/ă/ as in cat")
      expect(wordBank.letterSounds.shortVowels.e).toBe("/ĕ/ as in bed")
    })

    test("should have long vowel sounds defined", () => {
      expect(wordBank.letterSounds.longVowels).toBeDefined()
      expect(wordBank.letterSounds.longVowels.a).toBe("/ā/ as in cake")
      expect(wordBank.letterSounds.longVowels.i).toBe("/ī/ as in bike")
    })
  })
})
