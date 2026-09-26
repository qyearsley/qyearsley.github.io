/**
 * syllogism.js
 *
 * Checks a categorical syllogism -- two premises and a conclusion, each in one
 * of the four classical forms (A/E/I/O) over three terms -- against the
 * three-circle Venn diagram method, under the modern (Boolean) reading with no
 * existential import: "All A are B" only says A minus B is empty, it does not
 * assume A has any members.
 *
 * The diagram has three circles, one per term, and 2^3 = 8 regions, one for
 * every combination of being inside or outside each circle. A region is
 * identified by a three-character key of "1" (inside) or "0" (outside), in
 * `TERM_SLOTS` order -- e.g. "101" is inside term1 and term3, outside term2.
 *
 * A universal statement (A or E) shades two regions empty. A particular
 * statement (I or O) claims that at least one of two regions is non-empty --
 * an "X" that sits on the boundary between them until something pins it to
 * one side. The two regions a statement touches always agree on its subject
 * and predicate term and differ only on the third, unmentioned term, since a
 * statement about two terms says nothing about the third.
 *
 * `computeDiagramState` folds both premises into that diagram: which regions
 * are shaded, which are pinned non-empty, and which still carry an
 * unresolved X. `checkConclusion` then asks whether the conclusion's own
 * claim is already settled by that diagram. Nothing here draws the diagram --
 * that's DOM work, left to syllogism.html -- this module only computes the
 * region states and the verdict.
 */

/** The three term slots every statement and region is defined over. */
const TERM_SLOTS = ["term1", "term2", "term3"]

/**
 * The four classical categorical forms, each keyed by its traditional letter.
 *
 * `subjectBit`/`predicateBit` are the region membership ("in" the circle, or
 * "out" of it) that the form's own two regions share. A and O share the same
 * two regions (subject in, predicate out) because "All S are P" and "Some S
 * are not P" are contradictories -- one shades exactly what the other
 * claims is non-empty -- and likewise E and I (subject in, predicate in).
 */
const FORMS = {
  A: { label: "All", trailer: "are", type: "universal", subjectBit: "in", predicateBit: "out" },
  E: { label: "No", trailer: "are", type: "universal", subjectBit: "in", predicateBit: "in" },
  I: { label: "Some", trailer: "are", type: "particular", subjectBit: "in", predicateBit: "in" },
  O: {
    label: "Some",
    trailer: "are not",
    type: "particular",
    subjectBit: "in",
    predicateBit: "out",
  },
}

/**
 * The term slot that isn't either of the two given.
 *
 * @param {string} a - A slot from `TERM_SLOTS`.
 * @param {string} b - A different slot from `TERM_SLOTS`.
 * @returns {string} The remaining slot.
 */
function otherSlot(a, b) {
  return TERM_SLOTS.find((slot) => slot !== a && slot !== b)
}

/**
 * The eight-character-free, three-character region key for a set of
 * per-slot memberships.
 *
 * @param {Object<string, "in"|"out">} bits - Membership for every slot in
 *   `TERM_SLOTS`.
 * @returns {string} A three-character key of "1" (in) / "0" (out), in
 *   `TERM_SLOTS` order.
 */
function regionKeyFromBits(bits) {
  return TERM_SLOTS.map((slot) => (bits[slot] === "in" ? "1" : "0")).join("")
}

/**
 * The per-slot membership a region key encodes.
 *
 * @param {string} key - A three-character region key, as from `regionKeyFromBits`.
 * @returns {Object<string, "in"|"out">}
 */
function regionBitsFromKey(key) {
  const bits = {}
  TERM_SLOTS.forEach((slot, i) => {
    bits[slot] = key[i] === "1" ? "in" : "out"
  })
  return bits
}

/** All eight regions of the diagram, key and membership together. */
const ALL_REGIONS = Array.from({ length: 8 }, (_, i) => i.toString(2).padStart(3, "0")).map(
  (key) => ({ key, bits: regionBitsFromKey(key) }),
)

/**
 * A statement: a quantifier over an ordered pair of distinct term slots, e.g.
 * `{ quantifier: "A", subject: "term1", predicate: "term2" }` for "All term1
 * are term2".
 *
 * @typedef {{quantifier: "A"|"E"|"I"|"O", subject: string, predicate: string}} Statement
 */

/**
 * The two regions a statement's own claim is about: subject and predicate
 * fixed per its form, the third (unmentioned) term free.
 *
 * @param {Statement} stmt
 * @returns {[string, string]} Two region keys.
 * @throws {Error} If the subject and predicate are the same slot, or the
 *   quantifier isn't one of A/E/I/O.
 */
function statementRegions(stmt) {
  const { quantifier, subject, predicate } = stmt
  if (subject === predicate) {
    throw new Error("A statement's subject and predicate must be different terms")
  }
  const form = FORMS[quantifier]
  if (!form) {
    throw new Error(`Unknown quantifier: ${quantifier}`)
  }
  const other = otherSlot(subject, predicate)
  const base = { [subject]: form.subjectBit, [predicate]: form.predicateBit }
  return [
    regionKeyFromBits({ ...base, [other]: "in" }),
    regionKeyFromBits({ ...base, [other]: "out" }),
  ]
}

/**
 * Whether two region-key pairs name the same two regions, regardless of order.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
function sameRegionPair(a, b) {
  return a.length === b.length && a.every((r) => b.includes(r))
}

/**
 * Folds both premises into the diagram's region state.
 *
 * Universal premises (A/E) shade their two regions outright. A particular
 * premise (I/O) contributes an X across its two regions, which the *other*
 * premise's shading can pin to one side: if exactly one of its two regions is
 * already shaded, the X must fall on the other one, so that region is now
 * known non-empty. If both are shaded, the premises contradict each other on
 * this diagram (each premise, alone, is consistent -- it's the pair that
 * isn't). If neither is shaded, the X stays an unresolved boundary mark.
 *
 * @param {Statement} premise1
 * @param {Statement} premise2
 * @returns {{
 *   shaded: Set<string>,
 *   definiteNonempty: Set<string>,
 *   marks: Array<{regions: string[], resolved: boolean, contradictory?: boolean}>,
 *   contradiction: boolean,
 * }}
 */
function computeDiagramState(premise1, premise2) {
  const shaded = new Set()
  const existentialPairs = []

  for (const stmt of [premise1, premise2]) {
    const form = FORMS[stmt.quantifier]
    const regions = statementRegions(stmt)
    if (form.type === "universal") {
      regions.forEach((r) => shaded.add(r))
    } else {
      existentialPairs.push(regions)
    }
  }

  const definiteNonempty = new Set()
  const marks = []
  let contradiction = false

  for (const [r1, r2] of existentialPairs) {
    const shaded1 = shaded.has(r1)
    const shaded2 = shaded.has(r2)
    if (shaded1 && shaded2) {
      contradiction = true
      marks.push({ regions: [r1, r2], resolved: false, contradictory: true })
    } else if (shaded1) {
      definiteNonempty.add(r2)
      marks.push({ regions: [r2], resolved: true })
    } else if (shaded2) {
      definiteNonempty.add(r1)
      marks.push({ regions: [r1], resolved: true })
    } else {
      marks.push({ regions: [r1, r2], resolved: false })
    }
  }

  return { shaded, definiteNonempty, marks, contradiction }
}

/**
 * Whether the diagram (as folded from the premises) already settles the
 * conclusion's own claim.
 *
 * A universal conclusion follows iff both of its regions are shaded. A
 * particular conclusion follows iff one of its two regions is known
 * non-empty, or an unresolved X sits across exactly those same two regions --
 * i.e. a premise already asserted precisely the disjunction the conclusion
 * needs.
 *
 * @param {Statement} conclusion
 * @param {ReturnType<typeof computeDiagramState>} diagramState
 * @returns {boolean}
 */
function checkConclusion(conclusion, diagramState) {
  const form = FORMS[conclusion.quantifier]
  const regions = statementRegions(conclusion)

  if (form.type === "universal") {
    return regions.every((r) => diagramState.shaded.has(r))
  }

  if (regions.some((r) => diagramState.definiteNonempty.has(r))) {
    return true
  }
  return diagramState.marks.some(
    (mark) => !mark.resolved && !mark.contradictory && sameRegionPair(mark.regions, regions),
  )
}

/**
 * Checks a full syllogism: folds the premises into a diagram, then checks the
 * conclusion against it, and writes the verdict as one sentence.
 *
 * @param {Statement} premise1
 * @param {Statement} premise2
 * @param {Statement} conclusion
 * @returns {{
 *   diagramState: ReturnType<typeof computeDiagramState>,
 *   valid: boolean,
 *   contradiction: boolean,
 *   explanation: string,
 * }}
 */
function checkSyllogism(premise1, premise2, conclusion) {
  const diagramState = computeDiagramState(premise1, premise2)

  if (diagramState.contradiction) {
    return {
      diagramState,
      valid: false,
      contradiction: true,
      explanation:
        "The premises contradict each other on this diagram, so there's nothing left to check the conclusion against.",
    }
  }

  const valid = checkConclusion(conclusion, diagramState)
  const form = FORMS[conclusion.quantifier]
  const explanation =
    form.type === "universal"
      ? valid
        ? "Valid: the premises already shade every region this conclusion needs empty."
        : "Invalid: the premises leave at least one region open that this conclusion needs empty."
      : valid
        ? "Valid: the premises guarantee a non-empty region inside what this conclusion needs."
        : "Invalid: nothing in the premises guarantees the non-empty region this conclusion needs."

  return { diagramState, valid, contradiction: false, explanation }
}

/**
 * Renders a statement as English, e.g. "All Greeks are Men".
 *
 * @param {Statement} stmt
 * @param {Object<string, string>} terms - Display name for each term slot.
 * @returns {string}
 */
function formatStatement(stmt, terms) {
  const form = FORMS[stmt.quantifier]
  return `${form.label} ${terms[stmt.subject]} ${form.trailer} ${terms[stmt.predicate]}`
}

/** Default term names, matching the example in the Logic and Proof idea doc. */
const DEFAULT_TERMS = { term1: "A", term2: "B", term3: "C" }

/**
 * The page's starting state: "All A are B; some C are A; so some C are B" --
 * the example from the idea doc itself, which happens to be valid.
 */
const DEFAULT_STATE = {
  terms: { ...DEFAULT_TERMS },
  premise1: { quantifier: "A", subject: "term1", predicate: "term2" },
  premise2: { quantifier: "I", subject: "term3", predicate: "term1" },
  conclusion: { quantifier: "I", subject: "term3", predicate: "term2" },
}

/**
 * Preset syllogisms: three classically valid moods (Barbara, Celarent,
 * Darii), plus two classically-taught invalid ones. Each preset supplies its
 * own term names, chosen so the example reads naturally.
 */
const PRESETS = [
  {
    key: "barbara",
    label: "Barbara (AAA-1) — valid",
    valid: true,
    terms: { term1: "Greeks", term2: "Men", term3: "Mortals" },
    premise1: { quantifier: "A", subject: "term2", predicate: "term3" },
    premise2: { quantifier: "A", subject: "term1", predicate: "term2" },
    conclusion: { quantifier: "A", subject: "term1", predicate: "term3" },
  },
  {
    key: "celarent",
    label: "Celarent (EAE-1) — valid",
    valid: true,
    terms: { term1: "Snakes", term2: "Reptiles", term3: "Birds" },
    premise1: { quantifier: "E", subject: "term2", predicate: "term3" },
    premise2: { quantifier: "A", subject: "term1", predicate: "term2" },
    conclusion: { quantifier: "E", subject: "term1", predicate: "term3" },
  },
  {
    key: "darii",
    label: "Darii (AII-1) — valid",
    valid: true,
    terms: { term1: "Apples", term2: "Fruits", term3: "Foods" },
    premise1: { quantifier: "A", subject: "term2", predicate: "term3" },
    premise2: { quantifier: "I", subject: "term1", predicate: "term2" },
    conclusion: { quantifier: "I", subject: "term1", predicate: "term3" },
  },
  {
    key: "undistributed-middle",
    label: "Undistributed Middle (AAA-2) — invalid",
    valid: false,
    terms: { term1: "Dogs", term2: "Cats", term3: "Mammals" },
    premise1: { quantifier: "A", subject: "term2", predicate: "term3" },
    premise2: { quantifier: "A", subject: "term1", predicate: "term3" },
    conclusion: { quantifier: "A", subject: "term1", predicate: "term2" },
  },
  {
    key: "existential-fallacy",
    label: "Existential Fallacy (AAI-1) — invalid without existential import",
    valid: false,
    terms: { term1: "Kittens", term2: "Cats", term3: "Mammals" },
    premise1: { quantifier: "A", subject: "term2", predicate: "term3" },
    premise2: { quantifier: "A", subject: "term1", predicate: "term2" },
    conclusion: { quantifier: "I", subject: "term1", predicate: "term3" },
  },
]

/**
 * Looks up a preset by its key.
 *
 * @param {string} key
 * @returns {(typeof PRESETS)[number]|null}
 */
function presetByKey(key) {
  return PRESETS.find((preset) => preset.key === key) ?? null
}

export {
  TERM_SLOTS,
  FORMS,
  ALL_REGIONS,
  DEFAULT_TERMS,
  DEFAULT_STATE,
  PRESETS,
  otherSlot,
  regionKeyFromBits,
  regionBitsFromKey,
  statementRegions,
  computeDiagramState,
  checkConclusion,
  checkSyllogism,
  formatStatement,
  presetByKey,
}
