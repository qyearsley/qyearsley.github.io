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
const BINARY_OPERATORS = {
  and: (x, y) => x && y,
  eq: (x, y) => x == y,
  implies: (x, y) => !x || y,
  nand: (x, y) => !(x && y),
  or: (x, y) => x || y,
  xor: (x, y) => x != y,
}

const UNARY_OPERATORS = {
  not: x => !x,
}

/**
 * A list of operators and their precedence.
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
    const parsed = parseInfix(expr)
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
  toDOMTable() {
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
   * operator. If type is "const", then arg1 is the value of the
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
      }
      throw new Error("Undefined variable: " + this.arg1)
    }
    if (this.type in UNARY_OPERATORS) {
      const func = UNARY_OPERATORS[this.type]
      return func(this.arg1.eval(varMap))
    }
    if (this.type in BINARY_OPERATORS) {
      const func = BINARY_OPERATORS[this.type]
      if (this.arg2 === undefined) {
        throw new Error("Missing second argument for " + this.type)
      }
      return func(this.arg1.eval(varMap), this.arg2.eval(varMap))
    }
    throw new Error("Invalid operator " + this.type)
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
    // Dedupe the list of variables from the two arguments.
    const all = this.arg1.getVars().concat(this.arg2.getVars())
    return [...new Set(all)].sort()
  }
}

/**
 * Parse a boolean expression expressed in infix notation.
 *
 * This function uses the shunting yard algorithm. The expression can have
 * parantheses, binary or unary operators, and variables or constants.
 *
 * @param string str - The expression to parse.
 * @return BoolExpr - The parsed expression.
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
 * Converts an infix expression to postfix,
 * using the shunting yard algorithm.
 *
 * @param array tokens - An array of tokens.
 * @return array - An array of tokens in postfix notation.
 * @see https://en.wikipedia.org/wiki/Shunting_yard_algorithm
 */
function shuntingYard(tokens) {
  const output = [];
  const stack = [];
  for (const token of tokens) {
    processToken(token, output, stack);
  }
  while (stack.length > 0) {
    const operator = stack.pop();
    if (operator === "(" || operator === ")") {
      throw new Error("Mismatched parentheses");
    }
    output.push(operator);
  }
  return output
}

/**
 * Process a token in the shunting yard algorithm.
 *
 * @param string token - The token to process.
 * @param array output - The output array.
 * @param array stack - The operator stack.
 */
function processToken(token, output, stack) {
  if (token in UNARY_OPERATORS) {
    stack.push(token);
    return
  }
  if (token in BINARY_OPERATORS) {
    while (
      stack.length > 0 &&
      stack[stack.length - 1] !== "(" &&
      PRECEDENCE[token] <= PRECEDENCE[stack[stack.length - 1]]
    ) {
      output.push(stack.pop());
    }
    stack.push(token);
    return
  }
  if (token === "(") {
    stack.push(token)
    return
  }
  if (token === ")") {
    while (stack.length > 0 && stack[stack.length - 1] !== "(") {
      output.push(stack.pop())
    }
    if (stack.length === 0) {
      throw new Error("Mismatched parentheses");
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
 *
 * @param array tokens - An array of tokens in postfix notation.
 * @return BoolExpr - The parsed expression.
 * @see https://en.wikipedia.org/wiki/Reverse_Polish_notation
 */
function parsePostfix(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (token in UNARY_OPERATORS) {
      const operand = stack.pop();
      stack.push(new BoolExpr(token, operand))
    } else if (token in BINARY_OPERATORS) {
      const operand2 = stack.pop()
      const operand1 = stack.pop()
      stack.push(new BoolExpr(token, operand1, operand2))
    } else if (token === "true" || token === "false") {
      stack.push(new BoolExpr("const", token === "true"))
    } else {
      stack.push(new BoolExpr("var", token))
    }
  }
  if (stack.length !== 1) {
    throw new Error("Invalid expression");
  }
  return stack[0];
}

/**
 * Tokenize a string into an array of tokens.
 *
 * Tokens are either operators, parentheses, or variable names.
 * Operators are either unary or binary and separated by operands
 * by spaces.
 *
 * @param string str - The string to tokenize.
 * @return array - An array of tokens.
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
  if (token !== "") {
    tokens.push(token)
  }
  return tokens
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
  parseInfix: parseInfix,
  tokenize: tokenize,
  combinations: combinations,
}
