/**
 * Base Activity Generator for Number Garden
 * Provides common functionality for all math activity generators
 */
import { shuffleArray, generateMathOptions, getRandomItems } from "../../../common/js/utils.js"
import { getAreaTheme, getRandomMessage, getRandomVisualEmoji } from "../../data/areaThemes.js"

export class BaseMathGenerator {
  constructor(gameState) {
    this.gameState = gameState
  }

  /**
   * Get difficulty level based on user settings
   * Maps user-friendly names to internal difficulty levels
   * @returns {'easy'|'medium'|'hard'} Difficulty level
   */
  getDifficulty() {
    const userDifficulty = this.gameState?.settings?.difficulty || "adventurer"

    // Why this mapping? Matches age-appropriate skill levels
    // Explorer (5-7): Numbers 1-10
    // Adventurer (7-9): Numbers 1-15
    // Master (9-11): Numbers 1-20+
    const difficultyMap = {
      explorer: "easy",
      adventurer: "medium",
      master: "hard",
    }

    return difficultyMap[userDifficulty] || "medium"
  }

  /**
   * Create visual items for display
   * @param {number} count1 - First group count
   * @param {number} count2 - Second group count (optional)
   * @param {string} areaId - Area identifier
   * @returns {Array} Visual items array
   */
  createVisualItems(count1, count2, areaId) {
    const visual = []

    // First group
    const emoji1 = getRandomVisualEmoji(areaId, 1)
    for (let i = 0; i < count1; i++) {
      visual.push(emoji1)
    }

    // Second group (if exists)
    if (count2 > 0) {
      const emoji2 = getRandomVisualEmoji(areaId, 2)
      for (let i = 0; i < count2; i++) {
        visual.push(emoji2)
      }
    }

    return visual
  }

  /**
   * Generate activity response object
   * @param {string} type - Activity type
   * @param {string} question - Question text
   * @param {number|string} answer - Correct answer
   * @param {Array} visual - Visual representation
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  createActivity(type, question, answer, visual, areaId) {
    return {
      type,
      question,
      correctAnswer: answer,
      options: this.generateOptions(answer),
      visual,
      creature: getAreaTheme(areaId).creature,
      creatureMessage: getRandomMessage(areaId),
    }
  }

  /**
   * Generate answer options
   * Delegates to utility function with appropriate max range
   * @param {number} correctAnswer - The correct answer
   * @returns {Array<number>} Shuffled answer options
   */
  generateOptions(correctAnswer) {
    // Use appropriate max range based on answer magnitude
    const maxRange = correctAnswer <= 20 ? 40 : Math.max(50, correctAnswer * 2)
    return generateMathOptions(correctAnswer, maxRange)
  }

  /**
   * Shuffle array (delegates to utility)
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    return shuffleArray(array)
  }

  /**
   * Get random items (delegates to utility)
   * @param {Array} array - Source array
   * @param {number} count - Number of items
   * @returns {Array} Random items
   */
  getRandomItems(array, count) {
    return getRandomItems(array, count)
  }
}
