/**
 * truthtable.js
 *
 * A collection of functions for generating truth tables
 * for expressions.
 *
 * Originally written around 2008.
 */

"use strict"

/**
 * A list of operators and the functions that they correspond to.
 */
const OPERATIONS = {
  eq: (x, y) => x == y,
  "->": (x, y) => !x || y,
  "<-": (x, y) => x || !y,
  and: (x, y) => x && y,
  or: (x, y) => x || y,
}

/**
 * A BoolExpr represents a Boolean expression.
 */
class BoolExpr {
  /**
   * Construct a new BoolExpr.
   *
   * @param string type - The type of the BoolExpr. Either "atom" or a string
   *   in OPERATIONS. If type is "atom", then arg1 is the value of the atom.
   * @param mixed arg1 - If type is "atom", then arg1 is the value of the atom.
   * @param mixed arg2 - If type is "atom", then arg2 is ignored. Otherwise,
   *   this is the second argument for the boolean expression.
   */
  constructor(type, arg1, arg2) {
    this.type = type
    this.arg1 = this.arg1
    this.arg2 = this.arg2
  }

  /**
   * Return the value of a BoolExpr.
   */
  eval() {
    if (this.type === "atom") {
      return this.arg1
    } else {
      let arg1 = this.arg1.eval()
      let arg2 = this.arg2.eval()
      let func = OPERATIONS[this.type]
      return func(arg1, arg2)
    }
  }

  /*
   * Possible functions to include:
   * getVars: get atoms that are variables
   * evalWith: evaluate with values for variables
   */
}

/**
 * Parses a string to return a BoolExpr
 */
/*
function parse(str) {
  str = str.strip(/\s+/g)
  for (var depth = 0; depth <= result.maxDepth(); depth++) {
    for (var op in OPERATIONS_BY_SYMBOL) {
      if (result.containsInDepth(op, depth)) {
        var args = result.splitAtFirstInDepth(op, depth)
        if (OPERATIONS_BY_SYMBOL[op].arity == 1) {
          args = args.slice(1)
        }
        args = args.map(function (arg) {
          return arg.toBoolExpr()
        })
        return new BoolExpr(op, args, OPERATIONS_BY_SYMBOL[op])
      }
    }
  }
  return new BoolExpr("atom", result.strip(/[()]/g))
}
*/

/*
 * Possible functions to include:
 * depthAt: get depth of nested parentheses
 * maxDepth: get max depth of nested parentheses
 * indexOfFirstInDepth: get index of first occurrence of a substring at a depth
 * splitAtFirstInDepth: split a string at the first occurrence of a substring at a depth
 * containsInDepth: test whether a string contains a substring at a depth
 * strip: remove all occurrences of a substring or pattern
 */

/**
 * Remove duplicate items from an array and returns a sorted array.
 */
function dedupe(arr) {
  return [...new Set(arr)].sort()
}

/**
 * Return an array of all combinations of false and true of length n.
 */
function combinations(n) {
  if (n == 0) {
    return [[]]
  } else {
    return prependToAll(false, combinations(n - 1)).concat(
      prependToAll(true, combinations(n - 1)))
  }
}

/**
 * Prepend something to each array in a 2d array.
 */
function prependToAll(x, arrs) {
  return arrs.map(function (subarr) {
    return [x].concat(subarr)
  })
}

/**
 * Make a DOM table element from a 2d array.
 */
function makeDOMTable(rows) {
  var table = document.createElement("table")
  for (let row of rows) {
    var tr = document.createElement("tr")
    for (let col of row) {
      var td = document.createElement("td")
      td.appendChild(document.createTextNode(col))
      tr.appendChild(td)
    }
    table.appendChild(tr)
  }
  return table
}

/**
 * TruthTable object constructor. there are four parts:
 *   a list of unique atoms
 *   a list of BoolExpr objects
 *   a list of combinations of truth values of each atom
 *   a list of evaluations of each prop for each combination
 *
 *  Functions to add:
 *  to2DArray: convert to a 2d array
 *  add: add a BoolExpr to the table
 *  parse: parse a string to add a BoolExpr to the table
 *  makeDOMTable: make a DOM table element from the table
 *  makeDOMTableFromStr: parse a string and make a DOM table element from the table
 */
class Truthtable {
  constructor(atoms, exprs, combs, evals) {
    this.atoms = atoms || []
    this.exprs = exprs || []
    this.combs = combs || []
    this.evals = evals || []
  }
}

module.exports = {
  BoolExpr: BoolExpr,
  combinations: combinations,
  dedupe: dedupe,
  makeDOMTable: makeDOMTable,
  prependToAll: prependToAll,
}
