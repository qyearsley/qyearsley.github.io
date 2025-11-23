/**
 * AST Formatter
 *
 * Converts Abstract Syntax Trees back to human-readable string representations.
 * Adds parentheses strategically to avoid ambiguity while keeping output clean.
 */

"use strict"

/**
 * Formats an AST node as a string logical expression
 *
 * Algorithm:
 * - Atoms are returned as-is
 * - Negations add ~ prefix (with parens for binary operands)
 * - Binary operators add parens around nested binary expressions
 *
 * Examples:
 *   formatAST({ type: 'ATOM', value: 'P' }) => "P"
 *   formatAST({ type: 'NOT', operand: {type: 'ATOM', value: 'P'} }) => "~P"
 *   formatAST({ type: 'BINARY', operator: '->', left: P, right: Q }) => "P -> Q"
 *   formatAST({ type: 'BINARY', operator: '&', left: (P | Q), right: R }) => "(P | Q) & R"
 *
 * @param {import('./parser.js').ASTNode} node - The AST node to format
 * @returns {string} The formatted logical expression
 */
export function formatAST(node) {
  if (node.type === "ATOM") {
    return node.value
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

    // Add parentheses around nested binary expressions for clarity
    // This prevents ambiguity like: (P & Q) | R vs P & (Q | R)
    const leftStr = node.left.type === "BINARY" ? `(${left})` : left
    const rightStr = node.right.type === "BINARY" ? `(${right})` : right

    return `${leftStr} ${node.operator} ${rightStr}`
  }

  return ""
}
