/**
 * Markov Chain Text Generator
 *
 * This implementation demonstrates how Markov chains work for text generation.
 * It builds a model from input text using n-grams and generates new text
 * by following the probability patterns learned from the input.
 */

class MarkovChain {
  constructor() {
    this.ngrams = new Map()
    this.startNgrams = []
  }

  /**
   * Train the Markov chain on input text
   * @param {string} text - The input text to learn from
   * @param {number} ngramSize - Size of n-grams (2, 3, 4, etc.)
   * @param {string} type - 'char' for character n-grams, 'word' for word n-grams
   */
  train(text, ngramSize, type = "char") {
    this.ngrams.clear()
    this.startNgrams = []

    if (!text || text.trim().length === 0) {
      return
    }

    // Normalize text
    text = text.trim()

    // Split into tokens based on type
    const tokens =
      type === "word" ? text.split(/\s+/).filter((token) => token.length > 0) : text.split("")

    if (tokens.length < ngramSize) {
      return
    }

    // Build n-grams and their transitions
    for (let i = 0; i <= tokens.length - ngramSize; i++) {
      const ngram = tokens.slice(i, i + ngramSize).join(type === "word" ? " " : "")
      const nextToken = tokens[i + ngramSize]

      if (!this.ngrams.has(ngram)) {
        this.ngrams.set(ngram, [])
      }

      if (nextToken !== undefined) {
        this.ngrams.get(ngram).push(nextToken)
      }

      // Track starting n-grams (first ngramSize tokens)
      if (i === 0) {
        this.startNgrams.push(ngram)
      }
    }
  }

  /**
   * Generate text using the trained Markov chain
   * @param {number} length - Desired length of output
   * @param {string} startText - Optional starting text
   * @param {string} type - 'char' or 'word' to match training
   * @returns {string} Generated text
   */
  generate(length, startText = "", type = "char") {
    if (this.ngrams.size === 0) {
      return "No training data available. Please provide input text."
    }

    const tokens = []
    let currentNgram

    // Determine starting n-gram
    if (startText && startText.trim().length > 0) {
      const startTokens =
        type === "word"
          ? startText
              .trim()
              .split(/\s+/)
              .filter((t) => t.length > 0)
          : startText.split("")

      if (startTokens.length >= this.getNgramSize()) {
        currentNgram = startTokens.slice(0, this.getNgramSize()).join(type === "word" ? " " : "")
      }
    }

    // If no valid start text, pick random starting n-gram
    if (!currentNgram || !this.ngrams.has(currentNgram)) {
      const startOptions = this.startNgrams.filter((ngram) => this.ngrams.has(ngram))
      if (startOptions.length === 0) {
        return "Unable to generate text. Input text may be too short."
      }
      currentNgram = startOptions[Math.floor(Math.random() * startOptions.length)]
    }

    // Add initial tokens
    const initialTokens = type === "word" ? currentNgram.split(" ") : currentNgram.split("")
    tokens.push(...initialTokens)

    // Generate remaining tokens
    while (tokens.length < length) {
      const nextOptions = this.ngrams.get(currentNgram)
      if (!nextOptions || nextOptions.length === 0) {
        break
      }

      // Pick random next token
      const nextToken = nextOptions[Math.floor(Math.random() * nextOptions.length)]
      tokens.push(nextToken)

      // Update current n-gram by sliding window
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

  /**
   * Get the n-gram size used in training
   * @returns {number} The n-gram size
   */
  getNgramSize() {
    if (this.ngrams.size === 0) return 0
    const firstKey = this.ngrams.keys().next().value
    // For character n-grams, the key is the n-gram itself
    // For word n-grams, we need to count spaces + 1
    return firstKey.includes(" ") ? firstKey.split(" ").length : firstKey.length
  }

  /**
   * Get statistics about the trained model
   * @returns {object} Statistics about the model
   */
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

  /**
   * Get sample probabilities for display
   * @param {number} maxSamples - Maximum number of samples to return
   * @returns {Array} Array of probability samples
   */
  getSampleProbabilities(maxSamples = 5) {
    const samples = []
    const ngrams = Array.from(this.ngrams.entries())

    for (let i = 0; i < Math.min(maxSamples, ngrams.length); i++) {
      const [ngram, transitions] = ngrams[i]
      const totalTransitions = transitions.length
      const uniqueTransitions = [...new Set(transitions)]

      const probabilities = uniqueTransitions
        .map((token) => {
          const count = transitions.filter((t) => t === token).length
          return {
            token,
            count,
            probability: (count / totalTransitions).toFixed(3),
          }
        })
        .sort((a, b) => b.count - a.count)

      samples.push({
        ngram,
        totalTransitions,
        probabilities: probabilities.slice(0, 3), // Show top 3
      })
    }

    return samples
  }
}

// Global Markov chain instance
const markovChain = new MarkovChain()

/**
 * Generate text using the current UI settings
 */
function generateText() {
  const inputText = document.getElementById("inputText").value
  const ngramType = document.getElementById("ngramType").value
  const ngramSize = parseInt(document.getElementById("ngramSize").value)
  const outputLength = parseInt(document.getElementById("outputLength").value)
  const startText = document.getElementById("startText").value

  // Validate input
  if (!inputText.trim()) {
    document.getElementById("output").textContent = "Please provide some input text first."
    return
  }

  // Train the model
  markovChain.train(inputText, ngramSize, ngramType)

  // Generate text
  const generatedText = markovChain.generate(outputLength, startText, ngramType)

  // Display results
  document.getElementById("output").textContent = generatedText

  // Show sample probabilities
  showSampleProbabilities()
}

/**
 * Display sample probabilities below the generated text
 */
function showSampleProbabilities() {
  const samples = markovChain.getSampleProbabilities(3)
  const container = document.getElementById("probabilities")

  if (samples.length === 0) {
    container.innerHTML = ""
    return
  }

  let html = "<h4>Sample Probabilities from Training Data:</h4>"

  samples.forEach((sample) => {
    html += `<div class="probability-sample">`
    html += `<strong>"${sample.ngram}"</strong> → `
    html += sample.probabilities.map((p) => `"${p.token}" (${p.probability})`).join(", ")
    html += ` <span class="total-count">(${sample.totalTransitions} total transitions)</span>`
    html += "</div>"
  })

  container.innerHTML = html
}

/**
 * Load sample text for demonstration
 */
function loadSampleText() {
  const sampleText = `Whan that Aprill with his shoures soote
The droghte of March hath perced to the roote,
And bathed every veyne in swich licour
Of which vertu engendred is the flour;
Whan Zephirus eek with his sweete breeth
Inspired hath in every holt and heeth
The tendre croppes, and the yonge sonne
Hath in the Ram his half cours yronne,
And smale foweles maken melodye,
That slepen al the nyght with open ye
(So priketh hem Nature in hir corages),
Thanne longen folk to goon on pilgrimages,
And palmeres for to seken straunge strondes,
To ferne halwes, kowthe in sondry londes;
And specially from every shires ende
Of Engelond to Caunterbury they wende,
The hooly blisful martir for to seke,
That hem hath holpen whan that they were seeke.

Bifil that in that seson on a day,
In Southwerk at the Tabard as I lay
Redy to wenden on my pilgrymage
To Caunterbury with ful devout corage,
At nyght was come into that hostelrye
Wel nyne and twenty in a compaignye,
Of sondry folk, by aventure yfalle
In felaweshipe, and pilgrimes were they alle,
That toward Caunterbury wolden ryde.
The chambres and the stables weren wyde,
And wel we weren esed atte beste.
And shortly, whan the sonne was to reste,
So hadde I spoken with hem everichon
That I was of hir felaweshipe anon,
And made forward erly for to ryse,
To take oure wey ther as I yow devyse.`

  document.getElementById("inputText").value = sampleText
}

// Add event listeners for real-time updates
document.addEventListener("DOMContentLoaded", function () {
  // Add a sample text button
  const generateBtn = document.getElementById("generateBtn")
  const sampleBtn = document.createElement("button")
  sampleBtn.textContent = "Load Sample Text"
  sampleBtn.style.marginLeft = "10px"
  sampleBtn.style.background = "#28a745"
  sampleBtn.onclick = loadSampleText
  generateBtn.parentNode.appendChild(sampleBtn)

  // Set character n-grams as default
  document.getElementById("ngramType").value = "char"

  // Auto-generate when input changes (with debouncing)
  let timeoutId
  const inputText = document.getElementById("inputText")
  inputText.addEventListener("input", function () {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      if (inputText.value.trim().length > 50) {
        generateText()
      }
    }, 1000)
  })
})
