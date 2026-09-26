/**
 * syllogism.js
 *
 * Checks a categorical syllogism -- two premises and a conclusion, each one of
 * the four classical forms (A/E/I/O) over three terms -- under the modern
 * (Boolean) reading with no existential import: "All A are B" only says A
 * minus B is empty, it does not assume A has any members.
 *
 * The three terms divide the page into 8 regions, one for each combination of
 * being inside or outside each term's circle. A region is numbered 0-7, one
 * bit per term in TERM_SLOTS order (bit 0 is term1, and so on), and also has
 * a 3-character key of the same bits as "1"/"0" -- e.g. "101" is inside term1
 * and term3, outside term2. That key is what syllogism.html uses to place
 * shading and marks on the diagram.
 *
 * An *assignment* says, for each of the 8 regions, whether it holds a member:
 * an 8-bit number, bit r set if region r is non-empty. A statement is true
 * under an assignment exactly when that assignment satisfies its claim (see
 * `holds`). A syllogism is valid iff every assignment that satisfies both
 * premises also satisfies the conclusion -- checked here by brute force over
 * all 256 assignments, rather than by reasoning about which regions must be
 * shaded.
 */

const TERM_SLOTS = ["term1", "term2", "term3"]
const REGION_NUMS = [0, 1, 2, 3, 4, 5, 6, 7]

/** Whether region `r` (0-7) is inside `slot`'s circle. */
function isIn(r, slot) {
  return ((r >> TERM_SLOTS.indexOf(slot)) & 1) === 1
}

/** The 3-character "in"/"out" key for a region, in TERM_SLOTS order. */
function regionKey(r) {
  return TERM_SLOTS.map((slot) => (isIn(r, slot) ? "1" : "0")).join("")
}

/** All eight region keys, e.g. ["000", "001", ..., "111"]. */
const ALL_REGIONS = REGION_NUMS.map(regionKey)

/**
 * A statement: a quantifier over an ordered pair of distinct term slots, e.g.
 * `{ quantifier: "A", subject: "term1", predicate: "term2" }` for "All term1
 * are term2".
 *
 * @typedef {{quantifier: "A"|"E"|"I"|"O", subject: string, predicate: string}} Statement
 */

/**
 * Whether `stmt` is true under `assignment` (an 8-bit number, bit r set if
 * region r is non-empty).
 *
 * @param {Statement} stmt
 * @param {number} assignment
 * @returns {boolean}
 */
function holds(stmt, assignment) {
  const subjectRegions = REGION_NUMS.filter((r) => isIn(r, stmt.subject))
  const inPredicate = (r) => isIn(r, stmt.predicate)
  const nonEmpty = (r) => ((assignment >> r) & 1) === 1
  switch (stmt.quantifier) {
    case "A":
      return subjectRegions.every((r) => inPredicate(r) || !nonEmpty(r))
    case "E":
      return subjectRegions.every((r) => !inPredicate(r) || !nonEmpty(r))
    case "I":
      return subjectRegions.some((r) => inPredicate(r) && nonEmpty(r))
    case "O":
      return subjectRegions.some((r) => !inPredicate(r) && nonEmpty(r))
    default:
      throw new Error(`Unknown quantifier: ${stmt.quantifier}`)
  }
}

/** Every assignment (0-255) that satisfies both premises. */
function satisfyingAssignments(premise1, premise2) {
  const assignments = []
  for (let a = 0; a < 256; a++) {
    if (holds(premise1, a) && holds(premise2, a)) assignments.push(a)
  }
  return assignments
}

/**
 * The two regions a statement's own claim is about: inside the subject's
 * circle, inside or outside the predicate's circle depending on the
 * quantifier, and either way on the third, unmentioned term. A universal
 * statement (A/E) claims both regions are empty; a particular one (I/O)
 * claims at least one of them isn't.
 *
 * @param {Statement} stmt
 * @returns {string[]} Two region keys.
 */
function statementRegions(stmt) {
  if (stmt.subject === stmt.predicate) {
    throw new Error("A statement's subject and predicate must be different terms")
  }
  const predicateIn = stmt.quantifier === "E" || stmt.quantifier === "I"
  return REGION_NUMS.filter(
    (r) => isIn(r, stmt.subject) && isIn(r, stmt.predicate) === predicateIn,
  ).map(regionKey)
}

/**
 * Checks a syllogism by brute force: every assignment that satisfies both
 * premises must also satisfy the conclusion.
 *
 * Also works out what to draw: a region is shaded if it's empty in every
 * assignment satisfying the premises, and each particular premise gets an
 * "X" mark on its own two regions -- narrowed to one if shading has already
 * ruled out the other.
 *
 * @param {Statement} premise1
 * @param {Statement} premise2
 * @param {Statement} conclusion
 * @returns {{
 *   valid: boolean,
 *   contradiction: boolean,
 *   explanation: string,
 *   shaded: Set<string>,
 *   marks: Array<{regions: string[]}>,
 * }}
 */
function checkSyllogism(premise1, premise2, conclusion) {
  const assignments = satisfyingAssignments(premise1, premise2)

  if (assignments.length === 0) {
    return {
      valid: false,
      contradiction: true,
      explanation:
        "The premises contradict each other -- no way of filling in the diagram satisfies both -- so there's nothing left to check the conclusion against.",
      shaded: new Set(),
      marks: [],
    }
  }

  const valid = assignments.every((a) => holds(conclusion, a))
  const shaded = new Set(
    REGION_NUMS.filter((r) => assignments.every((a) => ((a >> r) & 1) === 0)).map(regionKey),
  )
  const marks = [premise1, premise2]
    .filter((p) => p.quantifier === "I" || p.quantifier === "O")
    .map((p) => ({ regions: statementRegions(p).filter((r) => !shaded.has(r)) }))

  const universal = conclusion.quantifier === "A" || conclusion.quantifier === "E"
  const explanation = universal
    ? valid
      ? "Valid: the premises already shade every region this conclusion needs empty."
      : "Invalid: the premises leave at least one region open that this conclusion needs empty."
    : valid
      ? "Valid: the premises guarantee a non-empty region inside what this conclusion needs."
      : "Invalid: nothing in the premises guarantees the non-empty region this conclusion needs."

  return { valid, contradiction: false, explanation, shaded, marks }
}

/**
 * Renders a statement as English, e.g. "All Greeks are Men".
 *
 * @param {Statement} stmt
 * @param {Object<string, string>} terms - Display name for each term slot.
 * @returns {string}
 */
function formatStatement(stmt, terms) {
  const label = { A: "All", E: "No", I: "Some", O: "Some" }[stmt.quantifier]
  const trailer = stmt.quantifier === "O" ? "are not" : "are"
  return `${label} ${terms[stmt.subject]} ${trailer} ${terms[stmt.predicate]}`
}

/**
 * The page's starting state: "All A are B; some C are A; so some C are B" --
 * the example from the idea doc, which happens to be valid.
 */
const DEFAULT_STATE = {
  terms: { term1: "A", term2: "B", term3: "C" },
  premise1: { quantifier: "A", subject: "term1", predicate: "term2" },
  premise2: { quantifier: "I", subject: "term3", predicate: "term1" },
  conclusion: { quantifier: "I", subject: "term3", predicate: "term2" },
}

/** Three classic syllogisms: two valid moods, and one classic invalid one. */
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
]

export { TERM_SLOTS, ALL_REGIONS, DEFAULT_STATE, PRESETS, checkSyllogism, formatStatement }
