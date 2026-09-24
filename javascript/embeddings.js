/**
 * embeddings.js
 *
 * The pipeline behind the "How Embeddings Work" page, as a chain of pure
 * functions -- no DOM, so every step is testable and runnable from Node:
 *
 *   tokenize          text -> lowercase word tokens
 *   buildVocabulary   token lists -> the words worth tracking (min count, no stopwords)
 *   buildCooccurrence vocabulary + token lists -> how often words appear near each other
 *   computePPMI       co-occurrence counts -> positive pointwise mutual information
 *   truncatedSVD       a symmetric matrix -> its top-k eigenvectors (power iteration + deflation)
 *   wordVectors        SVD output -> one dense vector per word
 *   projectTo2D         word vectors -> {x, y} points for the scatter plot
 *   cosineSimilarity / nearestNeighbors / analogy -- what the vectors are for
 *
 * PPMI matrices built from real text are symmetric (co-occurrence doesn't
 * care about order) and have a zero diagonal (a word's co-occurrence with
 * itself isn't counted), so truncated SVD of that matrix is the same thing
 * as taking its top eigenvectors by |eigenvalue|. `truncatedSVD` uses power
 * iteration with deflation for that: repeatedly multiply a vector by the
 * matrix to converge on the dominant eigenvector, subtract that direction
 * out, and repeat for the next one. The starting vector is a fixed formula
 * (no Math.random), so the same matrix always produces the same components.
 */

/**
 * Words excluded from the vocabulary regardless of how often they occur.
 *
 * "he"/"she" are deliberately *not* here, unlike most pronoun lists: the
 * built-in corpus gets its gender signal for the analogy box from which
 * words keep company with "he" versus "she" ("the king said he would...",
 * "the queen said she would..."), the way real text does. Filtering them out
 * as empty function words would remove that signal entirely. "his"/"her"
 * stay excluded -- they carry the same signal but more weakly, and mostly
 * just add noise.
 */
const DEFAULT_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "was",
  "were",
  "are",
  "in",
  "on",
  "at",
  "to",
  "of",
  "and",
  "with",
  "for",
  "it",
  "they",
  "that",
  "this",
  "who",
  "its",
  "their",
  "his",
  "her",
  "will",
  "near",
  "through",
])

const DEFAULT_WINDOW_SIZE = 4
const DEFAULT_MIN_COUNT = 5
const DEFAULT_DIM = 10

/**
 * Splits text into lowercase word tokens, dropping punctuation.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  const matches = text.toLowerCase().match(/[a-z']+/g)
  return matches ? matches.filter((token) => token.length > 0) : []
}

/**
 * Tokenizes a list of sentences, one token array per sentence. Co-occurrence
 * is counted within a sentence only, so keeping sentences separate here (as
 * opposed to tokenizing one giant string) matters: two words either side of
 * a sentence boundary shouldn't count as "near" each other.
 *
 * @param {string[]} sentences
 * @returns {string[][]}
 */
function tokenizeSentences(sentences) {
  return sentences.map(tokenize)
}

/**
 * Builds the vocabulary: every word that appears at least `minCount` times
 * across all sentences and isn't a stopword, in alphabetical order (so the
 * result -- and every matrix indexed by it -- is deterministic and easy to
 * hand-check).
 *
 * @param {string[][]} tokenizedSentences
 * @param {{minCount?: number, stopwords?: Set<string>}} [options]
 * @returns {{words: string[], indexOf: Map<string, number>, counts: Map<string, number>}}
 */
function buildVocabulary(tokenizedSentences, options = {}) {
  const { minCount = DEFAULT_MIN_COUNT, stopwords = DEFAULT_STOPWORDS } = options

  const counts = new Map()
  for (const tokens of tokenizedSentences) {
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
  }

  const words = [...counts.keys()]
    .filter((word) => !stopwords.has(word) && counts.get(word) >= minCount)
    .sort()

  const indexOf = new Map(words.map((word, i) => [word, i]))
  return { words, indexOf, counts }
}

/**
 * Counts how often each pair of vocabulary words appears near each other.
 *
 * Each sentence is first reduced to just its in-vocabulary tokens (dropping
 * stopwords and rare words), then every pair of words at most `windowSize`
 * apart in that reduced sentence adds one to both `matrix[i][j]` and
 * `matrix[j][i]` -- the matrix is symmetric, and a word is never paired with
 * itself.
 *
 * @param {string[][]} tokenizedSentences
 * @param {{words: string[], indexOf: Map<string, number>}} vocab
 * @param {number} [windowSize]
 * @returns {number[][]} A `vocab.words.length` square matrix.
 */
function buildCooccurrence(tokenizedSentences, vocab, windowSize = DEFAULT_WINDOW_SIZE) {
  const n = vocab.words.length
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0))

  for (const tokens of tokenizedSentences) {
    const indices = tokens
      .filter((token) => vocab.indexOf.has(token))
      .map((token) => vocab.indexOf.get(token))

    for (let i = 0; i < indices.length; i += 1) {
      for (let offset = 1; offset <= windowSize && i + offset < indices.length; offset += 1) {
        const a = indices[i]
        const b = indices[i + offset]
        matrix[a][b] += 1
        matrix[b][a] += 1
      }
    }
  }

  return matrix
}

/**
 * Converts co-occurrence counts to positive pointwise mutual information
 * (PPMI): how much more (or less) often two words co-occur than chance would
 * predict from how common each word is on its own, clipped at zero so a
 * pair that co-occurs less than chance reads as "no signal" rather than a
 * negative number.
 *
 * `ppmi(i, j) = max(0, log(P(i, j) / (P(i) * P(j))))`, all computed from the
 * co-occurrence counts. A pair that never co-occurs gets exactly 0, not
 * `-Infinity`, since `log(0)` is guarded rather than evaluated.
 *
 * @param {number[][]} coMatrix
 * @returns {number[][]}
 */
function computePPMI(coMatrix) {
  const n = coMatrix.length
  const rowSums = coMatrix.map((row) => row.reduce((sum, v) => sum + v, 0))
  const total = rowSums.reduce((sum, v) => sum + v, 0)

  const ppmi = Array.from({ length: n }, () => new Array(n).fill(0))
  if (total === 0) return ppmi

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const cij = coMatrix[i][j]
      if (cij === 0 || rowSums[i] === 0 || rowSums[j] === 0) continue
      const pij = cij / total
      const pi = rowSums[i] / total
      const pj = rowSums[j] / total
      const pmi = Math.log(pij / (pi * pj))
      ppmi[i][j] = Math.max(0, pmi)
    }
  }
  return ppmi
}

/** Dot product of two equal-length vectors. */
function dot(u, v) {
  let sum = 0
  for (let i = 0; i < u.length; i += 1) sum += u[i] * v[i]
  return sum
}

/** Euclidean norm (magnitude) of a vector. */
function norm(v) {
  return Math.sqrt(dot(v, v))
}

/**
 * Multiplies a square matrix by a vector.
 *
 * @param {number[][]} matrix
 * @param {number[]} vector
 * @returns {number[]}
 */
function matVecMul(matrix, vector) {
  return matrix.map((row) => dot(row, vector))
}

/**
 * A fixed, deterministic starting vector for power iteration. Using
 * `Math.sin` of an index-derived value rather than `Math.random` means the
 * same matrix and dimension always start from the same place, so the result
 * is reproducible -- it just needs to not be exactly orthogonal to the
 * eigenvector power iteration is converging toward, which a fixed
 * irrational-looking sequence like this reliably avoids in practice.
 *
 * @param {number} n - Vector length.
 * @param {number} salt - Varies the vector per SVD component so each
 *   deflation stage starts from a distinct direction.
 * @returns {number[]} A unit vector.
 */
function seedVector(n, salt) {
  const v = []
  for (let i = 0; i < n; i += 1) {
    v.push(Math.sin((i + 1) * (salt + 2) * 12.9898))
  }
  const scale = norm(v) || 1
  return v.map((x) => x / scale)
}

/**
 * The top `k` eigenpairs of a symmetric matrix, found by power iteration
 * with deflation. For the symmetric, zero-diagonal PPMI matrices this page
 * builds, that's the same computation as truncated SVD: singular values are
 * `|eigenvalue|` and singular vectors are the eigenvectors (a negative
 * eigenvalue just means that direction's word vectors get negated, which
 * doesn't change any cosine similarity between two words that are both
 * negated the same way).
 *
 * Deterministic: the same matrix and `k` always produce the same vectors,
 * each a unit vector, and any two of the returned vectors are orthogonal
 * (up to floating-point error) -- both properties fall out of power
 * iteration plus deflation on a symmetric matrix, not anything special
 * about this implementation.
 *
 * @param {number[][]} matrix - A square, symmetric matrix.
 * @param {number} k - Number of components to extract.
 * @param {{iterations?: number}} [options]
 * @returns {{values: number[], vectors: number[][]}} `values[i]` is the
 *   eigenvalue for `vectors[i]`, both sorted by decreasing `|value|`.
 */
function truncatedSVD(matrix, k, options = {}) {
  const { iterations = 200 } = options
  const n = matrix.length
  const deflated = matrix.map((row) => [...row])

  const values = []
  const vectors = []

  for (let c = 0; c < k && c < n; c += 1) {
    let v = seedVector(n, c)
    for (let iter = 0; iter < iterations; iter += 1) {
      const next = matVecMul(deflated, v)
      const magnitude = norm(next)
      if (magnitude < 1e-12) break
      v = next.map((x) => x / magnitude)
    }

    const eigenvalue = dot(v, matVecMul(deflated, v))
    values.push(eigenvalue)
    vectors.push(v)

    // Deflate: remove this component so the next power iteration converges
    // on the next-largest one instead of finding the same one again.
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        deflated[i][j] -= eigenvalue * v[i] * v[j]
      }
    }
  }

  return { values, vectors }
}

/**
 * Turns SVD components into one dense vector per vocabulary word: word `i`'s
 * vector is `[vectors[0][i] * sqrt(|values[0]|), vectors[1][i] * sqrt(|values[1]|), ...]`.
 * Scaling each component by the square root of its eigenvalue (rather than
 * using the raw eigenvector entries) is the standard way to turn an SVD into
 * word vectors -- it's the same idea as classic LSA -- so that components
 * with more signal contribute more to distances between words.
 *
 * @param {string[]} words
 * @param {{values: number[], vectors: number[][]}} svd
 * @returns {number[][]} `vectors[i]` is the dense vector for `words[i]`.
 */
function wordVectors(words, svd) {
  const scales = svd.values.map((value) => Math.sqrt(Math.abs(value)))
  return words.map((_word, i) => svd.vectors.map((component, c) => component[i] * scales[c]))
}

/**
 * The first two dimensions of each word's dense vector, for plotting.
 * Because `truncatedSVD`'s components are already ordered by decreasing
 * `|eigenvalue|`, this is the top two components -- not an approximation
 * computed separately.
 *
 * @param {number[][]} vectors
 * @returns {{x: number, y: number}[]}
 */
function projectTo2D(vectors) {
  return vectors.map((v) => ({ x: v[0] ?? 0, y: v[1] ?? 0 }))
}

/**
 * Cosine similarity between two vectors: 1 for the same direction, 0 for
 * perpendicular, -1 for opposite. Returns 0 for a zero-magnitude vector
 * rather than dividing by zero.
 *
 * @param {number[]} u
 * @param {number[]} v
 * @returns {number}
 */
function cosineSimilarity(u, v) {
  const denom = norm(u) * norm(v)
  return denom === 0 ? 0 : dot(u, v) / denom
}

/**
 * The words whose vectors are most similar (by cosine) to a given word's.
 *
 * @param {string} word
 * @param {string[]} words
 * @param {number[][]} vectors - `vectors[i]` corresponds to `words[i]`.
 * @param {{topN?: number}} [options]
 * @returns {{word: string, similarity: number}[]} Up to `topN` entries,
 *   excluding `word` itself, sorted by decreasing similarity.
 */
function nearestNeighbors(word, words, vectors, options = {}) {
  const { topN = 5 } = options
  const index = words.indexOf(word)
  if (index === -1) return []

  const target = vectors[index]
  return words
    .map((w, i) => ({ word: w, similarity: cosineSimilarity(target, vectors[i]) }))
    .filter((entry) => entry.word !== word)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN)
}

/**
 * The classic embedding analogy: `a - b + c`, e.g. `king - man + woman`.
 * Results are the words whose vectors are nearest that combined vector,
 * excluding `a`, `b`, and `c` themselves so the answer can't just be one of
 * the inputs.
 *
 * A tiny corpus like this page's doesn't have enough context to make
 * analogies reliable -- the top result is shown honestly, not cherry-picked
 * to make "king - man + woman = queen" come out right.
 *
 * @param {string} a
 * @param {string} b
 * @param {string} c
 * @param {string[]} words
 * @param {number[][]} vectors
 * @param {{topN?: number}} [options]
 * @returns {{word: string, similarity: number}[]} Empty if any input word is
 *   out of vocabulary.
 */
function analogy(a, b, c, words, vectors, options = {}) {
  const { topN = 5 } = options
  const ia = words.indexOf(a)
  const ib = words.indexOf(b)
  const ic = words.indexOf(c)
  if (ia === -1 || ib === -1 || ic === -1) return []

  const dim = vectors[ia].length
  const target = new Array(dim)
  for (let d = 0; d < dim; d += 1) target[d] = vectors[ia][d] - vectors[ib][d] + vectors[ic][d]

  const exclude = new Set([a, b, c])
  return words
    .map((w, i) => ({ word: w, similarity: cosineSimilarity(target, vectors[i]) }))
    .filter((entry) => !exclude.has(entry.word))
    .sort((a2, b2) => b2.similarity - a2.similarity)
    .slice(0, topN)
}

/**
 * Runs the full pipeline on a corpus: tokenize, build a vocabulary, count
 * co-occurrence, compute PPMI, and derive dense word vectors via truncated
 * SVD. Exposed as one function for the page and for the timing test; each
 * step is still available individually above for the walkthrough tables.
 *
 * @param {string[]} sentences
 * @param {{windowSize?: number, minCount?: number, dim?: number}} [options]
 * @returns {{
 *   tokenizedSentences: string[][],
 *   vocab: {words: string[], indexOf: Map<string, number>, counts: Map<string, number>},
 *   coMatrix: number[][],
 *   ppmiMatrix: number[][],
 *   svd: {values: number[], vectors: number[][]},
 *   vectors: number[][],
 *   points: {x: number, y: number}[],
 * }}
 */
function runPipeline(sentences, options = {}) {
  const {
    windowSize = DEFAULT_WINDOW_SIZE,
    minCount = DEFAULT_MIN_COUNT,
    dim = DEFAULT_DIM,
  } = options

  const tokenizedSentences = tokenizeSentences(sentences)
  const vocab = buildVocabulary(tokenizedSentences, { minCount })
  const coMatrix = buildCooccurrence(tokenizedSentences, vocab, windowSize)
  const ppmiMatrix = computePPMI(coMatrix)
  const svd = truncatedSVD(ppmiMatrix, Math.min(dim, vocab.words.length))
  const vectors = wordVectors(vocab.words, svd)
  const points = projectTo2D(vectors)

  return { tokenizedSentences, vocab, coMatrix, ppmiMatrix, svd, vectors, points }
}

export {
  DEFAULT_STOPWORDS,
  DEFAULT_WINDOW_SIZE,
  DEFAULT_MIN_COUNT,
  DEFAULT_DIM,
  tokenize,
  tokenizeSentences,
  buildVocabulary,
  buildCooccurrence,
  computePPMI,
  dot,
  norm,
  matVecMul,
  truncatedSVD,
  wordVectors,
  projectTo2D,
  cosineSimilarity,
  nearestNeighbors,
  analogy,
  runPipeline,
}
