/**
 * truthtable.js
 */

/**
 * Binary operators, which take two arguments.
 */
const BINARY_OPERATORS: { [key: string]: Function } = {
  and: (x: boolean, y: boolean) => x && y,
  eq: (x: boolean, y: boolean) => x == y,
  implies: (x: boolean, y: boolean) => !x || y,
  nand: (x: boolean, y: boolean) => !(x && y),
  or: (x: boolean, y: boolean) => x || y,
  xor: (x: boolean, y: boolean) => x != y,
}

/**
 * Unary operators, which take a single argument.
 */
const UNARY_OPERATORS: { [key: string]: Function } = {
  not: (x: boolean) => !x,
}

/**
 * Operators and their precedence.
 * Higher precedence means the operator binds more tightly,
 * so it is evaluated first.
 */
const PRECEDENCE: { [key: string]: number } = {
  and: 1,
  or: 1,
  nand: 2,
  implies: 2,
  eq: 2,
  xor: 2,
  not: 3,
}

interface VarMap {
  [key: string]: boolean
}

/**
 * A BoolExpr is an expression that can be evaluated to
 * a boolean value.
 */
abstract class BoolExpr {
  /**
   * Evaluate the expression with mapping of variables to values.
   */
  abstract eval(vars: VarMap): boolean
  /**
   * Return a list of variables used in the expression.
   */
  abstract vars(): string[]
}

class BoolExprConst extends BoolExpr {
  value: boolean

  constructor(value: boolean) {
    super()
    this.value = value
  }

  eval(): boolean {
    return this.value
  }

  vars(): string[] {
    return []
  }
}

class BoolExprVar extends BoolExpr {
  varname: string

  constructor(varname: string) {
    super()
    this.varname = varname
  }

  eval(map: VarMap): boolean {
    if (this.varname in map) {
      return map[this.varname]
    }
    throw new Error("Undefined variable: " + this.varname)
  }

  vars(): string[] {
    return [this.varname]
  }
}

class BoolExprUnary extends BoolExpr {
  op: string
  arg: BoolExpr

  constructor(op: string, arg: BoolExpr) {
    super()
    this.op = op
    this.arg = arg
  }

  eval(map: VarMap): boolean {
    const func = UNARY_OPERATORS[this.op]
    return func(this.arg.eval(map))
  }

  vars(): string[] {
    return this.arg.vars()
  }
}

class BoolExprBinary extends BoolExpr {
  op: string
  left: BoolExpr
  right: BoolExpr

  constructor(op: string, left: BoolExpr, right: BoolExpr) {
    super()
    this.op = op
    this.left = left
    this.right = right
  }

  eval(map: VarMap): boolean {
    const func = BINARY_OPERATORS[this.op]
    return func(this.left.eval(map), this.right.eval(map))
  }

  vars(): string[] {
    // Get variables from both arguments and de-dupe.
    const all = this.left.vars()
    for (let v of this.right.vars()) {
      if (!all.includes(v)) {
        all.push(v)
      }
    }
    return all
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
 * Converts an infix expression to postfix, using the shunting yard algorithm.
 */
function shuntingYard(tokens: string[]): string[] {
  const output: string[] = []
  const stack: string[] = []
  for (let token of tokens) {
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
function processToken(token: string, output: string[], stack: string[]) {
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
function parsePostfix(tokens: string[]): BoolExpr {
  const stack: BoolExpr[] = []
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
function listCombinations(n: number): boolean[][] {
  if (n == 0) {
    return [[]]
  } else {
    return prependToAll(false, listCombinations(n - 1)).concat(
      prependToAll(true, listCombinations(n - 1))
    )
  }
}

/**
 * Prepend something to each array in a 2d array.
 */
function prependToAll(x: any, arrs: any[][]) {
  return arrs.map(function (subarr) {
    return [x].concat(subarr)
  })
}

/**
 * TruthTable represents a truth table which can be displayed on a page.
 *
 * The constructor parses an expression and builds the table.
 */
class TruthTable {
  _rows: string[][]

  /**
   * Construct a truth table.
   *
   * @param {string} str - An infix expression to parse, like "(not a) or b".
   * @throws Error if the expression is invalid.
   */
  constructor(str: string) {
    const expr = parseInfix(str)
    const vars = expr.vars()
    const combinations = listCombinations(vars.length)
    this._rows = [vars.concat([str])]
    for (let c of combinations) {
      const map: VarMap = {}
      for (let i = 0; i < vars.length; i++) {
        map[vars[i]] = c[i]
      }
      const result = expr.eval(map)
      const values = c.concat([result])
      this.rows.push(values.map((b: boolean) => b.toString()))
    }
  }

  get rows(): string[][] {
    return this._rows
  }

  toDOMTable(): HTMLElement {
    const table = document.createElement("table")
    for (let row of this._rows) {
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

module.exports = {
  BoolExpr: BoolExpr,
  BoolExprConst: BoolExprConst,
  BoolExprVar: BoolExprVar,
  BoolExprUnary: BoolExprUnary,
  BoolExprBinary: BoolExprBinary,
  TruthTable: TruthTable,
  parseInfix: parseInfix,
  tokenize: tokenize,
  listCombinations: listCombinations,
}
