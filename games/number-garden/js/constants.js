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
  /** Duration to show project progress modal */
  PROJECT_MODAL_DELAY: 500,
}

/**
 * Default game settings
 */
export const DEFAULTS = {
  /** Number of questions required to complete a level */
  QUESTIONS_PER_LEVEL: 5,
  /** Available questions per level options */
  QUESTIONS_OPTIONS: [3, 5, 8],
  /** Default input mode */
  INPUT_MODE: "multipleChoice",
  /** Default visual hints level */
  VISUAL_HINTS: "medium",
  /** Default sound effects setting */
  SOUND_EFFECTS: "on",
  /** Default project type */
  PROJECT_TYPE: "castle",
  /** Default difficulty level */
  DIFFICULTY: "adventurer",
}

/**
 * Game progression constants
 */
export const PROGRESSION = {
  /** Total number of areas in the game */
  TOTAL_AREAS: 6,
  /** Stars earned per correct answer */
  STARS_PER_CORRECT: 1,
  /** Minimum stars to unlock next area */
  STARS_TO_UNLOCK: 10,
}

/**
 * Mathematical constants
 */
export const MATH = {
  /** Percentage multiplier */
  PERCENT_MULTIPLIER: 100,
  /** Half percentage */
  HALF_PERCENT: 50,
}

/**
 * Area identifiers
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
 * Project types
 */
export const PROJECTS = {
  CASTLE: "castle",
  GARDEN: "garden",
  ROBOT: "robot",
  SPACESHIP: "spaceship",
}

/**
 * Input modes
 */
export const INPUT_MODES = {
  MULTIPLE_CHOICE: "multipleChoice",
  KEYBOARD: "keyboard",
}

/**
 * Visual hint levels
 */
export const VISUAL_HINTS = {
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
}

/**
 * Sound effect settings
 */
export const SOUND_SETTINGS = {
  ON: "on",
  OFF: "off",
}

/**
 * Difficulty levels
 */
export const DIFFICULTY = {
  EXPLORER: "explorer",
  ADVENTURER: "adventurer",
  MASTER: "master",
}

/**
 * Difficulty ranges for operations
 */
export const DIFFICULTY_RANGES = {
  explorer: {
    max: 20,
    label: "Explorer (Ages 5-7)",
    description: "Numbers 1-20",
  },
  adventurer: {
    max: 50,
    label: "Adventurer (Ages 7-9)",
    description: "Numbers 1-50",
  },
  master: {
    max: 100,
    label: "Master (Ages 9-11)",
    description: "Numbers 1-100",
  },
}
