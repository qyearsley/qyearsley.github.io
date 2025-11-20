/**
 * Constants for Word Quest game
 * Centralizes magic numbers and strings for maintainability
 */

// Phonics constants
export const CONSONANTS = "bcdfghijklmnpqrstvwxyz"
export const VOWELS = "aeiou"
export const DIGRAPHS = ["ch", "sh", "th", "wh", "ph", "ck"]
export const R_CONTROLLED_PATTERNS = ["ar", "er", "ir", "or", "ur"]
export const SILENT_LETTER_PATTERNS = {
  kn: "k",
  wr: "w",
  mb: "b",
}

// Timing constants (in milliseconds)
// Why these values? User testing showed children need time to process feedback
// before moving to next question, but not so long they lose engagement
export const TIMING = {
  FEEDBACK_DISPLAY: 1000, // Time to show correct/incorrect feedback before advancing
  WORD_CARD_FLIP: 600, // Animation duration for word gallery card flip
  AUTO_ADVANCE_DELAY: 1000, // Delay before auto-advancing to next question
}

// Quest order
// This defines the progression sequence - order matters for unlocking
export const QUEST_ORDER = [
  "sound-cipher",
  "blending-workshop",
  "speed-vault",
  "pattern-archive",
  "spell-forge",
  "story-vault",
]

// Difficulty settings
export const DIFFICULTY_LEVELS = {
  EXPLORER: "explorer",
  ADVENTURER: "adventurer",
  MASTER: "master",
}

// Input modes
export const INPUT_MODES = {
  MULTIPLE_CHOICE: "multipleChoice",
  KEYBOARD: "keyboard",
}

// Default settings
export const DEFAULT_SETTINGS = {
  difficulty: DIFFICULTY_LEVELS.ADVENTURER,
  inputMode: INPUT_MODES.MULTIPLE_CHOICE,
  questionsPerLevel: 5,
  audioHints: true,
}

// Decoder ranks based on stars earned
// These thresholds were chosen to provide regular progression milestones
// roughly every 1-2 hours of play time
export const DECODER_RANKS = [
  { stars: 0, name: "Apprentice Decoder" },
  { stars: 20, name: "Journeyman Decoder" },
  { stars: 50, name: "Expert Decoder" },
  { stars: 100, name: "Master Decoder" },
  { stars: 200, name: "Grand Decoder" },
]

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  CHOICE_1: "1",
  CHOICE_2: "2",
  CHOICE_3: "3",
  CHOICE_4: "4",
  SHORT_VOWEL: "s",
  LONG_VOWEL: "l",
  ESCAPE: "Escape",
  ENTER: "Enter",
}
