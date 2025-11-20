/**
 * Pattern Archive Activity Generator
 * Focuses on word families and pattern recognition
 */
import { BaseActivityGenerator } from "./BaseActivityGenerator.js"

export class PatternArchiveGenerator extends BaseActivityGenerator {
  /**
   * Generate a word family/pattern activity
   * @param {number} activityNumber - Activity sequence number
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, difficulty) {
    const families = this.wordBank.getAllWordFamilies(difficulty)
    const familyKeys = Object.keys(families)
    const familyKey = familyKeys[activityNumber % familyKeys.length]
    const familyWords = families[familyKey]

    const correctWord = familyWords[activityNumber % familyWords.length]

    return {
      type: "word-family",
      question: `Which word belongs to the "-${familyKey}" family?`,
      visual: `Pattern: -${familyKey}`,
      correctAnswer: correctWord,
      choices: [
        correctWord,
        ...this.getRandomItems(
          this.wordBank.getWords(difficulty, "cvc").filter((w) => !w.endsWith(familyKey)),
          2,
        ),
      ],
      audioWord: correctWord,
      hint: `Listen for the rhyme!`,
      word: correctWord,
      pattern: familyKey,
    }
  }
}
