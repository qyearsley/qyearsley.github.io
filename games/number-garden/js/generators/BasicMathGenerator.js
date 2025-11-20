/**
 * Basic Math Operations Generator (Addition, Subtraction, Multiplication)
 * Handles the three core arithmetic operations with visual representations
 */
import { BaseMathGenerator } from "./BaseMathGenerator.js"
import { getRandomVisualEmoji } from "../../data/areaThemes.js"

export class BasicMathGenerator extends BaseMathGenerator {
  /**
   * Generate an addition activity
   * Teaching goal: Combine two groups to find the total
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateAddition(areaId) {
    const difficulty = this.getDifficulty()

    // Why these ranges? Research shows children can reliably count:
    // - Age 5-6: up to 10
    // - Age 7-8: up to 15
    // - Age 9+: up to 20
    const max = {
      easy: 10,
      medium: 15,
      hard: 20,
    }[difficulty]

    const num1 = Math.floor(Math.random() * max) + 1
    const num2 = Math.floor(Math.random() * max) + 1
    const answer = num1 + num2

    const visual = this.createVisualItems(num1, num2, areaId)
    const question = `${num1} + ${num2} = ?`

    return this.createActivity("addition", question, answer, visual, areaId)
  }

  /**
   * Generate a subtraction activity
   * Teaching goal: Take away from a group to find remainder
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateSubtraction(areaId) {
    const difficulty = this.getDifficulty()

    const max = {
      easy: 10,
      medium: 15,
      hard: 20,
    }[difficulty]

    // Start with larger number to ensure positive result
    const num1 = Math.floor(Math.random() * max) + Math.floor(max / 2) + 1
    const num2 = Math.floor(Math.random() * (num1 - 1)) + 1
    const answer = num1 - num2

    // Create visual with crossed-out items to show subtraction
    const visual = this.createSubtractionVisual(num1, num2, areaId)
    const question = `${num1} - ${num2} = ?`

    return this.createActivity("subtraction", question, answer, visual, areaId)
  }

  /**
   * Generate a multiplication activity
   * Teaching goal: Count groups of items
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateMultiplication(areaId) {
    const difficulty = this.getDifficulty()

    // Keep one operand small (2-5) for visual manageability
    // Why? Displaying 8 groups of 9 items (72 emojis) overwhelms the screen
    const smallNum = Math.floor(Math.random() * 4) + 2 // 2-5

    const largeNum = {
      easy: Math.floor(Math.random() * 5) + 1, // 1-5
      medium: Math.floor(Math.random() * 7) + 1, // 1-7
      hard: Math.floor(Math.random() * 10) + 1, // 1-10
    }[difficulty]

    const answer = smallNum * largeNum

    const visual = this.createMultiplicationVisual(smallNum, largeNum, areaId)
    const question = `${smallNum} × ${largeNum} = ?`

    return this.createActivity("multiplication", question, answer, visual, areaId)
  }

  /**
   * Create subtraction visual with crossed-out items
   * @param {number} total - Starting amount
   * @param {number} toSubtract - Amount to subtract
   * @param {string} areaId - Area identifier
   * @returns {Array} Visual items array
   */
  createSubtractionVisual(total, toSubtract, areaId) {
    const visual = []
    const emoji = getRandomVisualEmoji(areaId, 1)

    // Items that remain (not crossed out)
    for (let i = 0; i < total - toSubtract; i++) {
      visual.push(emoji)
    }

    // Crossed out items to show what was subtracted
    for (let i = 0; i < toSubtract; i++) {
      visual.push({ crossed: true, emoji: emoji })
    }

    return visual
  }

  /**
   * Create multiplication visual with grouped items
   * @param {number} groups - Number of groups
   * @param {number} itemsPerGroup - Items in each group
   * @param {string} areaId - Area identifier
   * @returns {Array} Visual items array
   */
  createMultiplicationVisual(groups, itemsPerGroup, areaId) {
    const visual = []
    const emoji = getRandomVisualEmoji(areaId, 1)

    // Create groups of items with separators
    for (let group = 0; group < groups; group++) {
      // Add items in this group
      for (let i = 0; i < itemsPerGroup; i++) {
        visual.push(emoji)
      }

      // Add separator between groups (but not after the last group)
      if (group < groups - 1) {
        visual.push({ separator: true, emoji: "|" })
      }
    }

    return visual
  }
}
