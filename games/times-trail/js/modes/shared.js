/**
 * The one scaffold builder, shared by every mode.
 *
 * Every mode carries a post-miss teaching array (§ 12.5) and both used to build it
 * from their own displayed orientation, which made the quality of the explanation
 * -- and how long the child had to sit through it -- a coin flip. `2 × 9` and
 * `9 × 2` are the same fact, but as scaffolds they were not:
 *
 *   | shown as | rows | sentence               | skip counts       | display time |
 *   |----------|------|------------------------|-------------------|--------------|
 *   | `2 × 9`  | 2    | "2 rows of 9 makes 18" | 9, 18             | 2300 ms      |
 *   | `9 × 2`  | 9    | "9 rows of 2 makes 18" | 2, 4, 6, ... 18   | 5450 ms      |
 *
 * The nine-row version is the worse explanation and the longer wait, and it came
 * up half the time. So the scaffold is built from `min(a, b)` rows regardless of
 * how the question was displayed: the shortest skip-count sequence that reaches
 * the product, which is also the one a child can actually count along with. The
 * `rows * SKIP_COUNT_TICK_MS + SCAFFOLD_DWELL_MS` duration `game.js` computes
 * then follows from the fact rather than from a dice roll.
 *
 * Note that this deliberately decouples the scaffold from `challenge.left` /
 * `challenge.right`: after a miss on `9 × 2` the teaching array is 2 rows of 9,
 * not 9 rows of 2. That is the commutative property, which is the thing the array
 * model exists to show, so the picture is allowed to differ from the prompt.
 *
 * Purity: no DOM, no clock, no randomness, and no argument is mutated. Imports
 * nothing at all, so it sits beside `constants.js` at the root of the dependency
 * graph and cannot introduce a cycle between mode modules.
 */

/**
 * The post-miss teaching moment, as pure data. `game.js` and `GameUI.js` own how
 * long it shows and how it is dismissed (§ 12.5); this only describes it.
 * @typedef {Object} Scaffold
 * @property {number} rows         - Rows in the array: `min(a, b)`
 * @property {number} cols         - Columns in the array: `max(a, b)`
 * @property {number} product      - `rows * cols`
 * @property {number[]} skipCounts - `[cols, 2*cols, ..., rows*cols]`; length === `rows`
 * @property {string} text         - e.g. "6 rows of 7 makes 42"
 */

/**
 * Build the skip-counting scaffold for a fact's two operands.
 *
 * Orientation-independent by design: the smaller operand becomes `rows` and the
 * larger becomes `cols`, whichever order they arrive in, so `(2, 9)` and `(9, 2)`
 * produce the identical scaffold. Non-integer or out-of-range input is clamped to
 * at least 1 rather than rejected -- a mode handing this a bad operand is a bug,
 * but a scaffold that throws would replace a teaching moment with a blank screen.
 * @param {number} a - One operand, in either position
 * @param {number} b - The other operand
 * @returns {Scaffold} A fresh scaffold; `skipCounts` has `rows` entries ending at the product
 */
export function buildScaffold(a, b) {
  const first = _dimension(a)
  const second = _dimension(b)
  const rows = Math.min(first, second)
  const cols = Math.max(first, second)
  const product = rows * cols
  return {
    rows,
    cols,
    product,
    skipCounts: Array.from({ length: rows }, (_unused, index) => (index + 1) * cols),
    text: `${rows} rows of ${cols} makes ${product}`,
  }
}

/**
 * Coerce one operand into a usable array dimension: a positive integer.
 * @private
 * @param {unknown} value - Candidate operand
 * @returns {number} An integer >= 1
 */
function _dimension(value) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}
