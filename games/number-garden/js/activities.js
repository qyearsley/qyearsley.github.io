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
import { AREAS } from "./constants.js"

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
  generateActivity(activityNumber, areaId = AREAS.FLOWER_MEADOW) {
    // Route to appropriate generator based on area
    // Each area teaches a specific math skill
    switch (areaId) {
      case AREAS.FLOWER_MEADOW:
        return this.basicMath.generateAddition(areaId)

      case AREAS.CRYSTAL_CAVE:
        return this.basicMath.generateSubtraction(areaId)

      case AREAS.ENCHANTED_FOREST:
        return this.basicMath.generateMultiplication(areaId)

      case AREAS.TIME_TEMPLE:
        return this.time.generateActivity()

      case AREAS.MEASUREMENT_MARKET:
        return this.measurementAndPattern.generateMeasurement(areaId)

      case AREAS.PATTERN_PATH:
        return this.measurementAndPattern.generatePattern(areaId)

      default:
        // Fallback to addition
        console.warn(`Unknown area: ${areaId}, falling back to ${AREAS.FLOWER_MEADOW}`)
        return this.basicMath.generateAddition(AREAS.FLOWER_MEADOW)
    }
  }
}
