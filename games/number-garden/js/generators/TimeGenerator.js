/**
 * Time Activities Generator
 * Handles clock reading and time elapsed activities
 */
import { BaseMathGenerator } from "./BaseMathGenerator.js"
import { generateTimeOptions } from "../../../common/js/utils.js"

export class TimeGenerator extends BaseMathGenerator {
  /**
   * Generate a time-related activity
   * Alternates between clock reading and elapsed time problems
   * @returns {Object} Activity object
   */
  generateActivity() {
    const difficulty = this.getDifficulty()

    // Mix between clock reading (70%) and time word problems (30%)
    // Why? Visual clock reading is more engaging for younger learners
    const useClockReading = Math.random() < 0.7

    if (useClockReading) {
      return this.generateClockReading(difficulty)
    } else {
      return this.generateTimeElapsed(difficulty)
    }
  }

  /**
   * Generate clock reading activity
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateClockReading(difficulty) {
    let hourOptions, minuteOptions

    // Progressive complexity in time increments
    switch (difficulty) {
      case "easy":
        hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        minuteOptions = [0, 30] // Hour and half-hour only
        break
      case "medium":
        hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        minuteOptions = [0, 15, 30, 45] // Add quarter hours
        break
      case "hard":
        hourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] // 5-minute intervals
        break
    }

    const hour = hourOptions[Math.floor(Math.random() * hourOptions.length)]
    const minute = minuteOptions[Math.floor(Math.random() * minuteOptions.length)]

    const minuteStr = minute < 10 ? `0${minute}` : `${minute}`
    const question = `What time does the clock show?`

    // Create SVG clock visual
    const clockSvg = this.createClockSVG(hour, minute)
    const visual = [{ html: clockSvg }]

    const answer = `${hour}:${minuteStr}`
    const options = generateTimeOptions(hour, minute)

    return {
      type: "time",
      question,
      correctAnswer: answer,
      options,
      visual,
      creature: "🕰️",
      creatureMessage: "Can you help me tell time?",
    }
  }

  /**
   * Generate time elapsed word problem
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Activity object
   */
  generateTimeElapsed(difficulty) {
    const startHour = Math.floor(Math.random() * 11) + 1 // 1-11
    let startMinute = 0
    let hoursToAdd = 0
    let minutesToAdd = 0

    switch (difficulty) {
      case "easy":
        hoursToAdd = [1, 2][Math.floor(Math.random() * 2)]
        break
      case "medium":
        hoursToAdd = [2, 3][Math.floor(Math.random() * 2)]
        break
      case "hard": {
        const useHalfHour = Math.random() < 0.5
        if (useHalfHour) {
          startMinute = [0, 30][Math.floor(Math.random() * 2)]
          minutesToAdd = 30
          hoursToAdd = [1, 2, 3][Math.floor(Math.random() * 3)]
        } else {
          hoursToAdd = [3, 4, 5][Math.floor(Math.random() * 3)]
        }
        break
      }
    }

    // Calculate end time
    let endMinute = startMinute + minutesToAdd
    let endHour = startHour + hoursToAdd

    if (endMinute >= 60) {
      endMinute -= 60
      endHour += 1
    }

    if (endHour > 12) {
      endHour -= 12
    }

    const startMinuteStr = startMinute < 10 ? `0${startMinute}` : `${startMinute}`
    const endMinuteStr = endMinute < 10 ? `0${endMinute}` : `${endMinute}`

    let timeDescription
    if (hoursToAdd > 0 && minutesToAdd > 0) {
      timeDescription = `${hoursToAdd} hour${hoursToAdd > 1 ? "s" : ""} and ${minutesToAdd} minutes`
    } else if (minutesToAdd > 0) {
      timeDescription = `${minutesToAdd} minutes`
    } else {
      timeDescription = `${hoursToAdd} hour${hoursToAdd > 1 ? "s" : ""}`
    }

    const question = `It is ${startHour}:${startMinuteStr}. What time is it ${timeDescription} later?`
    const answer = `${endHour}:${endMinuteStr}`
    const options = generateTimeOptions(endHour, endMinute)

    return {
      type: "time",
      question,
      correctAnswer: answer,
      options,
      visual: [],
      creature: "🕰️",
      creatureMessage: "Can you help me tell time?",
    }
  }

  /**
   * Create SVG clock face
   * @param {number} hour - Hour (1-12)
   * @param {number} minute - Minute (0-59)
   * @returns {string} SVG markup
   */
  createClockSVG(hour, minute) {
    const hourAngle = (hour % 12) * 30 + minute * 0.5 - 90
    const minuteAngle = minute * 6 - 90

    // Generate hour numbers
    const hourNumbers = Array.from({ length: 12 }, (_, i) => {
      const num = i === 0 ? 12 : i
      const angle = ((i * 30 - 90) * Math.PI) / 180
      const x = 60 + 40 * Math.cos(angle)
      const y = 60 + 40 * Math.sin(angle) + 5
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" fill="#333" font-weight="bold">${num}</text>`
    }).join("")

    // Generate tick marks
    const tickMarks = Array.from({ length: 60 }, (_, i) => {
      const angle = ((i * 6 - 90) * Math.PI) / 180
      const isHourMark = i % 5 === 0
      const innerRadius = isHourMark ? 48 : 50
      const outerRadius = 52
      const x1 = 60 + innerRadius * Math.cos(angle)
      const y1 = 60 + innerRadius * Math.sin(angle)
      const x2 = 60 + outerRadius * Math.cos(angle)
      const y2 = 60 + outerRadius * Math.sin(angle)
      const width = isHourMark ? 2 : 1
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="${width}"/>`
    }).join("")

    return `
      <svg width="140" height="140" viewBox="0 0 120 120" style="display:inline-block">
        <circle cx="60" cy="60" r="55" fill="white" stroke="#333" stroke-width="3"/>
        ${tickMarks}
        ${hourNumbers}
        <line x1="60" y1="60" x2="${60 + 30 * Math.cos((hourAngle * Math.PI) / 180)}" y2="${60 + 30 * Math.sin((hourAngle * Math.PI) / 180)}" stroke="#333" stroke-width="6" stroke-linecap="round"/>
        <line x1="60" y1="60" x2="${60 + 45 * Math.cos((minuteAngle * Math.PI) / 180)}" y2="${60 + 45 * Math.sin((minuteAngle * Math.PI) / 180)}" stroke="#666" stroke-width="4" stroke-linecap="round"/>
        <circle cx="60" cy="60" r="4" fill="#333"/>
      </svg>
    `
  }
}
