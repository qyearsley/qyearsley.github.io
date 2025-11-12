/**
 * truthtable.js
 *
 * A truth table generator for boolean logic expressions.
 * Parses infix expressions (e.g., "a and b") and generates truth tables
 * showing all possible input combinations and their results.
 */

/**
 * Binary operators that take two boolean arguments.
 * Each operator is implemented as a function returning a boolean.
 */
const BINARY_OPERATORS = {
  and: (x, y) => x && y,
  eq: (x, y) => x === y,
  implies: (x, y) => !x || y,
  nand: (x, y) => !(x && y),
  or: (x, y) => x || y,
  xor: (x, y) => x !== y,
}

/**
 * Unary operators that take a single boolean argument.
 */
const UNARY_OPERATORS = {
  not: (x) => !x,
}

/**
 * Operator precedence levels.
 * Higher precedence means the operator binds more tightly and is evaluated first.
 * Used during parsing to determine evaluation order.
 */
const PRECEDENCE = {
  and: 1,
  or: 1,
  nand: 2,
  implies: 2,
  eq: 2,
  xor: 2,
  not: 3,
}
/**
 * Base class for boolean expressions.
 * Subclasses represent constants, variables, and operations.
 */
class BoolExpr {}
class BoolExprConst extends BoolExpr {
  constructor(value) {
    super()
    this.value = value
  }
  eval() {
    return this.value
  }
  vars() {
    return []
  }
}
class BoolExprVar extends BoolExpr {
  constructor(varname) {
    super()
    this.varname = varname
  }
  eval(map) {
    if (this.varname in map) {
      return map[this.varname]
    }
    throw new Error("Undefined variable: " + this.varname)
  }
  vars() {
    return [this.varname]
  }
}
class BoolExprUnary extends BoolExpr {
  constructor(op, arg) {
    super()
    this.op = op
    this.arg = arg
  }
  eval(map) {
    const func = UNARY_OPERATORS[this.op]
    return func(this.arg.eval(map))
  }
  vars() {
    return this.arg.vars()
  }
}
class BoolExprBinary extends BoolExpr {
  constructor(op, left, right) {
    super()
    this.op = op
    this.left = left
    this.right = right
  }
  eval(map) {
    const func = BINARY_OPERATORS[this.op]
    return func(this.left.eval(map), this.right.eval(map))
  }
  vars() {
    // Get variables from both arguments and de-dupe.
    const leftVars = this.left.vars()
    const rightVars = this.right.vars()
    return [...new Set([...leftVars, ...rightVars])]
  }
}
/**
 * Parses a boolean expression in infix notation.
 *
 * Uses the shunting yard algorithm to convert infix to postfix, then builds
 * an expression tree. Supports parentheses, operators, variables, and constants.
 *
 * @param {string} str - The expression to parse (e.g., "a and not b").
 * @returns {BoolExpr} The parsed expression tree.
 * @throws {Error} If the expression is invalid or has mismatched parentheses.
 */
function parseInfix(str) {
  const tokens = tokenize(str)
  if (tokens.length === 0) {
    throw new Error("Empty expression")
  }
  const postfix = shuntingYard(tokens)
  return parsePostfix(postfix)
}
/**
 * Converts an infix expression to postfix using the shunting yard algorithm.
 * This simplifies evaluation by eliminating the need to handle precedence later.
 *
 * @param {string[]} tokens - Array of tokens from the tokenizer.
 * @returns {string[]} Tokens in postfix (Reverse Polish) notation.
 * @throws {Error} If parentheses are mismatched.
 */
function shuntingYard(tokens) {
  const output = []
  const stack = []

  for (const token of tokens) {
    processToken(token, output, stack)
  }

  while (stack.length > 0) {
    const operator = stack.pop()
    if (operator === "(" || operator === ")") {
      throw new Error("Mismatched parentheses")
    }
    if (operator !== undefined) {
      output.push(operator)
    }
  }

  return output
}
/**
 * Process one token in the shunting yard algorithm.
 */
function processToken(token, output, stack) {
  if (token in UNARY_OPERATORS) {
    stack.push(token)
    return
  }

  if (token in BINARY_OPERATORS) {
    while (
      stack.length > 0 &&
      stack[stack.length - 1] !== "(" &&
      PRECEDENCE[token] <= PRECEDENCE[stack[stack.length - 1]]
    ) {
      const op = stack.pop()
      if (typeof op === "string") {
        output.push(op)
      }
    }
    stack.push(token)
    return
  }

  if (token === "(") {
    stack.push(token)
    return
  }

  if (token === ")") {
    while (stack.length > 0 && stack[stack.length - 1] !== "(") {
      const item = stack.pop()
      if (item !== undefined) {
        output.push(item)
      }
    }
    if (stack.length === 0) {
      throw new Error("Mismatched parentheses")
    }
    stack.pop()
    return
  }

  // If we get here, it's a constant or a variable.
  output.push(token)
}
/**
 * Parse a postfix expression to a BoolExpr.
 *
 * For example, the postfix expression ["true", "false", "or", "not"]
 * is interpreted as "not (true or false)".
 */
function parsePostfix(tokens) {
  const stack = []

  for (const token of tokens) {
    if (token in UNARY_OPERATORS) {
      const operand = stack.pop()
      if (operand !== undefined) {
        stack.push(new BoolExprUnary(token, operand))
      }
    } else if (token in BINARY_OPERATORS) {
      const operand2 = stack.pop()
      const operand1 = stack.pop()
      if (operand1 !== undefined && operand2 !== undefined) {
        stack.push(new BoolExprBinary(token, operand1, operand2))
      }
    } else if (token === "true" || token === "false") {
      stack.push(new BoolExprConst(token === "true"))
    } else {
      stack.push(new BoolExprVar(token))
    }
  }

  if (stack.length !== 1) {
    throw new Error("Invalid expression")
  }

  return stack[0]
}
/**
 * Tokenizes a string into an array of tokens.
 *
 * Splits on spaces and parentheses. Tokens can be operators, parentheses,
 * variables, or constants (true/false).
 *
 * @param {string} str - The expression string to tokenize.
 * @returns {string[]} Array of tokens.
 */
function tokenize(str) {
  const tokens = []
  let token = ""

  for (const c of str) {
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

  if (token !== "") {
    tokens.push(token)
  }

  return tokens
}
/**
 * Generates all possible boolean combinations of length n.
 *
 * For n=2, returns: [[false, false], [true, false], [false, true], [true, true]]
 * Used to generate all rows of the truth table.
 *
 * @param {number} n - Number of boolean variables.
 * @returns {boolean[][]} Array of all possible boolean combinations.
 */
function listCombinations(n) {
  if (n === 0) {
    return [[]]
  } else {
    return prependToAll(false, listCombinations(n - 1)).concat(
      prependToAll(true, listCombinations(n - 1)),
    )
  }
}

/**
 * Prepend something to each array in a 2d array.
 */
function prependToAll(x, arrs) {
  return arrs.map((subarr) => [x, ...subarr])
}
/**
 * TruthTable represents a truth table which can be displayed on a page.
 *
 * The constructor parses an expression and builds the table.
 */
class TruthTable {
  /**
   * Construct a truth table.
   *
   * @param {string} str - An infix expression to parse, like "(not a) or b".
   * @throws Error if the expression is invalid.
   */
  constructor(str) {
    const expr = parseInfix(str)
    const vars = expr.vars()
    const combinations = listCombinations(vars.length)

    this._rows = [vars.concat([str])]

    for (const combination of combinations) {
      const map = {}
      for (let i = 0; i < vars.length; i++) {
        map[vars[i]] = combination[i]
      }
      const result = expr.eval(map)
      const values = combination.concat([result])
      this.rows.push(values.map((b) => b.toString()))
    }
  }

  get rows() {
    return this._rows
  }

  toDOMTable() {
    const table = document.createElement("table")

    for (const row of this._rows) {
      const tr = document.createElement("tr")
      for (const col of row) {
        const td = document.createElement("td")
        td.appendChild(document.createTextNode(col))
        tr.appendChild(td)
      }
      table.appendChild(tr)
    }

    return table
  }
}

export {
  BoolExpr,
  BoolExprConst,
  BoolExprVar,
  BoolExprUnary,
  BoolExprBinary,
  TruthTable,
  parseInfix,
  tokenize,
  listCombinations,
};
