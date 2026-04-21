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
    const tokens = type === "word" ? text.split(/\s+/).filter((t) => t.length > 0) : text.split("")

    if (tokens.length < ngramSize) return

    for (let i = 0; i <= tokens.length - ngramSize; i++) {
      const sep = type === "word" ? " " : ""
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
    const type = this.type || "char"
    if (this.ngrams.size === 0) {
      return "No training data available."
    }

    const tokens = []
    const startOptions = this.startNgrams.filter((ng) => this.ngrams.has(ng))
    if (startOptions.length === 0) return "Unable to generate text."

    let currentNgram = startOptions[Math.floor(Math.random() * startOptions.length)]
    const sep = type === "word" ? " " : ""
    const initialTokens = type === "word" ? currentNgram.split(" ") : currentNgram.split("")
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
    const firstKey = this.ngrams.keys().next().value
    return firstKey.includes(" ") ? firstKey.split(" ").length : firstKey.length
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
