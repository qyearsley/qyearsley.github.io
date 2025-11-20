/**
 * Shared utility functions for educational games
 * These functions provide common operations used across multiple games
 */

/**
 * Get random items from an array without modifying the original
 * Uses Fisher-Yates shuffle algorithm for unbiased selection
 * @param {Array} array - Source array
 * @param {number} count - Number of items to select
 * @returns {Array} Array of randomly selected items
 */
export function getRandomItems(array, count) {
  if (count >= array.length) {
    return shuffleArray(array)
  }

  // Use Fisher-Yates to shuffle a copy
  const shuffled = shuffleArray(array)
  return shuffled.slice(0, Math.min(count, array.length))
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * Creates a new array to avoid mutating the original
 *
 * Why Fisher-Yates? It provides an unbiased shuffle (each permutation equally likely)
 * and runs in O(n) time, making it efficient for educational game content
 *
 * @param {Array} array - Array to shuffle
 * @returns {Array} New shuffled array
 */
export function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Generate plausible wrong answer options for math problems
 * Creates distractors that are close to correct answer to ensure meaningful difficulty
 *
 * Why use offsets? Research shows that math distractors should be within ±5 of the
 * correct answer to test understanding rather than wild guessing
 *
 * @param {number} correctAnswer - The correct answer
 * @param {number} maxRange - Maximum value for generated answers
 * @param {number} [count=3] - Number of wrong answers to generate
 * @returns {Array<number>} Array of all options (correct + wrong) shuffled
 */
export function generateMathOptions(correctAnswer, maxRange, count = 3) {
  const options = new Set([correctAnswer])

  // Generate wrong answers that are plausible (not random)
  while (options.size < count + 1) {
    let wrongAnswer

    // Generate plausible wrong answers within ±5 range
    const offset = Math.floor(Math.random() * 5) + 1
    if (Math.random() < 0.5) {
      wrongAnswer = correctAnswer + offset
    } else {
      wrongAnswer = correctAnswer - offset
    }

    // Ensure answer is positive and within reasonable range
    if (wrongAnswer > 0 && wrongAnswer <= maxRange && wrongAnswer !== correctAnswer) {
      options.add(wrongAnswer)
    }
  }

  // Convert to array and shuffle
  return shuffleArray(Array.from(options))
}

/**
 * Generate plausible wrong time options for time-telling activities
 * Creates realistic mistakes children make when reading clocks
 *
 * @param {number} correctHour - Correct hour (1-12)
 * @param {number} correctMinute - Correct minute (0-59)
 * @param {number} [count=3] - Number of wrong answers to generate
 * @returns {Array<string>} Array of time strings (e.g., "3:30")
 */
export function generateTimeOptions(correctHour, correctMinute, count = 3) {
  const minuteStr = correctMinute < 10 ? `0${correctMinute}` : `${correctMinute}`
  const correctAnswer = `${correctHour}:${minuteStr}`
  const options = new Set([correctAnswer])

  while (options.size < count + 1) {
    // Generate plausible wrong answers
    let wrongHour = correctHour
    let wrongMinute = correctMinute

    if (Math.random() < 0.5) {
      // Change hour (common mistake: off by 1 hour)
      wrongHour = correctHour + (Math.random() < 0.5 ? 1 : -1)
      if (wrongHour < 1) wrongHour = 12
      if (wrongHour > 12) wrongHour = 1
    } else {
      // Change minute (common mistakes: quarter hour increments)
      const minuteOptions = [0, 15, 30, 45]
      wrongMinute = minuteOptions[Math.floor(Math.random() * minuteOptions.length)]
    }

    const wrongMinuteStr = wrongMinute < 10 ? `0${wrongMinute}` : `${wrongMinute}`
    const wrongAnswer = `${wrongHour}:${wrongMinuteStr}`

    if (wrongAnswer !== correctAnswer) {
      options.add(wrongAnswer)
    }
  }

  return shuffleArray(Array.from(options))
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Format a number with leading zero if needed
 * @param {number} num - Number to format
 * @param {number} [digits=2] - Minimum number of digits
 * @returns {string} Formatted number string
 */
export function padNumber(num, digits = 2) {
  return num.toString().padStart(digits, "0")
}

/**
 * Check if a value is a valid number (not NaN, not Infinity)
 * @param {*} value - Value to check
 * @returns {boolean} True if valid number
 */
export function isValidNumber(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value)
}

/**
 * Safely parse a number from string, returning default if invalid
 * @param {string} str - String to parse
 * @param {number} [defaultValue=0] - Default value if parsing fails
 * @returns {number} Parsed number or default
 */
export function safeParseNumber(str, defaultValue = 0) {
  const parsed = parseFloat(str)
  return isValidNumber(parsed) ? parsed : defaultValue
}

/**
 * Deep clone an object (simple implementation for game data)
 * Note: Does not handle circular references or complex objects
 * Sufficient for simple game state and configuration objects
 *
 * @param {*} obj - Object to clone
 * @returns {*} Deep cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item))
  }

  const cloned = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }

  return cloned
}
