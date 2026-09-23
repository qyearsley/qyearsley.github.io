import { describe, test, expect } from "@jest/globals"
import { MarkovChain, tokenize, isChineseText } from "./markov.js"

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

  test("getNgramSize returns 0 when training produced no ngrams", () => {
    const chain = new MarkovChain()
    chain.train("ab", 3, "char")
    expect(chain.getNgramSize()).toBe(0)
  })
})

describe("isChineseText", () => {
  test("detects Chinese-dominant text", () => {
    expect(isChineseText("你好，世界！今天天气很好。")).toBe(true)
  })

  test("does not flag plain English text", () => {
    expect(isChineseText("the quick brown fox jumps over the lazy dog")).toBe(false)
  })

  test("does not flag a Chinese term quoted inside English prose", () => {
    expect(isChineseText("The word for 'bridge' is 桥 in Mandarin.")).toBe(false)
  })

  test("returns false for empty or whitespace-only text", () => {
    expect(isChineseText("")).toBe(false)
    expect(isChineseText("   ")).toBe(false)
  })
})

describe("tokenize", () => {
  test("word mode splits English text on whitespace", () => {
    expect(tokenize("hello world again", "word")).toEqual(["hello", "world", "again"])
  })

  test("char mode splits into individual characters regardless of language", () => {
    expect(tokenize("hello", "char")).toEqual(["h", "e", "l", "l", "o"])
  })

  test("word mode falls back to character tokens for unspaced Chinese text", () => {
    // A whitespace split would return the whole string as one token, since
    // Chinese does not put spaces between words.
    expect(tokenize("你好，世界！", "word")).toEqual(["你", "好", "，", "世", "界", "！"])
  })
})

describe("MarkovChain with Chinese text", () => {
  test("word mode on Chinese text does not collapse into a single ngram", () => {
    const chain = new MarkovChain("你好世界你好世界你好", "word", 2)
    // A naive whitespace split would produce exactly one token (and
    // therefore no ngrams, since the text is shorter than the ngram size
    // once treated as a single word). Character tokenization instead
    // produces several distinct ngrams.
    expect(chain.ngrams.size).toBeGreaterThan(1)
  })

  test("ngram keys for Chinese text contain no spaces, even in word mode", () => {
    const chain = new MarkovChain("你好世界你好世界你好", "word", 2)
    for (const ngram of chain.ngrams.keys()) {
      expect(ngram).not.toContain(" ")
    }
  })

  test("generate joins Chinese output without spaces", () => {
    const chain = new MarkovChain("你好世界你好世界你好世界你好", "word", 2)
    const out = chain.generate(10)
    expect(out).not.toContain(" ")
  })

  test("generate on Chinese text under char mode also has no spaces", () => {
    const chain = new MarkovChain("你好世界你好世界你好世界你好", "char", 2)
    const out = chain.generate(10)
    expect(out).not.toContain(" ")
  })

  test("English word mode is unaffected and still joins with spaces", () => {
    const chain = new MarkovChain("the quick brown fox the quick brown", "word", 2)
    const out = chain.generate(6)
    expect(out).toContain(" ")
  })
})
