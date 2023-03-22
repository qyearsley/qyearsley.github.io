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
 * Generate a truth table for a boolean expression.
 *
 * @param string expr - The expression to generate a truth table for.
 *    For example: "and a b" or "or (not a) b".
 *
 * @return array - A 2d array representing the truth table.
 *    For example:
 *    [
 *      ["a", "b", "and a b"],
 *      [true, true, true],
 *      [true, false, false],
 *      [false, true, false],
 *      [false, false, false],
 *    ]
 *    The first row is the header row.
 */
class TruthTable {
  constructor(expr) {
    const parsed = parsePrefix(expr)
    const vars = parsed.getVars()
    const combns = combinations(vars.length)
    this.rows = [vars.concat([expr])]
    for (let c of combns) {
      const varMap = {}
      for (let i = 0; i < vars.length; i++) {
        varMap[vars[i]] = c[i]
      }
      const result = parsed.eval(varMap)
      this.rows.push(c.concat([result]))
    }
  }

  getRows() {
    return this.rows
  }

  /** Make a DOM table element from a 2d array. */
  toDOMTable(rows) {
    const table = document.createElement("table")
    for (let row of this.rows) {
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
  eval(varMap) {
    if (this.type === "const") {
      return this.arg1
    } else if (this.type === "var") {
      if (this.arg1 in varMap) {
        return varMap[this.arg1]
      } else {
        throw new Error("Undefined variable: " + this.arg1)
      }
    } else {
      const func = OPERATIONS[this.type]
      if (func.length === 1) {
        return func(this.arg1.eval(varMap))
      }
      if (func.length === 2 && this.arg2 === undefined) {
        throw new Error("Missing second argument for " + this.type)
      }
      return func(this.arg1.eval(varMap), this.arg2.eval(varMap))
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
 *   "and or true false true"
 */
function parsePrefix(str) {
  const tokens = str.split(/\s+/)
  return parsePrefixHelper(tokens)
}

function parsePrefixHelper(tokens) {
  if (tokens.length === 0) {
    throw new Error("Unexpected end of input")
  }
  const token = tokens.shift()
  if (token === "true") {
    return new BoolExpr("const", true)
  } else if (token === "false") {
    return new BoolExpr("const", false)
  } else if (token in OPERATIONS) {
    if (OPERATIONS[token].length === 1) {
      let arg1 = parsePrefixHelper(tokens)
      return new BoolExpr(token, arg1)
    }
    let arg1 = parsePrefixHelper(tokens)
    let arg2 = parsePrefixHelper(tokens)
    return new BoolExpr(token, arg1, arg2)
  }
  return new BoolExpr("var", token)
}

/**
 * Parse a boolean expression expressed in infix notation.
 *
 * The expression can have parentheses.
 * Example input:
 *  "a or not (b and c)"
 * If parentheses are not balanced, an error is thrown.
 * If parentheses are not used, earlier operators have higher precedence.
 */
function parseInfix(str) {
  const tokens = tokenize(str)
  if (tokens.length === 0) {
    throw new Error("Empty expression")
  }
  const [expr, remaining] = parseInfixHelper(tokens)
  if (remaining.length > 0) {
    throw new Error("Unexpected tokens: " + remaining.join(" "))
  }
  return expr
}

/**
 * Parse a boolean expression expressed in infix notation.
 * Returns a tuple of the parsed expression and the remaining tokens.
 */
function parseInfixHelper(tokens) {
  if (tokens.length === 0) {
    throw new Error("Unexpected end of input")
  }
  const token = tokens.shift()
  // Parenthetical group
  if (token === "(") {
    const [expr, remaining] = parseInfixHelper(tokens)
    if (remaining[0] !== ")") {
      throw new Error("Unbalanced parentheses")
    }
    return [expr, remaining.slice(1)]
  }
  // Single token
  if (tokens.length === 0) {
    if (token === "true") {
      return [new BoolExpr("const", true), tokens]
    }
    if (token === "false") {
      return [new BoolExpr("const", false), tokens]
    }
    if (token in OPERATIONS) {
      throw new Error("Unexpected operator " + token)
    }
    return [new BoolExpr("var", token), tokens]
  }
  const nextToken = tokens.shift()
  // Binary operators
  if (nextToken in OPERATIONS) {
    const [expr, remaining] = parseInfixHelper(tokens)
    return [
      new BoolExpr(nextToken, new BoolExpr("var", token), expr),
      remaining
    ]
  }
  // Unary operator
  if (token in OPERATIONS && OPERATIONS[token].length === 1) {
    const [expr, remaining] = parseInfixHelper(tokens)
    return [new BoolExpr(token, expr), remaining]
  }
}


/**
 * Tokenize a string into an array of tokens.
 *
 * Tokens are either operators, parentheses, or variable names.
 */
function tokenize(str) {
  const tokens = []
  let token = ""
  for (let c of str) {
    if (c === " ") {
      if (token !== "") {
        tokens.push(token)
        token = ""
      }
    } else if (c === "(" || c === ")") {
      if (token !== "") {
        tokens.push(token)
        token = ""
      }
      tokens.push(c)
    } else {
      token += c
    }
  }
  return tokens
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


module.exports = {
  BoolExpr: BoolExpr,
  TruthTable: TruthTable,
  parsePrefix: parsePrefix,
  parseInfix: parseInfix,
  tokenize: tokenize,
  combinations: combinations,
  prependToAll: prependToAll,

}
