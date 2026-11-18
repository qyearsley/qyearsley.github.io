// Text that game.js writes into the page. The build only translates static
// HTML, so the Chinese page (`<html lang="zh">`) reads its text from here.
const zh = {
  back: "返回游戏",
  solved: "（已解决）",
  next: "下一关 →",
  pause: "暂停",
  removeRule: "删除规则",
  fields: ["当前状态", "读取符号", "写入符号", "移动方向", "下一状态"],
  solvedIn: (n) => `用 ${n} 步解决！`,
  noHalt: (n) => `运行了 ${n} 步仍未停机。试试别的规则。`,
  noRule: (state, symbol) =>
    `状态 ${state} 读到“${symbol}”时没有规则。请添加一条，或修改已有规则。`,
  mismatch: "纸带与目标不一致。请重置后再试。",
}

const en = {
  back: "Back to games",
  solved: " (solved)",
  next: "Next puzzle →",
  pause: "Pause",
  removeRule: "Remove rule",
  fields: ["Current state", "Read symbol", "Write symbol", "Move direction", "Next state"],
  solvedIn: (n) => `Solved in ${n} steps!`,
  noHalt: (n) => `Ran for ${n} steps without halting. Try different rules.`,
  noRule: (state, symbol) =>
    `No rule for state ${state} reading "${symbol}". Add one, or fix an existing rule.`,
  mismatch: "Tape doesn't match the goal. Reset and try again.",
}

/** The strings for the page's language, and a level's name and description. */
export function strings(doc = document) {
  const isZh = doc.documentElement.lang.startsWith("zh")
  return { s: isZh ? zh : en, text: (level) => (isZh ? { ...level, ...level.zh } : level) }
}
