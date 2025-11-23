/**
 * Blending Workshop Activity Generator
 * Focuses on blending phonemes into words (encoding/spelling)
 */
import { BaseActivityGenerator } from "./BaseActivityGenerator.js"
import { DIGRAPHS, VOWELS } from "../constants.js"

export class BlendingWorkshopGenerator extends BaseActivityGenerator {
  /**
   * Generate a blending/spelling activity
   * @param {number} activityNumber - Activity sequence number
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, difficulty) {
    if (difficulty === "explorer") {
      return this.generateSpellBeginning(activityNumber)
    } else if (difficulty === "adventurer") {
      return this.generateSpellMiddle(activityNumber)
    } else {
      return this.generateSpellSyllable(activityNumber)
    }
  }

  /**
   * Explorer: Spell the beginning sound
   * Teaching goal: Initial consonant encoding
   */
  generateSpellBeginning(activityNumber) {
    const words = this.wordBank.getWords("explorer", "cvc")
    const correctWord = words[activityNumber % words.length]
    const firstLetter = correctWord[0]
    const restOfWord = correctWord.substring(1)

    const allLetters = "bcdfghjklmnpqrstvwxyz".split("")
    const distractors = this.getRandomItems(
      allLetters.filter((l) => l !== firstLetter),
      2,
    )

    return {
      type: "spell-beginning",
      question: `What letter does this word start with?`,
      visual: `_ ${restOfWord}`,
      correctAnswer: firstLetter,
      choices: this.shuffleArray([firstLetter, ...distractors]),
      audioWord: correctWord,
      autoPlayAudio: true, // Listening is integral to this question
      hint: `Listen to the first sound!`,
      word: correctWord,
    }
  }

  /**
   * Adventurer: Spell vowels and digraphs
   * Teaching goal: Medial sound encoding
   */
  generateSpellMiddle(activityNumber) {
    const useDigraph = activityNumber % 2 === 0
    const words = useDigraph
      ? this.wordBank.getWords("adventurer", "digraphs")
      : this.wordBank.getWords("adventurer", "cvce")
    const correctWord = words[activityNumber % words.length]

    // For digraphs, find and blank out the digraph
    if (useDigraph) {
      for (const digraph of DIGRAPHS) {
        const index = correctWord.indexOf(digraph)
        if (index !== -1) {
          const before = correctWord.substring(0, index)
          const after = correctWord.substring(index + 2)
          const distractors = DIGRAPHS.filter((d) => d !== digraph).slice(0, 2)

          return {
            type: "spell-digraph",
            question: `How do you spell this word?`,
            visual: `${before} _ ${after}`,
            correctAnswer: digraph,
            choices: this.shuffleArray([digraph, ...distractors]),
            audioWord: correctWord,
            autoPlayAudio: true, // Listening is integral to this question
            hint: `Listen for the digraph sound!`,
            word: correctWord,
          }
        }
      }
    }

    // For CVCe, blank out the vowel
    const vowelIndex = correctWord.search(/[aeiou]/)
    if (vowelIndex !== -1) {
      const vowel = correctWord[vowelIndex]
      const before = correctWord.substring(0, vowelIndex)
      const after = correctWord.substring(vowelIndex + 1)
      const distractors = VOWELS.split("")
        .filter((v) => v !== vowel)
        .slice(0, 2)

      return {
        type: "spell-vowel",
        question: `What vowel do you hear in this word?`,
        visual: `${before} _ ${after}`,
        correctAnswer: vowel,
        choices: this.shuffleArray([vowel, ...distractors]),
        audioWord: correctWord,
        autoPlayAudio: true, // Listening is integral to this question
        hint: `Listen for the long vowel sound!`,
        word: correctWord,
      }
    }

    // Fallback to beginning sound
    return this.generateSpellBeginning(activityNumber)
  }

  /**
   * Master: Spell syllables in multi-syllable words
   * Teaching goal: Syllable awareness and encoding
   */
  generateSpellSyllable(activityNumber) {
    const words = this.wordBank.getWords("master", "multiSyllable")
    const correctWord = words[activityNumber % words.length]
    const syllables = this.breakIntoSyllables(correctWord)

    if (syllables.length >= 2) {
      // Pick a syllable to blank out
      const blankIndex = activityNumber % syllables.length
      const correctSyllable = syllables[blankIndex]

      // Create visual with blank
      const visual = syllables.map((syl, i) => (i === blankIndex ? "___" : syl)).join("")

      // Generate distractors (other syllables from similar words)
      const allWords = this.wordBank.getWords("master", "multiSyllable")
      const allSyllables = []
      for (const w of allWords) {
        allSyllables.push(...this.breakIntoSyllables(w))
      }
      const distractors = this.getRandomItems(
        allSyllables.filter((s) => s !== correctSyllable && s.length === correctSyllable.length),
        2,
      )

      return {
        type: "spell-syllable",
        question: `What syllable is missing?`,
        visual: visual,
        correctAnswer: correctSyllable,
        choices: this.shuffleArray([correctSyllable, ...distractors]),
        audioWord: correctWord,
        autoPlayAudio: true, // Listening is integral to this question
        hint: `Listen to the whole word!`,
        word: correctWord,
      }
    }

    // Fallback if word doesn't split well
    return this.generateSpellBeginning(activityNumber)
  }
}
