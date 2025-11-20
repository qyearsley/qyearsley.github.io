/**
 * Base class for activity generators
 * Provides common functionality shared across all activity types
 */
import { shuffleArray, getRandomItems } from "../../../common/js/utils.js"
import { VOWELS, DIGRAPHS } from "../constants.js"

export class BaseActivityGenerator {
  constructor(wordBank) {
    this.wordBank = wordBank
  }

  /**
   * Generate similar words for distractor choices
   * Why similar length? Distractors should be plausible to test actual reading, not just length recognition
   * @param {string} word - Target word
   * @param {string} difficulty - Difficulty level
   * @param {number} count - Number of choices to generate
   * @returns {Array<string>} Shuffled array of words including the target
   */
  generateSimilarWords(word, difficulty, count) {
    const cvcWords = this.wordBank.getWords(difficulty, "cvc")
    const cvceWords = this.wordBank.getWords(difficulty, "cvce")
    const allWords = [...cvcWords, ...cvceWords]

    // Find words with similar length (±1 character)
    const similarLength = allWords.filter(
      (w) => Math.abs(w.length - word.length) <= 1 && w !== word,
    )

    const distractors = getRandomItems(similarLength, count - 1)
    return shuffleArray([word, ...distractors])
  }

  /**
   * Break word into phonemes (individual sounds)
   * Handles digraphs as single units since they represent single sounds
   * @param {string} word - Word to analyze
   * @returns {Array<string>} Array of phonemes
   */
  breakIntoPhonemes(word) {
    const phonemes = []
    let i = 0

    while (i < word.length) {
      let foundDigraph = false

      // Check for digraphs first (they take precedence)
      for (const digraph of DIGRAPHS) {
        if (word.substring(i, i + 2) === digraph) {
          phonemes.push(digraph)
          i += 2
          foundDigraph = true
          break
        }
      }

      if (!foundDigraph) {
        phonemes.push(word[i])
        i++
      }
    }

    return phonemes
  }

  /**
   * Break word into syllables using basic heuristics
   * Note: This is a simplified algorithm suitable for common words
   * Why simple? Complex syllabification requires a dictionary; this handles 80% of cases
   * @param {string} word - Word to syllabify
   * @returns {Array<string>} Array of syllables
   */
  breakIntoSyllables(word) {
    const syllables = []
    let currentSyllable = ""

    for (let i = 0; i < word.length; i++) {
      currentSyllable += word[i]

      // Split after consonant following a vowel (basic V-CV rule)
      if (
        i > 0 &&
        VOWELS.includes(word[i - 1]) &&
        !VOWELS.includes(word[i]) &&
        i < word.length - 1
      ) {
        syllables.push(currentSyllable)
        currentSyllable = ""
      }
    }

    if (currentSyllable) syllables.push(currentSyllable)
    return syllables.length > 0 ? syllables : [word]
  }

  /**
   * Get random items from array (delegates to utility function)
   * @param {Array} array - Source array
   * @param {number} count - Number of items
   * @returns {Array} Random items
   */
  getRandomItems(array, count) {
    return getRandomItems(array, count)
  }

  /**
   * Shuffle array (delegates to utility function)
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    return shuffleArray(array)
  }
}
