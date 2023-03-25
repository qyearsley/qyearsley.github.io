/**
 * truthtable.js
 */

/**
 * A list of operators and the functions that they correspond to.
 */
const BINARY_OPERATORS = {
  and: (x: boolean, y: boolean) => x && y,
  eq: (x: boolean, y: boolean) => x == y,
  implies: (x: boolean, y: boolean) => !x || y,
  nand: (x: boolean, y: boolean) => !(x && y),
  or: (x: boolean, y: boolean) => x || y,
  xor: (x: boolean, y: boolean) => x != y,
}

const UNARY_OPERATORS = {
  not: (x: boolean) => !x,
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
 * TruthTable represents a truth table.
 */
class TruthTable {
  constructor(expr: string) {
    const parsed: BoolExpr = parseInfix(expr)
    const vars: Object = parsed.getVars()
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

  /** Returns rows, useful for testing. */
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


type BoolExprArg = string | boolean | BoolExpr
/**
 * A BoolExpr represents a Boolean expression.
 */

class BoolExpr {
  op: string
  arg1: BoolExprArg
  arg2: BoolExprArg | undefined

  constructor(op: string, arg1: BoolExprArg, arg2?: BoolExprArg) {
    this.op = op
    this.arg1 = arg1
    this.arg2 = arg2
  }

  /**
   * Return the value of a BoolExpr.
   */
  eval(varMap: Object) {
    if (this.op === "const") {
      return this.arg1
    } else if (this.op === "var") {
      if (this.arg1 in varMap) {
        return varMap[this.arg1]
      }
      throw new Error("Undefined variable: " + this.arg1)
    }
    if (this.op in UNARY_OPERATORS) {
      const func = UNARY_OPERATORS[this.op]
      return func(this.arg1.eval(varMap))
    }
    if (this.op in BINARY_OPERATORS) {
      const func = BINARY_OPERATORS[this.op]
      if (this.arg2 === undefined) {
        throw new Error("Missing second argument for " + this.op)
      }
      return func(this.arg1.eval(varMap), this.arg2.eval(varMap))
    }
    throw new Error("Invalid operator " + this.op)
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
function parseInfix(str: string): BoolExpr {
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
function processToken(token: string, output: string[], stack: string[]) {
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
      const item: string = stack.pop()
      output.push(item);
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
 */
function parsePostfix(tokens: string[]) {
  const stack: BoolExpr[] = [];
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
 */
function tokenize(str: string): string[] {
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
function combinations(n: number): Array<Array<boolean>> {
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
function prependToAll(x: boolean, arrs: Array<Array<boolean>>) {
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
