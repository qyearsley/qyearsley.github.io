/**
 * knights-knaves.js
 *
 * A solver for knights-and-knaves logic puzzles. Every islander is either a
 * knight, who always tells the truth, or a knave, who always lies. Each
 * islander's statement is entered as a boolean expression in the mini
 * language `truthtable.js` already parses ("a and not b", "a eq b", and so
 * on), where each lowercase letter names another islander's "is a knight"
 * variable.
 *
 * The puzzle rule -- knights' statements are true, knaves' are false -- is
 * exactly the constraint "islander is a knight if and only if the
 * islander's statement is true." So for each islander who speaks, this
 * module builds the clause `(x eq (statement))` and ANDs every islander's
 * clause together, then hands the combined expression to `truthtable.js`'s
 * own `TruthTable`, which parses it, finds every variable, and evaluates it
 * over every combination. Rows where the combined constraint comes out true
 * are the puzzle's solutions -- zero rows means the statements contradict
 * each other (no valid assignment), and more than one means the puzzle
 * doesn't pin down every islander.
 */

import { TruthTable } from "./truthtable.js"

/**
 * @typedef {object} Islander
 * @property {string} name - A single letter identifying the islander (case
 *   insensitive). Used, lowercased, as the boolean variable for "this
 *   islander is a knight."
 * @property {string} statement - A boolean expression in truthtable.js's
 *   mini language, e.g. "not a", or "" if the islander says nothing.
 */

/**
 * The lowercase variable name truthtable.js uses for an islander.
 *
 * @param {string} name
 * @returns {string}
 */
function islanderVar(name) {
  return name.trim().toLowerCase()
}

/**
 * The islanders that actually say something.
 *
 * @param {Islander[]} islanders
 * @returns {Islander[]}
 */
function speakingIslanders(islanders) {
  return islanders.filter((isl) => isl.statement && isl.statement.trim())
}

/**
 * Builds the single combined constraint expression for a puzzle: the AND,
 * across every islander who speaks, of "islander is a knight iff (their
 * statement)."
 *
 * @param {Islander[]} islanders
 * @returns {string} An infix expression parseable by truthtable.js's
 *   `parseInfix`, or "" if no islander says anything.
 */
function buildConstraint(islanders) {
  return speakingIslanders(islanders)
    .map((isl) => `(${islanderVar(isl.name)} eq (${isl.statement.trim()}))`)
    .join(" and ")
}

/**
 * A human-readable line per speaking islander, e.g.
 * "a is a knight iff (not a and not b)" -- for display above the truth
 * table, so the reader can see where each clause of the combined constraint
 * came from.
 *
 * @param {Islander[]} islanders
 * @returns {string[]}
 */
function describeConstraints(islanders) {
  return speakingIslanders(islanders).map(
    (isl) => `${islanderVar(isl.name)} is a knight iff (${isl.statement.trim()})`,
  )
}

/**
 * Solves a knights-and-knaves puzzle.
 *
 * @param {Islander[]} islanders
 * @returns {{
 *   constraintExpr: string,
 *   constraintDescriptions: string[],
 *   table: TruthTable,
 *   solutionRows: string[][],
 *   solutionCount: number,
 * }} `table.rows[0]` is the header row (variable names, then the constraint
 *   expression); the rest are data rows of "true"/"false" strings.
 *   `solutionRows` is the subset of data rows where the constraint holds.
 * @throws {Error} If no islander says anything, or a statement fails to
 *   parse.
 */
function solvePuzzle(islanders) {
  const constraintExpr = buildConstraint(islanders)
  if (!constraintExpr) {
    throw new Error("At least one islander needs to say something.")
  }

  const table = new TruthTable(constraintExpr)
  const dataRows = table.rows.slice(1)
  const solutionRows = dataRows.filter((row) => row[row.length - 1] === "true")

  return {
    constraintExpr,
    constraintDescriptions: describeConstraints(islanders),
    table,
    solutionRows,
    solutionCount: solutionRows.length,
  }
}

/**
 * A few classic Smullyan-style puzzles, covering a unique solution, no
 * solution, and several solutions.
 *
 * Each islander's `english` field is what they actually say; `statement` is
 * that same statement written in truthtable.js's mini language, where every
 * other islander's name (lowercased) stands for "that islander is a
 * knight."
 */
const PRESETS = [
  {
    id: "both-knaves",
    title: "We are both knaves",
    summary: "A unique solution.",
    islanders: [
      { name: "A", english: "We are both knaves.", statement: "(not a) and (not b)" },
      { name: "B", english: "", statement: "" },
    ],
  },
  {
    id: "liars-paradox",
    title: "I am a knave",
    summary: "No solution -- the statement contradicts itself either way.",
    islanders: [{ name: "A", english: "I am a knave.", statement: "not a" }],
  },
  {
    id: "point-the-finger",
    title: "Each calls the other a knave",
    summary: "Two solutions -- the puzzle can't say which of them is which.",
    islanders: [
      { name: "A", english: "B is a knave.", statement: "not b" },
      { name: "B", english: "A is a knave.", statement: "not a" },
    ],
  },
  {
    id: "three-islanders",
    title: "Three islanders",
    summary: "A unique solution, with three islanders and one silent.",
    islanders: [
      { name: "A", english: "All three of us are knaves.", statement: "not a and not b and not c" },
      {
        name: "B",
        english: "Exactly one of us is a knight.",
        statement: "(a and not b and not c) or (not a and b and not c) or (not a and not b and c)",
      },
      { name: "C", english: "", statement: "" },
    ],
  },
]

export { islanderVar, buildConstraint, describeConstraints, solvePuzzle, PRESETS }
