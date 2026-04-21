import {
  randomInt,
  randomChoice,
  shuffleArray,
  getRandomItems,
  generateMathOptions,
  generateTimeOptions,
} from "../js/utils.js"

describe("randomInt", () => {
  it("returns values within range", () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(5, 10)
      expect(val).toBeGreaterThanOrEqual(5)
      expect(val).toBeLessThanOrEqual(10)
    }
  })

  it("returns integers", () => {
    for (let i = 0; i < 50; i++) {
      expect(Number.isInteger(randomInt(1, 100))).toBe(true)
    }
  })

  it("works when min equals max", () => {
    expect(randomInt(7, 7)).toBe(7)
  })
})

describe("randomChoice", () => {
  it("returns an element from the array", () => {
    const arr = ["a", "b", "c"]
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(randomChoice(arr))
    }
  })

  it("works with single-element array", () => {
    expect(randomChoice([42])).toBe(42)
  })
})

describe("shuffleArray", () => {
  it("returns array with same elements", () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = shuffleArray(arr)
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it("does not mutate original", () => {
    const arr = [1, 2, 3]
    const copy = [...arr]
    shuffleArray(arr)
    expect(arr).toEqual(copy)
  })

  it("returns same length", () => {
    expect(shuffleArray([1, 2, 3, 4]).length).toBe(4)
  })

  it("handles empty array", () => {
    expect(shuffleArray([])).toEqual([])
  })
})

describe("getRandomItems", () => {
  it("returns requested count", () => {
    const result = getRandomItems([1, 2, 3, 4, 5], 3)
    expect(result.length).toBe(3)
  })

  it("items come from source array", () => {
    const src = [10, 20, 30, 40]
    const result = getRandomItems(src, 2)
    result.forEach((item) => expect(src).toContain(item))
  })

  it("returns all items when count >= length", () => {
    const result = getRandomItems([1, 2, 3], 5)
    expect(result.sort()).toEqual([1, 2, 3])
  })

  it("returns no duplicates", () => {
    const result = getRandomItems([1, 2, 3, 4, 5], 4)
    expect(new Set(result).size).toBe(4)
  })
})

describe("generateMathOptions", () => {
  it("includes the correct answer", () => {
    const options = generateMathOptions(10, 20)
    expect(options).toContain(10)
  })

  it("returns 4 options by default (1 correct + 3 wrong)", () => {
    const options = generateMathOptions(5, 20)
    expect(options.length).toBe(4)
  })

  it("all options are positive and within range", () => {
    for (let i = 0; i < 20; i++) {
      const options = generateMathOptions(8, 15)
      options.forEach((opt) => {
        expect(opt).toBeGreaterThan(0)
        expect(opt).toBeLessThanOrEqual(15)
      })
    }
  })

  it("respects custom count", () => {
    const options = generateMathOptions(5, 20, 5)
    expect(options.length).toBe(6) // 5 wrong + 1 correct
  })
})

describe("generateTimeOptions", () => {
  it("includes the correct time", () => {
    const options = generateTimeOptions(3, 30)
    expect(options).toContain("3:30")
  })

  it("returns 4 options by default", () => {
    const options = generateTimeOptions(12, 0)
    expect(options.length).toBe(4)
  })

  it("formats minutes with leading zero", () => {
    const options = generateTimeOptions(5, 0)
    expect(options).toContain("5:00")
  })

  it("all options are valid time strings", () => {
    const options = generateTimeOptions(9, 15)
    options.forEach((opt) => {
      expect(opt).toMatch(/^\d{1,2}:\d{2}$/)
    })
  })

  it("hours stay in 1-12 range", () => {
    for (let i = 0; i < 30; i++) {
      const options = generateTimeOptions(1, 0)
      options.forEach((opt) => {
        const hour = parseInt(opt.split(":")[0], 10)
        expect(hour).toBeGreaterThanOrEqual(1)
        expect(hour).toBeLessThanOrEqual(12)
      })
    }
  })
})
