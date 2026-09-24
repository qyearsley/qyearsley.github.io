import * as emb from "./embeddings.js"
import { CORPUS_SENTENCES, WORD_CLUSTER, CLUSTERS } from "./embeddings-corpus.js"

describe("tokenize", () => {
  test("lowercases and strips punctuation", () => {
    expect(emb.tokenize("The Cat, sat on a mat.")).toEqual(["the", "cat", "sat", "on", "a", "mat"])
  })

  test("returns an empty array for text with no words", () => {
    expect(emb.tokenize("... !! ,,")).toEqual([])
  })
})

// A tiny, hand-checkable corpus. Every count and matrix entry below was
// computed by hand from these three sentences -- see the comments -- so
// these tests catch a wrong pipeline, not just a change in the built-in
// corpus.
const TINY_CORPUS = [
  "the cat sat on the mat",
  "the dog sat on the log",
  "the cat and the dog are friends",
]

describe("buildVocabulary", () => {
  test("keeps words at or above minCount, drops the rest, sorted alphabetically", () => {
    const tokenized = emb.tokenizeSentences(TINY_CORPUS)
    // Word counts across all three sentences: the=6, cat=2, sat=2, on=2,
    // dog=2, mat=1, log=1, and=1, are=1, friends=1.
    const vocab = emb.buildVocabulary(tokenized, { minCount: 2, stopwords: new Set() })
    expect(vocab.words).toEqual(["cat", "dog", "on", "sat", "the"])
    expect(vocab.counts.get("the")).toBe(6)
    expect(vocab.counts.get("cat")).toBe(2)
    expect(vocab.counts.get("mat")).toBe(1)
  })

  test("drops stopwords even if they meet minCount", () => {
    const tokenized = emb.tokenizeSentences(TINY_CORPUS)
    const vocab = emb.buildVocabulary(tokenized, { minCount: 2 })
    // "the" and "on" are both default stopwords, even though each occurs
    // often enough to otherwise qualify.
    expect(vocab.words).not.toContain("the")
    expect(vocab.words).not.toContain("on")
    expect(vocab.words).toEqual(["cat", "dog", "sat"])
  })
})

describe("buildCooccurrence", () => {
  test("matches a hand count on the tiny corpus", () => {
    const tokenized = emb.tokenizeSentences(TINY_CORPUS)
    const vocab = emb.buildVocabulary(tokenized, { minCount: 2, stopwords: new Set() })
    // vocab.words is ["cat", "dog", "on", "sat", "the"], indices 0-4.
    const matrix = emb.buildCooccurrence(tokenized, vocab, 1)

    const expected = [
      [0, 0, 0, 1, 3], // cat
      [0, 0, 0, 1, 2], // dog
      [0, 0, 0, 2, 2], // on
      [1, 1, 2, 0, 0], // sat
      [3, 2, 2, 0, 0], // the
    ]
    expect(matrix).toEqual(expected)
  })

  test("is symmetric with a zero diagonal", () => {
    const tokenized = emb.tokenizeSentences(TINY_CORPUS)
    const vocab = emb.buildVocabulary(tokenized, { minCount: 1 })
    const matrix = emb.buildCooccurrence(tokenized, vocab, 2)
    for (let i = 0; i < matrix.length; i += 1) {
      expect(matrix[i][i]).toBe(0)
      for (let j = 0; j < matrix.length; j += 1) expect(matrix[i][j]).toBe(matrix[j][i])
    }
  })
})

describe("computePPMI", () => {
  test("is non-negative everywhere and zero for a pair that never co-occurs", () => {
    const tokenized = emb.tokenizeSentences(TINY_CORPUS)
    const vocab = emb.buildVocabulary(tokenized, { minCount: 2, stopwords: new Set() })
    const coMatrix = emb.buildCooccurrence(tokenized, vocab, 1)
    const ppmi = emb.computePPMI(coMatrix)

    // "sat" and "the" (indices 3 and 4) are never adjacent in the tiny
    // corpus: coMatrix[3][4] is 0, and PPMI must not turn that into -Infinity.
    expect(coMatrix[3][4]).toBe(0)
    expect(ppmi[3][4]).toBe(0)

    for (const row of ppmi) {
      for (const value of row) expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  test("an all-zero co-occurrence matrix produces an all-zero PPMI matrix", () => {
    const zeros = [
      [0, 0],
      [0, 0],
    ]
    expect(emb.computePPMI(zeros)).toEqual(zeros)
  })
})

describe("cosineSimilarity", () => {
  test("is 1 for identical direction, 0 for perpendicular, -1 for opposite", () => {
    expect(emb.cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
    expect(emb.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
    expect(emb.cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  test("is scale-invariant", () => {
    expect(emb.cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1)
  })

  test("is 0 for a zero-magnitude vector rather than NaN", () => {
    expect(emb.cosineSimilarity([0, 0], [1, 1])).toBe(0)
  })
})

describe("truncatedSVD", () => {
  // A small, symmetric matrix with well-separated eigenvalues, so power
  // iteration converges tightly and orthogonality isn't blurred by two
  // near-equal eigenvalues (the built-in corpus, with its very symmetric
  // clusters, has exactly that near-degeneracy -- fine for word vectors,
  // not a fair test of orthonormality).
  const MATRIX = [
    [4, 1, 0, 0],
    [1, 3, 1, 0],
    [0, 1, 2, 1],
    [0, 0, 1, 1],
  ]

  test("is deterministic: the same matrix always gives the same components", () => {
    const a = emb.truncatedSVD(MATRIX, 4)
    const b = emb.truncatedSVD(MATRIX, 4)
    expect(a).toEqual(b)
  })

  test("components are unit vectors and mutually orthogonal", () => {
    const { vectors } = emb.truncatedSVD(MATRIX, 4)
    for (let i = 0; i < vectors.length; i += 1) {
      expect(emb.norm(vectors[i])).toBeCloseTo(1, 6)
      for (let j = i + 1; j < vectors.length; j += 1) {
        expect(emb.dot(vectors[i], vectors[j])).toBeCloseTo(0, 6)
      }
    }
  })

  test("values are sorted by decreasing magnitude", () => {
    const { values } = emb.truncatedSVD(MATRIX, 4)
    for (let i = 1; i < values.length; i += 1) {
      expect(Math.abs(values[i])).toBeLessThanOrEqual(Math.abs(values[i - 1]))
    }
  })
})

describe("projectTo2D", () => {
  test("takes the first two components of each vector", () => {
    const points = emb.projectTo2D([
      [1, 2, 3],
      [4, 5, 6],
    ])
    expect(points).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 5 },
    ])
  })

  test("defaults a missing second component to 0", () => {
    expect(emb.projectTo2D([[1]])).toEqual([{ x: 1, y: 0 }])
  })
})

describe("runPipeline on the built-in corpus", () => {
  const result = emb.runPipeline(CORPUS_SENTENCES)

  test("produces a vector for every vocabulary word", () => {
    expect(result.vectors.length).toBe(result.vocab.words.length)
    expect(result.points.length).toBe(result.vocab.words.length)
  })

  test("runs well under 200ms", () => {
    const start = Date.now()
    emb.runPipeline(CORPUS_SENTENCES)
    const elapsed = Date.now() - start
    // eslint-disable-next-line no-console
    console.log(`embeddings pipeline: ${elapsed}ms for ${CORPUS_SENTENCES.length} sentences`)
    expect(elapsed).toBeLessThan(200)
  })

  // For each of a few representative words, most of its nearest neighbors
  // should share its designed cluster. "Most" (3 of 5) rather than "all",
  // so this doesn't break if the corpus changes slightly -- the point is
  // that clustering clearly works, not that it's perfect.
  test.each(["dog", "king", "bread", "castle", "run"])(
    "%s's nearest neighbors are mostly from its own cluster",
    (word) => {
      const cluster = WORD_CLUSTER.get(word)
      const neighbors = emb.nearestNeighbors(word, result.vocab.words, result.vectors, {
        topN: 5,
      })
      const sameCluster = neighbors.filter((n) => WORD_CLUSTER.get(n.word) === cluster)
      expect(sameCluster.length).toBeGreaterThanOrEqual(3)
    },
  )

  // Words in a cluster share some context (their cluster's shared frames)
  // but not all of it (each also has its own sentences), so they should be
  // similar without being identical. A corpus where every within-cluster
  // neighbor comes back at similarity 1.0000 would mean every word in a
  // cluster is a distributional clone of the others -- a degenerate result,
  // not a realistic one.
  test("within-cluster neighbor similarities are clearly below 1 (median under 0.95)", () => {
    const similarities = []
    for (const cluster of CLUSTERS) {
      for (const word of cluster.words) {
        const neighbors = emb.nearestNeighbors(word, result.vocab.words, result.vectors, {
          topN: 5,
        })
        for (const n of neighbors) {
          if (WORD_CLUSTER.get(n.word) === cluster.name) similarities.push(n.similarity)
        }
      }
    }
    similarities.sort((a, b) => a - b)
    const median = similarities[Math.floor(similarities.length / 2)]
    expect(median).toBeLessThan(0.95)
    for (const similarity of similarities) expect(similarity).toBeLessThan(1)
  })

  // With every word carrying its own sentences on top of a randomly-sampled
  // slice of its cluster's shared frames, most words should land on their
  // own point in the 2D projection rather than piling onto a handful of
  // exact duplicates.
  test("at least 90% of vocabulary words get a distinct 2D point", () => {
    const seen = new Set()
    for (const point of result.points) seen.add(`${point.x.toFixed(4)},${point.y.toFixed(4)}`)
    expect(seen.size / result.points.length).toBeGreaterThanOrEqual(0.9)
  })

  test("analogy excludes its three input words from the results", () => {
    const results = emb.analogy("king", "man", "woman", result.vocab.words, result.vectors)
    const words = results.map((r) => r.word)
    expect(words).not.toContain("king")
    expect(words).not.toContain("man")
    expect(words).not.toContain("woman")
    expect(results.length).toBeGreaterThan(0)
  })

  test("king - man + woman ranks queen at or near the top", () => {
    // Documents the actual (honest) output rather than asserting a specific
    // rank forever: on this corpus queen comes out on top, but the pipeline
    // doesn't special-case this analogy to make that happen.
    const results = emb.analogy("king", "man", "woman", result.vocab.words, result.vectors, {
      topN: 3,
    })
    expect(results.map((r) => r.word)).toContain("queen")
  })

  test("analogy returns no results for an out-of-vocabulary word", () => {
    expect(
      emb.analogy("king", "not-a-real-word", "woman", result.vocab.words, result.vectors),
    ).toEqual([])
  })
})

describe("CLUSTERS / WORD_CLUSTER", () => {
  test("every clustered word is covered by exactly one cluster", () => {
    const seen = new Set()
    for (const cluster of CLUSTERS) {
      for (const word of cluster.words) {
        expect(seen.has(word)).toBe(false)
        seen.add(word)
      }
    }
    expect(WORD_CLUSTER.size).toBe(seen.size)
  })

  test("the built-in corpus has a few hundred sentences", () => {
    expect(CORPUS_SENTENCES.length).toBeGreaterThan(100)
  })
})
