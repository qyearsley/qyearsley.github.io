import { describe, test, expect } from "@jest/globals"
import { MarkovChain } from "./markov.js"

describe("MarkovChain", () => {
  test("constructor with no text leaves the chain untrained", () => {
    const chain = new MarkovChain()
    expect(chain.ngrams.size).toBe(0)
    expect(chain.startNgrams.length).toBe(0)
  })

  test("constructor trains when text is provided", () => {
    const chain = new MarkovChain("hello world", "char", 2)
    expect(chain.ngrams.size).toBeGreaterThan(0)
    expect(chain.getNgramSize()).toBe(2)
  })

  test("train builds character n-grams", () => {
    const chain = new MarkovChain()
    chain.train("hello", 2, "char")
    expect(chain.getNgramSize()).toBe(2)
    expect(chain.ngrams.has("he")).toBe(true)
    expect(chain.ngrams.get("he")).toContain("l")
  })

  test("train builds word n-grams with space separators", () => {
    const chain = new MarkovChain()
    chain.train("hello world hello there", 2, "word")
    expect(chain.getNgramSize()).toBe(2)
    expect(chain.ngrams.has("hello world")).toBe(true)
  })

  test("train resets prior state on each call", () => {
    const chain = new MarkovChain()
    chain.train("hello world", 2, "word")
    const firstSize = chain.ngrams.size
    chain.train("a b c d e", 2, "word")
    expect(chain.ngrams.size).not.toBe(firstSize)
    expect(chain.ngrams.has("hello world")).toBe(false)
  })

  test("train ignores empty, whitespace-only, and null text", () => {
    const chain = new MarkovChain()
    chain.train("", 2, "char")
    expect(chain.ngrams.size).toBe(0)
    chain.train("   ", 2, "char")
    expect(chain.ngrams.size).toBe(0)
    chain.train(null, 2, "char")
    expect(chain.ngrams.size).toBe(0)
  })

  test("train with text shorter than ngram size produces no ngrams", () => {
    const chain = new MarkovChain()
    chain.train("ab", 3, "char")
    expect(chain.ngrams.size).toBe(0)
  })

  test("generate returns the placeholder when untrained", () => {
    const chain = new MarkovChain()
    expect(chain.generate(10)).toBe("No training data available.")
  })

  test("generate produces a non-empty string after training", () => {
    const chain = new MarkovChain("the quick brown fox jumps over the lazy dog", "word", 2)
    const out = chain.generate(8)
    expect(typeof out).toBe("string")
    expect(out.length).toBeGreaterThan(0)
  })

  test("generate stays within the corpus vocabulary", () => {
    const chain = new MarkovChain("alpha beta gamma alpha beta delta", "word", 2)
    const corpus = new Set(["alpha", "beta", "gamma", "delta"])
    const tokens = chain.generate(20).split(" ")
    for (const token of tokens) {
      expect(corpus.has(token)).toBe(true)
    }
  })

  test("getTransitions counts each follow-up token", () => {
    const chain = new MarkovChain("ababab", "char", 2)
    const transitions = chain.getTransitions()
    // "ab" is followed by "a" twice in "ababab"
    expect(transitions.ab.a).toBe(2)
  })
})
