/**
 * Tests for tradsimp.js - Traditional to Simplified Chinese converter.
 */

const { simplify } = require("./tradsimp.js")

describe("simplify", () => {
  test("converts traditional characters to simplified", () => {
    expect(simplify("電腦")).toBe("电脑")
    expect(simplify("學習")).toBe("学习")
    expect(simplify("資訊")).toBe("资讯")
  })

  test("leaves simplified characters unchanged", () => {
    expect(simplify("电脑")).toBe("电脑")
    expect(simplify("学习")).toBe("学习")
  })

  test("handles mixed traditional and simplified", () => {
    expect(simplify("學习电腦")).toBe("学习电脑")
  })

  test("leaves unknown characters unchanged", () => {
    expect(simplify("abc123")).toBe("abc123")
    expect(simplify("中国")).toBe("中国") // Already simplified.
  })

  test("handles empty string", () => {
    expect(simplify("")).toBe("")
  })

  test("preserves non-Chinese characters", () => {
    expect(simplify("Hello 世界!")).toBe("Hello 世界!")
    expect(simplify("數字123")).toBe("数字123")
  })

  test("handles long text", () => {
    const input = "這個網站提供電腦資訊"
    const expected = "这个网站提供电脑资讯"
    expect(simplify(input)).toBe(expected)
  })

  test("handles common punctuation", () => {
    expect(simplify("你好，世界！")).toBe("你好，世界！")
  })
})
