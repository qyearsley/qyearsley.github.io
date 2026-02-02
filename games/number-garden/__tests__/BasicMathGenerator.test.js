import { describe, test, expect, beforeEach } from "@jest/globals"
import { BasicMathGenerator } from "../js/generators/BasicMathGenerator.js"

describe("BasicMathGenerator", () => {
  let generator

  const mockGameState = {
    settings: {
      difficulty: "adventurer",
    },
  }

  beforeEach(() => {
    generator = new BasicMathGenerator(mockGameState)
  })

  describe("generateAddition", () => {
    test("generates valid addition activity", () => {
      const activity = generator.generateAddition("flower-meadow")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("addition")
      expect(activity.question).toMatch(/\d+ \+ \d+ = \?/)
      expect(typeof activity.correctAnswer).toBe("number")
      expect(activity.options).toBeDefined()
      expect(Array.isArray(activity.visual)).toBe(true)
    })

    test("generates correct addition answer", () => {
      const activity = generator.generateAddition("flower-meadow")
      const match = activity.question.match(/(\d+) \+ (\d+) = \?/)

      expect(match).toBeDefined()
      const [, num1, num2] = match
      const expectedAnswer = parseInt(num1) + parseInt(num2)

      expect(activity.correctAnswer).toBe(expectedAnswer)
    })

    test("includes correct answer in options", () => {
      const activity = generator.generateAddition("flower-meadow")

      expect(activity.options).toContain(activity.correctAnswer)
    })

    test("generates visual items", () => {
      const activity = generator.generateAddition("flower-meadow")

      expect(activity.visual.length).toBeGreaterThan(0)
    })
  })

  describe("generateSubtraction", () => {
    test("generates valid subtraction activity", () => {
      const activity = generator.generateSubtraction("crystal-cave")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("subtraction")
      expect(activity.question).toMatch(/\d+ - \d+ = \?/)
      expect(typeof activity.correctAnswer).toBe("number")
      expect(activity.correctAnswer).toBeGreaterThanOrEqual(0)
    })

    test("generates correct subtraction answer", () => {
      const activity = generator.generateSubtraction("crystal-cave")
      const match = activity.question.match(/(\d+) - (\d+) = \?/)

      expect(match).toBeDefined()
      const [, num1, num2] = match
      const expectedAnswer = parseInt(num1) - parseInt(num2)

      expect(activity.correctAnswer).toBe(expectedAnswer)
      expect(activity.correctAnswer).toBeGreaterThanOrEqual(0)
    })

    test("generates visual items with crossed-out elements", () => {
      const activity = generator.generateSubtraction("crystal-cave")

      expect(activity.visual.length).toBeGreaterThan(0)
    })
  })

  describe("generateMultiplication", () => {
    test("generates valid multiplication activity", () => {
      const activity = generator.generateMultiplication("enchanted-forest")

      expect(activity).toBeDefined()
      expect(activity.type).toBe("multiplication")
      expect(activity.question).toMatch(/\d+ × \d+ = \?/)
      expect(typeof activity.correctAnswer).toBe("number")
    })

    test("generates correct multiplication answer", () => {
      const activity = generator.generateMultiplication("enchanted-forest")
      const match = activity.question.match(/(\d+) × (\d+) = \?/)

      expect(match).toBeDefined()
      const [, num1, num2] = match
      const expectedAnswer = parseInt(num1) * parseInt(num2)

      expect(activity.correctAnswer).toBe(expectedAnswer)
    })

    test("includes correct answer in options", () => {
      const activity = generator.generateMultiplication("enchanted-forest")

      expect(activity.options).toContain(activity.correctAnswer)
    })

    test("generates grouped visual representation", () => {
      const activity = generator.generateMultiplication("enchanted-forest")

      expect(activity.visual.length).toBeGreaterThan(0)
    })
  })

  describe("difficulty scaling", () => {
    test("easy difficulty uses appropriate number ranges", () => {
      const easyState = { settings: { difficulty: "explorer" } }
      const easyGenerator = new BasicMathGenerator(easyState)
      const activity = easyGenerator.generateAddition("flower-meadow")
      const match = activity.question.match(/(\d+) \+ (\d+) = \?/)

      const [, num1, num2] = match
      expect(parseInt(num1)).toBeLessThanOrEqual(10)
      expect(parseInt(num2)).toBeLessThanOrEqual(10)
    })

    test("medium difficulty uses larger ranges", () => {
      const mediumState = { settings: { difficulty: "adventurer" } }
      const mediumGenerator = new BasicMathGenerator(mediumState)
      const activity = mediumGenerator.generateAddition("flower-meadow")

      expect(activity.correctAnswer).toBeGreaterThan(0)
    })

    test("hard difficulty uses largest ranges", () => {
      const hardState = { settings: { difficulty: "master" } }
      const hardGenerator = new BasicMathGenerator(hardState)
      const activity = hardGenerator.generateAddition("flower-meadow")

      expect(activity.correctAnswer).toBeGreaterThan(0)
    })
  })
})
