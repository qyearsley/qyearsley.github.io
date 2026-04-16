const MAX_STEPS = 500

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
      if (this.head >= this.tape.length) this.tape.push("_")
    } else if (rule.move === "L") {
      if (this.head === 0) {
        this.tape.unshift("_")
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

  /** Check if current tape matches target (ignoring trailing blanks). */
  matchesTape(target) {
    const trim = (t) => {
      const arr = [...t]
      while (arr.length > 0 && arr[arr.length - 1] === "_") arr.pop()
      while (arr.length > 0 && arr[0] === "_") arr.shift()
      return arr
    }
    const a = trim(this.tape)
    const b = trim(target)
    return a.length === b.length && a.every((v, i) => v === b[i])
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
