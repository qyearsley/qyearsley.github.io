import * as tc from "./tokenizer-comparison.js"

describe("textToBytes / bytesToText", () => {
  test("round-trips ASCII text", () => {
    expect(tc.bytesToText(tc.textToBytes("hello"))).toBe("hello")
  })

  test("round-trips Chinese text", () => {
    expect(tc.bytesToText(tc.textToBytes("你好"))).toBe("你好")
  })

  test("a common CJK character takes 3 UTF-8 bytes", () => {
    expect(tc.textToBytes("中")).toHaveLength(3)
    expect(tc.textToBytes("好")).toHaveLength(3)
  })

  test("bytesToHex renders bytes as space-separated uppercase hex", () => {
    expect(tc.bytesToHex([0xe4, 0xb8, 0xad])).toBe("E4 B8 AD")
    expect(tc.bytesToHex([5])).toBe("05")
  })
})

describe("trainBPE: known tiny example", () => {
  // "abab" as bytes is [97, 98, 97, 98]. The only adjacent pair is (97, 98),
  // appearing twice (98,97 appears once), so the first merge combines it into
  // a new token 256, leaving [256, 256]. The only pair left is (256, 256),
  // so the second merge combines that into 257, leaving a single token.
  test("training on 'abab' for 2 merges produces the expected merge sequence", () => {
    const bytes = tc.textToBytes("abab")
    const merges = tc.trainBPE([bytes], 2)
    expect(merges).toEqual([
      { a: 97, b: 98, id: 256 },
      { a: 256, b: 256, id: 257 },
    ])
    expect(tc.applyMerges(bytes, merges)).toEqual([257])
  })

  test("training stops early once no pair is left to merge", () => {
    const bytes = tc.textToBytes("abab")
    const merges = tc.trainBPE([bytes], 10)
    expect(merges).toHaveLength(2)
  })

  test("a single-byte sequence trains no merges", () => {
    expect(tc.trainBPE([[65]], 5)).toEqual([])
  })
})

describe("trainBPE: determinism", () => {
  test("training twice on the same corpus produces the same merges", () => {
    const sequences = tc.buildTrainingSequences(50)
    const a = tc.trainBPE(sequences, 30)
    const b = tc.trainBPE(sequences, 30)
    expect(a).toEqual(b)
  })

  test("ties are broken by the numerically smaller pair, not encounter order", () => {
    // (1,2) and (3,4) both occur twice; (1,2) is numerically smaller.
    const seq = [3, 4, 3, 4, 1, 2, 1, 2]
    const merges = tc.trainBPE([seq], 1)
    expect(merges).toEqual([{ a: 1, b: 2, id: 256 }])
  })
})

describe("trainBPE: token count on the training text never increases with more merges", () => {
  test("each additional learned merge keeps or reduces the token count", () => {
    const sequences = tc.buildTrainingSequences(50)
    const merges = tc.trainBPE(sequences, 60)
    let previous = Infinity
    for (let k = 0; k <= merges.length; k += 1) {
      const prefix = merges.slice(0, k)
      // Weight each sequence's token count the same way `countPairs` weights
      // its pairs, so this checks the same "total tokens across the mixed
      // corpus" quantity that training is actually shrinking.
      const total = sequences.reduce(
        (sum, seq) => sum + seq.weight * tc.applyMerges(seq.bytes, prefix).length,
        0,
      )
      expect(total).toBeLessThanOrEqual(previous)
      previous = total
    }
  })
})

describe("encode / decode round trip", () => {
  const sequences = tc.buildTrainingSequences(tc.DEFAULT_MIX_PERCENT)
  const merges = tc.trainBPE(sequences, tc.DEFAULT_MERGES)

  test.each([
    ["English", "The weather is nice today."],
    ["Chinese", "今天天气很好。"],
    ["mixed", "Hello 你好, world 世界!"],
    ["empty string", ""],
    ["emoji (4-byte UTF-8)", "Look at this: 🎉"],
  ])("round-trips %s text", (_label, text) => {
    const tokens = tc.encode(text, merges)
    expect(tc.decode(tokens, merges)).toBe(text)
  })

  test("round-trips with zero merges (identity: tokens are just bytes)", () => {
    const text = "中文 and English mixed"
    const tokens = tc.encode(text, [])
    expect(tokens).toEqual(tc.textToBytes(text))
    expect(tc.decode(tokens, [])).toBe(text)
  })
})

describe("tokenStats", () => {
  test("a common CJK character needs 3 tokens with no merges (one per byte)", () => {
    const stats = tc.tokenStats("中", [])
    expect(stats.chars).toBe(1)
    expect(stats.bytes).toBe(3)
    expect(stats.tokens).toBe(3)
    expect(stats.tokensPerChar).toBe(3)
  })

  test("an ASCII character needs 1 token with no merges", () => {
    const stats = tc.tokenStats("a", [])
    expect(stats).toEqual({ chars: 1, bytes: 1, tokens: 1, tokensPerChar: 1 })
  })

  test("tokensPerChar is 0 for empty text, not NaN", () => {
    expect(tc.tokenStats("", []).tokensPerChar).toBe(0)
  })

  test("merges never increase the token count for a fixed text", () => {
    const sequences = tc.buildTrainingSequences(70)
    const text = "The weather is nice today. 今天天气很好。"
    const merges = tc.trainBPE(sequences, 80)
    let previous = Infinity
    for (let k = 0; k <= merges.length; k += 10) {
      const tokens = tc.tokenStats(text, merges.slice(0, k)).tokens
      expect(tokens).toBeLessThanOrEqual(previous)
      previous = tokens
    }
  })
})

describe("tokenizeForDisplay", () => {
  test("with no merges, an ASCII character displays as itself", () => {
    const chips = tc.tokenizeForDisplay("a", [])
    expect(chips).toEqual([{ id: 97, bytes: [97], label: "a", isText: true }])
  })

  test("with no merges, each byte of a CJK character displays as hex, not a broken glyph", () => {
    const chips = tc.tokenizeForDisplay("中", [])
    const bytes = tc.textToBytes("中")
    expect(chips).toHaveLength(3)
    for (let i = 0; i < 3; i += 1) {
      expect(chips[i].isText).toBe(false)
      expect(chips[i].label).toBe(tc.bytesToHex([bytes[i]]))
    }
  })

  test("a merge spanning a full CJK character displays as the character", () => {
    const bytes = tc.textToBytes("中")
    // Merge byte 0 with byte 1, then that with byte 2, to build one token
    // covering the whole 3-byte character.
    const merges = [
      { a: bytes[0], b: bytes[1], id: 256 },
      { a: 256, b: bytes[2], id: 257 },
    ]
    const chips = tc.tokenizeForDisplay("中", merges)
    expect(chips).toEqual([{ id: 257, bytes, label: "中", isText: true }])
  })

  test("chip bytes always concatenate back to the original UTF-8 bytes", () => {
    const sequences = tc.buildTrainingSequences(30)
    const merges = tc.trainBPE(sequences, 40)
    const text = "Hello 你好世界"
    const chips = tc.tokenizeForDisplay(text, merges)
    const rebuilt = chips.flatMap((chip) => chip.bytes)
    expect(rebuilt).toEqual(tc.textToBytes(text))
  })
})

describe("buildTrainingSequences", () => {
  test("100% English produces one English sequence weighted by MIX_SLOTS", () => {
    const sequences = tc.buildTrainingSequences(100)
    const englishBytes = tc.textToBytes(tc.ENGLISH_CORPUS)
    expect(sequences).toEqual([{ bytes: englishBytes, weight: tc.MIX_SLOTS }])
  })

  test("0% English produces one Chinese sequence weighted by MIX_SLOTS", () => {
    const sequences = tc.buildTrainingSequences(0)
    const chineseBytes = tc.textToBytes(tc.CHINESE_CORPUS)
    expect(sequences).toEqual([{ bytes: chineseBytes, weight: tc.MIX_SLOTS }])
  })

  test("clamps out-of-range percentages", () => {
    expect(tc.buildTrainingSequences(-50)).toEqual(tc.buildTrainingSequences(0))
    expect(tc.buildTrainingSequences(150)).toEqual(tc.buildTrainingSequences(100))
  })

  test("a mix in between produces one weighted sequence per language, weights summing to MIX_SLOTS", () => {
    const sequences = tc.buildTrainingSequences(30)
    expect(sequences).toHaveLength(2)
    const totalWeight = sequences.reduce((sum, seq) => sum + seq.weight, 0)
    expect(totalWeight).toBe(tc.MIX_SLOTS)
  })

  test("weighting a single copy gives the same merges as literally repeating the corpus", () => {
    // buildTrainingSequences represents "N shares of this corpus" as one
    // sequence with weight N, instead of N literal copies, purely for
    // training speed (see the comment on the function). This checks the two
    // representations agree.
    const weighted = tc.buildTrainingSequences(40)
    const englishBytes = tc.textToBytes(tc.ENGLISH_CORPUS)
    const chineseBytes = tc.textToBytes(tc.CHINESE_CORPUS)
    const englishSlots = Math.round((40 / 100) * tc.MIX_SLOTS)
    const chineseSlots = tc.MIX_SLOTS - englishSlots
    const literal = [
      ...Array.from({ length: englishSlots }, () => englishBytes),
      ...Array.from({ length: chineseSlots }, () => chineseBytes),
    ]
    expect(tc.trainBPE(weighted, 30)).toEqual(tc.trainBPE(literal, 30))
  })

  test("a mostly-English corpus needs more merges to shrink Chinese text as much as English text", () => {
    // With training weighted heavily toward English, English gets
    // English-shaped merges and pulls further ahead of its own no-merge
    // token count than Chinese does -- the core point of this page.
    const sequences = tc.buildTrainingSequences(90)
    const merges = tc.trainBPE(sequences, 80)
    const englishSentence = "I like to drink tea in the morning."
    const chineseSentence = "我喜欢早上喝茶。"

    const englishNoMerge = tc.tokenStats(englishSentence, []).tokens
    const chineseNoMerge = tc.tokenStats(chineseSentence, []).tokens
    const englishTrained = tc.tokenStats(englishSentence, merges).tokens
    const chineseTrained = tc.tokenStats(chineseSentence, merges).tokens

    const englishReduction = (englishNoMerge - englishTrained) / englishNoMerge
    const chineseReduction = (chineseNoMerge - chineseTrained) / chineseNoMerge
    expect(englishReduction).toBeGreaterThan(chineseReduction)
  })

  test("at the default mix, more merges are learned at MAX_MERGES than at DEFAULT_MERGES", () => {
    // A sanity check that MAX_MERGES is actually reachable (training doesn't
    // stop early well before the slider's top end) given the corpus size.
    const sequences = tc.buildTrainingSequences(tc.DEFAULT_MIX_PERCENT)
    const atDefault = tc.trainBPE(sequences, tc.DEFAULT_MERGES)
    const atMax = tc.trainBPE(sequences, tc.MAX_MERGES)
    expect(atDefault).toHaveLength(tc.DEFAULT_MERGES)
    expect(atMax).toHaveLength(tc.MAX_MERGES)
  })
})

describe("PRESET_PAIRS", () => {
  test("every preset has a label, English text, and Chinese text", () => {
    expect(tc.PRESET_PAIRS.length).toBeGreaterThanOrEqual(2)
    for (const preset of tc.PRESET_PAIRS) {
      expect(typeof preset.label).toBe("string")
      expect(preset.en.length).toBeGreaterThan(0)
      expect(preset.zh.length).toBeGreaterThan(0)
    }
  })
})

describe("corpus size and slider limits", () => {
  test("both corpora are a few thousand UTF-8 bytes, not a couple hundred", () => {
    // Big enough that a few hundred merges learn real recurring words and
    // phrases instead of memorizing the whole text; see tokenizer-corpus.js.
    const englishBytes = tc.textToBytes(tc.ENGLISH_CORPUS).length
    const chineseBytes = tc.textToBytes(tc.CHINESE_CORPUS).length
    expect(englishBytes).toBeGreaterThan(4000)
    expect(englishBytes).toBeLessThan(8000)
    expect(chineseBytes).toBeGreaterThan(4000)
    expect(chineseBytes).toBeLessThan(8000)
  })

  test("MERGES_STEP evenly divides both DEFAULT_MERGES and MAX_MERGES", () => {
    expect(tc.DEFAULT_MERGES % tc.MERGES_STEP).toBe(0)
    expect(tc.MAX_MERGES % tc.MERGES_STEP).toBe(0)
    expect(tc.DEFAULT_MERGES).toBeLessThanOrEqual(tc.MAX_MERGES)
  })
})
