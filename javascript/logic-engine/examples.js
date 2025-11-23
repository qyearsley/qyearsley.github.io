/**
 * Predefined Logic Examples
 *
 * A collection of example proofs demonstrating different inference rules.
 * These help users learn the system and explore classical logic patterns.
 */

"use strict"

/**
 * Predefined logic examples to help users explore different inference rules
 * Each example includes premises that will trigger specific inference rules
 * @type {Array<{name: string, premises: string[]}>}
 */
export const PREDEFINED_EXAMPLES = [
  {
    name: "Simple: Modus Ponens",
    description: "If it rains, the street is wet. It's raining.",
    premises: ["rain -> wet", "rain"],
  },
  {
    name: "Simple: Modus Tollens",
    description: "If it's a cat, it's a mammal. It's not a mammal.",
    premises: ["cat -> mammal", "~mammal"],
  },
  {
    name: "Simple: Disjunctive Syllogism",
    description: "Either coffee or tea. Not coffee.",
    premises: ["coffee | tea", "~coffee"],
  },
  {
    name: "Chain: Socrates",
    description: "Classic syllogism with chained implications",
    premises: ["man -> mortal", "socrates -> man", "socrates"],
  },
  {
    name: "Chain: Transitive Reasoning",
    description: "A implies B, B implies C",
    premises: ["A -> B", "B -> C", "A"],
  },
  {
    name: "Logic: De Morgan's Law",
    description: "Negation distributes over conjunction",
    premises: ["~(rain & cold)"],
  },
  {
    name: "Logic: Resolution",
    description: "Resolution inference from two disjunctions",
    premises: ["P | Q", "~P | R"],
  },
  {
    name: "Complex: Multi-step Proof",
    description: "Requires multiple inference steps to reach conclusion",
    premises: ["A -> B", "B -> C", "A", "~C | D", "~D"],
  },
  {
    name: "Puzzle: Who's Guilty?",
    description: "If Alice did it, Bob is innocent. Bob is guilty.",
    premises: ["alice -> ~bob_guilty", "bob_guilty"],
  },
]
