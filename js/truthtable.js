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
  and: (x, y) => x && y,
  eq: (x, y) => x == y,
  implies: (x, y) => !x || y,
  nand: (x, y) => !(x && y),
  or: (x, y) => x || y,
  xor: (x, y) => x != y,
  not: x => !x,
}

/**
 * A BoolExpr represents a Boolean expression.
 */
class BoolExpr {
  /**
   * Construct a new BoolExpr.
   *
   * @param string type - The type of the BoolExpr. Either "const", "var" or a
   * string in OPERATIONS. If type is "const", then arg1 is the value of the
   * atom; if it's "var" then arg1 is the name of the variable.
   * @param mixed arg1 - The first argument for the expression; could be
   *     a BoolExpr, a variable name, or a constant value.
   * @param mixed arg2 - Second argument for the expression; not specified
   *     for unary operators or constants or variables.
   */
  constructor(type, arg1, arg2) {
    this.type = type
    this.arg1 = arg1
    this.arg2 = arg2
  }

  /**
   * Return the value of a BoolExpr.
   */
  eval(vars) {
    if (this.type === "const") {
      return this.arg1
    } else if (this.type === "var") {
      if (this.arg1 in vars) {
        return vars[this.arg1]
      } else {
        throw new Error("Undefined variable: " + this.arg1)
      }
    } else {
      const func = OPERATIONS[this.type]
      if (func.length === 1) {
        return func(this.arg1.eval(vars))
      }
      if (func.length === 2 && this.arg2 === undefined) {
        throw new Error("Missing second argument for " + this.type)
      }
      return func(this.arg1.eval(vars), this.arg2.eval(vars))
    }
  }

  /*
   * Extract a list of variable names.
   */
  getVars() {
    if (this.type === "var") {
      if (typeof this.arg1 != "string") {
        throw new Error("Variable name is not a string");
      }
      return [this.arg1]
    }
    if (this.type === "const") {
      return []
    }
    if (this.arg2 === undefined) {
      return this.arg1.getVars()
    }
    return dedupe(this.arg1.getVars().concat(this.arg2.getVars()))
  }
}

/**
 * Parses a boolean expression expressed in prefix notation.
 *
 * Example input:
 *   "and or true false true)"
 */
function parsePrefix(str) {
  let tokens = str.split(/\s+/)
  return parsePrefixHelper(tokens)
}

function parsePrefixHelper(tokens) {
  if (tokens.length === 0) {
    throw new Error("Unexpected end of input")
  }
  let token = tokens.shift()
  if (token === "true") {
    return new BoolExpr("const", true)
  } else if (token === "false") {
    return new BoolExpr("const", false)
  } else if (token in OPERATIONS) {
    let arg1 = parsePrefixHelper(tokens)
    let arg2 = parsePrefixHelper(tokens)
    return new BoolExpr(token, arg1, arg2)
  } else if (token == "not") {
    let arg1 = parsePrefixHelper(tokens)
    return new BoolExpr(token, arg1)
  }
  return new BoolExpr("var", token)
}

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
      prependToAll(true, combinations(n - 1))
    )
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
 * Class TruthTable
 *
 * Possile Functions to add:
 * to2DArray: convert to a 2d array
 * add: add a BoolExpr to the table
 * parse: parse a string to add a BoolExpr to the table
 * makeDOMTable: make a DOM table element from the table
 * makeDOMTableFromStr: parse a string and make a DOM table element from the table
 */

module.exports = {
  BoolExpr: BoolExpr,
  combinations: combinations,
  dedupe: dedupe,
  makeDOMTable: makeDOMTable,
  prependToAll: prependToAll,
  parsePrefix: parsePrefix,
}
