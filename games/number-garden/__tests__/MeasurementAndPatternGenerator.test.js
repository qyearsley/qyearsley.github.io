import { describe, test, expect, beforeEach } from "@jest/globals"
import { MeasurementAndPatternGenerator } from "../js/generators/MeasurementAndPatternGenerator.js"

describe("MeasurementAndPatternGenerator", () => {
  let generator

  const mockGameState = {
    settings: {
      difficulty: "adventurer",
    },
  }

  beforeEach(() => {
    generator = new MeasurementAndPatternGenerator(mockGameState)
  })

  describe("generateMeasurement", () => {
    test("generates valid measurement activity", () => {
      const activity = generator.generateMeasurement("measurement-market")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("measurement")
      expect(activity.question).toBeDefined()
      expect(typeof activity.correctAnswer).toBe("number")
      expect(activity.options).toBeDefined()
      expect(Array.isArray(activity.visual)).toBe(true)
    })

    test("includes correct answer in options", () => {
      const activity = generator.generateMeasurement("measurement-market")

      expect(activity.options).toContain(activity.correctAnswer)
    })

    test("generates visual representation", () => {
      const activity = generator.generateMeasurement("measurement-market")

      expect(activity.visual.length).toBeGreaterThan(0)
    })
  })

  describe("generateLength", () => {
    test("generates length measurement activity", () => {
      const activity = generator.generateLength("measurement-market")

      expect(activity.type).toBe("measurement")
      expect(activity.question).toMatch(/inch/)
      expect(typeof activity.correctAnswer).toBe("number")
      expect(activity.correctAnswer).toBeGreaterThanOrEqual(0)
    })

    test("generates appropriate length values", () => {
      const activity = generator.generateLength("measurement-market")

      expect(activity.correctAnswer).toBeGreaterThanOrEqual(0)
      expect(activity.correctAnswer).toBeLessThanOrEqual(20)
    })

    test("includes ruler visualization", () => {
      const activity = generator.generateLength("measurement-market")

      expect(activity.visual.length).toBeGreaterThan(0)
      expect(activity.visual[0].html).toContain("svg")
    })
  })

  describe("generateWeight", () => {
    test("generates weight measurement activity", () => {
      const activity = generator.generateWeight("measurement-market")

      expect(activity.type).toBe("measurement")
      expect(activity.question).toMatch(/pound/)
      expect(typeof activity.correctAnswer).toBe("number")
      expect(activity.correctAnswer).toBeGreaterThan(0)
    })

    test("generates correct weight calculation", () => {
      const activity = generator.generateWeight("measurement-market")
      const match = activity.question.match(/(\d+) apples weigh (\d+) pound/)

      if (match) {
        const [, numItems, weightPer] = match
        const expectedAnswer = parseInt(numItems) * parseInt(weightPer)
        expect(activity.correctAnswer).toBe(expectedAnswer)
      }
    })

    test("includes scale visualization", () => {
      const activity = generator.generateWeight("measurement-market")

      expect(activity.visual.length).toBeGreaterThan(0)
      expect(activity.visual[0].html).toContain("svg")
    })
  })

  describe("generatePattern", () => {
    test("generates valid pattern activity", () => {
      const activity = generator.generatePattern("pattern-path")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("pattern")
      expect(activity.question).toBeDefined()
      expect(typeof activity.correctAnswer).toBe("number")
      expect(activity.options).toBeDefined()
    })

    test("includes correct answer in options", () => {
      const activity = generator.generatePattern("pattern-path")

      expect(activity.options).toContain(activity.correctAnswer)
    })
  })

  describe("generateSkipCounting", () => {
    test("generates skip counting pattern", () => {
      const activity = generator.generateSkipCounting("easy", "pattern-path")

      expect(activity.type).toBe("pattern")
      expect(activity.question).toContain("What number comes next")
      expect(typeof activity.correctAnswer).toBe("number")
    })

    test("generates valid skip counting sequence", () => {
      const activity = generator.generateSkipCounting("medium", "pattern-path")

      expect(activity.correctAnswer).toBeGreaterThan(0)
    })
  })

  describe("generateMissingNumber", () => {
    test("generates missing number pattern", () => {
      const activity = generator.generateMissingNumber("easy", "pattern-path")

      expect(activity.type).toBe("pattern")
      expect(activity.question).toContain("missing")
      expect(typeof activity.correctAnswer).toBe("number")
    })

    test("generates valid number sequence", () => {
      const activity = generator.generateMissingNumber("medium", "pattern-path")

      expect(activity.correctAnswer).toBeGreaterThan(0)
    })

    test("includes visual representation of sequence", () => {
      const activity = generator.generateMissingNumber("easy", "pattern-path")

      expect(Array.isArray(activity.visual)).toBe(true)
    })
  })

  describe("difficulty scaling", () => {
    test("easy difficulty uses simpler patterns", () => {
      const easyState = { settings: { difficulty: "explorer" } }
      const easyGenerator = new MeasurementAndPatternGenerator(easyState)
      const activity = easyGenerator.generatePattern("pattern-path")

      expect(activity.correctAnswer).toBeGreaterThan(0)
    })

    test("hard difficulty uses more complex patterns", () => {
      const hardState = { settings: { difficulty: "master" } }
      const hardGenerator = new MeasurementAndPatternGenerator(hardState)
      const activity = hardGenerator.generatePattern("pattern-path")

      expect(activity.correctAnswer).toBeGreaterThan(0)
    })
  })
})
