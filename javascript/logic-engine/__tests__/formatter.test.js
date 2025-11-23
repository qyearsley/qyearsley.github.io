/**
 * Formatter Tests
 *
 * Tests for AST to string formatting
 */

import { formatAST } from "../formatter.js"

describe("formatAST", () => {
  test("formats atoms", () => {
    const ast = { type: "ATOM", value: "P" }
    expect(formatAST(ast)).toBe("P")
  })

  test("formats NOT of atoms", () => {
    const ast = { type: "NOT", operand: { type: "ATOM", value: "P" } }
    expect(formatAST(ast)).toBe("~P")
  })

  test("formats NOT of binary expressions with parens", () => {
    const ast = {
      type: "NOT",
      operand: {
        type: "BINARY",
        operator: "&",
        left: { type: "ATOM", value: "P" },
        right: { type: "ATOM", value: "Q" },
      },
    }
    expect(formatAST(ast)).toBe("~(P & Q)")
  })

  test("formats AND expressions", () => {
    const ast = {
      type: "BINARY",
      operator: "&",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    expect(formatAST(ast)).toBe("P & Q")
  })

  test("formats OR expressions", () => {
    const ast = {
      type: "BINARY",
      operator: "|",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    expect(formatAST(ast)).toBe("P | Q")
  })

  test("formats IMPLIES expressions", () => {
    const ast = {
      type: "BINARY",
      operator: "->",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    expect(formatAST(ast)).toBe("P -> Q")
  })

  test("formats IFF expressions", () => {
    const ast = {
      type: "BINARY",
      operator: "<->",
      left: { type: "ATOM", value: "P" },
      right: { type: "ATOM", value: "Q" },
    }
    expect(formatAST(ast)).toBe("P <-> Q")
  })

  test("adds parentheses for nested binary expressions", () => {
    // (P & Q) | R
    const ast = {
      type: "BINARY",
      operator: "|",
      left: {
        type: "BINARY",
        operator: "&",
        left: { type: "ATOM", value: "P" },
        right: { type: "ATOM", value: "Q" },
      },
      right: { type: "ATOM", value: "R" },
    }
    expect(formatAST(ast)).toBe("(P & Q) | R")
  })

  test("handles complex nested structures", () => {
    // ~(P & Q) | R
    const ast = {
      type: "BINARY",
      operator: "|",
      left: {
        type: "NOT",
        operand: {
          type: "BINARY",
          operator: "&",
          left: { type: "ATOM", value: "P" },
          right: { type: "ATOM", value: "Q" },
        },
      },
      right: { type: "ATOM", value: "R" },
    }
    expect(formatAST(ast)).toBe("~(P & Q) | R")
  })

  test("returns empty string for invalid node type", () => {
    const invalidAst = { type: "INVALID", value: "test" }
    expect(formatAST(invalidAst)).toBe("")
  })
})
