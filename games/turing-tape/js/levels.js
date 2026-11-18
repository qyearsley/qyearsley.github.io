export const levels = [
  {
    id: "write-one",
    zh: { name: "写入 1", description: "纸带上只有一个空白格。写入 1 并停机。" },
    name: "Write One",
    description: "The tape has a single blank cell. Write a 1 and halt.",
    tape: ["_"],
    target: ["1"],
    headStart: 0,
    states: ["A", "HALT"],
    symbols: ["0", "1", "_"],
  },
  {
    id: "flip-it",
    zh: {
      name: "翻转",
      description: "翻转每一位：0 变 1，1 变 0。纸带以空白结尾，用它来判断何时停止。",
    },
    name: "Flip It",
    description:
      "Flip every bit: turn 0s into 1s and 1s into 0s. " +
      "The tape ends with a blank -- use it to know when to stop.",
    tape: ["1", "0", "1", "_"],
    target: ["0", "1", "0"],
    headStart: 0,
    states: ["A", "HALT"],
    symbols: ["0", "1", "_"],
  },
  {
    id: "move-right",
    zh: {
      name: "右移",
      description: "把 1 向右移动一格。需要两个状态：一个用来擦掉 1，另一个用来在新位置写入 1。",
    },
    name: "Move Right",
    description:
      "Move the 1 one cell to the right. " +
      "You'll need two states: one to erase the 1, and another to write it in the new spot.",
    tape: ["1", "_"],
    target: ["_", "1"],
    headStart: 0,
    states: ["A", "B", "HALT"],
    symbols: ["0", "1", "_"],
  },
  {
    id: "fill",
    zh: { name: "填充", description: "把每个空白格都填成 1。纸带以 1 结尾，用它来判断何时停止。" },
    name: "Fill",
    description:
      "Fill every blank cell with 1. " +
      "The tape ends with a 1 sentinel so you know where to stop.",
    tape: ["_", "_", "_", "1"],
    target: ["1", "1", "1", "1"],
    headStart: 0,
    states: ["A", "HALT"],
    symbols: ["0", "1", "_"],
  },
  {
    id: "binary-increment",
    zh: {
      name: "二进制加一",
      description: "把二进制数加 1：101（5）应变成 110（6）。提示：先扫到末尾，再从右向左进位。",
    },
    name: "Binary +1",
    description:
      "Increment a binary number by 1. The number 101 (5) should become 110 (6). " +
      "Hint: scan to the end, then carry from right to left.",
    tape: ["1", "0", "1", "_"],
    target: ["1", "1", "0"],
    headStart: 0,
    states: ["A", "B", "HALT"],
    symbols: ["0", "1", "_"],
  },
]

/**
 * Resolves a `?level=` query value to a level, for deep-linking to a puzzle.
 *
 * The value is a 1-based index into `levels`, matching the order they appear
 * in the nav (`?level=2` for Flip It) rather than the level's `id`, so a
 * link survives a level being renamed. Nothing here is locked or gated by
 * progress -- every level is reachable from the nav regardless of what's
 * been solved -- so a missing, non-numeric, or out-of-range value just
 * falls back to `null` and the caller opens the default first level.
 *
 * @param {string | null} rawValue - Result of `URLSearchParams.get("level")`.
 * @returns {object | null} The matching level, or null.
 */
export function levelFromParam(rawValue) {
  if (rawValue === null) return null
  const index = Number(rawValue)
  if (!Number.isInteger(index) || index < 1 || index > levels.length) return null
  return levels[index - 1]
}
