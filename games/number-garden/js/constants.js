/**
 * Constants for Number Garden game
 * Centralizes magic numbers and configuration values
 */

/**
 * Area identifiers used throughout the game
 */
export const AREAS = {
  FLOWER_MEADOW: "flower-meadow",
  CRYSTAL_CAVE: "crystal-cave",
  ENCHANTED_FOREST: "enchanted-forest",
  TIME_TEMPLE: "time-temple",
  MEASUREMENT_MARKET: "measurement-market",
  PATTERN_PATH: "pattern-path",
}

/**
 * Human-readable area names
 */
export const AREA_NAMES = {
  [AREAS.FLOWER_MEADOW]: "Flower Meadow",
  [AREAS.CRYSTAL_CAVE]: "Crystal Cave",
  [AREAS.ENCHANTED_FOREST]: "Enchanted Forest",
  [AREAS.TIME_TEMPLE]: "Time Temple",
  [AREAS.MEASUREMENT_MARKET]: "Measurement Market",
  [AREAS.PATTERN_PATH]: "Pattern Path",
}

/**
 * Area emoji icons (used in castle pieces display)
 */
export const AREA_ICONS = {
  [AREAS.FLOWER_MEADOW]: "🦄",
  [AREAS.CRYSTAL_CAVE]: "🔮",
  [AREAS.ENCHANTED_FOREST]: "🧚",
  [AREAS.TIME_TEMPLE]: "🕰️",
  [AREAS.MEASUREMENT_MARKET]: "🦊",
  [AREAS.PATTERN_PATH]: "🦋",
}

/**
 * Timing constants (in milliseconds)
 */
export const TIMING = {
  /** Delay before showing level complete screen after correct answer */
  LEVEL_COMPLETE_DELAY: 1500,
  /** Delay before generating next activity after correct answer */
  NEXT_ACTIVITY_DELAY: 1500,
  /** Delay before re-enabling answer buttons after wrong answer */
  RETRY_DELAY: 1000,
}

/**
 * Default game settings
 */
export const DEFAULTS = {
  /** Number of questions required to complete a level */
  QUESTIONS_PER_LEVEL: 5,
}

/**
 * Mathematical constants
 */
export const MATH = {
  /** Percentage multiplier */
  PERCENT_MULTIPLIER: 100,
}
