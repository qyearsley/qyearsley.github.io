export const levels = [
  {
    id: "write-one",
    name: "Write One",
    description:
      "The tape has a single blank cell. Write a 1 and halt. " +
      "This introduces the basics: each rule says what to write, which way to move, and what state to go to next.",
    tape: ["_"],
    target: ["1"],
    headStart: 0,
    states: ["A", "HALT"],
    symbols: ["0", "1", "_"],
    maxSteps: 10,
  },
  {
    id: "flip-it",
    name: "Flip It",
    description:
      "Flip every bit: turn 0s into 1s and 1s into 0s. " +
      "The tape ends with a blank -- use it to know when to stop.",
    tape: ["1", "0", "1", "_"],
    target: ["0", "1", "0"],
    headStart: 0,
    states: ["A", "HALT"],
    symbols: ["0", "1", "_"],
    maxSteps: 50,
  },
  {
    id: "move-right",
    name: "Move Right",
    description:
      "Move the 1 one cell to the right. " +
      "You'll need two states: one to erase the 1, and another to write it in the new spot.",
    tape: ["1", "_"],
    target: ["_", "1"],
    headStart: 0,
    states: ["A", "B", "HALT"],
    symbols: ["0", "1", "_"],
    maxSteps: 20,
  },
  {
    id: "fill",
    name: "Fill",
    description:
      "Fill every blank cell with 1. " +
      "The tape ends with a 1 sentinel so you know where to stop.",
    tape: ["_", "_", "_", "1"],
    target: ["1", "1", "1", "1"],
    headStart: 0,
    states: ["A", "HALT"],
    symbols: ["0", "1", "_"],
    maxSteps: 50,
  },
  {
    id: "binary-increment",
    name: "Binary +1",
    description:
      "Increment a binary number by 1. The number 101 (5) should become 110 (6). " +
      "Hint: scan to the end, then carry from right to left.",
    tape: ["1", "0", "1", "_"],
    target: ["1", "1", "0"],
    headStart: 0,
    states: ["A", "B", "HALT"],
    symbols: ["0", "1", "_"],
    maxSteps: 100,
  },
]

/**
 * Demo programs: pre-filled rule sets to step through.
 * These illustrate interesting Turing machine behavior.
 * Rules are read-only -- the user watches, not edits.
 */
export const demos = [
  {
    id: "demo-busy-beaver-3",
    name: "Busy Beaver (3-state)",
    description:
      "The 3-state busy beaver writes the maximum number of 1s (six) " +
      "before halting, using only 3 states. It runs for 14 steps. " +
      "This is a famous result in computability theory -- " +
      "finding busy beavers for larger state counts is an open problem.",
    tape: ["_", "_", "_", "_", "_", "_", "_", "_", "_"],
    headStart: 4,
    states: ["A", "B", "C", "HALT"],
    symbols: ["0", "1", "_"],
    maxSteps: 200,
    rules: [
      ["A", "_", "1", "R", "B"],
      ["A", "1", "1", "L", "C"],
      ["B", "_", "1", "L", "A"],
      ["B", "1", "1", "R", "B"],
      ["C", "_", "1", "L", "B"],
      ["C", "1", "1", "S", "HALT"],
    ],
  },
  {
    id: "demo-unary-add",
    name: "Unary Addition",
    description:
      "Adds two unary numbers separated by a 0. " +
      "For example, 111+0+11 (3+2) becomes 11111 (5). " +
      "It erases the separator and shifts the second number left.",
    tape: ["1", "1", "1", "0", "1", "1", "_"],
    headStart: 0,
    states: ["A", "B", "C", "HALT"],
    symbols: ["0", "1", "_"],
    maxSteps: 100,
    rules: [
      ["A", "1", "1", "R", "A"],
      ["A", "0", "1", "R", "B"],
      ["B", "1", "1", "R", "B"],
      ["B", "_", "_", "L", "C"],
      ["C", "1", "_", "S", "HALT"],
    ],
  },
  {
    id: "demo-palindrome",
    name: "Palindrome Check",
    description:
      "Checks if a binary string is a palindrome by comparing the first and last " +
      "characters, erasing them, and repeating. Halts in state Y (yes) or N (no). " +
      "Try it on 1001 (palindrome) -- watch it bounce back and forth.",
    tape: ["1", "0", "0", "1", "_"],
    headStart: 0,
    states: ["A", "B", "C", "D", "Y", "N"],
    symbols: ["0", "1", "_"],
    maxSteps: 200,
    // A: read first char. If 1, erase and go right looking for matching 1 at end (state B).
    // If 0, erase and go right looking for matching 0 at end (state C).
    // If blank, all matched -- accept (Y).
    rules: [
      ["A", "1", "_", "R", "B"],
      ["A", "0", "_", "R", "C"],
      ["A", "_", "_", "S", "Y"],
      // B: scan right to end, check last char is 1
      ["B", "1", "1", "R", "B"],
      ["B", "0", "0", "R", "B"],
      ["B", "_", "_", "L", "D"],
      // D from B: check rightmost is 1
      ["D", "1", "_", "L", "E"],
      ["D", "0", "0", "S", "N"],
      ["D", "_", "_", "S", "Y"],
      // C: scan right to end, check last char is 0
      ["C", "1", "1", "R", "C"],
      ["C", "0", "0", "R", "C"],
      ["C", "_", "_", "L", "F"],
      // F from C: check rightmost is 0
      ["F", "0", "_", "L", "E"],
      ["F", "1", "1", "S", "N"],
      ["F", "_", "_", "S", "Y"],
      // E: scan back left to start, then restart
      ["E", "1", "1", "L", "E"],
      ["E", "0", "0", "L", "E"],
      ["E", "_", "_", "R", "A"],
    ],
  },
]
