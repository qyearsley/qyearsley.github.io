/**
 * tokenizer-comparison.js
 *
 * A tiny byte-level BPE (byte-pair encoding) tokenizer, trained on a mix of
 * English and Chinese prose, to show why a BPE tokenizer needs more tokens
 * for Chinese than for English carrying the same meaning.
 *
 * The pipeline, in order:
 * 1. `textToBytes` turns a string into its UTF-8 bytes (0-255). This is the
 *    starting "vocabulary" -- every byte value is its own token.
 * 2. `trainBPE` repeatedly finds the most frequent adjacent pair of tokens in
 *    a training corpus and merges it into one new token, the way real BPE
 *    tokenizers (part of how GPT- and Llama-family models tokenize text) are
 *    trained. Ties are broken deterministically (smallest pair, compared
 *    numerically) so the same corpus always learns the same merges.
 * 3. `encode` applies those learned merges, in the order they were learned,
 *    to turn a new piece of text into a short sequence of token ids.
 * 4. `decode` reverses that by expanding each token id back into its bytes
 *    and decoding the result as UTF-8 -- lossless, since every step only
 *    ever regroups bytes, never changes them.
 *
 * Because merges are learned from *frequency in the training corpus*, a
 * corpus that is mostly English teaches the tokenizer English-shaped merges
 * (common letter pairs, short words) and does nothing for Chinese byte
 * patterns, which is the whole point of this page's "corpus mix" slider.
 *
 * Everything here is a pure function over strings, byte arrays, and plain
 * objects -- no DOM, so it is straightforward to unit test and safe to call
 * from a slider's `input` handler.
 *
 * The training text itself -- a few thousand bytes of everyday English
 * prose, and a Chinese translation of it -- lives in `tokenizer-corpus.js`,
 * next door, so the page can link to it as the raw source of what was
 * trained on.
 */

import { ENGLISH_CORPUS, CHINESE_CORPUS } from "./tokenizer-corpus.js"

/** How many corpus "shares" the mix slider divides English and Chinese into. */
const MIX_SLOTS = 20

/**
 * Slider range and default for the merge-count control. Chosen so that a
 * single `trainBPE` call -- which runs synchronously on every slider `input`
 * event -- stays comfortably under 300ms even at `MAX_MERGES`: measured
 * around 240ms at 500 merges on the built-in corpus (a two-language mix,
 * the more expensive case), versus roughly 400ms at 1000.
 */
const MAX_MERGES = 500
const MERGES_STEP = 20
const DEFAULT_MERGES = 100
const DEFAULT_MIX_PERCENT = 50

/**
 * A couple of preset English/Chinese sentence pairs for the comparison tool,
 * each an editable starting point rather than a fixed example.
 */
const PRESET_PAIRS = [
  {
    label: "Morning coffee",
    en: "I wake up every morning and make a pot of coffee.",
    zh: "我每天早上起床，然后泡一壶咖啡。",
  },
  {
    label: "Evening walk",
    en: "In the evening, I like to go for a walk.",
    zh: "晚上我喜欢出去散步。",
  },
  {
    label: "Reading a book",
    en: "She is reading a book at home.",
    zh: "她在家看书。",
  },
]

/**
 * Encodes a single Unicode code point as its UTF-8 bytes.
 *
 * @param {number} codePoint
 * @returns {number[]}
 */
function codePointToUtf8Bytes(codePoint) {
  if (codePoint <= 0x7f) return [codePoint]
  if (codePoint <= 0x7ff) {
    return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)]
  }
  if (codePoint <= 0xffff) {
    return [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)]
  }
  return [
    0xf0 | (codePoint >> 18),
    0x80 | ((codePoint >> 12) & 0x3f),
    0x80 | ((codePoint >> 6) & 0x3f),
    0x80 | (codePoint & 0x3f),
  ]
}

/**
 * Encodes a string as its UTF-8 bytes. Iterating the string with `Array.from`
 * (rather than indexing it) walks whole code points, so a surrogate pair --
 * an emoji, say -- is encoded as one 4-byte character rather than two
 * mis-encoded halves.
 *
 * @param {string} text
 * @returns {number[]} Byte values 0-255, one array entry per byte.
 */
function textToBytes(text) {
  return Array.from(text).flatMap((ch) => codePointToUtf8Bytes(ch.codePointAt(0)))
}

/**
 * Reads one UTF-8 code point starting at `bytes[i]`, validating continuation
 * bytes, sequence length, and that the encoding is not overlong or a
 * surrogate code point (neither of which a well-formed UTF-8 encoder would
 * ever produce).
 *
 * @param {number[]} bytes
 * @param {number} i
 * @returns {{codePoint: number, length: number} | null} `null` if the byte at
 *   `i` does not begin a valid, complete code point.
 */
function readUtf8CodePoint(bytes, i) {
  const first = bytes[i]
  let length
  let codePoint
  if (first <= 0x7f) {
    length = 1
    codePoint = first
  } else if ((first & 0xe0) === 0xc0) {
    length = 2
    codePoint = first & 0x1f
  } else if ((first & 0xf0) === 0xe0) {
    length = 3
    codePoint = first & 0x0f
  } else if ((first & 0xf8) === 0xf0) {
    length = 4
    codePoint = first & 0x07
  } else {
    return null // a stray continuation byte, or an invalid lead byte
  }

  if (i + length > bytes.length) return null // truncated

  for (let k = 1; k < length; k += 1) {
    const byte = bytes[i + k]
    if ((byte & 0xc0) !== 0x80) return null
    codePoint = (codePoint << 6) | (byte & 0x3f)
  }

  const minForLength = [0, 0, 0x80, 0x800, 0x10000][length]
  if (codePoint < minForLength || codePoint > 0x10ffff) return null
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return null // surrogate range

  return { codePoint, length }
}

/**
 * Decodes UTF-8 bytes into a string.
 *
 * @param {number[]} bytes
 * @param {{fatal?: boolean}} [options] - With `fatal: true`, any malformed or
 *   truncated sequence fails the whole decode (returns `null`) instead of
 *   being replaced -- used to tell whether a token's bytes are valid UTF-8 on
 *   their own, for chip display.
 * @returns {string | null}
 */
function decodeUtf8(bytes, { fatal = false } = {}) {
  const codePoints = []
  let i = 0
  while (i < bytes.length) {
    const result = readUtf8CodePoint(bytes, i)
    if (result) {
      codePoints.push(result.codePoint)
      i += result.length
    } else {
      if (fatal) return null
      codePoints.push(0xfffd) // U+FFFD REPLACEMENT CHARACTER
      i += 1
    }
  }
  return String.fromCodePoint(...codePoints)
}

/**
 * Decodes a byte array back into a string, assuming it is valid UTF-8 (true
 * of anything this module produces, since it only ever regroups bytes).
 *
 * @param {number[]} bytes
 * @returns {string}
 */
function bytesToText(bytes) {
  return decodeUtf8(bytes)
}

/**
 * Renders bytes as space-separated uppercase hex pairs, for showing a token
 * that is not valid UTF-8 on its own -- a partial CJK character, for example
 * -- without producing broken glyphs or a decode error.
 *
 * @param {number[]} bytes
 * @returns {string} e.g. "E4 B8"
 */
function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")
}

/**
 * Decodes a token's bytes as UTF-8, but only if they form one or more
 * complete, valid code points on their own -- rejecting a lone continuation
 * byte or a truncated multi-byte sequence rather than replacing it with
 * U+FFFD.
 *
 * @param {number[]} bytes
 * @returns {{ok: true, text: string} | {ok: false, text: null}}
 */
function decodeTokenBytes(bytes) {
  const text = decodeUtf8(bytes, { fatal: true })
  return text === null ? { ok: false, text: null } : { ok: true, text }
}

/**
 * Counts adjacent-pair frequency across a set of independent, weighted
 * sequences. A pair never spans two sequences, so training on `[english,
 * chinese]` never learns a merge that straddles the language boundary. A
 * sequence's `weight` (default 1) scales every pair it contributes -- how
 * `buildTrainingSequences` represents "20 copies of this corpus" as one copy
 * with weight 20, without literally repeating the bytes.
 *
 * @param {Array<number[] | {bytes: number[], weight?: number}>} sequences
 * @returns {Map<string, {a: number, b: number, count: number}>} Keyed by
 *   `"a,b"` for fast lookup while counting.
 */
function countPairs(sequences) {
  const counts = new Map()
  for (const entry of sequences) {
    const seq = Array.isArray(entry) ? entry : entry.bytes
    const weight = Array.isArray(entry) ? 1 : (entry.weight ?? 1)
    for (let i = 0; i < seq.length - 1; i += 1) {
      const a = seq[i]
      const b = seq[i + 1]
      const key = `${a},${b}`
      const existing = counts.get(key)
      if (existing) existing.count += weight
      else counts.set(key, { a, b, count: weight })
    }
  }
  return counts
}

/**
 * Picks the pair to merge next: highest count, ties broken by the
 * numerically smallest `[a, b]` pair. That tie-break -- rather than "first
 * seen" or "last seen" -- is what makes training deterministic regardless of
 * `Map` iteration order or how the corpus is chunked into sequences.
 *
 * @param {Map<string, {a: number, b: number, count: number}>} pairCounts
 * @returns {{a: number, b: number, count: number} | null}
 */
function pickBestPair(pairCounts) {
  let best = null
  for (const entry of pairCounts.values()) {
    if (!best) {
      best = entry
      continue
    }
    if (entry.count > best.count) {
      best = entry
    } else if (entry.count === best.count) {
      if (entry.a < best.a || (entry.a === best.a && entry.b < best.b)) best = entry
    }
  }
  return best
}

/**
 * Replaces every non-overlapping occurrence of `[a, b]` in `seq` with
 * `newId`, scanning left to right.
 *
 * @param {number[]} seq
 * @param {number} a
 * @param {number} b
 * @param {number} newId
 * @returns {number[]}
 */
function applyMergeToSequence(seq, a, b, newId) {
  const result = []
  let i = 0
  while (i < seq.length) {
    if (i < seq.length - 1 && seq[i] === a && seq[i + 1] === b) {
      result.push(newId)
      i += 2
    } else {
      result.push(seq[i])
      i += 1
    }
  }
  return result
}

/**
 * Trains byte-level BPE merges from one or more independent, weighted byte
 * sequences.
 *
 * Each step counts every adjacent pair across all sequences (a plain
 * `number[]` counts as weight 1; `{bytes, weight}` scales its pairs by
 * `weight`, see `countPairs`), merges the most frequent one (deterministically,
 * via `pickBestPair`) into a new token id, and repeats. Training stops early,
 * before `numMerges` merges, once no sequence has an adjacent pair left to
 * merge.
 *
 * @param {Array<number[] | {bytes: number[], weight?: number}>} sequences -
 *   Independent training sequences (a pair is never counted or merged across
 *   two of them).
 * @param {number} numMerges - Maximum number of merges to learn.
 * @returns {Array<{a: number, b: number, id: number}>} The learned merges,
 *   in the order they were learned. `id` starts at 256 (past the 0-255 byte
 *   vocabulary) and increases by one per merge.
 */
function trainBPE(sequences, numMerges) {
  let seqs = sequences.map((entry) =>
    Array.isArray(entry)
      ? { bytes: entry.slice(), weight: 1 }
      : { bytes: entry.bytes.slice(), weight: entry.weight ?? 1 },
  )
  const merges = []
  for (let i = 0; i < numMerges; i += 1) {
    const best = pickBestPair(countPairs(seqs))
    if (!best) break
    const newId = 256 + merges.length
    seqs = seqs.map((s) => ({
      bytes: applyMergeToSequence(s.bytes, best.a, best.b, newId),
      weight: s.weight,
    }))
    merges.push({ a: best.a, b: best.b, id: newId })
  }
  return merges
}

/**
 * Applies learned merges, in order, to a byte sequence.
 *
 * @param {number[]} bytes
 * @param {Array<{a: number, b: number, id: number}>} merges
 * @returns {number[]} Token ids: unmerged bytes (0-255) and/or merge ids.
 */
function applyMerges(bytes, merges) {
  let seq = bytes.slice()
  for (const merge of merges) {
    seq = applyMergeToSequence(seq, merge.a, merge.b, merge.id)
  }
  return seq
}

/**
 * Builds the full id -> bytes table implied by a list of merges: bytes 0-255
 * map to themselves, and each merge id maps to the concatenation of the
 * bytes of the two tokens it merged.
 *
 * @param {Array<{a: number, b: number, id: number}>} merges
 * @returns {Map<number, number[]>}
 */
function buildVocab(merges) {
  const vocab = new Map()
  for (let byte = 0; byte < 256; byte += 1) vocab.set(byte, [byte])
  for (const merge of merges) {
    vocab.set(merge.id, [...vocab.get(merge.a), ...vocab.get(merge.b)])
  }
  return vocab
}

/**
 * Encodes text into token ids: UTF-8 bytes, then the learned merges applied
 * in order.
 *
 * @param {string} text
 * @param {Array<{a: number, b: number, id: number}>} merges
 * @returns {number[]}
 */
function encode(text, merges) {
  return applyMerges(textToBytes(text), merges)
}

/**
 * Decodes token ids back into the original text: each token expands to its
 * bytes via the merge vocabulary, and the concatenated bytes decode as
 * UTF-8. Lossless for any token sequence produced by `encode`, since merges
 * only ever regroup bytes.
 *
 * @param {number[]} tokens
 * @param {Array<{a: number, b: number, id: number}>} merges
 * @returns {string}
 */
function decode(tokens, merges) {
  const vocab = buildVocab(merges)
  const bytes = tokens.flatMap((id) => vocab.get(id))
  return bytesToText(bytes)
}

/**
 * Builds the training corpus for a given English/Chinese mix, as one
 * weighted sequence per language (rather than a truncated slice of either,
 * or `MIX_SLOTS` literal copies of each), so mixing never cuts a multi-byte
 * character in half, and a 100% mix is just the one corpus.
 *
 * `mixPercent` divides into `MIX_SLOTS` shares (English gets the share
 * nearest `mixPercent`, Chinese gets the rest). A language with zero shares
 * is left out entirely rather than included as a zero-weight sequence, so a
 * 100%/0% mix trains on exactly one language, as before.
 *
 * @param {number} mixPercent - 0 (all Chinese) to 100 (all English).
 * @returns {Array<{bytes: number[], weight: number}>} Independent, weighted
 *   training sequences.
 */
function buildTrainingSequences(mixPercent) {
  const clamped = Math.min(100, Math.max(0, mixPercent))
  const englishSlots = Math.round((clamped / 100) * MIX_SLOTS)
  const chineseSlots = MIX_SLOTS - englishSlots

  const sequences = []
  if (englishSlots > 0) sequences.push({ bytes: textToBytes(ENGLISH_CORPUS), weight: englishSlots })
  if (chineseSlots > 0) sequences.push({ bytes: textToBytes(CHINESE_CORPUS), weight: chineseSlots })
  return sequences
}

/**
 * Character, byte, and token counts for a piece of text under a given set of
 * merges -- the numbers the comparison view shows under each sentence.
 *
 * @param {string} text
 * @param {Array<{a: number, b: number, id: number}>} merges
 * @returns {{chars: number, bytes: number, tokens: number, tokensPerChar: number}}
 */
function tokenStats(text, merges) {
  const chars = Array.from(text).length
  const bytes = textToBytes(text).length
  const tokens = encode(text, merges).length
  return { chars, bytes, tokens, tokensPerChar: chars > 0 ? tokens / chars : 0 }
}

/**
 * Tokenizes text for display as colored chips: each token paired with a
 * human-readable label -- the decoded text when the token's bytes are valid
 * UTF-8 on their own, or its bytes in hex when they are not (a partial CJK
 * character split across two tokens, most often).
 *
 * @param {string} text
 * @param {Array<{a: number, b: number, id: number}>} merges
 * @returns {Array<{id: number, bytes: number[], label: string, isText: boolean}>}
 */
function tokenizeForDisplay(text, merges) {
  const vocab = buildVocab(merges)
  const tokens = encode(text, merges)
  return tokens.map((id) => {
    const bytes = vocab.get(id)
    const decoded = decodeTokenBytes(bytes)
    return {
      id,
      bytes,
      label: decoded.ok ? decoded.text : bytesToHex(bytes),
      isText: decoded.ok,
    }
  })
}

export {
  MIX_SLOTS,
  MAX_MERGES,
  MERGES_STEP,
  DEFAULT_MERGES,
  DEFAULT_MIX_PERCENT,
  ENGLISH_CORPUS,
  CHINESE_CORPUS,
  PRESET_PAIRS,
  textToBytes,
  bytesToText,
  bytesToHex,
  trainBPE,
  applyMerges,
  buildVocab,
  encode,
  decode,
  buildTrainingSequences,
  tokenStats,
  tokenizeForDisplay,
}
