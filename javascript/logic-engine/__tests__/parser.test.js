/**
 * Parser Tests
 *
 * Tests for tokenizer, parser, and utility functions
 */

import { tokenize, Parser, areEqual, isNegation, isSimple } from "../parser.js"

describe("Tokenizer", () => {
  test("tokenizes simple atoms", () => {
    const tokens = tokenize("P")
    expect(tokens).toEqual([
      { type: "ATOM", value: "P" },
      { type: "EOF", value: "" },
    ])
  })

  test("tokenizes NOT operator", () => {
    expect(tokenize("~P")[0]).toEqual({ type: "NOT", value: "~" })
    expect(tokenize("!P")[0]).toEqual({ type: "NOT", value: "~" })
    expect(tokenize("not P")[0]).toEqual({ type: "NOT", value: "~" })
  })

  test("tokenizes AND operator", () => {
    expect(tokenize("P & Q")[1]).toEqual({ type: "AND", value: "&" })
    expect(tokenize("P ^ Q")[1]).toEqual({ type: "AND", value: "&" })
    expect(tokenize("P and Q")[1]).toEqual({ type: "AND", value: "&" })
  })

  test("tokenizes OR operator", () => {
    expect(tokenize("P | Q")[1]).toEqual({ type: "OR", value: "|" })
    expect(tokenize("P or Q")[1]).toEqual({ type: "OR", value: "|" })
  })

  test("tokenizes IMPLIES operator", () => {
    expect(tokenize("P -> Q")[1]).toEqual({ type: "IMPLIES", value: "->" })
    expect(tokenize("P implies Q")[1]).toEqual({ type: "IMPLIES", value: "->" })
    expect(tokenize("P then Q")[1]).toEqual({ type: "IMPLIES", value: "->" })
  })

  test("tokenizes IFF operator", () => {
    expect(tokenize("P <-> Q")[1]).toEqual({ type: "IFF", value: "<->" })
    expect(tokenize("P iff Q")[1]).toEqual({ type: "IFF", value: "<->" })
  })

  test("tokenizes XOR operator", () => {
    expect(tokenize("P xor Q")[1]).toEqual({ type: "XOR", value: "xor" })
  })

  test("tokenizes NAND operator", () => {
    expect(tokenize("P nand Q")[1]).toEqual({ type: "NAND", value: "nand" })
  })

  test("tokenizes NOR operator", () => {
    expect(tokenize("P nor Q")[1]).toEqual({ type: "NOR", value: "nor" })
  })

  test("tokenizes XNOR operator", () => {
    expect(tokenize("P xnor Q")[1]).toEqual({ type: "XNOR", value: "xnor" })
  })

  test("tokenizes parentheses", () => {
    const tokens = tokenize("(P)")
    expect(tokens[0]).toEqual({ type: "LPAREN", value: "(" })
    expect(tokens[2]).toEqual({ type: "RPAREN", value: ")" })
  })

  test("distinguishes keywords from atom names", () => {
    // "and" as operator
    expect(tokenize("P and Q")[1]).toEqual({ type: "AND", value: "&" })
    // "android" as atom
    expect(tokenize("android")[0]).toEqual({ type: "ATOM", value: "android" })
    // "notice" as atom (not "not")
    expect(tokenize("notice")[0]).toEqual({ type: "ATOM", value: "notice" })
  })

  test("handles multi-word expressions", () => {
    const tokens = tokenize("P -> Q and R")
    expect(tokens).toHaveLength(6) // P, ->, Q, &, R, EOF
  })
})

describe("Parser", () => {
  test("parses simple atoms", () => {
    const ast = new Parser(tokenize("P")).parse()
    expect(ast).toEqual({ type: "ATOM", value: "P" })
  })

  test("parses NOT expressions", () => {
    const ast = new Parser(tokenize("~P")).parse()
    expect(ast).toEqual({
      type: "NOT",
      operand: { type: "ATOM", value: "P" },
    })
  })

  test("parses double negation", () => {
    const ast = new Parser(tokenize("~~P")).parse()
    expect(ast).toEqual({
      type: "NOT",
      operand: {
        type: "NOT",
        operand: { type: "ATOM", value: "P" },
      },
    })
  })

  test("parses AND expressions", () => {
    const ast = new Parser(tokenize("P & Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "&",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("parses OR expressions", () => {
    const ast = new Parser(tokenize("P | Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "|",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("parses IMPLIES expressions", () => {
    const ast = new Parser(tokenize("P -> Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "->",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("parses IFF expressions", () => {
    const ast = new Parser(tokenize("P <-> Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "<->",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("parses XOR expressions", () => {
    const ast = new Parser(tokenize("P xor Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "xor",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("parses NAND expressions", () => {
    const ast = new Parser(tokenize("P nand Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "nand",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("parses NOR expressions", () => {
    const ast = new Parser(tokenize("P nor Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "nor",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("parses XNOR expressions", () => {
    const ast = new Parser(tokenize("P xnor Q")).parse()
    expect(ast).toEqual({
      type: "BINARY",
      operator: "xnor",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    })
  })

  test("respects operator precedence", () => {
    // P & Q | R should parse as (P & Q) | R
    const ast = new Parser(tokenize("P & Q | R")).parse()
    expect(ast.type).toBe("BINARY")
    expect(ast.operator).toBe("|")
    expect(ast.left.type).toBe("BINARY")
    expect(ast.left.operator).toBe("&")
  })

  test("handles parentheses", () => {
    // P & (Q | R) should parse with OR as child of AND
    const ast = new Parser(tokenize("P & (Q | R)")).parse()
    expect(ast.type).toBe("BINARY")
    expect(ast.operator).toBe("&")
    expect(ast.right.type).toBe("BINARY")
    expect(ast.right.operator).toBe("|")
  })

  test("right-associative implication", () => {
    // P -> Q -> R should parse as P -> (Q -> R)
    const ast = new Parser(tokenize("P -> Q -> R")).parse()
    expect(ast.type).toBe("BINARY")
    expect(ast.operator).toBe("->")
    expect(ast.right.type).toBe("BINARY")
    expect(ast.right.operator).toBe("->")
  })

  test("handles complex nested expressions", () => {
    const ast = new Parser(tokenize("~(P & Q) | R")).parse()
    expect(ast.type).toBe("BINARY")
    expect(ast.operator).toBe("|")
    expect(ast.left.type).toBe("NOT")
    expect(ast.left.operand.type).toBe("BINARY")
  })

  test("handles empty input gracefully", () => {
    // Empty input creates just an EOF token, parser returns ERROR atom
    const tokens = tokenize("")
    expect(tokens).toHaveLength(1) // Just EOF
    expect(tokens[0].type).toBe("EOF")
  })

  test("handles unbalanced parentheses", () => {
    const ast = new Parser(tokenize("(P & Q")).parse()
    // Parser is lenient - it will parse what it can
    expect(ast.type).toBe("BINARY")
  })

  test("handles multiple spaces", () => {
    const tokens = tokenize("P    ->     Q")
    expect(tokens).toHaveLength(4) // P, ->, Q, EOF
  })

  test("preserves atom case sensitivity", () => {
    const tokens = tokenize("MyVar")
    expect(tokens[0].value).toBe("MyVar")
  })
})

describe("areEqual", () => {
  test("compares simple atoms", () => {
    const p1 = { type: "ATOM", value: "P" }
    const p2 = { type: "ATOM", value: "P" }
    const q = { type: "ATOM", value: "Q" }
    expect(areEqual(p1, p2)).toBe(true)
    expect(areEqual(p1, q)).toBe(false)
  })

  test("compares NOT expressions", () => {
    const notP1 = { type: "NOT", operand: { type: "ATOM", value: "P" } }
    const notP2 = { type: "NOT", operand: { type: "ATOM", value: "P" } }
    const notQ = { type: "NOT", operand: { type: "ATOM", value: "Q" } }
    expect(areEqual(notP1, notP2)).toBe(true)
    expect(areEqual(notP1, notQ)).toBe(false)
  })

  test("compares BINARY expressions", () => {
    const pAndQ1 = {
      type: "BINARY",
      operator: "&",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    const pAndQ2 = {
      type: "BINARY",
      operator: "&",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    const pOrQ = {
      type: "BINARY",
      operator: "|",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    expect(areEqual(pAndQ1, pAndQ2)).toBe(true)
    expect(areEqual(pAndQ1, pOrQ)).toBe(false)
  })
})

describe("isNegation", () => {
  test("detects negation relationship", () => {
    const P = { type: "ATOM", value: "P" }
    const notP = { type: "NOT", operand: { type: "ATOM", value: "P" } }
    expect(isNegation(P, notP)).toBe(true)
    expect(isNegation(notP, P)).toBe(true)
  })

  test("rejects non-negation pairs", () => {
    const P = { type: "ATOM", value: "P" }
    const Q = { type: "ATOM", value: "Q" }
    expect(isNegation(P, Q)).toBe(false)
  })
})

describe("isSimple", () => {
  test("identifies simple atoms", () => {
    const P = { type: "ATOM", value: "P" }
    expect(isSimple(P)).toBe(true)
  })

  test("identifies negated atoms as simple", () => {
    const notP = { type: "NOT", operand: { type: "ATOM", value: "P" } }
    expect(isSimple(notP)).toBe(true)
  })

  test("rejects complex expressions", () => {
    const pAndQ = {
      type: "BINARY",
      operator: "&",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    expect(isSimple(pAndQ)).toBe(false)
  })

  test("rejects doubly negated atoms", () => {
    const notNotP = {
      type: "NOT",
      operand: { type: "NOT", operand: { type: "ATOM", value: "P" } },
    }
    expect(isSimple(notNotP)).toBe(false)
  })
})
