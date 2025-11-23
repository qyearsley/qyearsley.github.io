/**
 * Spell Forge Activity Generator
 * Focuses on fill-in-the-blank spelling practice
 */
import { BaseActivityGenerator } from "./BaseActivityGenerator.js"

export class SpellForgeGenerator extends BaseActivityGenerator {
  /**
   * Generate a spelling fill-in-the-blank activity
   * @param {number} activityNumber - Activity sequence number
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, difficulty) {
    let wordType = "cvc"
    if (difficulty === "adventurer") {
      wordType = activityNumber % 2 === 0 ? "cvce" : "digraphs"
    } else if (difficulty === "master") {
      wordType = activityNumber % 2 === 0 ? "multiSyllable" : "complexPatterns"
    }

    const words = this.wordBank.getWords(difficulty, wordType)
    const correctWord = words[activityNumber % words.length]

    // Create fill-in-the-blank (blank out middle letter)
    const blankPosition = Math.floor(correctWord.length / 2)
    const blanked = correctWord
      .split("")
      .map((l, i) => (i === blankPosition ? "_" : l))
      .join("")

    const correctLetter = correctWord[blankPosition]
    const distractors = this.getRandomItems(
      "abcdefghijklmnopqrstuvwxyz".split("").filter((l) => l !== correctLetter),
      2,
    )

    return {
      type: "spelling",
      question: `Fill in the blank to spell the word:`,
      visual: blanked,
      correctAnswer: correctLetter,
      choices: this.shuffleArray([correctLetter, ...distractors]),
      audioWord: correctWord,
      autoPlayAudio: true, // Listening is integral to this question
      hint: `Listen to the word and think about each sound!`,
      word: correctWord,
      fullWord: correctWord,
    }
  }
}
