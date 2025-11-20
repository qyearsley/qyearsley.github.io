/**
 * Measurement and Pattern Activities Generator
 * Handles measurement (length, weight) and pattern/sequence activities
 */
import { BaseMathGenerator } from "./BaseMathGenerator.js"

export class MeasurementAndPatternGenerator extends BaseMathGenerator {
  /**
   * Generate a measurement activity
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateMeasurement(areaId) {
    const measurementTypes = ["length", "weight"]
    const type = measurementTypes[Math.floor(Math.random() * measurementTypes.length)]

    if (type === "length") {
      return this.generateLength(areaId)
    } else {
      return this.generateWeight(areaId)
    }
  }

  /**
   * Generate length measurement activity
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateLength(areaId) {
    const length1 = Math.floor(Math.random() * 8) + 2 // 2-9 inches
    const length2 = Math.floor(Math.random() * 8) + 2

    const opType = Math.floor(Math.random() * 3) // 0=single, 1=add, 2=subtract

    let question, answer, visual

    if (opType === 0) {
      question = `How long is the line in inches?`
      answer = length1
      visual = [{ html: this.createRulerSVG(length1) }]
    } else if (opType === 1) {
      question = `One stick is ${length1} inches long. Another is ${length2} inches long. How long are they together?`
      answer = length1 + length2
      visual = [{ html: this.createRulerSVG(length1) }, { html: this.createRulerSVG(length2) }]
    } else {
      const longer = Math.max(length1, length2)
      const shorter = Math.min(length1, length2)
      question = `One rope is ${longer} inches long. Another rope is ${shorter} inches long. How much longer is the first rope?`
      answer = longer - shorter
      visual = [{ html: this.createRulerSVG(longer) }, { html: this.createRulerSVG(shorter) }]
    }

    return this.createActivity("measurement", question, answer, visual, areaId)
  }

  /**
   * Generate weight measurement activity
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateWeight(areaId) {
    const difficulty = this.getDifficulty()
    const numItems = Math.floor(Math.random() * 4) + 2 // 2-5 items
    const weightPer = difficulty === "easy" ? 1 : Math.floor(Math.random() * 2) + 1 // 1-2 pounds

    const totalWeight = numItems * weightPer
    const question = `${numItems} apples weigh ${weightPer} pound${weightPer > 1 ? "s" : ""} each. How many pounds in total?`
    const answer = totalWeight
    const visual = [{ html: this.createScaleSVG(numItems) }]

    return this.createActivity("measurement", question, answer, visual, areaId)
  }

  /**
   * Generate pattern/sequence activity
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generatePattern(areaId) {
    const difficulty = this.getDifficulty()
    const patternTypes = ["skipCount", "whatsMissing"]
    const type = patternTypes[Math.floor(Math.random() * patternTypes.length)]

    if (type === "skipCount") {
      return this.generateSkipCounting(difficulty, areaId)
    } else {
      return this.generateMissingNumber(difficulty, areaId)
    }
  }

  /**
   * Generate skip counting pattern
   * @param {string} difficulty - Difficulty level
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateSkipCounting(difficulty, areaId) {
    const skipBy =
      difficulty === "easy"
        ? [2, 5, 10][Math.floor(Math.random() * 3)]
        : [3, 4, 6][Math.floor(Math.random() * 3)]

    const startMultiplier = Math.floor(Math.random() * 3) + 1
    const start = skipBy * startMultiplier

    const sequence = [start, start + skipBy, start + skipBy * 2]
    const answer = start + skipBy * 3

    const question = `What number comes next?`
    const visual = [sequence.join("  ,  ") + "  ,  ?"]

    return this.createActivity("pattern", question, answer, visual, areaId)
  }

  /**
   * Generate missing number pattern
   * @param {string} difficulty - Difficulty level
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateMissingNumber(difficulty, areaId) {
    const diff =
      difficulty === "easy"
        ? [1, 2, 5, 10][Math.floor(Math.random() * 4)]
        : [3, 4, 6, 7][Math.floor(Math.random() * 4)]

    const firstNum = Math.floor(Math.random() * 10) + 1
    const fullSequence = [firstNum, firstNum + diff, firstNum + diff * 2, firstNum + diff * 3]

    const missingIndex = Math.floor(Math.random() * 2) + 1
    const answer = fullSequence[missingIndex]

    const displaySequence = fullSequence.map((num, idx) =>
      idx === missingIndex ? "__" : num.toString(),
    )

    const question = `What number is missing from the sequence?`
    const visual = [displaySequence.join("  ,  ")]

    return this.createActivity("pattern", question, answer, visual, areaId)
  }

  createRulerSVG(length) {
    return `
      <svg width="300" height="60" viewBox="0 0 300 60" style="display:inline-block">
        <rect x="0" y="20" width="${length * 25}" height="30" fill="none" stroke="#333" stroke-width="2"/>
        ${Array.from(
          { length: length + 1 },
          (_, i) => `
          <line x1="${i * 25}" y1="20" x2="${i * 25}" y2="50" stroke="#333" stroke-width="2"/>
          <text x="${i * 25}" y="15" text-anchor="middle" font-size="10">${i}</text>
        `,
        ).join("")}
      </svg>
    `
  }

  createScaleSVG(numItems) {
    const apples = Array.from(
      { length: numItems },
      (_, i) => `<text x="${20 + i * 25}" y="50" font-size="30">🍎</text>`,
    ).join("")

    return `
      <svg width="200" height="80" viewBox="0 0 200 80" style="display:inline-block">
        <text x="10" y="30" font-size="24">⚖️</text>
        ${apples}
      </svg>
    `
  }
}
