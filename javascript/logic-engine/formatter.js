/**
 * AST Formatter
 *
 * Converts Abstract Syntax Trees back to human-readable string representations.
 * Uses precedence-aware parenthesization to avoid unnecessary parentheses while
 * maintaining correctness.
 *
 * Operator precedence (lowest to highest):
 * 1. IFF (<->)
 * 2. IMPLIES (->)
 * 3. XNOR
 * 4. XOR
 * 5. NOR
 * 6. OR (|)
 * 7. NAND
 * 8. AND (&)
 * 9. NOT (~) - handled separately as unary operator
 */

"use strict"

/**
 * Operator precedence levels (lower number = lower precedence)
 * @type {Record<string, number>}
 */
const PRECEDENCE = {
  "<->": 1,
  "->": 2,
  xnor: 3,
  xor: 4,
  nor: 5,
  "|": 6,
  nand: 7,
  "&": 8,
}

/**
 * Checks if parentheses are needed around a child expression
 * @param {string} parentOp - Parent operator
 * @param {import('./parser.js').ASTNode} child - Child AST node
 * @param {boolean} isRightSide - Whether child is on right side of parent operator
 * @returns {boolean} True if parentheses are needed
 */
function needsParens(parentOp, child, isRightSide = false) {
  if (child.type !== "BINARY") {
    return false
  }

  const parentPrec = PRECEDENCE[parentOp]
  const childPrec = PRECEDENCE[child.operator]

  // Lower precedence always needs parens: (P | Q) & R
  if (childPrec < parentPrec) {
    return true
  }

  // Equal precedence on right side of non-associative operators needs parens
  // Example: P -> (Q -> R) for right-associativity of ->
  if (childPrec === parentPrec && isRightSide && parentOp === "->") {
    // Right-associative, so don't add parens on right side
    return false
  }

  // Equal precedence on left side of right-associative operators needs parens
  // Example: (P -> Q) -> R should show parens
  if (childPrec === parentPrec && !isRightSide && parentOp === "->") {
    return true
  }

  return false
}

/**
 * Formats an AST node as a string logical expression
 *
 * Algorithm:
 * - Atoms are returned as-is
 * - Negations add ~ prefix (with parens for binary operands)
 * - Binary operators add parens only when precedence requires it
 *
 * Examples:
 *   formatAST({ type: 'ATOM', value: 'P' }) => "P"
 *   formatAST({ type: 'NOT', operand: {type: 'ATOM', value: 'P'} }) => "~P"
 *   formatAST({ type: 'BINARY', operator: '->', left: P, right: Q }) => "P -> Q"
 *   formatAST({ type: 'BINARY', operator: '&', left: (P | Q), right: R }) => "(P | Q) & R"
 *   formatAST({ type: 'BINARY', operator: '&', left: (P & Q), right: R }) => "P & Q & R"
 *
 * @param {import('./parser.js').ASTNode} node - The AST node to format
 * @returns {string} The formatted logical expression
 */
export function formatAST(node) {
  if (node.type === "ATOM") {
    return node.value
  }

  if (node.type === "LITERAL") {
    return node.value.toString()
  }

  if (node.type === "NOT") {
    const operand = formatAST(node.operand)
    // Add parens around binary expressions to avoid ambiguity
    // e.g., ~(P & Q) instead of ~P & Q
    return node.operand.type === "BINARY" ? `~(${operand})` : `~${operand}`
  }

  if (node.type === "BINARY") {
    const left = formatAST(node.left)
    const right = formatAST(node.right)

    // Use precedence-aware parenthesization
    const leftStr = needsParens(node.operator, node.left, false) ? `(${left})` : left
    const rightStr = needsParens(node.operator, node.right, true) ? `(${right})` : right

    return `${leftStr} ${node.operator} ${rightStr}`
  }

  return ""
}
