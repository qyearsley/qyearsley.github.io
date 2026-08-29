const MAX_STEPS = 500
const BLANK = "_"

/**
 * Index range [start, end) of a tape with leading and trailing blanks removed.
 * Both `matchesTape` and `matchMask` align on this range so they can't disagree
 * about whether a tape matches its goal.
 *
 * @param {string[]|string} tape
 * @returns {{start: number, end: number}}
 */
function contentRange(tape) {
  let start = 0
  let end = tape.length
  while (end > start && tape[end - 1] === BLANK) end--
  while (start < end && tape[start] === BLANK) start++
  return { start, end }
}

export class TuringMachine {
  /**
   * @param {string[]} tape - Initial tape symbols
   * @param {Map<string, {write: string, move: string, nextState: string}>} rules
   * @param {string} startState
   * @param {number} headPos
   */
  constructor(tape, rules, startState = "A", headPos = 0) {
    this._initialTape = [...tape]
    this._initialState = startState
    this._initialHead = headPos
    this.rules = rules
    this.reset()
  }

  reset() {
    this.tape = [...this._initialTape]
    this.state = this._initialState
    this.head = this._initialHead
    this.halted = false
    this.haltReason = null
    this.stepCount = 0
  }

  /** Run one step. Returns a snapshot of the result. */
  step() {
    if (this.halted) return this._snapshot()

    const key = `${this.state},${this.tape[this.head]}`
    const rule = this.rules.get(key)

    if (!rule) {
      this.halted = true
      this.haltReason = "no-rule"
      return this._snapshot()
    }

    // Write
    this.tape[this.head] = rule.write

    // Transition
    this.state = rule.nextState
    if (this.state === "HALT") {
      this.halted = true
      this.haltReason = "halt-state"
      this.stepCount++
      return this._snapshot()
    }

    // Move
    if (rule.move === "R") {
      this.head++
      if (this.head >= this.tape.length) this.tape.push(BLANK)
    } else if (rule.move === "L") {
      if (this.head === 0) {
        this.tape.unshift(BLANK)
        // head stays at 0 (new blank inserted before it)
      } else {
        this.head--
      }
    }
    // move === "S" (stay) does nothing

    this.stepCount++

    if (this.stepCount >= MAX_STEPS) {
      this.halted = true
      this.haltReason = "max-steps"
    }

    return this._snapshot()
  }

  /** Run until halted. Returns final snapshot. */
  run() {
    while (!this.halted) this.step()
    return this._snapshot()
  }

  /** Check if current tape matches target (ignoring leading and trailing blanks). */
  matchesTape(target) {
    const a = contentRange(this.tape)
    const b = contentRange(target)
    const length = a.end - a.start
    if (length !== b.end - b.start) return false
    for (let i = 0; i < length; i++) {
      if (this.tape[a.start + i] !== target[b.start + i]) return false
    }
    return true
  }

  /**
   * Per-cell match report for the current tape, aligned the same way
   * `matchesTape` aligns: leading and trailing blanks are trimmed off both
   * sides, then the remaining content is compared position by position.
   *
   * Returns one boolean per cell of `this.tape`, so callers can colour cells
   * without re-deriving the alignment (and without contradicting the win
   * message, which is what happens when the two use different rules).
   *
   * Trimmed-off blanks report `true`. They are padding that `matchesTape`
   * ignores, so they can never be the reason a tape is wrong; marking them as
   * mismatches would paint a red cell on a solved puzzle. This matters in
   * practice because `step()` prepends a blank whenever the head moves left
   * from position 0.
   *
   * Content past the end of the goal reports `false` -- there is no target
   * symbol for it, so it is extra. A tape that is *shorter* than the goal has
   * no cell to mark, so every entry can be `true` while `matchesTape` is
   * false; the result message is what reports the missing symbols.
   *
   * @param {string[]|string} target
   * @returns {boolean[]}
   */
  matchMask(target) {
    const a = contentRange(this.tape)
    const b = contentRange(target)
    const targetLength = b.end - b.start
    return this.tape.map((symbol, i) => {
      if (i < a.start || i >= a.end) return true
      const t = i - a.start
      if (t >= targetLength) return false
      return symbol === target[b.start + t]
    })
  }

  _snapshot() {
    return {
      tape: [...this.tape],
      head: this.head,
      state: this.state,
      halted: this.halted,
      haltReason: this.haltReason,
      stepCount: this.stepCount,
    }
  }
}
