/**
 * Logic Expression Parser
 *
 * Tokenizes and parses logical expressions into Abstract Syntax Trees (ASTs).
 * Supports standard logical operators and English synonyms.
 *
 * Operator precedence (highest to lowest):
 * 1. Parentheses ()
 * 2. NOT (~, !)
 * 3. AND (&, ^)
 * 4. OR (|)
 * 5. IMPLIES (->)
 * 6. IFF (<->)
 *
 * Examples:
 *   "P -> Q" parses to { type: 'BINARY', operator: '->', left: {type: 'ATOM', value: 'P'}, right: {...} }
 *   "~(A & B)" parses to { type: 'NOT', operand: { type: 'BINARY', ... } }
 */

"use strict"

/**
 * Token types for the lexer
 * @typedef {'ATOM'|'NOT'|'AND'|'OR'|'IMPLIES'|'IFF'|'LPAREN'|'RPAREN'|'EOF'} TokenType
 */

/**
 * A token from the lexer
 * @typedef {Object} Token
 * @property {TokenType} type - The token type
 * @property {string} value - The token value (normalized operator or atom name)
 */

/**
 * Abstract Syntax Tree node representing a logical expression
 * @typedef {AtomNode|NotNode|BinaryNode} ASTNode
 */

/**
 * @typedef {Object} AtomNode
 * @property {'ATOM'} type
 * @property {string} value - The proposition name (e.g., "P", "Q", "rain")
 */

/**
 * @typedef {Object} NotNode
 * @property {'NOT'} type
 * @property {ASTNode} operand - The negated expression
 */

/**
 * @typedef {Object} BinaryNode
 * @property {'BINARY'} type
 * @property {'&'|'|'|'->'|'<->'} operator - The binary operator
 * @property {ASTNode} left - Left operand
 * @property {ASTNode} right - Right operand
 */

/**
 * Tokenizes a logical expression string into an array of tokens.
 *
 * Algorithm: Single-pass linear scan with multi-character lookahead
 * Time Complexity: O(n) where n is the input length
 *
 * The Challenge:
 * We need to distinguish between keywords (operators) and identifiers (atoms).
 * Example: "and" is AND operator, but "android" is an atom named "android"
 *
 * Solution: Lookahead Strategy
 * 1. Check if the next few characters match a keyword ("and", "or", "not")
 * 2. If they do, peek at the character AFTER the keyword
 * 3. If it's alphanumeric, it's part of a longer identifier, not a keyword
 * 4. Otherwise, it's genuinely the keyword operator
 *
 * Example Input: "rain and android"
 * - Position 0: "r" → start atom matching → captures "rain"
 * - Position 5: "a" → lookahead sees "and", next char is space → AND token
 * - Position 9: "a" → lookahead sees "and", next char is "r" → atom "android"
 *
 * Supported operators (in order checked - longest first to avoid partial matches):
 * - NOT: ~, !, "not"
 * - AND: &, ^, "and"
 * - OR: |, "or"
 * - IMPLIES: ->, "implies", "then"
 * - IFF: <->, "iff"
 *
 * @param {string} input - The logical expression to tokenize
 * @returns {Token[]} Array of tokens ending with EOF token
 */
export function tokenize(input) {
  const tokens = []
  let cursor = 0

  while (cursor < input.length) {
    const char = input[cursor]

    // Skip whitespace (spaces, tabs, newlines)
    if (/\s/.test(char)) {
      cursor++
      continue
    }

    // Parentheses - single character tokens
    if (char === "(") {
      tokens.push({ type: "LPAREN", value: "(" })
      cursor++
      continue
    }
    if (char === ")") {
      tokens.push({ type: "RPAREN", value: ")" })
      cursor++
      continue
    }

    // Multi-character operator lookahead
    // We lowercase the remaining string for case-insensitive keyword matching
    // but preserve the original cursor position for atom extraction
    const remaining = input.slice(cursor).toLowerCase()

    // IFF operator (<-> or "iff")
    // Check longest operators first to avoid partial matches
    if (remaining.startsWith("<->") || remaining.startsWith("iff")) {
      tokens.push({ type: "IFF", value: "<->" })
      cursor += remaining.startsWith("<->") ? 3 : 3
      continue
    }

    // IMPLIES operator (->, "implies", "then")
    // Note: "then" is less common but supported for natural language
    if (
      remaining.startsWith("->") ||
      remaining.startsWith("implies") ||
      remaining.startsWith("then")
    ) {
      tokens.push({ type: "IMPLIES", value: "->" })
      // Advance cursor by the length of what we matched
      if (remaining.startsWith("->")) cursor += 2
      else if (remaining.startsWith("then")) cursor += 4
      else cursor += 7 // "implies"
      continue
    }

    // OR operator (| or "or")
    // Lookahead check: Is "or" followed by alphanumeric? If yes, it's part of "order"/"oracle"/etc
    // Example: "or" at end of string → /^[a-z0-9]/.test(undefined) → false → it's OR
    // Example: "order" → /^[a-z0-9]/.test("d") → true → not OR, continue to atom matching
    const isWordOr = remaining.startsWith("or") && !/^[a-z0-9]/.test(input[cursor + 2] || "")
    if (char === "|" || isWordOr) {
      tokens.push({ type: "OR", value: "|" })
      cursor += isWordOr ? 2 : 1
      continue
    }

    // AND operator (&, ^ or "and")
    // Same lookahead strategy: "and" followed by alphanumeric means it's "android"/"андроид"/etc
    const isWordAnd = remaining.startsWith("and") && !/^[a-z0-9]/.test(input[cursor + 3] || "")
    if (char === "&" || char === "^" || isWordAnd) {
      tokens.push({ type: "AND", value: "&" })
      cursor += isWordAnd ? 3 : 1
      continue
    }

    // NOT operator (~, ! or "not")
    // Lookahead prevents "notice", "nothing", "notation" from being tokenized as "not" + "ice"
    const isWordNot = remaining.startsWith("not") && !/^[a-z0-9]/.test(input[cursor + 3] || "")
    if (char === "~" || char === "!" || isWordNot) {
      tokens.push({ type: "NOT", value: "~" })
      cursor += isWordNot ? 3 : 1
      continue
    }

    // Atoms (proposition names: P, Q, rain, socrates, wet_street, etc.)
    // Matches alphanumeric sequences and underscores
    // Uses regex to capture the longest possible match
    const match = input.slice(cursor).match(/^[a-zA-Z0-9_]+/)
    if (match) {
      const value = match[0]
      tokens.push({ type: "ATOM", value })
      cursor += value.length
      continue
    }

    // Unknown character (e.g., @, #, $) - skip and continue
    // This makes the tokenizer lenient with invalid input
    cursor++
  }

  // Always add EOF token to signal end of input
  // This simplifies parser logic (can always call current() without null checks)
  tokens.push({ type: "EOF", value: "" })
  return tokens
}

/**
 * Recursive Descent Parser
 *
 * Parses a stream of tokens into an Abstract Syntax Tree (AST) using
 * recursive descent with operator precedence climbing.
 *
 * The grammar (in order of precedence from lowest to highest):
 *   iff     ::= implies ('IFF' implies)*             // P <-> Q <-> R  (left-associative)
 *   implies ::= or ('->' implies)?                   // P -> Q -> R = P -> (Q -> R)  (right-associative!)
 *   or      ::= and ('|' and)*                       // P | Q | R  (left-associative)
 *   and     ::= not ('&' not)*                       // P & Q & R  (left-associative)
 *   not     ::= 'NOT' not | primary                  // ~~P works recursively
 *   primary ::= 'ATOM' | '(' iff ')'                 // P or (P & Q)
 *
 * Examples:
 *   "P & Q | R"   => OR(AND(P, Q), R)      - AND binds tighter than OR
 *   "P -> Q -> R" => IMPLIES(P, IMPLIES(Q, R))  - Right-associative chaining
 *   "~P & Q"      => AND(NOT(P), Q)        - NOT binds tightest
 *
 * Right-associativity for IMPLIES matches standard logic conventions where
 * "if P then if Q then R" means "if P then (if Q then R)", not "(if P then Q) then R".
 */
export class Parser {
  /**
   * @param {Token[]} tokens - The tokens to parse
   */
  constructor(tokens) {
    this.tokens = tokens
    this.pos = 0
  }

  /**
   * Gets the current token without consuming it
   * @returns {Token}
   */
  current() {
    return this.tokens[this.pos]
  }

  /**
   * Consumes and returns the current token
   * @returns {Token}
   */
  consume() {
    return this.tokens[this.pos++]
  }

  /**
   * Matches and consumes a token of the given type
   * @param {TokenType} type - The expected token type
   * @returns {boolean} True if the token was matched and consumed
   */
  match(type) {
    if (this.current().type === type) {
      this.consume()
      return true
    }
    return false
  }

  /**
   * Parses the token stream into an AST
   * @returns {ASTNode} The root of the abstract syntax tree
   * @throws {Error} If there are syntax errors
   */
  parse() {
    const node = this.parseIff()
    if (this.current().type !== "EOF") {
      // Could throw an error here for trailing tokens
      console.warn("Warning: Unexpected tokens after expression")
    }
    return node
  }

  /**
   * Parses IFF (biconditional) expressions - lowest precedence operator
   *
   * Algorithm: Left-associative iteration (using while loop)
   * Grammar: iff ::= implies ('IFF' implies)*
   *
   * Why lowest precedence?
   * "P & Q <-> R | S" should parse as "(P & Q) <-> (R | S)", not "P & (Q <-> R) | S"
   *
   * Example parse of "P <-> Q <-> R":
   * 1. left = parseImplies() → get P
   * 2. See IFF, consume it
   * 3. right = parseImplies() → get Q
   * 4. left = (P <-> Q)
   * 5. See IFF again, consume it
   * 6. right = parseImplies() → get R
   * 7. left = ((P <-> Q) <-> R)  ← Left-associative!
   *
   * @returns {ASTNode}
   */
  parseIff() {
    let left = this.parseImplies()
    while (this.current().type === "IFF") {
      this.consume()
      const right = this.parseImplies()
      left = { type: "BINARY", operator: "<->", left, right }
    }
    return left
  }

  /**
   * Parses IMPLIES (implication) expressions
   *
   * Algorithm: Right-associative recursion (using if + recursive call)
   * Grammar: implies ::= or ('->' implies)?
   *
   * Why right-associative?
   * In logic, "P → Q → R" means "P → (Q → R)", not "(P → Q) → R"
   * Natural language: "If it rains then if streets are wet then it's slippery"
   * = "If it rains, then (if streets are wet, then it's slippery)"
   *
   * Example parse of "P -> Q -> R":
   * 1. left = parseOr() → get P
   * 2. See IMPLIES, consume it
   * 3. right = parseImplies() [RECURSIVE CALL] →
   *    3a. left = parseOr() → get Q
   *    3b. See IMPLIES, consume it
   *    3c. right = parseImplies() →
   *        3c1. left = parseOr() → get R
   *        3c2. No IMPLIES, return R
   *    3d. return (Q -> R)
   * 4. return (P -> (Q -> R))  ← Right-associative!
   *
   * Why if instead of while?
   * The recursive call handles the rest of the chain, so we only need one if check.
   * Using while here would make it left-associative (wrong for implications).
   *
   * @returns {ASTNode}
   */
  parseImplies() {
    let left = this.parseOr()
    if (this.current().type === "IMPLIES") {
      this.consume()
      // Recursion makes it right-associative (unlike the while loops in other methods)
      const right = this.parseImplies()
      left = { type: "BINARY", operator: "->", left, right }
    }
    return left
  }

  /**
   * Parses OR (disjunction) expressions
   *
   * Algorithm: Left-associative iteration
   * Grammar: or ::= and ('|' and)*
   *
   * Example parse of "P | Q | R":
   * 1. left = parseAnd() → get P
   * 2. See OR, consume it, right = parseAnd() → get Q, left = (P | Q)
   * 3. See OR, consume it, right = parseAnd() → get R, left = ((P | Q) | R)
   *
   * Why higher precedence than IFF/IMPLIES?
   * "P -> Q | R" should parse as "P -> (Q | R)", so OR binds tighter than IMPLIES
   *
   * @returns {ASTNode}
   */
  parseOr() {
    let left = this.parseAnd()
    while (this.current().type === "OR") {
      this.consume()
      const right = this.parseAnd()
      left = { type: "BINARY", operator: "|", left, right }
    }
    return left
  }

  /**
   * Parses AND (conjunction) expressions
   *
   * Algorithm: Left-associative iteration
   * Grammar: and ::= not ('&' not)*
   *
   * Why higher precedence than OR?
   * Standard convention: "P | Q & R" means "P | (Q & R)", not "(P | Q) & R"
   * This matches mathematical convention (like * before +)
   *
   * Example: "P & Q | R" parses as "(P & Q) | R" because:
   * - parseOr calls parseAnd which consumes "P & Q" entirely
   * - then parseOr sees "|" and makes the OR the top-level operator
   *
   * @returns {ASTNode}
   */
  parseAnd() {
    let left = this.parseNot()
    while (this.current().type === "AND") {
      this.consume()
      const right = this.parseNot()
      left = { type: "BINARY", operator: "&", left, right }
    }
    return left
  }

  /**
   * Parses NOT (negation) expressions
   *
   * Algorithm: Right-recursive (allows chaining: ~~P)
   * Grammar: not ::= 'NOT' not | primary
   *
   * Why highest precedence?
   * "~P & Q" should parse as "(~P) & Q", not "~(P & Q)"
   *
   * Example: "~~P" (double negation)
   * 1. See NOT, consume it
   * 2. operand = parseNot() [RECURSIVE] →
   *    2a. See NOT, consume it
   *    2b. operand = parseNot() [RECURSIVE] →
   *        2b1. No NOT, so parsePrimary() → get P
   *    2c. return NOT(P)
   * 3. return NOT(NOT(P))
   *
   * The recursion naturally builds the tree from outside-in:
   * First NOT wraps the second NOT, which wraps P
   *
   * @returns {ASTNode}
   */
  parseNot() {
    if (this.match("NOT")) {
      return { type: "NOT", operand: this.parseNot() }
    }
    return this.parsePrimary()
  }

  /**
   * Parses primary expressions (atoms and parenthesized expressions)
   *
   * Algorithm: Base case for recursion - handles the highest-precedence constructs
   * Grammar: primary ::= 'ATOM' | '(' iff ')'
   *
   * This is where the recursion bottoms out. When we hit an atom or opening paren,
   * we've reached the "leaf" level of the expression tree.
   *
   * Why parentheses reset to parseIff()?
   * Parentheses override precedence. Inside them, we start over with the lowest
   * precedence level, allowing any expression.
   *
   * Example: "~(P & Q | R)"
   * 1. parseNot sees NOT, calls parseNot recursively
   * 2. Inner parseNot calls parsePrimary
   * 3. parsePrimary sees "(", calls parseIff() to parse what's inside
   * 4. parseIff → parseImplies → parseOr → parseAnd handles "P & Q | R" completely
   * 5. parsePrimary consumes ")", returns the full sub-tree
   * 6. parseNot wraps it: NOT((P & Q) | R)
   *
   * @returns {ASTNode}
   */
  parsePrimary() {
    // Handle parenthesized expressions
    if (this.match("LPAREN")) {
      const node = this.parseIff() // Start over at lowest precedence
      this.match("RPAREN") // Consume closing paren (lenient if missing)
      return node
    }

    // Handle atoms (base case)
    const token = this.consume()
    if (token.type === "ATOM") {
      return { type: "ATOM", value: token.value }
    }

    // Syntax error: expected atom or '(' but got something else
    // This is a lenient parser - we return an ERROR atom instead of throwing
    console.error("Unexpected token:", token)
    return { type: "ATOM", value: "ERROR" }
  }
}

/**
 * Checks deep structural equality of two AST nodes
 *
 * Algorithm: Recursive tree comparison
 * Time Complexity: O(n) where n is the number of nodes in the smaller tree
 *
 * Why needed?
 * The inference engine needs to check if we've already proven a conclusion.
 * JavaScript's === compares object references, not structure, so {type: 'ATOM', value: 'P'}
 * !== {type: 'ATOM', value: 'P'} even though they represent the same thing.
 *
 * How it works:
 * 1. If types differ, trees are different
 * 2. For atoms: compare values
 * 3. For NOT: recursively compare operands
 * 4. For BINARY: compare operators AND both subtrees recursively
 *
 * Example:
 *   a = {type: 'BINARY', op: '&', left: {type: 'ATOM', value: 'P'}, right: {type: 'ATOM', value: 'Q'}}
 *   b = {type: 'BINARY', op: '&', left: {type: 'ATOM', value: 'P'}, right: {type: 'ATOM', value: 'Q'}}
 *   areEqual(a, b) → true (same structure)
 *
 * @param {ASTNode} a - First AST node
 * @param {ASTNode} b - Second AST node
 * @returns {boolean} True if the ASTs are structurally identical
 */
export function areEqual(a, b) {
  // Quick reject: different node types
  if (a.type !== b.type) return false

  if (a.type === "ATOM") {
    return a.value === b.value
  }

  if (a.type === "NOT") {
    return areEqual(a.operand, b.operand)
  }

  if (a.type === "BINARY") {
    return a.operator === b.operator && areEqual(a.left, b.left) && areEqual(a.right, b.right)
  }

  return false
}

/**
 * Checks if one node is the logical negation of another
 *
 * Algorithm: Bidirectional negation checking
 *
 * Why bidirectional?
 * In logic, "A is the negation of ~A" AND "~A is the negation of A" are both true.
 * We need to handle both cases to apply rules like Modus Tollens and Resolution.
 *
 * Examples:
 *   isNegation(P, ~P) => true     (check is the negation of base)
 *   isNegation(~P, P) => true     (base is the negation of check)
 *   isNegation(P, Q) => false     (unrelated atoms)
 *   isNegation(~P, ~Q) => false   (both negated but different atoms)
 *
 * Used in inference rules:
 * - Modus Tollens: (P -> Q), ~Q => ~P  (need to check if Q and ~Q are negations)
 * - Resolution: (P | Q), (~P | R) => (Q | R)  (need to find negated pairs)
 *
 * @param {ASTNode} base - First node
 * @param {ASTNode} check - Second node to check if it's the negation of base
 * @returns {boolean} True if check is the negation of base (or vice versa)
 */
export function isNegation(base, check) {
  // Case 1: check is ~base (e.g., base=P, check=~P)
  if (check.type === "NOT" && areEqual(check.operand, base)) {
    return true
  }
  // Case 2: base is ~check (e.g., base=~P, check=P)
  if (base.type === "NOT" && areEqual(base.operand, check)) {
    return true
  }
  return false
}

/**
 * Checks if an AST node is "simple" (just an atom or negated atom)
 *
 * Algorithm: Two-level depth check
 *
 * Why needed?
 * The Adjunction rule (P, Q => P & Q) can create exponentially many conclusions
 * if applied to all pairs of facts. Limiting it to simple facts prevents explosion.
 *
 * Without this restriction:
 * - Facts: P, Q, R, S
 * - Step 1: P&Q, P&R, P&S, Q&R, Q&S, R&S (6 new facts)
 * - Step 2: P&Q&R, P&Q&S, ... (many more combinations)
 * - Result: Combinatorial explosion, UI becomes unusable
 *
 * With this restriction:
 * - Simple nodes: P, Q, ~P, ~Q (atoms and single negations)
 * - Complex nodes: P&Q, P->Q, ~(P&Q) (everything else)
 * - Adjunction only applies to simple nodes, preventing the explosion
 *
 * Examples:
 *   isSimple(P) => true          (atom)
 *   isSimple(~P) => true         (negated atom)
 *   isSimple(~~P) => false       (double negation - complex)
 *   isSimple(P & Q) => false     (binary expression - complex)
 *   isSimple(~(P & Q)) => false  (negated binary - complex)
 *
 * @param {ASTNode} node - The AST node to check
 * @returns {boolean} True if the node is an atom or negated atom
 */
export function isSimple(node) {
  if (node.type === "ATOM") return true
  if (node.type === "NOT" && node.operand.type === "ATOM") return true
  return false
}
