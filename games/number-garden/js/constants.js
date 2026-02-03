/**
 * Constants for Number Garden game
 * Centralizes magic numbers and configuration values
 */

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
