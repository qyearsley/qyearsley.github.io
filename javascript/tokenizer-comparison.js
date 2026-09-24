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
 */

/** How many corpus "shares" the mix slider divides English and Chinese into. */
const MIX_SLOTS = 20

/** Slider range and default for the merge-count control. */
const MAX_MERGES = 200
const DEFAULT_MERGES = 50
const DEFAULT_MIX_PERCENT = 50

/**
 * A few short paragraphs of everyday English prose, used to train the
 * tokenizer. Plain writing, not translated from anywhere -- its only job is
 * to give BPE some ordinary English letter and word patterns to learn from.
 */
const ENGLISH_CORPUS = `Every morning I wake up around seven and make a pot of coffee before I do anything else. I like to sit by the window with my cup and watch the street outside slowly wake up too. Some days a neighbor walks by with her dog, and the dog always stops to sniff the same bush.

After breakfast I usually check my email and then go for a short walk. Walking clears my head better than almost anything else, even a ten minute loop around the block. On the way back I stop at the corner store if we are out of milk or bread.

In the afternoon I try to get some work done, but it is easy to get distracted by small chores around the house. A load of laundry, a pile of dishes, a plant that needs water. By evening I am usually ready to sit down, read for a while, and go to bed early.`

/**
 * A few short paragraphs of everyday Chinese prose (my own writing, not a
 * translation of the English corpus above), used the same way.
 */
const CHINESE_CORPUS = `我每天早上七点左右起床，先给自己泡一杯茶，然后才开始做别的事情。我喜欢坐在窗户旁边，一边喝茶，一边看外面的街道慢慢热闹起来。有时候邻居会牵着狗散步，那只狗总是喜欢闻同一丛花。

吃过早饭以后，我通常会看看邮件，然后出去走一走。散步能让我的头脑变得清楚，哪怕只是绕着这条街走十分钟。回家的路上，如果家里没有牛奶或者面包了，我会去街角的小店买一些。

下午我想做一点工作，但是家里总有一些小事让我分心。洗衣服，洗碗，还有需要浇水的植物。到了晚上，我一般会坐下来看书，然后早点休息。`

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
 * Counts adjacent-pair frequency across a set of independent sequences. A
 * pair never spans two sequences, so training on `[englishBytes,
 * chineseBytes]` never learns a merge that straddles the language boundary.
 *
 * @param {number[][]} sequences
 * @returns {Map<string, {a: number, b: number, count: number}>} Keyed by
 *   `"a,b"` for fast lookup while counting.
 */
function countPairs(sequences) {
  const counts = new Map()
  for (const seq of sequences) {
    for (let i = 0; i < seq.length - 1; i += 1) {
      const a = seq[i]
      const b = seq[i + 1]
      const key = `${a},${b}`
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { a, b, count: 1 })
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
 * Trains byte-level BPE merges from one or more independent byte sequences.
 *
 * Each step counts every adjacent pair across all sequences, merges the most
 * frequent one (deterministically, via `pickBestPair`) into a new token id,
 * and repeats. Training stops early, before `numMerges` merges, once no
 * sequence has an adjacent pair left to merge.
 *
 * @param {number[][]} sequences - Independent training sequences (a pair is
 *   never counted or merged across two of them).
 * @param {number} numMerges - Maximum number of merges to learn.
 * @returns {Array<{a: number, b: number, id: number}>} The learned merges,
 *   in the order they were learned. `id` starts at 256 (past the 0-255 byte
 *   vocabulary) and increases by one per merge.
 */
function trainBPE(sequences, numMerges) {
  let seqs = sequences.map((seq) => seq.slice())
  const merges = []
  for (let i = 0; i < numMerges; i += 1) {
    const best = pickBestPair(countPairs(seqs))
    if (!best) break
    const newId = 256 + merges.length
    seqs = seqs.map((seq) => applyMergeToSequence(seq, best.a, best.b, newId))
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
 * Builds the training corpus for a given English/Chinese mix, as two
 * independent sequences (whole copies of each corpus, repeated to weight
 * it) rather than a truncated slice of either -- so mixing never cuts a
 * multi-byte character in half, and a 100% mix is just the one corpus.
 *
 * `mixPercent` divides into `MIX_SLOTS` shares (English gets the share
 * nearest `mixPercent`, Chinese gets the rest); repeating a whole corpus N
 * times scales every pair's count by N without inventing any new patterns,
 * so this is a clean way to weight "how much this language's byte patterns
 * influence which merges get learned" without touching corpus content.
 *
 * @param {number} mixPercent - 0 (all Chinese) to 100 (all English).
 * @returns {number[][]} Independent training sequences.
 */
function buildTrainingSequences(mixPercent) {
  const clamped = Math.min(100, Math.max(0, mixPercent))
  const englishSlots = Math.round((clamped / 100) * MIX_SLOTS)
  const chineseSlots = MIX_SLOTS - englishSlots

  const englishBytes = textToBytes(ENGLISH_CORPUS)
  const chineseBytes = textToBytes(CHINESE_CORPUS)

  const sequences = []
  for (let i = 0; i < englishSlots; i += 1) sequences.push(englishBytes)
  for (let i = 0; i < chineseSlots; i += 1) sequences.push(chineseBytes)
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
