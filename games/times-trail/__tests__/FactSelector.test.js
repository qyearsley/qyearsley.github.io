import { describe, test, expect } from "@jest/globals"

import { DAY_MS, SELECTION } from "../js/constants.js"
import { FactSelector } from "../js/FactSelector.js"

/** A fixed epoch-ms instant. No fake timers anywhere: every clock is explicit. */
const NOW = 1700000000000

/** The injected clock every test uses. */
const fixedNow = () => NOW

/**
 * An rng that returns `values` in order and throws once exhausted, so an
 * unexpected extra call fails loudly instead of quietly reusing a value. The
 * returned function carries a mutable `calls` counter, which is how the tests
 * assert the documented "0 calls for a queue hit, 2 for a normal selection".
 * @param {number[]} values - Values to return, in order
 * @returns {(() => number) & {calls: number}} The scripted rng
 */
function scriptedRng(values) {
  const rng = () => {
    if (rng.calls >= values.length) throw new Error("rng exhausted")
    const value = values[rng.calls]
    rng.calls += 1
    return value
  }
  rng.calls = 0
  return rng
}

/**
 * An rng that cycles through `values` forever, for tests that need many
 * selections and do not care about the exact sequence.
 * @param {number[]} values - Values to cycle
 * @returns {() => number} The cycling rng
 */
function cyclingRng(values) {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

/**
 * A tiny deterministic PRNG (a 32-bit LCG), for tests that need a realistic
 * SPREAD of values rather than a scripted sequence. `cyclingRng` repeats a short
 * cycle, which makes the weighted draw land in the same place every time and so
 * cannot sample a distribution at all.
 * @param {number} seed - Any integer; the same seed always gives the same stream
 * @returns {() => number} Values in [0, 1)
 */
function seededRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Build a record map from a terse spec. Defaults produce a record that is NOT
 * due (dueAt one day out) and has been answered before, so `decayedStrength`
 * returns the stored strength and bucket membership is easy to read. Pass
 * `dueAt: NOW - 1` to make a fact due.
 * @param {Object<string, Object>} spec - factId -> field overrides
 * @returns {Object<string, Object>} A record map
 */
function recordsFrom(spec) {
  /** @type {Object<string, Object>} */
  const records = {}
  for (const [factId, fields] of Object.entries(spec)) {
    records[factId] = {
      strength: 0,
      totalSeen: 5,
      totalCorrect: 5,
      lastSeen: NOW - DAY_MS,
      lastMs: 1200,
      dueAt: NOW + DAY_MS,
      ...fields,
    }
  }
  return records
}

/**
 * The six-fact pool the retry traces use. "6x7" has no record at all, so it is
 * brand new and therefore the only member of the weak bucket; the other five are
 * strength 5 and not due, so they are the whole strong bucket. That lets a
 * scripted rng steer a selection to "6x7" (bucket roll below WEAK_RATIO) or away
 * from it (bucket roll at or above WEAK_RATIO) without any weight arithmetic.
 */
const TRACE_POOL = ["6x7", "2x3", "3x4", "4x5", "5x6", "8x9"]

/** Records for TRACE_POOL: everything except "6x7" is strong. */
const TRACE_RECORDS = recordsFrom({
  "2x3": { strength: 5 },
  "3x4": { strength: 5 },
  "4x5": { strength: 5 },
  "5x6": { strength: 5 },
  "8x9": { strength: 5 },
})

/** A pool with two weak facts and two strong ones, in a known order. */
const MIXED_POOL = ["6x7", "2x3", "3x4", "4x5"]

/**
 * Records for MIXED_POOL. "6x7" is absent (brand new, so due and weak), "2x3" is
 * strength 0 but not due (weak by strength), "3x4" and "4x5" are strong.
 */
const MIXED_RECORDS = recordsFrom({
  "2x3": { strength: 0 },
  "3x4": { strength: 5 },
  "4x5": { strength: 4 },
})

describe("FactSelector", () => {
  describe("selectNext", () => {
    test("returns null for anything that is not a non-empty array, consuming no rng", () => {
      const rng = scriptedRng([])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext([], {})).toBeNull()
      expect(selector.selectNext(null, {})).toBeNull()
      expect(selector.selectNext(undefined, {})).toBeNull()
      expect(selector.selectNext("6x7", {})).toBeNull()
      expect(selector.selectNext({}, {})).toBeNull()

      expect(rng.calls).toBe(0)
      expect(selector.questionIndex).toBe(0)
      expect(selector.lastFactId).toBeNull()
    })

    test("a single-fact pool serves that fact every time; the repeat is unavoidable", () => {
      const rng = scriptedRng([0.1, 0, 0.9, 0.5])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(["6x7"], {})).toBe("6x7")
      expect(rng.calls).toBe(2)
      expect(selector.selectNext(["6x7"], {})).toBe("6x7")
      expect(rng.calls).toBe(4)
      expect(selector.questionIndex).toBe(2)
      expect(selector.lastFactId).toBe("6x7")
    })

    test("a low bucket roll draws from the weak bucket", () => {
      const rng = scriptedRng([0.1, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(MIXED_POOL, MIXED_RECORDS)).toBe("6x7")
      expect(rng.calls).toBe(2)
    })

    test("a high bucket roll draws from the strong bucket", () => {
      const rng = scriptedRng([0.9, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(MIXED_POOL, MIXED_RECORDS)).toBe("3x4")
      expect(rng.calls).toBe(2)
    })

    test("the WEAK_RATIO boundary is exclusive: 0.6999 is weak, 0.7 is strong", () => {
      const weakSide = new FactSelector({ rng: scriptedRng([0.6999, 0]), now: fixedNow })
      const strongSide = new FactSelector({ rng: scriptedRng([0.7, 0]), now: fixedNow })

      expect(SELECTION.WEAK_RATIO).toBe(0.7)
      expect(weakSide.selectNext(MIXED_POOL, MIXED_RECORDS)).toBe("6x7")
      expect(strongSide.selectNext(MIXED_POOL, MIXED_RECORDS)).toBe("3x4")
    })

    test("an empty weak bucket falls back to strong and still costs two rng calls", () => {
      const pool = ["2x3", "3x4", "4x5"]
      const records = recordsFrom({
        "2x3": { strength: 5 },
        "3x4": { strength: 5 },
        "4x5": { strength: 5 },
      })
      const rng = scriptedRng([0.1, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(pool, records)).toBe("2x3")
      expect(rng.calls).toBe(2)
    })

    test("an empty strong bucket falls back to weak and still costs two rng calls", () => {
      const pool = ["2x3", "3x4", "4x5"]
      const rng = scriptedRng([0.9, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(pool, {})).toBe("2x3")
      expect(rng.calls).toBe(2)
    })

    test("weighted position inside the weak bucket walks the cumulative weights", () => {
      // Weights 8, 4, 4 (all three facts are due, so weight is (6 - s) * 2).
      // Cumulative boundaries land on 8/16 = 0.5 and 12/16 = 0.75, both exact in
      // binary, so the boundary assertions are not floating-point coin flips.
      const pool = ["2x3", "3x4", "4x5"]
      const records = recordsFrom({
        "2x3": { strength: 2, dueAt: NOW - 1 },
        "3x4": { strength: 4, dueAt: NOW - 1 },
        "4x5": { strength: 4, dueAt: NOW - 1 },
      })
      const pick = (position) =>
        new FactSelector({ rng: scriptedRng([0, position]), now: fixedNow }).selectNext(
          pool,
          records,
        )

      expect(pick(0)).toBe("2x3")
      expect(pick(0.49)).toBe("2x3")
      expect(pick(0.5)).toBe("3x4")
      expect(pick(0.74)).toBe("3x4")
      expect(pick(0.75)).toBe("4x5")
      expect(pick(0.9999)).toBe("4x5")
    })

    test("weighted position inside the strong bucket walks the cumulative weights", () => {
      // Weights 3, 2, 1 (none due, so weight is 6 - s). Cumulative 3, 5, 6.
      const pool = ["2x3", "3x4", "4x5"]
      const records = recordsFrom({
        "2x3": { strength: 3 },
        "3x4": { strength: 4 },
        "4x5": { strength: 5 },
      })
      const pick = (position) =>
        new FactSelector({ rng: scriptedRng([0.9, position]), now: fixedNow }).selectNext(
          pool,
          records,
        )

      expect(pick(0)).toBe("2x3")
      expect(pick(0.49)).toBe("2x3")
      expect(pick(0.5)).toBe("3x4")
      expect(pick(0.83)).toBe("3x4")
      expect(pick(0.834)).toBe("4x5")
      expect(pick(0.9999)).toBe("4x5")
    })

    test("an rng of exactly 1 hits the floating-point guard and returns the last member", () => {
      const pool = ["2x3", "3x4", "4x5"]
      const records = recordsFrom({
        "2x3": { strength: 3 },
        "3x4": { strength: 4 },
        "4x5": { strength: 5 },
      })
      const selector = new FactSelector({ rng: () => 1, now: fixedNow })

      expect(selector.selectNext(pool, records)).toBe("4x5")
    })

    test("never serves the same fact twice in a row", () => {
      const selector = new FactSelector({
        rng: cyclingRng([0.1, 0.3, 0.9, 0.62, 0, 0.99, 0.45, 0.71]),
        now: fixedNow,
      })
      const pool = ["6x7", "2x3"]
      let previous = null

      for (let index = 0; index < 10; index += 1) {
        const factId = selector.selectNext(pool, {})
        expect(pool).toContain(factId)
        expect(factId).not.toBe(previous)
        previous = factId
      }
      expect(selector.questionIndex).toBe(10)
    })

    test("questionIndex increments once per served fact and lastFactId tracks the return", () => {
      const rng = scriptedRng([0.1, 0, 0.1, 0, 0.1, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.questionIndex).toBe(0)
      const first = selector.selectNext(MIXED_POOL, MIXED_RECORDS)
      expect(selector.questionIndex).toBe(1)
      expect(selector.lastFactId).toBe(first)
      const second = selector.selectNext(MIXED_POOL, MIXED_RECORDS)
      expect(selector.questionIndex).toBe(2)
      expect(selector.lastFactId).toBe(second)
      const third = selector.selectNext(MIXED_POOL, MIXED_RECORDS)
      expect(selector.questionIndex).toBe(3)
      expect(selector.lastFactId).toBe(third)
      expect(rng.calls).toBe(6)
    })

    test("a fact with no record is treated as brand new and lands in the weak bucket", () => {
      const pool = ["6x7", "2x3"]
      const records = recordsFrom({ "2x3": { strength: 5 } })
      const weakSide = new FactSelector({ rng: scriptedRng([0.1, 0]), now: fixedNow })
      const strongSide = new FactSelector({ rng: scriptedRng([0.9, 0]), now: fixedNow })

      expect(weakSide.selectNext(pool, records)).toBe("6x7")
      expect(strongSide.selectNext(pool, records)).toBe("2x3")
    })

    test("an empty records map makes every fact new, so the weak bucket holds the pool", () => {
      const pool = ["6x7", "2x3", "3x4", "4x5"]

      // Every fact is fresh: weight 12 each, total 48, boundaries at 0.25 / 0.5 / 0.75.
      const pick = (bucketRoll, position) =>
        new FactSelector({ rng: scriptedRng([bucketRoll, position]), now: fixedNow }).selectNext(
          pool,
          {},
        )

      expect(pick(0.1, 0)).toBe("6x7")
      expect(pick(0.1, 0.25)).toBe("2x3")
      expect(pick(0.1, 0.5)).toBe("3x4")
      expect(pick(0.1, 0.75)).toBe("4x5")
      // A high roll asks for the strong bucket, which is empty on a first run, so
      // it falls back to weak rather than returning null.
      expect(pick(0.9, 0)).toBe("6x7")
    })

    test("records for facts outside the pool are ignored, never served", () => {
      const pool = ["2x3", "3x4"]
      const records = recordsFrom({
        "2x3": { strength: 5 },
        "3x4": { strength: 5 },
        // The most attractive record in the map, and not in the pool.
        "9x9": { strength: 0, dueAt: NOW - 1 },
        "8x8": { strength: 0, dueAt: NOW - 1 },
      })

      for (const roll of [0, 0.1, 0.5, 0.6999, 0.7, 0.9, 0.9999]) {
        const selector = new FactSelector({ rng: () => roll, now: fixedNow })
        for (let index = 0; index < 6; index += 1) {
          expect(pool).toContain(selector.selectNext(pool, records))
        }
      }
    })

    test("never returns a fact outside the pool for any rng value", () => {
      const rolls = [0, 0.0001, 0.1, 0.3, 0.5, 0.6999, 0.7, 0.9, 0.9999, 1]

      for (const roll of rolls) {
        const mixed = new FactSelector({ rng: () => roll, now: fixedNow })
        const fresh = new FactSelector({ rng: () => roll, now: fixedNow })
        for (let index = 0; index < 8; index += 1) {
          expect(MIXED_POOL).toContain(mixed.selectNext(MIXED_POOL, MIXED_RECORDS))
          expect(MIXED_POOL).toContain(fresh.selectNext(MIXED_POOL, {}))
        }
      }
    })

    test("a normal selection consumes exactly two rng calls", () => {
      const rng = scriptedRng([0.1, 0, 0.9, 0, 0.4, 0.8])
      const selector = new FactSelector({ rng, now: fixedNow })

      for (let index = 1; index <= 3; index += 1) {
        selector.selectNext(MIXED_POOL, MIXED_RECORDS)
        expect(rng.calls).toBe(index * 2)
      }
    })
  })

  describe("recordMiss", () => {
    test("maps the rng roll onto a delay of 3 or 4, clamped at the top", () => {
      const delayFor = (roll) =>
        new FactSelector({ rng: scriptedRng([roll]), now: fixedNow }).recordMiss("6x7")

      expect(delayFor(0)).toBe(3)
      expect(delayFor(0.49)).toBe(3)
      expect(delayFor(0.5)).toBe(4)
      expect(delayFor(0.99)).toBe(4)
      expect(delayFor(1)).toBe(SELECTION.RETRY_DELAY_MAX)
    })

    test("queues dueIndex = questionIndex + delay, counting the missed question", () => {
      const rng = scriptedRng([0.1, 0, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      const served = selector.selectNext(TRACE_POOL, TRACE_RECORDS)
      expect(served).toBe("6x7")
      expect(selector.questionIndex).toBe(1)

      expect(selector.recordMiss(served)).toBe(3)
      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 4 }])
    })

    test("consumes exactly one rng call", () => {
      const rng = scriptedRng([0, 0.9])
      const selector = new FactSelector({ rng, now: fixedNow })

      selector.recordMiss("6x7")
      expect(rng.calls).toBe(1)
      selector.recordMiss("2x3")
      expect(rng.calls).toBe(2)
    })

    test("a second miss on the same fact updates the entry instead of duplicating it", () => {
      const selector = new FactSelector({ rng: scriptedRng([0, 0.9]), now: fixedNow })

      expect(selector.recordMiss("6x7")).toBe(3)
      expect(selector.recordMiss("6x7")).toBe(4)
      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 4 }])
    })

    test("keeps the queue sorted ascending by dueIndex when misses arrive out of order", () => {
      const selector = new FactSelector({ rng: scriptedRng([0.9, 0]), now: fixedNow })

      selector.recordMiss("6x7") // delay 4 -> dueIndex 4
      selector.recordMiss("2x3") // delay 3 -> dueIndex 3

      expect(selector.peekRetryQueue()).toEqual([
        { factId: "2x3", dueIndex: 3 },
        { factId: "6x7", dueIndex: 4 },
      ])
    })
  })

  describe("recordMiss and selectNext together", () => {
    test("missed as question 1 with delay 3, re-asked as question 5, 3 in between", () => {
      // The normative trace from the spec, asserted verbatim.
      //   q1 (index 0): normal selection serves 6x7        -> index 1
      //   miss: delay 3, dueIndex = 1 + 3 = 4
      //   q2 (index 1), q3 (index 2), q4 (index 3): 4 <= index is false
      //   q5 (index 4): 4 <= 4 is true -> queue hit, zero rng calls
      const rng = scriptedRng([0.1, 0, 0, 0.9, 0, 0.9, 0, 0.9, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
      expect(rng.calls).toBe(2)

      expect(selector.recordMiss("6x7")).toBe(3)
      expect(rng.calls).toBe(3)
      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 4 }])

      for (const expectedCalls of [5, 7, 9]) {
        expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).not.toBe("6x7")
        expect(rng.calls).toBe(expectedCalls)
      }
      expect(selector.questionIndex).toBe(4)

      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
      expect(rng.calls).toBe(9)
      expect(selector.questionIndex).toBe(5)
      expect(selector.peekRetryQueue()).toEqual([])
    })

    test("missed as question 1 with delay 4, re-asked as question 6, 4 in between", () => {
      const rng = scriptedRng([0.1, 0, 0.9, 0.9, 0, 0.9, 0, 0.9, 0, 0.9, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
      expect(selector.recordMiss("6x7")).toBe(4)
      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 5 }])

      for (const expectedCalls of [5, 7, 9, 11]) {
        expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).not.toBe("6x7")
        expect(rng.calls).toBe(expectedCalls)
      }
      expect(selector.questionIndex).toBe(5)

      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
      expect(rng.calls).toBe(11)
      expect(selector.questionIndex).toBe(6)
      expect(selector.peekRetryQueue()).toEqual([])
    })

    test("a queued fact that is the last-served fact is deferred one question", () => {
      // q4 happens to serve 6x7 by normal selection, so when its dueIndex
      // arrives at q5 it would be an immediate repeat. It stays queued and fires
      // at q6 instead.
      const rng = scriptedRng([0.1, 0, 0, 0.9, 0, 0.9, 0, 0.1, 0, 0.9, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7") // q1
      expect(selector.recordMiss("6x7")).toBe(3) // dueIndex 4
      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).not.toBe("6x7") // q2
      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).not.toBe("6x7") // q3
      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7") // q4, normal
      expect(selector.lastFactId).toBe("6x7")
      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 4 }])

      // q5: due, but it would repeat, so normal selection runs and the entry stays.
      const deferred = selector.selectNext(TRACE_POOL, TRACE_RECORDS)
      expect(deferred).not.toBe("6x7")
      expect(rng.calls).toBe(11)
      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 4 }])

      // q6: the entry is now overdue and fires, free of charge.
      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
      expect(rng.calls).toBe(11)
      expect(selector.peekRetryQueue()).toEqual([])
    })

    test("ties fire in insertion order, and an overdue entry still fires", () => {
      const pool = ["6x7", "2x3", "3x4", "4x5", "5x6", "8x9"]
      const records = recordsFrom({
        "4x5": { strength: 5 },
        "5x6": { strength: 5 },
        "8x9": { strength: 5 },
      })
      // All three misses are recorded at questionIndex 0, so all three share
      // dueIndex 3. The first fires at q4 (on time), the second at q5, the third
      // at q6 -- overdue by 2 and still served rather than skipped.
      const rng = scriptedRng([0, 0, 0, 0.9, 0, 0.9, 0, 0.9, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      selector.recordMiss("6x7")
      selector.recordMiss("2x3")
      selector.recordMiss("3x4")
      expect(selector.peekRetryQueue()).toEqual([
        { factId: "6x7", dueIndex: 3 },
        { factId: "2x3", dueIndex: 3 },
        { factId: "3x4", dueIndex: 3 },
      ])

      for (let index = 0; index < 3; index += 1) {
        expect(["4x5", "5x6", "8x9"]).toContain(selector.selectNext(pool, records))
      }
      expect(selector.questionIndex).toBe(3)
      expect(rng.calls).toBe(9)

      expect(selector.selectNext(pool, records)).toBe("6x7")
      expect(selector.selectNext(pool, records)).toBe("2x3")
      expect(selector.selectNext(pool, records)).toBe("3x4")
      expect(rng.calls).toBe(9)
      expect(selector.peekRetryQueue()).toEqual([])
    })

    test("a queued fact that has left the pool is dropped and normal selection runs", () => {
      const pool = ["2x3", "3x4", "4x5"]
      const rng = scriptedRng([0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      selector.recordMiss("6x7") // dueIndex 3, and 6x7 is not in this pool
      for (let index = 0; index < 3; index += 1) {
        expect(pool).toContain(selector.selectNext(pool, {}))
      }
      expect(selector.questionIndex).toBe(3)
      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 3 }])

      const callsBefore = rng.calls
      expect(pool).toContain(selector.selectNext(pool, {}))
      expect(rng.calls - callsBefore).toBe(2)
      expect(selector.peekRetryQueue()).toEqual([])
    })
  })

  describe("peekRetryQueue", () => {
    test("returns a copy that cannot be used to mutate the selector", () => {
      const selector = new FactSelector({ rng: scriptedRng([0]), now: fixedNow })
      selector.recordMiss("6x7")

      const snapshot = selector.peekRetryQueue()
      snapshot.push({ factId: "9x9", dueIndex: 1 })
      snapshot[0].dueIndex = 999

      expect(selector.peekRetryQueue()).toEqual([{ factId: "6x7", dueIndex: 3 }])
    })
  })

  describe("reset", () => {
    test("clears the question counter, the last fact, and the queue", () => {
      const rng = scriptedRng([0.1, 0, 0, 0.1, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
      selector.recordMiss("6x7")
      expect(selector.questionIndex).toBe(1)
      expect(selector.peekRetryQueue()).toHaveLength(1)

      selector.reset()

      expect(selector.questionIndex).toBe(0)
      expect(selector.lastFactId).toBeNull()
      expect(selector.peekRetryQueue()).toEqual([])
      // With no last-fact memory the previously-served fact may come straight back.
      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
    })

    test("a miss queued before reset never fires in the new session", () => {
      const rng = scriptedRng([0.1, 0, 0, 0.9, 0, 0.9, 0, 0.9, 0, 0.9, 0])
      const selector = new FactSelector({ rng, now: fixedNow })

      expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).toBe("6x7")
      selector.recordMiss("6x7") // dueIndex 4 in the OLD session
      selector.reset()

      // Four questions, every one forced to the strong bucket. If the stale entry
      // had survived, question 4 (index 4 on entry) would return "6x7" for zero
      // rng calls; instead every question costs the documented two.
      for (let index = 0; index < 4; index += 1) {
        const callsBefore = rng.calls
        expect(selector.selectNext(TRACE_POOL, TRACE_RECORDS)).not.toBe("6x7")
        expect(rng.calls - callsBefore).toBe(2)
      }
      expect(selector.questionIndex).toBe(4)
      expect(selector.peekRetryQueue()).toEqual([])
    })
  })

  describe("setPriorityFacts", () => {
    // The bias that ties selection to the trail. Without it selection ignored the
    // token's position, so the facts a gate was waiting on might not come up for
    // twenty questions and the trail stopped for no visible reason.
    const POOL = ["2x2", "2x3", "3x3", "6x7"]
    const EVEN = recordsFrom({ "2x2": {}, "2x3": {}, "3x3": {}, "6x7": {} })

    test("defaults to empty and reads back what was set", () => {
      const selector = new FactSelector({ now: fixedNow })
      expect(selector.priorityFactIds).toEqual([])
      selector.setPriorityFacts(["2x3", "3x3"])
      expect(selector.priorityFactIds.sort()).toEqual(["2x3", "3x3"])
    })

    test("replaces rather than merges, so a moved gate cannot leave a stale set", () => {
      const selector = new FactSelector({ now: fixedNow })
      selector.setPriorityFacts(["2x3"])
      selector.setPriorityFacts(["6x7"])
      expect(selector.priorityFactIds).toEqual(["6x7"])
    })

    test("junk clears the set instead of corrupting it", () => {
      const selector = new FactSelector({ now: fixedNow })
      for (const junk of [null, undefined, "2x3", 42, {}]) {
        selector.setPriorityFacts(["2x3"])
        selector.setPriorityFacts(junk)
        expect(selector.priorityFactIds).toEqual([])
      }
    })

    test("drops non-string entries and duplicates", () => {
      const selector = new FactSelector({ now: fixedNow })
      selector.setPriorityFacts(["2x3", "2x3", 7, null, "3x3"])
      expect(selector.priorityFactIds.sort()).toEqual(["2x3", "3x3"])
    })

    test("returns a copy, so mutating it cannot change the bias", () => {
      const selector = new FactSelector({ now: fixedNow })
      selector.setPriorityFacts(["2x3"])
      const ids = selector.priorityFactIds
      ids.push("9x9")
      expect(selector.priorityFactIds).toEqual(["2x3"])
    })

    // The whole point: it must not cost an extra rng call, because the "exactly
    // two per selection" contract is what every trace test in this file counts on.
    test("costs no extra rng call", () => {
      const rng = scriptedRng([0.1, 0, 0.9, 0, 0.4, 0.8])
      const selector = new FactSelector({ rng, now: fixedNow })
      selector.setPriorityFacts(["2x3", "3x3"])

      for (let index = 1; index <= 3; index += 1) {
        selector.selectNext(POOL, EVEN)
        expect(rng.calls).toBe(index * 2)
      }
    })

    test("a prioritized fact is drawn more often than an identical unprioritized one", () => {
      const draw = (priority) => {
        const selector = new FactSelector({ rng: seededRng(12345), now: fixedNow })
        selector.setPriorityFacts(priority)
        const counts = {}
        for (let index = 0; index < 400; index += 1) {
          const factId = selector.selectNext(POOL, EVEN)
          counts[factId] = (counts[factId] || 0) + 1
        }
        return counts
      }

      // Every fact has identical records, so any difference is the gate bonus.
      const without = draw([])
      const with3x3 = draw(["3x3"])
      expect(with3x3["3x3"] || 0).toBeGreaterThan(without["3x3"] || 0)
    })

    test("biases without excluding: everything in the pool is still reachable", () => {
      const selector = new FactSelector({ rng: seededRng(99), now: fixedNow })
      selector.setPriorityFacts(["3x3"])
      const seen = new Set()
      for (let index = 0; index < 500; index += 1) {
        seen.add(selector.selectNext(POOL, EVEN))
      }
      expect([...seen].sort()).toEqual([...POOL].sort())
    })

    test("a fact outside the pool is simply never drawn", () => {
      const selector = new FactSelector({ rng: seededRng(7), now: fixedNow })
      selector.setPriorityFacts(["9x9"])
      for (let index = 0; index < 50; index += 1) {
        expect(POOL).toContain(selector.selectNext(POOL, EVEN))
      }
    })

    // Derived from the trail and the records, both of which outlive a session.
    test("survives reset, so question 1 of a session is already biased", () => {
      const selector = new FactSelector({ now: fixedNow })
      selector.setPriorityFacts(["2x3"])
      selector.reset()
      expect(selector.priorityFactIds).toEqual(["2x3"])
    })
  })
})
