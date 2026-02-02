import { describe, test, expect, beforeEach } from "@jest/globals"
import { TimeGenerator } from "../js/generators/TimeGenerator.js"

describe("TimeGenerator", () => {
  let generator

  const mockGameState = {
    settings: {
      difficulty: "adventurer",
    },
  }

  beforeEach(() => {
    generator = new TimeGenerator(mockGameState)
  })

  describe("generateActivity", () => {
    test("generates valid activity object", () => {
      const activity = generator.generateActivity()

      expect(activity).toBeDefined()
      expect(activity.type).toBe("time")
      expect(activity.question).toBeDefined()
      expect(activity.correctAnswer).toBeDefined()
      expect(activity.options).toBeDefined()
      expect(Array.isArray(activity.options)).toBe(true)
      expect(activity.creature).toBe("🕰️")
      expect(activity.creatureMessage).toBe("Can you help me tell time?")
    })

    test("generates activity with correct answer in options", () => {
      const activity = generator.generateActivity()

      expect(activity.options).toContain(activity.correctAnswer)
    })

    test("generates multiple choice options", () => {
      const activity = generator.generateActivity()

      expect(activity.options.length).toBeGreaterThanOrEqual(3)
      expect(activity.options.length).toBeLessThanOrEqual(4)
    })
  })

  describe("generateClockReading", () => {
    test("generates clock reading activity for easy difficulty", () => {
      const activity = generator.generateClockReading("easy")

      expect(activity.type).toBe("time")
      expect(activity.question).toContain("What time does the clock show?")
      expect(activity.visual).toBeDefined()
      expect(activity.visual.length).toBeGreaterThan(0)
      expect(activity.visual[0].html).toContain("<svg")
    })

    test("generates valid time format", () => {
      const activity = generator.generateClockReading("easy")
      const timePattern = /^\d{1,2}:\d{2}$/

      expect(activity.correctAnswer).toMatch(timePattern)
    })

    test("generates clock SVG with proper structure", () => {
      const activity = generator.generateClockReading("medium")
      const svg = activity.visual[0].html

      expect(svg).toContain("<svg")
      expect(svg).toContain("<circle")
      expect(svg).toContain("<line")
      expect(svg).toContain("</svg>")
    })

    test("handles different difficulty levels", () => {
      const easyActivity = generator.generateClockReading("easy")
      const mediumActivity = generator.generateClockReading("medium")
      const hardActivity = generator.generateClockReading("hard")

      expect(easyActivity.correctAnswer).toMatch(/^\d{1,2}:(00|30)$/)
      expect(mediumActivity.correctAnswer).toBeDefined()
      expect(hardActivity.correctAnswer).toBeDefined()
    })
  })

  describe("generateTimeElapsed", () => {
    test("generates time elapsed activity", () => {
      const activity = generator.generateTimeElapsed("easy")

      expect(activity.type).toBe("time")
      expect(activity.question).toContain("What time will it be")
      expect(activity.correctAnswer).toMatch(/^\d{1,2}:\d{2}$/)
    })

    test("generates valid time calculations", () => {
      const activity = generator.generateTimeElapsed("medium")
      const [hour, minute] = activity.correctAnswer.split(":").map(Number)

      expect(hour).toBeGreaterThanOrEqual(1)
      expect(hour).toBeLessThanOrEqual(12)
      expect(minute).toBeGreaterThanOrEqual(0)
      expect(minute).toBeLessThanOrEqual(59)
    })

    test("includes time description in question", () => {
      const activity = generator.generateTimeElapsed("easy")

      expect(activity.question).toMatch(/hour|minute/)
    })

    test("handles different difficulty levels", () => {
      const easyActivity = generator.generateTimeElapsed("easy")
      const mediumActivity = generator.generateTimeElapsed("medium")
      const hardActivity = generator.generateTimeElapsed("hard")

      expect(easyActivity.correctAnswer).toBeDefined()
      expect(mediumActivity.correctAnswer).toBeDefined()
      expect(hardActivity.correctAnswer).toBeDefined()
    })
  })

  describe("createClockSVG", () => {
    test("creates valid SVG markup", () => {
      const svg = generator.createClockSVG(3, 30)

      expect(svg).toContain("<svg")
      expect(svg).toContain("</svg>")
      expect(svg).toContain("viewBox")
    })

    test("includes hour and minute hands", () => {
      const svg = generator.createClockSVG(6, 15)

      const lineCount = (svg.match(/<line/g) || []).length
      expect(lineCount).toBeGreaterThan(2) // At least hour hand, minute hand, plus tick marks
    })

    test("includes clock numbers", () => {
      const svg = generator.createClockSVG(12, 0)

      expect(svg).toContain("<text")
      expect(svg).toContain("12")
    })
  })
})
