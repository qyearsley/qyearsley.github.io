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
    name: "Modus Ponens",
    description: "If it rains, the street is wet. It's raining.",
    premises: ["rain -> wet", "rain"],
  },
  {
    name: "Modus Tollens",
    description: "If it's a cat, it's a mammal. It's not a mammal.",
    premises: ["cat -> mammal", "~mammal"],
  },
  {
    name: "Disjunctive Syllogism",
    description: "Either coffee or tea. Not coffee.",
    premises: ["coffee | tea", "~coffee"],
  },
  {
    name: "Socrates",
    description: "Classic syllogism with chained implications",
    premises: ["man -> mortal", "socrates -> man", "socrates"],
  },
  {
    name: "Transitive Reasoning",
    description: "A implies B, B implies C, therefore A implies C",
    premises: ["A -> B", "B -> C", "A"],
  },
  {
    name: "Resolution",
    description: "Resolution inference from two disjunctions",
    premises: ["P | Q", "~P | R"],
  },
  {
    name: "Multi-step Proof",
    description: "Requires multiple inference steps to reach conclusion",
    premises: ["A -> B", "B -> C", "A", "~C | D", "~D"],
  },
  {
    name: "Who's Guilty?",
    description: "If Alice did it, Bob is innocent. Bob is guilty.",
    premises: ["alice -> ~bob_guilty", "bob_guilty"],
  },
  {
    name: "Light Switch",
    description: "The light is on if and only if the switch is up",
    premises: ["light <-> switch_up", "~light"],
  },
  {
    name: "Alibi",
    description: "If suspect was at scene, no alibi. Has alibi or guilty.",
    premises: ["at_scene -> ~alibi", "alibi | guilty", "at_scene"],
  },
  {
    name: "Fire Protocol",
    description: "If fire, then alarm. If alarm, evacuate. Fire detected.",
    premises: ["fire -> alarm", "alarm -> evacuate", "fire"],
  },
  {
    name: "Medical Diagnosis",
    description: "Fever and cough. If both, then flu or cold.",
    premises: ["fever & cough", "(fever & cough) -> (flu | cold)"],
  },
  {
    name: "Contradiction Example",
    description: "It's raining and not raining - detects inconsistency",
    premises: ["raining", "~raining"],
  },
]
