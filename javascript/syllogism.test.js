import * as syl from "./syllogism.js"

describe("statementRegions", () => {
  test("All term1 are term2: shades subject-in/predicate-out, third term free", () => {
    const regions = syl.statementRegions({
      quantifier: "A",
      subject: "term1",
      predicate: "term2",
    })
    expect(regions.sort()).toEqual(["100", "101"].sort())
  })

  test("No term1 are term2: subject-in/predicate-in, third term free", () => {
    const regions = syl.statementRegions({
      quantifier: "E",
      subject: "term1",
      predicate: "term2",
    })
    expect(regions.sort()).toEqual(["110", "111"].sort())
  })

  test("Some term1 are term2 and No term1 are term2 name the same two regions", () => {
    const some = syl.statementRegions({ quantifier: "I", subject: "term1", predicate: "term2" })
    const no = syl.statementRegions({ quantifier: "E", subject: "term1", predicate: "term2" })
    expect(some.sort()).toEqual(no.sort())
  })

  test("All term1 are term2 and Some term1 are not term2 name the same two regions", () => {
    const all = syl.statementRegions({ quantifier: "A", subject: "term1", predicate: "term2" })
    const someNot = syl.statementRegions({
      quantifier: "O",
      subject: "term1",
      predicate: "term2",
    })
    expect(all.sort()).toEqual(someNot.sort())
  })

  test("subject and predicate must differ", () => {
    expect(() =>
      syl.statementRegions({ quantifier: "A", subject: "term1", predicate: "term1" }),
    ).toThrow()
  })

  test("rejects an unknown quantifier", () => {
    expect(() =>
      syl.statementRegions({ quantifier: "Z", subject: "term1", predicate: "term2" }),
    ).toThrow()
  })
})

describe("ALL_REGIONS", () => {
  test("has all eight regions, each with a unique key", () => {
    expect(syl.ALL_REGIONS).toHaveLength(8)
    const keys = new Set(syl.ALL_REGIONS.map((r) => r.key))
    expect(keys.size).toBe(8)
  })

  test("bits round-trip through the region key", () => {
    for (const region of syl.ALL_REGIONS) {
      expect(syl.regionKeyFromBits(region.bits)).toBe(region.key)
      expect(syl.regionBitsFromKey(region.key)).toEqual(region.bits)
    }
  })
})

describe("otherSlot", () => {
  test("returns the slot that is neither argument", () => {
    expect(syl.otherSlot("term1", "term2")).toBe("term3")
    expect(syl.otherSlot("term2", "term3")).toBe("term1")
    expect(syl.otherSlot("term1", "term3")).toBe("term2")
  })
})

describe("computeDiagramState", () => {
  test("two universal premises shade regions and resolve no existential marks", () => {
    const state = syl.computeDiagramState(
      { quantifier: "A", subject: "term2", predicate: "term3" },
      { quantifier: "A", subject: "term1", predicate: "term2" },
    )
    expect(state.contradiction).toBe(false)
    expect(state.marks).toEqual([])
    expect(state.definiteNonempty.size).toBe(0)
    expect(state.shaded.has("010")).toBe(true) // term2 in, term3 out, term1 out
    expect(state.shaded.has("110")).toBe(true) // term2 in, term3 out, term1 in
  })

  test("a universal premise resolves the other premise's existential mark", () => {
    // All term2 are term3 (shades term2-in/term3-out), Some term1 are term2:
    // the "110" side of the Some claim is shaded, so "111" must be non-empty.
    const state = syl.computeDiagramState(
      { quantifier: "A", subject: "term2", predicate: "term3" },
      { quantifier: "I", subject: "term1", predicate: "term2" },
    )
    expect(state.contradiction).toBe(false)
    expect(state.definiteNonempty.has("111")).toBe(true)
    expect(state.marks).toEqual([{ regions: ["111"], resolved: true }])
  })

  test("two particular premises leave both marks unresolved", () => {
    const state = syl.computeDiagramState(
      { quantifier: "I", subject: "term1", predicate: "term2" },
      { quantifier: "I", subject: "term2", predicate: "term3" },
    )
    expect(state.contradiction).toBe(false)
    expect(state.definiteNonempty.size).toBe(0)
    expect(state.marks.every((m) => !m.resolved && !m.contradictory)).toBe(true)
  })

  test("a universal premise contradicting a particular premise over the same pair", () => {
    const state = syl.computeDiagramState(
      { quantifier: "E", subject: "term1", predicate: "term2" },
      { quantifier: "I", subject: "term1", predicate: "term2" },
    )
    expect(state.contradiction).toBe(true)
    expect(state.marks[0].contradictory).toBe(true)
  })
})

describe("checkSyllogism: presets", () => {
  test.each(syl.PRESETS)("$label", (preset) => {
    const result = syl.checkSyllogism(preset.premise1, preset.premise2, preset.conclusion)
    expect(result.valid).toBe(preset.valid)
    expect(result.contradiction).toBe(false)
    expect(result.explanation.length).toBeGreaterThan(0)
  })
})

describe("checkSyllogism: the idea doc's own example", () => {
  test("All A are B; some C are A; so some C are B -- valid", () => {
    const result = syl.checkSyllogism(
      syl.DEFAULT_STATE.premise1,
      syl.DEFAULT_STATE.premise2,
      syl.DEFAULT_STATE.conclusion,
    )
    expect(result.valid).toBe(true)
    expect(result.contradiction).toBe(false)
  })
})

describe("checkSyllogism: two particular premises never validate a conclusion", () => {
  test("Some A are B; some B are C; so some A are C -- invalid", () => {
    const result = syl.checkSyllogism(
      { quantifier: "I", subject: "term1", predicate: "term2" },
      { quantifier: "I", subject: "term2", predicate: "term3" },
      { quantifier: "I", subject: "term1", predicate: "term3" },
    )
    expect(result.valid).toBe(false)
  })
})

describe("checkSyllogism: contradictory premises", () => {
  test("reports contradiction instead of a validity verdict", () => {
    const result = syl.checkSyllogism(
      { quantifier: "E", subject: "term1", predicate: "term2" },
      { quantifier: "I", subject: "term1", predicate: "term2" },
      { quantifier: "A", subject: "term1", predicate: "term3" },
    )
    expect(result.contradiction).toBe(true)
    expect(result.valid).toBe(false)
    expect(result.explanation).toMatch(/contradict/)
  })
})

describe("formatStatement", () => {
  test("renders All/are", () => {
    expect(
      syl.formatStatement(
        { quantifier: "A", subject: "term1", predicate: "term2" },
        { term1: "Greeks", term2: "Men", term3: "Mortals" },
      ),
    ).toBe("All Greeks are Men")
  })

  test("renders Some/are not", () => {
    expect(
      syl.formatStatement(
        { quantifier: "O", subject: "term1", predicate: "term2" },
        { term1: "Greeks", term2: "Men", term3: "Mortals" },
      ),
    ).toBe("Some Greeks are not Men")
  })

  test("renders No/are", () => {
    expect(
      syl.formatStatement(
        { quantifier: "E", subject: "term2", predicate: "term3" },
        { term1: "Greeks", term2: "Men", term3: "Mortals" },
      ),
    ).toBe("No Men are Mortals")
  })
})

describe("presetByKey", () => {
  test("finds a preset by its key", () => {
    expect(syl.presetByKey("barbara")).toBe(syl.PRESETS[0])
  })

  test("returns null for an unknown key", () => {
    expect(syl.presetByKey("nope")).toBeNull()
  })
})
