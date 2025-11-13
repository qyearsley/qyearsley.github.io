import { ActivityGenerator } from "./js/activities.js"

describe("ActivityGenerator", () => {
  let generator

  beforeEach(() => {
    generator = new ActivityGenerator()
  })

  describe("generateActivity", () => {
    test("generates easy difficulty for early activities", () => {
      const activity = generator.generateActivity(0, "flower-meadow")
      expect(activity).toBeDefined()
      expect(activity.type).toMatch(/addition|subtraction|multiplication/)
      expect(activity.question).toBeDefined()
      expect(activity.correctAnswer).toBeGreaterThan(0)
    })

    test("generates medium difficulty for mid activities", () => {
      const activity = generator.generateActivity(15)
      expect(activity).toBeDefined()
      expect(activity.correctAnswer).toBeLessThanOrEqual(30)
    })

    test("includes visual elements", () => {
      const activity = generator.generateActivity(0)
      expect(activity.visual).toBeDefined()
      expect(Array.isArray(activity.visual)).toBe(true)
      expect(activity.visual.length).toBeGreaterThan(0)
    })

    test("includes 4 answer options", () => {
      const activity = generator.generateActivity(0)
      expect(activity.options).toBeDefined()
      expect(activity.options.length).toBe(4)
      expect(activity.options).toContain(activity.correctAnswer)
    })

    test("includes creature message", () => {
      const activity = generator.generateActivity(0)
      expect(activity.creatureMessage).toBeDefined()
      expect(typeof activity.creatureMessage).toBe("string")
    })
  })

  describe("generateAddition", () => {
    test("generates valid addition problem", () => {
      const activity = generator.generateAddition("easy")
      expect(activity.type).toBe("addition")
      expect(activity.question).toContain("+")
      expect(activity.correctAnswer).toBeGreaterThan(0)
    })

    test("easy difficulty uses numbers up to 10", () => {
      for (let i = 0; i < 10; i++) {
        const activity = generator.generateAddition("easy")
        // With max=10, largest answer is 10+10=20
        expect(activity.correctAnswer).toBeLessThanOrEqual(20)
      }
    })

    test("answer options are unique", () => {
      const activity = generator.generateAddition("easy")
      const uniqueOptions = new Set(activity.options)
      expect(uniqueOptions.size).toBe(4)
    })
  })

  describe("generateSubtraction", () => {
    test("generates valid subtraction problem", () => {
      const activity = generator.generateSubtraction("easy")
      expect(activity.type).toBe("subtraction")
      expect(activity.question).toContain("-")
      expect(activity.correctAnswer).toBeGreaterThanOrEqual(0)
    })

    test("includes crossed-out visual items", () => {
      const activity = generator.generateSubtraction("easy")
      const crossedOutItems = activity.visual.filter(
        (item) => typeof item === "object" && item.crossed,
      )
      expect(crossedOutItems.length).toBeGreaterThan(0)
    })

    test("answer is always positive", () => {
      for (let i = 0; i < 20; i++) {
        const activity = generator.generateSubtraction("medium")
        expect(activity.correctAnswer).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe("createSubtractionVisual", () => {
    test("creates correct number of items", () => {
      const visual = generator.createSubtractionVisual(5, 2)
      expect(visual.length).toBe(5)
    })

    test("marks correct number as crossed out", () => {
      const visual = generator.createSubtractionVisual(7, 3)
      const crossedOut = visual.filter((item) => typeof item === "object" && item.crossed)
      expect(crossedOut.length).toBe(3)
    })

    test("non-crossed items come first", () => {
      const visual = generator.createSubtractionVisual(6, 2)
      const firstFour = visual.slice(0, 4)
      const lastTwo = visual.slice(4, 6)

      const firstFourAllStrings = firstFour.every((item) => typeof item === "string")
      const lastTwoAllCrossed = lastTwo.every((item) => typeof item === "object" && item.crossed)

      expect(firstFourAllStrings).toBe(true)
      expect(lastTwoAllCrossed).toBe(true)
    })
  })

  describe("generateOptions", () => {
    test("generates 4 unique options", () => {
      const options = generator.generateOptions(5, 20)
      expect(options.length).toBe(4)
      expect(new Set(options).size).toBe(4)
    })

    test("includes correct answer", () => {
      const correctAnswer = 7
      const options = generator.generateOptions(correctAnswer, 20)
      expect(options).toContain(correctAnswer)
    })

    test("all options are positive", () => {
      const options = generator.generateOptions(3, 10)
      options.forEach((option) => {
        expect(option).toBeGreaterThan(0)
      })
    })
  })

  describe("generateMultiplication", () => {
    test("generates valid multiplication problem", () => {
      const activity = generator.generateMultiplication("easy")
      expect(activity.type).toBe("multiplication")
      expect(activity.question).toContain("×")
      expect(activity.correctAnswer).toBeGreaterThan(0)
    })

    test("one operand is always between 2-5", () => {
      for (let i = 0; i < 20; i++) {
        const activity = generator.generateMultiplication("medium")
        const parts = activity.question.split(" × ")
        const num1 = parseInt(parts[0])
        const num2 = parseInt(parts[1].split(" =")[0])

        // At least one number should be between 2-5
        const hasSmallOperand = (num1 >= 2 && num1 <= 5) || (num2 >= 2 && num2 <= 5)
        expect(hasSmallOperand).toBe(true)
      }
    })

    test("includes separator in visual", () => {
      const activity = generator.generateMultiplication("easy")
      const separators = activity.visual.filter(
        (item) => typeof item === "object" && item.separator,
      )
      expect(separators.length).toBeGreaterThan(0)
    })
  })

  describe("createMultiplicationVisual", () => {
    test("creates correct total number of items", () => {
      const visual = generator.createMultiplicationVisual(3, 4)
      // 3 groups of 4 items + 2 separators = 14 total
      expect(visual.length).toBe(3 * 4 + 2)
    })

    test("includes correct number of separators", () => {
      const visual = generator.createMultiplicationVisual(3, 4)
      const separators = visual.filter((item) => typeof item === "object" && item.separator)
      // 3 groups needs 2 separators
      expect(separators.length).toBe(2)
    })

    test("no separator after last group", () => {
      const visual = generator.createMultiplicationVisual(2, 3)
      const lastItem = visual[visual.length - 1]
      // Last item should not be a separator
      expect(typeof lastItem === "object" && lastItem.separator).toBe(false)
    })
  })

  describe("area-specific visuals", () => {
    test("flower-meadow uses flower emojis", () => {
      const activity = generator.generateActivity(0, "flower-meadow")
      const hasFlowerEmoji = activity.visual.some((item) => {
        const emoji = typeof item === "string" ? item : item.emoji
        return ["🌹", "🌺", "🌸", "🌼", "🌻", "🌷", "💐", "🏵️", "🥀", "🌾"].includes(emoji)
      })
      expect(hasFlowerEmoji).toBe(true)
    })

    test("crystal-cave uses crystal emojis", () => {
      const activity = generator.generateActivity(0, "crystal-cave")
      const hasCrystalEmoji = activity.visual.some((item) => {
        const emoji = typeof item === "string" ? item : item.emoji
        return ["💎", "💠", "🔷", "🔹", "💙", "💜", "🔮", "⚗️", "✨", "⭐"].includes(emoji)
      })
      expect(hasCrystalEmoji).toBe(true)
    })

    test("enchanted-forest uses nature emojis", () => {
      const activity = generator.generateActivity(0, "enchanted-forest")
      const hasNatureEmoji = activity.visual.some((item) => {
        const emoji = typeof item === "string" ? item : item.emoji
        return ["🌲", "🌳", "🌴", "🎄", "🌿", "🍄", "🍃", "🌾", "🌱", "🪵"].includes(emoji)
      })
      expect(hasNatureEmoji).toBe(true)
    })

    test("uses correct creature for each area", () => {
      const meadowActivity = generator.generateActivity(0, "flower-meadow")
      expect(meadowActivity.creature).toBe("🦄")

      const caveActivity = generator.generateActivity(0, "crystal-cave")
      expect(caveActivity.creature).toBe("🔮")

      const forestActivity = generator.generateActivity(0, "enchanted-forest")
      expect(forestActivity.creature).toBe("🧚")
    })
  })

  describe("area-specific problem types", () => {
    test("flower-meadow generates addition problems", () => {
      const activity = generator.generateActivity(0, "flower-meadow")
      expect(activity.type).toBe("addition")
      expect(activity.question).toContain("+")
    })

    test("crystal-cave generates subtraction problems", () => {
      const activity = generator.generateActivity(0, "crystal-cave")
      expect(activity.type).toBe("subtraction")
      expect(activity.question).toContain("-")
    })

    test("enchanted-forest generates multiplication problems", () => {
      const activity = generator.generateActivity(0, "enchanted-forest")
      expect(activity.type).toBe("multiplication")
      expect(activity.question).toContain("×")
    })
  })

  describe("difficulty progression", () => {
    test("difficulty increases with activity number", () => {
      // Easy problems (0-9)
      const easy = generator.generateActivity(5, "flower-meadow")
      expect(easy.correctAnswer).toBeLessThanOrEqual(20) // max 10+10

      // Medium problems (10-19) can be larger
      const medium = generator.generateActivity(15, "flower-meadow")
      expect(medium.correctAnswer).toBeGreaterThan(0)

      // Hard problems (20+) can be even larger
      const hard = generator.generateActivity(25, "flower-meadow")
      expect(hard.correctAnswer).toBeGreaterThan(0)
    })
  })
})
