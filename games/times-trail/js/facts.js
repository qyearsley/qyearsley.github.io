/**
 * Fact set for Times Trail
 *
 * Owns the 36-fact multiplication set (2x2 through 9x9), the canonical form of a
 * fact id, and every way of selecting a subset of facts: by table family, by
 * trail region, or one at a time. Pure and stateless -- no DOM, no storage, no
 * clock, and the only randomness is the injected `rng` of `randomOrientation`.
 *
 * Architecture: facts are built once at module load into a frozen array whose
 * order is fixed (ascending smaller operand, then ascending larger operand), plus
 * a private `Map` for O(1) id lookup. Every exported table is frozen -- array and
 * elements -- so a mode or UI module cannot reshape the shared fact set by
 * accident. Every filtering function returns a fresh array, so callers may sort
 * or splice the result freely.
 *
 * Error Handling: two deliberately different styles, because the callers differ.
 * Functions taking operands (`canonicalize`, `factId`, `getFactFor`) throw
 * `RangeError` -- a bad operand is a programming mistake and should be loud.
 * Functions taking an id or a table list (`parseFactId`, `getFact`,
 * `factsForTables`, `factsForRegionTable`) never throw, because their input can
 * come from persisted settings or a save file: they return `null` or `[]`.
 */

import { OPERAND_MIN, OPERAND_MAX, PATTERN_FREE_IDS } from "./constants.js"

/**
 * @typedef {Object} Fact
 * @property {string} id      - Canonical id, "<min>x<max>", e.g. "6x7"
 * @property {number} a       - Smaller operand (2-9)
 * @property {number} b       - Larger operand (2-9), b >= a
 * @property {number} product - a * b
 * @property {boolean} isSquare - a === b
 * @property {boolean} isTough  - id is in PATTERN_FREE_IDS: one of the ten facts
 *                                with no pattern shortcut, so it must be recalled
 */

/**
 * @typedef {Object} Operands
 * @property {number} a - Smaller operand
 * @property {number} b - Larger operand, b >= a
 */

/**
 * @typedef {Object} Orientation
 * @property {number} left  - Operand shown on the left of the "x"
 * @property {number} right - Operand shown on the right of the "x"
 */

/**
 * Canonical fact-id shape. The "x" separator and the 2-9 operand range are baked
 * in deliberately: there is no FACT_ID_SEPARATOR constant, because storage.js
 * carries its own copy of this same literal regex and a constant only one of the
 * two honoured would be a lie. Anchored and case-sensitive, so "7X8", "07x8",
 * " 7x8", "10x3" and "7x" all fail to match.
 * @private
 * @type {RegExp}
 */
const _FACT_ID_PATTERN = /^([2-9])x([2-9])$/

/**
 * True when `value` is an integer within the fact set's operand bounds.
 * @private
 * @param {unknown} value - Candidate operand
 * @returns {boolean} Whether the value is an integer in [OPERAND_MIN, OPERAND_MAX]
 */
function _isOperand(value) {
  return Number.isInteger(value) && value >= OPERAND_MIN && value <= OPERAND_MAX
}

/**
 * Build the frozen 36-fact set in canonical order.
 * @private
 * @returns {readonly Fact[]} All facts, ascending by `a` then `b`, each frozen
 */
function _buildFacts() {
  const patternFree = new Set(PATTERN_FREE_IDS)
  const facts = []
  for (let a = OPERAND_MIN; a <= OPERAND_MAX; a += 1) {
    for (let b = a; b <= OPERAND_MAX; b += 1) {
      const id = `${a}x${b}`
      facts.push(
        Object.freeze({
          id,
          a,
          b,
          product: a * b,
          isSquare: a === b,
          isTough: patternFree.has(id),
        }),
      )
    }
  }
  return Object.freeze(facts)
}

/**
 * Every fact in the game, 36 of them, in canonical order: ascending smaller
 * operand, then ascending larger operand. `FACTS[0].id` is "2x2" and
 * `FACTS[35].id` is "9x9". The array and every element are frozen.
 * @type {readonly Fact[]}
 */
export const FACTS = _buildFacts()

/**
 * Canonical ids of every fact, in `FACTS` order. Frozen.
 * @type {readonly string[]}
 */
export const FACT_IDS = Object.freeze(FACTS.map((fact) => fact.id))

/**
 * The eight square ids, "2x2" through "9x9". Frozen.
 * @type {readonly string[]}
 */
export const SQUARE_IDS = Object.freeze(
  FACTS.filter((fact) => fact.isSquare).map((fact) => fact.id),
)

/**
 * Id -> Fact index, so `getFact` is O(1) rather than a scan of 36.
 * @private
 * @type {Map<string, Fact>}
 */
const _FACT_BY_ID = new Map(FACTS.map((fact) => [fact.id, fact]))

/**
 * Put a pair of operands into canonical order (smaller first).
 * @param {number} x - First operand, an integer in [OPERAND_MIN, OPERAND_MAX]
 * @param {number} y - Second operand, an integer in [OPERAND_MIN, OPERAND_MAX]
 * @returns {Operands} `{a: min, b: max}`
 * @throws {RangeError} If either operand is not an integer in range. Strings are
 *   never coerced: `canonicalize("6", 7)` throws.
 */
export function canonicalize(x, y) {
  if (!_isOperand(x) || !_isOperand(y)) {
    throw new RangeError(
      `Operands must be integers ${OPERAND_MIN}-${OPERAND_MAX}, got (${x}, ${y})`,
    )
  }
  return { a: Math.min(x, y), b: Math.max(x, y) }
}

/**
 * The canonical id of the fact with these operands. Symmetric:
 * `factId(8, 7) === factId(7, 8) === "7x8"`.
 * @param {number} x - First operand
 * @param {number} y - Second operand
 * @returns {string} Canonical id, "<min>x<max>"
 * @throws {RangeError} If either operand is not an integer in range
 */
export function factId(x, y) {
  const { a, b } = canonicalize(x, y)
  return `${a}x${b}`
}

/**
 * Parse a canonical fact id back into operands. Never throws -- ids can come
 * from a save file or a URL, so every rejection is a `null` return.
 *
 * Accepts only the exact canonical form: a single digit 2-9, a lowercase "x",
 * and a single digit 2-9, with the left digit less than or equal to the right.
 * Everything else is `null`, with no trimming, no case folding, and no numeric
 * coercion. So: `"7x8"` parses; `"8x7"` (non-canonical order), `"1x5"` and
 * `"10x3"` (out of range), `"7X8"` (uppercase), `"7*8"`, `"7x"`, `"axb"`, `""`,
 * `" 7x8 "`, `null`, `undefined` and any non-string all return `null`.
 * @param {unknown} id - Candidate fact id
 * @returns {Operands|null} `{a, b}` when `id` is a canonical fact id, else `null`
 */
export function parseFactId(id) {
  if (typeof id !== "string") return null
  const match = _FACT_ID_PATTERN.exec(id)
  if (!match) return null
  const a = Number(match[1])
  const b = Number(match[2])
  if (a > b) return null
  return { a, b }
}

/**
 * Look up a fact by canonical id. O(1). Never throws.
 * @param {unknown} id - Canonical fact id, e.g. "6x7"
 * @returns {Fact|null} The fact, or `null` for an unknown, non-canonical
 *   ("8x7") or non-string id
 */
export function getFact(id) {
  return _FACT_BY_ID.get(id) ?? null
}

/**
 * The fact with these operands, in either order.
 * @param {number} x - First operand
 * @param {number} y - Second operand
 * @returns {Fact} The fact; always found, since the operands are validated first
 * @throws {RangeError} If either operand is not an integer in range
 */
export function getFactFor(x, y) {
  return /** @type {Fact} */ (_FACT_BY_ID.get(factId(x, y)))
}

/**
 * The facts belonging to a set of enabled tables. Never throws: entries of
 * `tables` that are not integers in [OPERAND_MIN, OPERAND_MAX] are ignored, and
 * a non-array, empty, or all-invalid `tables` yields `[]`.
 * @param {number[]} tables - Enabled tables, e.g. `[2, 3, 4, 5]`
 * @param {"both"|"either"} mode - `"either"` includes a fact when either operand
 *   is enabled (custom table-family semantics); anything else, including the
 *   explicit `"both"`, requires both operands (preset-ceiling semantics)
 * @returns {Fact[]} A new array in `FACTS` order
 */
export function factsForTables(tables, mode) {
  if (!Array.isArray(tables)) return []
  const enabled = new Set(tables.filter(_isOperand))
  if (enabled.size === 0) return []
  if (mode === "either") {
    return FACTS.filter((fact) => enabled.has(fact.a) || enabled.has(fact.b))
  }
  return FACTS.filter((fact) => enabled.has(fact.a) && enabled.has(fact.b))
}

/**
 * Ids of the facts belonging to a set of enabled tables.
 * @param {number[]} tables - Enabled tables
 * @param {"both"|"either"} mode - See `factsForTables`
 * @returns {string[]} A new array of canonical ids in `FACTS` order
 */
export function factIdsForTables(tables, mode) {
  return factsForTables(tables, mode).map((fact) => fact.id)
}

/**
 * The facts a trail region owns: those whose LARGER operand equals `table`. Each
 * of the 36 facts therefore belongs to exactly one region, and region sizes run
 * 1, 2, 3, 4, 5, 6, 7, 8 for tables 2 through 9. Never throws.
 * @param {number} table - The region's table, an integer in range
 * @returns {Fact[]} A new array in `FACTS` order; `[]` for an out-of-range table
 */
export function factsForRegionTable(table) {
  if (!_isOperand(table)) return []
  return FACTS.filter((fact) => fact.b === table)
}

/**
 * Decide which way round to show a fact, so "3 x 8" and "8 x 3" both appear.
 *
 * Consumes exactly one `rng()` call, always -- including for squares, where the
 * result cannot vary -- so callers and tests can count rng consumption without
 * special-casing the diagonal.
 * @param {Fact} fact - The fact to display
 * @param {() => number} [rng] - Source of randomness in [0, 1); defaults to Math.random
 * @returns {Orientation} `{left, right}`; `rng() < 0.5` gives `{a, b}`, otherwise `{b, a}`
 */
export function randomOrientation(fact, rng = Math.random) {
  const roll = rng()
  if (fact.isSquare || roll < 0.5) {
    return { left: fact.a, right: fact.b }
  }
  return { left: fact.b, right: fact.a }
}
