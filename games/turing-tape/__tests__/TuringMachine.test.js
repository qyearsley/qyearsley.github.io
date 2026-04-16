import { TuringMachine } from "../js/TuringMachine.js"

/** Helper: build a rules Map from an array of [state, read, write, move, nextState] */
function makeRules(entries) {
  const map = new Map()
  for (const [state, read, write, move, nextState] of entries) {
    map.set(`${state},${read}`, { write, move, nextState })
  }
  return map
}

describe("TuringMachine", () => {
  describe("constructor and reset", () => {
    test("initializes with given tape, state, and head", () => {
      const tm = new TuringMachine(["0", "1"], new Map(), "A", 0)
      expect(tm.tape).toEqual(["0", "1"])
      expect(tm.state).toBe("A")
      expect(tm.head).toBe(0)
      expect(tm.halted).toBe(false)
      expect(tm.stepCount).toBe(0)
    })

    test("reset restores initial state", () => {
      const rules = makeRules([["A", "0", "1", "R", "HALT"]])
      const tm = new TuringMachine(["0"], rules, "A", 0)
      tm.step()
      expect(tm.halted).toBe(true)
      expect(tm.tape).toEqual(["1"])

      tm.reset()
      expect(tm.tape).toEqual(["0"])
      expect(tm.state).toBe("A")
      expect(tm.head).toBe(0)
      expect(tm.halted).toBe(false)
      expect(tm.stepCount).toBe(0)
    })

    test("reset does not share reference with initial tape", () => {
      const tm = new TuringMachine(["0", "1"], new Map(), "A", 0)
      tm.tape[0] = "X"
      tm.reset()
      expect(tm.tape).toEqual(["0", "1"])
    })
  })

  describe("step", () => {
    test("writes, moves right, and transitions state", () => {
      const rules = makeRules([["A", "0", "1", "R", "B"]])
      const tm = new TuringMachine(["0", "0"], rules, "A", 0)

      const result = tm.step()

      expect(result.tape).toEqual(["1", "0"])
      expect(result.head).toBe(1)
      expect(result.state).toBe("B")
      expect(result.halted).toBe(false)
      expect(result.stepCount).toBe(1)
    })

    test("moves left correctly", () => {
      const rules = makeRules([["A", "0", "1", "L", "B"]])
      const tm = new TuringMachine(["0", "0"], rules, "A", 1)
      const result = tm.step()

      expect(result.tape).toEqual(["0", "1"])
      expect(result.head).toBe(0)
    })

    test("stay move keeps head in place", () => {
      const rules = makeRules([["A", "0", "1", "S", "HALT"]])
      const tm = new TuringMachine(["0"], rules, "A", 0)
      const result = tm.step()

      expect(result.tape).toEqual(["1"])
      expect(result.head).toBe(0)
    })

    test("halts on HALT state", () => {
      const rules = makeRules([["A", "0", "1", "S", "HALT"]])
      const tm = new TuringMachine(["0"], rules, "A", 0)
      const result = tm.step()

      expect(result.halted).toBe(true)
      expect(result.haltReason).toBe("halt-state")
    })

    test("halts when no matching rule", () => {
      const tm = new TuringMachine(["0"], new Map(), "A", 0)
      const result = tm.step()

      expect(result.halted).toBe(true)
      expect(result.haltReason).toBe("no-rule")
    })

    test("does nothing after halt", () => {
      const rules = makeRules([["A", "0", "1", "S", "HALT"]])
      const tm = new TuringMachine(["0"], rules, "A", 0)
      tm.step()
      const result = tm.step()

      expect(result.halted).toBe(true)
      expect(result.stepCount).toBe(1)
    })

    test("extends tape when moving right past end", () => {
      const rules = makeRules([["A", "0", "0", "R", "A"]])
      const tm = new TuringMachine(["0"], rules, "A", 0)
      tm.step()

      expect(tm.tape).toEqual(["0", "_"])
      expect(tm.head).toBe(1)
    })

    test("extends tape when moving left past start", () => {
      const rules = makeRules([["A", "0", "0", "L", "B"]])
      const tm = new TuringMachine(["0"], rules, "A", 0)
      tm.step()

      expect(tm.tape).toEqual(["_", "0"])
      expect(tm.head).toBe(0)
    })
  })

  describe("run", () => {
    test("runs until halt", () => {
      // Write 1 to each cell, move right, halt on blank
      const rules = makeRules([
        ["A", "0", "1", "R", "A"],
        ["A", "_", "_", "S", "HALT"],
      ])
      const tm = new TuringMachine(["0", "0", "0", "_"], rules, "A", 0)
      const result = tm.run()

      expect(result.tape).toEqual(["1", "1", "1", "_"])
      expect(result.halted).toBe(true)
      expect(result.haltReason).toBe("halt-state")
      expect(result.stepCount).toBe(4)
    })

    test("stops at max steps to prevent infinite loop", () => {
      // Infinite loop: always move right
      const rules = makeRules([["A", "_", "_", "R", "A"]])
      const tm = new TuringMachine(["_"], rules, "A", 0)
      const result = tm.run()

      expect(result.halted).toBe(true)
      expect(result.haltReason).toBe("max-steps")
      expect(result.stepCount).toBe(500)
    })
  })

  describe("matchesTape", () => {
    test("matches identical tapes", () => {
      const tm = new TuringMachine(["1", "0", "1"], new Map())
      expect(tm.matchesTape(["1", "0", "1"])).toBe(true)
    })

    test("ignores trailing blanks", () => {
      const tm = new TuringMachine(["1", "0", "_", "_"], new Map())
      expect(tm.matchesTape(["1", "0"])).toBe(true)
    })

    test("ignores leading blanks", () => {
      const tm = new TuringMachine(["_", "1", "0"], new Map())
      expect(tm.matchesTape(["1", "0"])).toBe(true)
    })

    test("rejects different tapes", () => {
      const tm = new TuringMachine(["1", "0"], new Map())
      expect(tm.matchesTape(["0", "1"])).toBe(false)
    })

    test("rejects tapes of different length", () => {
      const tm = new TuringMachine(["1"], new Map())
      expect(tm.matchesTape(["1", "0"])).toBe(false)
    })
  })

  describe("level solutions", () => {
    test("Level 1: Write One", () => {
      const rules = makeRules([["A", "_", "1", "S", "HALT"]])
      const tm = new TuringMachine(["_"], rules, "A", 0)
      tm.run()
      expect(tm.matchesTape(["1"])).toBe(true)
      expect(tm.haltReason).toBe("halt-state")
    })

    test("Level 2: Flip It", () => {
      const rules = makeRules([
        ["A", "1", "0", "R", "A"],
        ["A", "0", "1", "R", "A"],
        ["A", "_", "_", "S", "HALT"],
      ])
      const tm = new TuringMachine(["1", "0", "1", "_"], rules, "A", 0)
      tm.run()
      expect(tm.matchesTape(["0", "1", "0"])).toBe(true)
    })

    test("Level 3: Move Right", () => {
      const rules = makeRules([
        ["A", "1", "_", "R", "B"],
        ["B", "_", "1", "S", "HALT"],
      ])
      const tm = new TuringMachine(["1", "_"], rules, "A", 0)
      tm.run()
      expect(tm.matchesTape(["_", "1"])).toBe(true)
    })

    test("Level 4: Fill", () => {
      const rules = makeRules([
        ["A", "_", "1", "R", "A"],
        ["A", "1", "1", "S", "HALT"],
      ])
      // The tape has a sentinel 1 at the end so we know when to stop
      const tm = new TuringMachine(["_", "_", "_", "1"], rules, "A", 0)
      tm.run()
      expect(tm.matchesTape(["1", "1", "1", "1"])).toBe(true)
    })

    test("Level 5: Binary +1 (101 -> 110)", () => {
      // Scan right to end, then carry from right
      const rules = makeRules([
        ["A", "0", "0", "R", "A"],
        ["A", "1", "1", "R", "A"],
        ["A", "_", "_", "L", "B"],
        ["B", "1", "0", "L", "B"],
        ["B", "0", "1", "S", "HALT"],
        ["B", "_", "1", "S", "HALT"],
      ])
      const tm = new TuringMachine(["1", "0", "1", "_"], rules, "A", 0)
      tm.run()
      expect(tm.matchesTape(["1", "1", "0"])).toBe(true)
    })
  })

  describe("demo programs", () => {
    test("Busy Beaver (3-state) writes 6 ones", () => {
      const rules = makeRules([
        ["A", "_", "1", "R", "B"],
        ["A", "1", "1", "L", "C"],
        ["B", "_", "1", "L", "A"],
        ["B", "1", "1", "R", "B"],
        ["C", "_", "1", "L", "B"],
        ["C", "1", "1", "S", "HALT"],
      ])
      const tm = new TuringMachine(
        ["_", "_", "_", "_", "_", "_", "_", "_", "_"],
        rules,
        "A",
        4,
      )
      tm.run()
      expect(tm.haltReason).toBe("halt-state")
      const ones = tm.tape.filter((c) => c === "1").length
      expect(ones).toBe(6)
    })

    test("Unary Addition: 111+11 = 11111", () => {
      const rules = makeRules([
        ["A", "1", "1", "R", "A"],
        ["A", "0", "1", "R", "B"],
        ["B", "1", "1", "R", "B"],
        ["B", "_", "_", "L", "C"],
        ["C", "1", "_", "S", "HALT"],
      ])
      const tm = new TuringMachine(["1", "1", "1", "0", "1", "1", "_"], rules, "A", 0)
      tm.run()
      expect(tm.haltReason).toBe("halt-state")
      expect(tm.matchesTape(["1", "1", "1", "1", "1"])).toBe(true)
    })

    test("Palindrome Check accepts 1001", () => {
      const rules = makeRules([
        ["A", "1", "_", "R", "B"],
        ["A", "0", "_", "R", "C"],
        ["A", "_", "_", "S", "Y"],
        ["B", "1", "1", "R", "B"],
        ["B", "0", "0", "R", "B"],
        ["B", "_", "_", "L", "D"],
        ["D", "1", "_", "L", "E"],
        ["D", "0", "0", "S", "N"],
        ["D", "_", "_", "S", "Y"],
        ["C", "1", "1", "R", "C"],
        ["C", "0", "0", "R", "C"],
        ["C", "_", "_", "L", "F"],
        ["F", "0", "_", "L", "E"],
        ["F", "1", "1", "S", "N"],
        ["F", "_", "_", "S", "Y"],
        ["E", "1", "1", "L", "E"],
        ["E", "0", "0", "L", "E"],
        ["E", "_", "_", "R", "A"],
      ])
      const tm = new TuringMachine(["1", "0", "0", "1", "_"], rules, "A", 0)
      tm.run()
      expect(tm.halted).toBe(true)
      expect(tm.state).toBe("Y")
    })

    test("Palindrome Check rejects 1010", () => {
      const rules = makeRules([
        ["A", "1", "_", "R", "B"],
        ["A", "0", "_", "R", "C"],
        ["A", "_", "_", "S", "Y"],
        ["B", "1", "1", "R", "B"],
        ["B", "0", "0", "R", "B"],
        ["B", "_", "_", "L", "D"],
        ["D", "1", "_", "L", "E"],
        ["D", "0", "0", "S", "N"],
        ["D", "_", "_", "S", "Y"],
        ["C", "1", "1", "R", "C"],
        ["C", "0", "0", "R", "C"],
        ["C", "_", "_", "L", "F"],
        ["F", "0", "_", "L", "E"],
        ["F", "1", "1", "S", "N"],
        ["F", "_", "_", "S", "Y"],
        ["E", "1", "1", "L", "E"],
        ["E", "0", "0", "L", "E"],
        ["E", "_", "_", "R", "A"],
      ])
      const tm = new TuringMachine(["1", "0", "1", "0", "_"], rules, "A", 0)
      tm.run()
      expect(tm.halted).toBe(true)
      expect(tm.state).toBe("N")
    })
  })

  describe("snapshot immutability", () => {
    test("snapshot tape is a copy", () => {
      const tm = new TuringMachine(["0"], new Map(), "A", 0)
      const snap = tm.step()
      snap.tape[0] = "X"
      expect(tm.tape).toEqual(["0"])
    })
  })
})
