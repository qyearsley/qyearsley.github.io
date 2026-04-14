/**
 * Utility functions for Number Garden
 */

/**
 * Generate a random integer in the range [min, max] (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer between min and max
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Pick a random element from an array
 * @param {Array} array - Source array
 * @returns {*} Random element
 */
export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * Creates a new array to avoid mutating the original
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
 * Get random items from an array without modifying the original
 * @param {Array} array - Source array
 * @param {number} count - Number of items to select
 * @returns {Array} Array of randomly selected items
 */
export function getRandomItems(array, count) {
  if (count >= array.length) {
    return shuffleArray(array)
  }

  const shuffled = shuffleArray(array)
  return shuffled.slice(0, Math.min(count, array.length))
}

/**
 * Generate plausible wrong answer options for math problems
 * Creates distractors that are close to correct answer
 *
 * @param {number} correctAnswer - The correct answer
 * @param {number} maxRange - Maximum value for generated answers
 * @param {number} [count=3] - Number of wrong answers to generate
 * @returns {Array<number>} Array of all options (correct + wrong) shuffled
 */
export function generateMathOptions(correctAnswer, maxRange, count = 3) {
  const options = new Set([correctAnswer])

  // Generate wrong answers that are plausible (within ±5 range)
  while (options.size < count + 1) {
    const offset = randomInt(1, 5)
    const wrongAnswer = Math.random() < 0.5 ? correctAnswer + offset : correctAnswer - offset

    if (wrongAnswer > 0 && wrongAnswer <= maxRange && wrongAnswer !== correctAnswer) {
      options.add(wrongAnswer)
    }
  }

  return shuffleArray(Array.from(options))
}

/**
 * Generate plausible wrong time options for time-telling activities
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
    let wrongHour = correctHour
    let wrongMinute = correctMinute

    if (Math.random() < 0.5) {
      // Change hour (off by 1)
      wrongHour = correctHour + (Math.random() < 0.5 ? 1 : -1)
      if (wrongHour < 1) wrongHour = 12
      if (wrongHour > 12) wrongHour = 1
    } else {
      // Change minute (quarter hour increments)
      const minuteOptions = [0, 15, 30, 45]
      wrongMinute = randomChoice(minuteOptions)
    }

    const wrongMinuteStr = wrongMinute < 10 ? `0${wrongMinute}` : `${wrongMinute}`
    const wrongAnswer = `${wrongHour}:${wrongMinuteStr}`

    if (wrongAnswer !== correctAnswer) {
      options.add(wrongAnswer)
    }
  }

  return shuffleArray(Array.from(options))
}
