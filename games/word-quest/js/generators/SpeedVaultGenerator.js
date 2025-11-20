/**
 * Speed Vault (Rhyming) Activity Generator
 * Focuses on phonological awareness through rhyme recognition
 */
import { BaseActivityGenerator } from "./BaseActivityGenerator.js"

export class SpeedVaultGenerator extends BaseActivityGenerator {
  /**
   * Generate a rhyming activity
   * Alternates between rhyme matching and odd-one-out activities
   * @param {number} activityNumber - Activity sequence number
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, difficulty) {
    // Alternate for variety - research shows mixed practice improves retention
    const useOddOneOut = activityNumber % 2 === 0

    if (useOddOneOut) {
      return this.generateOddOneOut(activityNumber, difficulty)
    } else {
      return this.generateRhymeMatching(activityNumber, difficulty)
    }
  }

  /**
   * Rhyme Matching - Find which word rhymes with the target
   * Teaching goal: Identify matching ending sounds
   */
  generateRhymeMatching(activityNumber, difficulty) {
    const families = this.wordBank.getAllWordFamilies(difficulty)
    const familyKeys = Object.keys(families)
    const familyKey = familyKeys[activityNumber % familyKeys.length]
    const familyWords = families[familyKey]

    // Select target word and correct rhyme from same family
    const targetWord = familyWords[activityNumber % familyWords.length]
    const correctWord = familyWords[(activityNumber + 1) % familyWords.length]

    // Generate non-rhyming distractors from different families
    const otherFamilyKeys = familyKeys.filter((k) => k !== familyKey)
    const distractors = []

    for (let i = 0; i < 2 && i < otherFamilyKeys.length; i++) {
      const otherFamily = otherFamilyKeys[(activityNumber + i) % otherFamilyKeys.length]
      const otherWords = families[otherFamily]
      if (otherWords.length > 0) {
        distractors.push(otherWords[activityNumber % otherWords.length])
      }
    }

    // Fallback: ensure we always have 2 distractors
    while (distractors.length < 2) {
      const allWords = this.wordBank.getWords(difficulty, "cvc")
      const nonRhyming = allWords.filter((w) => !w.endsWith(familyKey) && w !== targetWord)
      if (nonRhyming.length > 0) {
        const distractor = nonRhyming[activityNumber % nonRhyming.length]
        if (!distractors.includes(distractor)) {
          distractors.push(distractor)
        }
      }
    }

    return {
      type: "rhyme-matching",
      question: `Which word rhymes with "${targetWord}"?`,
      visual: targetWord,
      correctAnswer: correctWord,
      choices: this.shuffleArray([correctWord, ...distractors.slice(0, 2)]),
      audioWord: targetWord,
      hint: `Words that rhyme have the same ending sound!`,
      word: targetWord,
      rhymesWith: correctWord,
    }
  }

  /**
   * Odd One Out - Find the word that doesn't rhyme
   * Teaching goal: Negative discrimination (identify what doesn't fit)
   * Why this matters: Research shows identifying non-examples strengthens concept understanding
   */
  generateOddOneOut(activityNumber, difficulty) {
    const families = this.wordBank.getAllWordFamilies(difficulty)
    const familyKeys = Object.keys(families)
    const familyKey = familyKeys[activityNumber % familyKeys.length]
    const familyWords = families[familyKey]

    // Pick 3 words from same family (that rhyme)
    const rhymingWords = []
    for (let i = 0; i < 3 && i < familyWords.length; i++) {
      rhymingWords.push(familyWords[(activityNumber + i) % familyWords.length])
    }

    // Pick 1 word from different family as the odd one out
    const otherFamilyKeys = familyKeys.filter((k) => k !== familyKey)
    let oddWord = null

    if (otherFamilyKeys.length > 0) {
      const otherFamily = otherFamilyKeys[activityNumber % otherFamilyKeys.length]
      const otherWords = families[otherFamily]
      if (otherWords.length > 0) {
        oddWord = otherWords[activityNumber % otherWords.length]
      }
    }

    // Fallback if we couldn't find an odd word
    if (!oddWord) {
      const allWords = this.wordBank.getWords(difficulty, "cvc")
      const nonRhyming = allWords.filter((w) => !w.endsWith(familyKey))
      if (nonRhyming.length > 0) {
        oddWord = nonRhyming[activityNumber % nonRhyming.length]
      }
    }

    return {
      type: "odd-one-out",
      question: `Which word does NOT rhyme with the others?`,
      visual: null,
      correctAnswer: oddWord,
      choices: this.shuffleArray([...rhymingWords, oddWord]),
      audioWord: null,
      hint: `Three words rhyme, but one is different!`,
      word: null,
      rhymingGroup: rhymingWords,
      oddWord: oddWord,
    }
  }
}
