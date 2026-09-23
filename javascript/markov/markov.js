// Han character ranges covering ordinary Chinese text: CJK Unified
// Ideographs, Extension A, and the CJK Compatibility Ideographs block. This
// does not attempt to cover the rarer Han extension blocks outside the
// Basic Multilingual Plane.
const HAN_CHAR_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

// Detects Chinese-dominant text, i.e. text where whitespace tokenization
// would not work because Chinese does not put spaces between words. This is
// a ratio over non-whitespace characters, not "contains any Han character",
// so a Chinese term quoted inside mostly-English prose does not flip it.
export function isChineseText(text) {
  const chars = Array.from(text).filter((ch) => !/\s/.test(ch))
  if (chars.length === 0) return false
  const hanCount = chars.filter((ch) => HAN_CHAR_PATTERN.test(ch)).length
  return hanCount / chars.length > 0.3
}

// Splits text into the tokens n-grams are built from. "word" mode splits on
// whitespace -- but Chinese has no whitespace between words, so without this
// check the whole input would become a single token. For Chinese text,
// tokenize falls back to characters even when "word" mode is selected: each
// Han character, and each punctuation mark, becomes its own token. The
// caller (see `joinWithSpace` below) then joins tokens back together
// without spaces, the same way "char" mode always has.
export function tokenize(text, type) {
  if (type === "word" && !isChineseText(text)) {
    return text.split(/\s+/).filter((t) => t.length > 0)
  }
  return Array.from(text)
}

export class MarkovChain {
  constructor(text, type = "char", ngramSize = 3) {
    this.ngrams = new Map()
    this.startNgrams = []
    if (text) {
      this.train(text, ngramSize, type)
    }
  }

  train(text, ngramSize, type = "char") {
    this.ngrams.clear()
    this.startNgrams = []
    this.type = type

    if (!text || text.trim().length === 0) return

    text = text.trim()
    const tokens = tokenize(text, type)
    this.joinWithSpace = type === "word" && !isChineseText(text)
    this.ngramSize = ngramSize

    if (tokens.length < ngramSize) return

    const sep = this.joinWithSpace ? " " : ""
    for (let i = 0; i <= tokens.length - ngramSize; i++) {
      const ngram = tokens.slice(i, i + ngramSize).join(sep)
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

  generate(length) {
    if (this.ngrams.size === 0) {
      return "No training data available."
    }

    const tokens = []
    const startOptions = this.startNgrams.filter((ng) => this.ngrams.has(ng))
    if (startOptions.length === 0) return "Unable to generate text."

    const sep = this.joinWithSpace ? " " : ""
    let currentNgram = startOptions[Math.floor(Math.random() * startOptions.length)]
    const initialTokens = this.joinWithSpace ? currentNgram.split(" ") : Array.from(currentNgram)
    tokens.push(...initialTokens)

    const ngramSize = this.getNgramSize()

    while (tokens.length < length) {
      const nextOptions = this.ngrams.get(currentNgram)
      if (!nextOptions || nextOptions.length === 0) break

      const nextToken = nextOptions[Math.floor(Math.random() * nextOptions.length)]
      tokens.push(nextToken)

      currentNgram = tokens.slice(-ngramSize).join(sep)
    }

    return tokens.join(sep)
  }

  getNgramSize() {
    if (this.ngrams.size === 0) return 0
    return this.ngramSize || 0
  }

  getTransitions() {
    const result = {}
    for (const [ngram, transitions] of this.ngrams) {
      const counts = {}
      for (const t of transitions) {
        counts[t] = (counts[t] || 0) + 1
      }
      result[ngram] = counts
    }
    return result
  }
}
