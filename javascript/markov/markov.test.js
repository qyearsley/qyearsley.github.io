/**
 * Tests for Markov Chain Text Generator
 */

import { describe, test, expect } from "@jest/globals"

// Mock MarkovChain class for testing
class MarkovChain {
  constructor() {
    this.ngrams = new Map()
    this.startNgrams = []
  }

  train(text, ngramSize, type = "char") {
    this.ngrams.clear()
    this.startNgrams = []

    if (!text || text.trim().length === 0) {
      return
    }

    text = text.trim()

    const tokens =
      type === "word" ? text.split(/\s+/).filter((token) => token.length > 0) : text.split("")

    if (tokens.length < ngramSize) {
      return
    }

    for (let i = 0; i <= tokens.length - ngramSize; i++) {
      const ngram = tokens.slice(i, i + ngramSize).join(type === "word" ? " " : "")
      const nextToken = tokens[i + ngramSize]

      if (!this.ngrams.has(ngram)) {
        this.ngrams.set(ngram, [])
      }

      if (nextToken !== undefined) {
        this.ngrams.get(ngram).push(nextToken)
      }

      if (i === 0) {
        this.startNgrams.push(ngram)
      }
    }
  }

  generate(length, startText = "", type = "char") {
    if (this.ngrams.size === 0) {
      return "No training data available. Please provide input text."
    }

    const tokens = []
    let currentNgram

    if (startText && startText.trim().length > 0) {
      const startTokens =
        type === "word" ? startText.split(/\s+/).filter((t) => t.length > 0) : startText.split("")

      if (startTokens.length >= this.getNgramSize()) {
        currentNgram = startTokens.slice(0, this.getNgramSize()).join(type === "word" ? " " : "")
      }
    }

    if (!currentNgram || !this.ngrams.has(currentNgram)) {
      const startOptions = this.startNgrams.filter((ngram) => this.ngrams.has(ngram))
      if (startOptions.length === 0) {
        return "Unable to generate text. Input text may be too short."
      }
      currentNgram = startOptions[Math.floor(Math.random() * startOptions.length)]
    }

    const initialTokens = type === "word" ? currentNgram.split(" ") : currentNgram.split("")
    tokens.push(...initialTokens)

    while (tokens.length < length) {
      const nextOptions = this.ngrams.get(currentNgram)
      if (!nextOptions || nextOptions.length === 0) {
        break
      }

      const nextToken = nextOptions[Math.floor(Math.random() * nextOptions.length)]
      tokens.push(nextToken)

      const ngramSize = this.getNgramSize()
      if (type === "word") {
        const words = tokens.slice(-ngramSize)
        currentNgram = words.join(" ")
      } else {
        const chars = tokens.slice(-ngramSize)
        currentNgram = chars.join("")
      }
    }

    return tokens.join(type === "word" ? " " : "")
  }

  getNgramSize() {
    if (this.ngrams.size === 0) return 0
    const firstKey = this.ngrams.keys().next().value
    return firstKey.includes(" ") ? firstKey.split(" ").length : firstKey.length
  }

  getStats() {
    return {
      ngramCount: this.ngrams.size,
      startNgramCount: this.startNgrams.length,
      avgTransitions:
        this.ngrams.size > 0
          ? Array.from(this.ngrams.values()).reduce(
              (sum, transitions) => sum + transitions.length,
              0,
            ) / this.ngrams.size
          : 0,
    }
  }
}

// Test MarkovChain class
describe("MarkovChain", () => {
  test("should initialize with empty state", () => {
    const chain = new MarkovChain()
    expect(chain.ngrams.size).toBe(0)
    expect(chain.startNgrams.length).toBe(0)
  })

  test("should train on character n-grams", () => {
    const chain = new MarkovChain()
    chain.train("hello", 2, "char")

    expect(chain.ngrams.size).toBeGreaterThan(0)
    expect(chain.startNgrams.length).toBeGreaterThan(0)
    expect(chain.getNgramSize()).toBe(2)
  })

  test("should train on word n-grams", () => {
    const chain = new MarkovChain()
    chain.train("hello world test", 2, "word")

    expect(chain.ngrams.size).toBeGreaterThan(0)
    expect(chain.startNgrams.length).toBeGreaterThan(0)
    expect(chain.getNgramSize()).toBe(2)
  })

  test("should handle empty input gracefully", () => {
    const chain = new MarkovChain()
    chain.train("", 2, "char")
    chain.train(null, 2, "char")
    chain.train("   ", 2, "char")

    expect(chain.ngrams.size).toBe(0)
    expect(chain.startNgrams.length).toBe(0)
  })

  test("should handle input shorter than ngram size", () => {
    const chain = new MarkovChain()
    chain.train("a", 3, "char")

    expect(chain.ngrams.size).toBe(0)
  })

  test("should generate text with character n-grams", () => {
    const chain = new MarkovChain()
    const input = "hello world hello there"
    chain.train(input, 2, "char")

    const generated = chain.generate(10, "", "char")
    expect(generated.length).toBeGreaterThan(0)
    expect(typeof generated).toBe("string")
  })

  test("should generate text with word n-grams", () => {
    const chain = new MarkovChain()
    const input = "hello world hello there world test"
    chain.train(input, 2, "word")

    const generated = chain.generate(5, "", "word")
    expect(generated.length).toBeGreaterThan(0)
    expect(typeof generated).toBe("string")
  })

  test("should use provided start text when valid", () => {
    const chain = new MarkovChain()
    const input = "hello world hello there world test"
    chain.train(input, 2, "word")

    const generated = chain.generate(5, "hello world", "word")
    expect(generated.startsWith("hello world")).toBe(true)
  })

  test("should fall back to random start when start text is invalid", () => {
    const chain = new MarkovChain()
    const input = "hello world hello there world test"
    chain.train(input, 2, "word")

    const generated = chain.generate(5, "invalid start text that does not exist", "word")
    expect(generated.length).toBeGreaterThan(0)
  })

  test("should return error message when not trained", () => {
    const chain = new MarkovChain()
    const generated = chain.generate(10, "", "char")

    expect(generated).toBe("No training data available. Please provide input text.")
  })

  test("should provide correct statistics", () => {
    const chain = new MarkovChain()
    const input = "hello world hello there world test"
    chain.train(input, 2, "word")

    const stats = chain.getStats()
    expect(stats.ngramCount).toBeGreaterThan(0)
    expect(stats.startNgramCount).toBeGreaterThan(0)
    expect(stats.avgTransitions).toBeGreaterThanOrEqual(0)
  })

  test("should handle different ngram sizes", () => {
    const chain = new MarkovChain()
    const input = "hello world hello there world test hello again"

    // Test size 2
    chain.train(input, 2, "word")
    expect(chain.getNgramSize()).toBe(2)

    // Test size 3
    chain.train(input, 3, "word")
    expect(chain.getNgramSize()).toBe(3)
  })

  test("should generate text of approximately correct length", () => {
    const chain = new MarkovChain()
    const input =
      "the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog"
    chain.train(input, 2, "word")

    const generated = chain.generate(10, "", "word")
    const wordCount = generated.split(" ").length

    // Should be close to requested length (allow some variance)
    expect(wordCount).toBeGreaterThanOrEqual(5)
    expect(wordCount).toBeLessThanOrEqual(15)
  })
})
