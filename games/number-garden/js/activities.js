/**
 * Main Activity Generator for Number Garden
 * Delegates to specialized generators for each area type
 *
 * This architecture provides:
 * - Separation of concerns (each math concept has its own generator)
 * - Easier testing and maintenance
 * - Clearer code organization
 * - Reusable components
 */
import { BasicMathGenerator } from "./generators/BasicMathGenerator.js"
import { TimeGenerator } from "./generators/TimeGenerator.js"
import { MeasurementAndPatternGenerator } from "./generators/MeasurementAndPatternGenerator.js"

export class ActivityGenerator {
  constructor(gameState) {
    if (!gameState) {
      console.warn("ActivityGenerator: no gameState provided, using fallback")
    }

    this.gameState = gameState

    // Initialize specialized generators
    this.basicMath = new BasicMathGenerator(gameState)
    this.time = new TimeGenerator(gameState)
    this.measurementAndPattern = new MeasurementAndPatternGenerator(gameState)
  }

  /**
   * Generate an activity based on area and activity number
   * Each area focuses on a specific math concept
   *
   * @param {number} activityNumber - Activity sequence number (unused but kept for compatibility)
   * @param {string} areaId - Area identifier
   * @returns {Object} Activity object
   */
  generateActivity(activityNumber, areaId = "flower-meadow") {
    // Route to appropriate generator based on area
    // Each area teaches a specific math skill
    switch (areaId) {
      case "flower-meadow":
        return this.basicMath.generateAddition(areaId)

      case "crystal-cave":
        return this.basicMath.generateSubtraction(areaId)

      case "enchanted-forest":
        return this.basicMath.generateMultiplication(areaId)

      case "time-temple":
        return this.time.generateActivity()

      case "measurement-market":
        return this.measurementAndPattern.generateMeasurement(areaId)

      case "pattern-path":
        return this.measurementAndPattern.generatePattern(areaId)

      default:
        // Fallback to addition
        console.warn(`Unknown area: ${areaId}, falling back to flower-meadow`)
        return this.basicMath.generateAddition("flower-meadow")
    }
  }
}
