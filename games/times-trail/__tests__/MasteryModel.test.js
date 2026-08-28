import { describe, test, expect } from "@jest/globals"

import {
  DAY_MS,
  DECAY,
  MINUTE_MS,
  RESPONSE_TIME,
  SELECTION,
  STRENGTH,
  STRENGTH_INTERVALS_MS,
  TRAIL,
} from "../js/constants.js"
import {
  accuracy,
  cardTier,
  classifySpeed,
  countMastered,
  createRecord,
  decayedStrength,
  dueAtFor,
  intervalMsFor,
  isDue,
  isMastered,
  masteryTier,
  MasteryStore,
  normalizeRecord,
  recordAnswer,
  selectionWeight,
} from "../js/MasteryModel.js"

/** A fixed epoch-ms instant. No fake timers anywhere: every clock is explicit. */
const NOW = 1700000000000

/** The six field names a record is allowed to have. */
const RECORD_KEYS = ["strength", "totalSeen", "totalCorrect", "lastSeen", "lastMs", "dueAt"]

/** All valid strengths, for matrix assertions. */
const ALL_STRENGTHS = [0, 1, 2, 3, 4, 5]

/**
 * Build a record at a given strength that is NOT overdue, so `decayedStrength`
 * returns the stored strength and band arithmetic is easy to read.
 * @param {number} strength - Stored strength
 * @param {Object} [overrides] - Fields to override
 * @returns {Object} A record
 */
function recordAt(strength, overrides = {}) {
  return {
    strength,
    totalSeen: 5,
    totalCorrect: 4,
    lastSeen: NOW - DAY_MS,
    lastMs: 1200,
    dueAt: NOW + DAY_MS,
    ...overrides,
  }
}

/**
 * Build a record that is overdue by a whole number of days.
 * @param {number} strength - Stored strength
 * @param {number} overdueDays - Days past dueAt
 * @param {number} [totalCorrect] - Correct count, which sets the decay floor
 * @returns {Object} A record
 */
function overdueRecord(strength, overdueDays, totalCorrect = 3) {
  return {
    strength,
    totalSeen: 3,
    totalCorrect,
    lastSeen: NOW - overdueDays * DAY_MS,
    lastMs: 1200,
    dueAt: NOW - overdueDays * DAY_MS,
  }
}

describe("MasteryModel", () => {
  describe("createRecord", () => {
    test("returns the documented defaults", () => {
      expect(createRecord()).toEqual({
        strength: 0,
        totalSeen: 0,
        totalCorrect: 0,
        lastSeen: null,
        lastMs: null,
        dueAt: null,
      })
    })

    test("has exactly the six documented keys", () => {
      expect(Object.keys(createRecord()).sort()).toEqual([...RECORD_KEYS].sort())
    })

    test("has no streak or avgMs field", () => {
      const record = createRecord()
      expect("streak" in record).toBe(false)
      expect("avgMs" in record).toBe(false)
    })

    test("returns a distinct object every call", () => {
      expect(createRecord()).not.toBe(createRecord())
    })
  })

  describe("normalizeRecord", () => {
    test("returns a default record for non-object input", () => {
      const expected = createRecord()
      expect(normalizeRecord(null)).toEqual(expected)
      expect(normalizeRecord(undefined)).toEqual(expected)
      expect(normalizeRecord(42)).toEqual(expected)
      expect(normalizeRecord("x")).toEqual(expected)
      expect(normalizeRecord([])).toEqual(expected)
      expect(normalizeRecord(true)).toEqual(expected)
      expect(normalizeRecord(() => 1)).toEqual(expected)
    })

    test("clamps and rounds strength", () => {
      expect(normalizeRecord({ strength: 9 }).strength).toBe(STRENGTH.MAX)
      expect(normalizeRecord({ strength: -3 }).strength).toBe(STRENGTH.MIN)
      expect(normalizeRecord({ strength: 3.6 }).strength).toBe(4)
      expect(normalizeRecord({ strength: 3.4 }).strength).toBe(3)
    })

    test("treats a non-finite strength as 0", () => {
      expect(normalizeRecord({ strength: "4" }).strength).toBe(0)
      expect(normalizeRecord({ strength: NaN }).strength).toBe(0)
      expect(normalizeRecord({ strength: Infinity }).strength).toBe(0)
      expect(normalizeRecord({ strength: null }).strength).toBe(0)
    })

    test("coerces counts to non-negative integers", () => {
      expect(normalizeRecord({ totalSeen: -4 }).totalSeen).toBe(0)
      expect(normalizeRecord({ totalSeen: 3.7 }).totalSeen).toBe(3)
      expect(normalizeRecord({ totalSeen: "many" }).totalSeen).toBe(0)
    })

    test("clamps totalCorrect to totalSeen", () => {
      expect(normalizeRecord({ totalCorrect: 10, totalSeen: 3 })).toMatchObject({
        totalSeen: 3,
        totalCorrect: 3,
      })
    })

    test("nulls unreadable timestamps", () => {
      expect(normalizeRecord({ lastSeen: "yesterday" }).lastSeen).toBeNull()
      expect(normalizeRecord({ dueAt: Infinity }).dueAt).toBeNull()
      expect(normalizeRecord({ dueAt: NaN }).dueAt).toBeNull()
      expect(normalizeRecord({ lastSeen: {} }).lastSeen).toBeNull()
    })

    test("keeps any finite timestamp, including a negative one", () => {
      // Documented behaviour: the rule is "finite number or null", so a
      // pre-1970 timestamp survives. It is harmless -- decay and isDue are
      // plain arithmetic -- and rejecting it would need a threshold nothing
      // else in the game agrees on.
      expect(normalizeRecord({ lastSeen: -1000, dueAt: -500 })).toMatchObject({
        lastSeen: -1000,
        dueAt: -500,
      })
    })

    test("requires lastMs to be positive and clamps it", () => {
      expect(normalizeRecord({ lastMs: 0 }).lastMs).toBeNull()
      expect(normalizeRecord({ lastMs: -20 }).lastMs).toBeNull()
      expect(normalizeRecord({ lastMs: "fast" }).lastMs).toBeNull()
      expect(normalizeRecord({ lastMs: 999999 }).lastMs).toBe(RESPONSE_TIME.MAX_RECORDED_MS)
      expect(normalizeRecord({ lastMs: 1200 }).lastMs).toBe(1200)
    })

    test("drops unknown keys", () => {
      const result = normalizeRecord({ foo: 1, strength: 2 })
      expect("foo" in result).toBe(false)
      expect(Object.keys(result).sort()).toEqual([...RECORD_KEYS].sort())
    })

    test("drops streak and avgMs from a legacy save", () => {
      const result = normalizeRecord({ strength: 3, streak: 4, avgMs: 2500 })
      expect("streak" in result).toBe(false)
      expect("avgMs" in result).toBe(false)
      expect(result).toEqual({
        strength: 3,
        totalSeen: 0,
        totalCorrect: 0,
        lastSeen: null,
        lastMs: null,
        dueAt: null,
      })
    })

    test("round-trips an already-valid record unchanged", () => {
      const valid = recordAt(4)
      const result = normalizeRecord(valid)
      expect(result).toEqual(valid)
      expect(result).not.toBe(valid)
      expect(normalizeRecord(result)).toEqual(result)
    })

    test("never throws on hostile input", () => {
      const hostile = [
        null,
        undefined,
        0,
        "",
        [],
        [1, 2],
        { strength: {} },
        { totalSeen: [] },
        { lastSeen: () => 1 },
        Object.create(null),
        { strength: -Infinity, totalCorrect: NaN, dueAt: "soon" },
      ]
      for (const raw of hostile) {
        expect(() => normalizeRecord(raw)).not.toThrow()
        expect(Object.keys(normalizeRecord(raw)).sort()).toEqual([...RECORD_KEYS].sort())
      }
    })
  })

  describe("classifySpeed", () => {
    test("returns unknown for unmeasured or nonsense input", () => {
      expect(classifySpeed(null)).toBe("unknown")
      expect(classifySpeed(undefined)).toBe("unknown")
      expect(classifySpeed(0)).toBe("unknown")
      expect(classifySpeed(-5)).toBe("unknown")
      expect(classifySpeed(NaN)).toBe("unknown")
      expect(classifySpeed(Infinity)).toBe("unknown")
      expect(classifySpeed("1200")).toBe("unknown")
    })

    test("classifies fluent thinking time", () => {
      expect(classifySpeed(1)).toBe("fluent")
      expect(classifySpeed(4999)).toBe("fluent")
      expect(classifySpeed(5000)).toBe("fluent")
    })

    test("classifies slow thinking time", () => {
      expect(classifySpeed(5001)).toBe("slow")
      expect(classifySpeed(7000)).toBe("slow")
      // Counting to 42 by sevens takes about ten seconds and is still "slow",
      // not "counting": a reliably correct answer has to be able to make
      // progress, and 9000 ms used to fall the wrong side of this line.
      expect(classifySpeed(10000)).toBe("slow")
      expect(classifySpeed(12000)).toBe("slow")
    })

    test("classifies counting", () => {
      expect(classifySpeed(12001)).toBe("counting")
      expect(classifySpeed(30000)).toBe("counting")
      expect(classifySpeed(600000)).toBe("counting")
    })

    test("boundaries come straight off RESPONSE_TIME", () => {
      expect(classifySpeed(RESPONSE_TIME.FLUENT_MS)).toBe("fluent")
      expect(classifySpeed(RESPONSE_TIME.FLUENT_MS + 1)).toBe("slow")
      expect(classifySpeed(RESPONSE_TIME.SLOW_MS)).toBe("slow")
      expect(classifySpeed(RESPONSE_TIME.SLOW_MS + 1)).toBe("counting")
    })
  })

  describe("intervalMsFor", () => {
    test("maps each strength to its Leitner interval", () => {
      expect(intervalMsFor(0)).toBe(0)
      expect(intervalMsFor(1)).toBe(10 * MINUTE_MS)
      expect(intervalMsFor(2)).toBe(DAY_MS)
      expect(intervalMsFor(3)).toBe(3 * DAY_MS)
      expect(intervalMsFor(4)).toBe(7 * DAY_MS)
      expect(intervalMsFor(5)).toBe(21 * DAY_MS)
    })

    test("clamps out-of-range strengths", () => {
      expect(intervalMsFor(7)).toBe(STRENGTH_INTERVALS_MS[STRENGTH.MAX])
      expect(intervalMsFor(-1)).toBe(STRENGTH_INTERVALS_MS[STRENGTH.MIN])
      expect(intervalMsFor(2.4)).toBe(STRENGTH_INTERVALS_MS[2])
    })

    test("treats a non-finite strength as the lowest box", () => {
      expect(intervalMsFor(NaN)).toBe(STRENGTH_INTERVALS_MS[STRENGTH.MIN])
      expect(intervalMsFor(undefined)).toBe(STRENGTH_INTERVALS_MS[STRENGTH.MIN])
    })
  })

  describe("dueAtFor", () => {
    test("adds the interval to now", () => {
      expect(dueAtFor(2, 1000)).toBe(1000 + DAY_MS)
      expect(dueAtFor(0, NOW)).toBe(NOW)
      expect(dueAtFor(5, NOW)).toBe(NOW + 21 * DAY_MS)
    })
  })

  describe("isDue", () => {
    test("a never-asked fact is always due", () => {
      expect(isDue(createRecord(), NOW)).toBe(true)
    })

    test("is inclusive at exactly dueAt", () => {
      expect(isDue(recordAt(3, { dueAt: NOW }), NOW)).toBe(true)
      expect(isDue(recordAt(3, { dueAt: NOW + 1 }), NOW)).toBe(false)
      expect(isDue(recordAt(3, { dueAt: NOW - 1 }), NOW)).toBe(true)
    })

    test("treats an unreadable dueAt as due", () => {
      expect(isDue({ strength: 3 }, NOW)).toBe(true)
      expect(isDue({ strength: 3, dueAt: "soon" }, NOW)).toBe(true)
      expect(isDue(null, NOW)).toBe(true)
    })
  })

  describe("decayedStrength", () => {
    test("returns the stored strength when the fact has no due date", () => {
      expect(decayedStrength({ ...createRecord(), strength: 4 }, NOW)).toBe(4)
    })

    test("returns the stored strength when not yet due", () => {
      expect(decayedStrength(recordAt(5), NOW)).toBe(5)
      expect(decayedStrength(recordAt(5, { dueAt: NOW }), NOW)).toBe(5)
    })

    test("does not decay below one full period overdue", () => {
      expect(decayedStrength(overdueRecord(5, 13), NOW)).toBe(5)
      expect(decayedStrength(overdueRecord(5, 0), NOW)).toBe(5)
    })

    test("loses one point per full DECAY.PERIOD_MS", () => {
      expect(decayedStrength(overdueRecord(5, 14), NOW)).toBe(4)
      expect(decayedStrength(overdueRecord(5, 29), NOW)).toBe(3)
      expect(decayedStrength(overdueRecord(5, 30), NOW)).toBe(3)
    })

    test("crossing the period boundary is exact", () => {
      const record = { ...createRecord(), strength: 5, totalCorrect: 3, totalSeen: 3, dueAt: NOW }
      expect(decayedStrength(record, NOW + DECAY.PERIOD_MS - 1)).toBe(5)
      expect(decayedStrength(record, NOW + DECAY.PERIOD_MS)).toBe(4)
      expect(decayedStrength(record, NOW + 2 * DECAY.PERIOD_MS - 1)).toBe(4)
      expect(decayedStrength(record, NOW + 2 * DECAY.PERIOD_MS)).toBe(3)
    })

    test("floors at FLOOR_SEEN for a fact ever answered correctly", () => {
      expect(decayedStrength(overdueRecord(5, 200, 5), NOW)).toBe(DECAY.FLOOR_SEEN)
    })

    test("floors at FLOOR_UNSEEN for a fact never answered correctly", () => {
      expect(decayedStrength(overdueRecord(5, 200, 0), NOW)).toBe(DECAY.FLOOR_UNSEEN)
    })

    test("never returns more than the stored strength", () => {
      for (const strength of ALL_STRENGTHS) {
        for (const overdueDays of [0, 1, 13, 14, 29, 60, 200]) {
          for (const totalCorrect of [0, 3]) {
            const record = overdueRecord(strength, overdueDays, totalCorrect)
            const decayed = decayedStrength(record, NOW)
            expect(decayed).toBeLessThanOrEqual(strength)
            expect(decayed).toBeGreaterThanOrEqual(STRENGTH.MIN)
          }
        }
      }
    })

    test("returns the lowest box for junk input", () => {
      expect(decayedStrength(null, NOW)).toBe(STRENGTH.MIN)
      expect(decayedStrength("x", NOW)).toBe(STRENGTH.MIN)
    })
  })

  describe("recordAnswer", () => {
    test("throws TypeError when now is missing or not finite", () => {
      expect(() => recordAnswer(createRecord(), { correct: true })).toThrow(TypeError)
      expect(() => recordAnswer(createRecord(), { correct: true, now: NaN })).toThrow(
        "recordAnswer requires a finite now timestamp",
      )
      expect(() => recordAnswer(createRecord(), { correct: true, now: "now" })).toThrow(TypeError)
      expect(() => recordAnswer(createRecord())).toThrow(TypeError)
    })

    test("does not mutate its input", () => {
      const record = recordAt(3)
      const before = { ...record }
      recordAnswer(record, { correct: true, now: NOW, responseMs: 1200 })
      expect(record).toEqual(before)
    })

    test("returns exactly the six documented keys", () => {
      const next = recordAnswer(createRecord(), { correct: true, now: NOW, responseMs: 1200 })
      expect(Object.keys(next).sort()).toEqual([...RECORD_KEYS].sort())
    })

    test("records a correct fluent answer on a fresh fact", () => {
      const next = recordAnswer(createRecord(), { correct: true, now: NOW, responseMs: 1200 })
      expect(next).toEqual({
        strength: 1,
        totalSeen: 1,
        totalCorrect: 1,
        lastSeen: NOW,
        lastMs: 1200,
        dueAt: NOW + 10 * MINUTE_MS,
      })
    })

    test("a fluent answer promotes by one and stops at MAX", () => {
      const expected = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 5 }
      for (const strength of ALL_STRENGTHS) {
        const next = recordAnswer(recordAt(strength), {
          correct: true,
          now: NOW,
          responseMs: 1200,
        })
        expect(next.strength).toBe(expected[strength])
      }
    })

    test("an unmeasured correct answer promotes like fluent and keeps lastMs", () => {
      const next = recordAnswer(recordAt(2, { lastMs: 2222 }), {
        correct: true,
        now: NOW,
        responseMs: null,
      })
      expect(next.strength).toBe(3)
      expect(next.lastMs).toBe(2222)

      const omitted = recordAnswer(recordAt(2, { lastMs: null }), { correct: true, now: NOW })
      expect(omitted.strength).toBe(3)
      expect(omitted.lastMs).toBeNull()
    })

    test("a slow answer is capped by SLOW_CAP and never drops more than one", () => {
      // 7000 ms sits between FLUENT_MS (5000) and SLOW_MS (9000).
      const expected = { 0: 1, 1: 2, 2: 3, 3: 3, 4: 3, 5: 4 }
      for (const strength of ALL_STRENGTHS) {
        const next = recordAnswer(recordAt(strength), {
          correct: true,
          now: NOW,
          responseMs: 7000,
        })
        expect(next.strength).toBe(expected[strength])
        expect(next.strength).toBeLessThanOrEqual(Math.max(strength, STRENGTH.SLOW_CAP))
      }
    })

    test("a counting answer promotes toward SLOW_CAP and never demotes", () => {
      // Just past SLOW_MS, so the band is "counting". Every correct answer makes
      // progress; the band only sets the ceiling.
      const responseMs = RESPONSE_TIME.SLOW_MS + 1
      const expected = { 0: 1, 1: 2, 2: 3, 3: 3, 4: 4, 5: 5 }
      for (const strength of ALL_STRENGTHS) {
        const next = recordAnswer(recordAt(strength), { correct: true, now: NOW, responseMs })
        expect(next.strength).toBe(expected[strength])
        expect(next.strength).toBeLessThanOrEqual(Math.max(strength, STRENGTH.SLOW_CAP))
      }
    })

    test("the counting band never lowers strength", () => {
      const responseMs = RESPONSE_TIME.SLOW_MS + 1
      expect(classifySpeed(responseMs)).toBe("counting")
      for (const strength of ALL_STRENGTHS) {
        const next = recordAnswer(recordAt(strength), { correct: true, now: NOW, responseMs })
        expect(next.strength).toBeGreaterThanOrEqual(strength)
      }
    })

    test("no correct answer in any band ever lowers strength below its own floor", () => {
      for (const responseMs of [null, 1200, 5000, 7000, 10000, 12000, 12001, 45000]) {
        for (const strength of ALL_STRENGTHS) {
          const next = recordAnswer(recordAt(strength), { correct: true, now: NOW, responseMs })
          // The slow band alone may step a mastered fact down, by exactly one.
          expect(next.strength).toBeGreaterThanOrEqual(strength - 1)
        }
      }
    })

    test("clamps a huge responseMs into lastMs and reads it as counting", () => {
      const next = recordAnswer(recordAt(2), { correct: true, now: NOW, responseMs: 90000 })
      expect(classifySpeed(90000)).toBe("counting")
      expect(next.lastMs).toBe(RESPONSE_TIME.MAX_RECORDED_MS)
      // Still a promotion: she got it right, however long she took.
      expect(next.strength).toBe(3)
    })

    test("a wrong answer demotes by one, or two once mastered", () => {
      const expected = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 2, 5: 3 }
      for (const strength of ALL_STRENGTHS) {
        const record = recordAt(strength)
        const next = recordAnswer(record, { correct: false, now: NOW, responseMs: 1200 })
        expect(next.strength).toBe(expected[strength])
        expect(next.totalCorrect).toBe(record.totalCorrect)
        expect(next.totalSeen).toBe(record.totalSeen + 1)
        expect(next.lastMs).toBe(record.lastMs)
      }
    })

    test("dueAt after a wrong answer reflects the new lower strength", () => {
      const next = recordAnswer(recordAt(5), { correct: false, now: NOW, responseMs: 1200 })
      expect(next.strength).toBe(3)
      expect(next.dueAt).toBe(NOW + 3 * DAY_MS)
    })

    test("promotion starts from the decayed strength, not the stored one", () => {
      const record = overdueRecord(5, 30, 5)
      expect(decayedStrength(record, NOW)).toBe(3)
      const next = recordAnswer(record, { correct: true, now: NOW, responseMs: 1200 })
      expect(next.strength).toBe(4)
    })

    test("demotion starts from the decayed strength too", () => {
      const record = overdueRecord(5, 30, 5)
      const next = recordAnswer(record, { correct: false, now: NOW, responseMs: 1200 })
      // Decayed to 3, which is below MASTERED_MIN, so the step is 1.
      expect(next.strength).toBe(2)
    })

    test("tolerates a junk prior record by treating it as fresh", () => {
      const next = recordAnswer(null, { correct: true, now: NOW, responseMs: 1200 })
      expect(next).toEqual({
        strength: 1,
        totalSeen: 1,
        totalCorrect: 1,
        lastSeen: NOW,
        lastMs: 1200,
        dueAt: NOW + 10 * MINUTE_MS,
      })
    })
  })

  describe("recordAnswer mastery-reachable guard (D4)", () => {
    /**
     * Answer a fact correctly repeatedly, stepping the clock just past each new
     * dueAt so nothing decays between answers. No fake timers: the clock is a
     * plain number we advance by hand.
     * @param {number[]} responseTimes - Thinking time per answer, in ms
     * @param {Object} [start] - Starting record
     * @param {number} [startNow] - Starting epoch ms
     * @returns {{record: Object, strengths: number[], mastered: boolean[], now: number}} Trace
     */
    function practise(responseTimes, start = createRecord(), startNow = NOW) {
      let record = start
      let now = startNow
      const strengths = []
      const mastered = []
      for (const responseMs of responseTimes) {
        record = recordAnswer(record, { correct: true, now, responseMs })
        strengths.push(record.strength)
        mastered.push(isMastered(record, now))
        now = record.dueAt + 1
      }
      return { record, strengths, mastered, now }
    }

    test("eight confident 4500 ms answers reach strength 5 and stay mastered", () => {
      expect(classifySpeed(4500)).toBe("fluent")
      const { strengths, mastered, record, now } = practise(Array(8).fill(4500))
      expect(strengths).toEqual([1, 2, 3, 4, 5, 5, 5, 5])
      // Strength 4 is STRENGTH.MASTERED_MIN, so mastery arrives on the fourth
      // answer and holds from there -- which includes the fifth onward.
      expect(mastered).toEqual([false, false, false, true, true, true, true, true])
      expect(isMastered(record, now)).toBe(true)
      expect(masteryTier(record, now)).toBe("mastered")
    })

    test("a realistic mixed sequence reaches strength 5 and a foiled card", () => {
      const times = [3200, 2400, 3800, 2900, 3100, 2600]
      const { strengths, record, now } = practise(times)
      expect(strengths).toEqual([1, 2, 3, 4, 5, 5])
      expect(record.strength).toBe(STRENGTH.MAX)
      expect(cardTier(record, now)).toBe("foiled")
      expect(isMastered(record, now)).toBe(true)
    })

    test("the slow band plateaus at SLOW_CAP, and fluent answers lift it off", () => {
      expect(classifySpeed(7000)).toBe("slow")
      const slow = practise(Array(6).fill(7000))
      expect(slow.strengths).toEqual([1, 2, 3, 3, 3, 3])
      expect(slow.record.strength).toBe(STRENGTH.SLOW_CAP)
      expect(isMastered(slow.record, slow.now)).toBe(false)

      const lifted = practise([4500, 4500], slow.record, slow.now)
      expect(lifted.strengths).toEqual([4, 5])
      expect(isMastered(lifted.record, lifted.now)).toBe(true)
    })

    test("a consistently correct but slow player reaches the trail's unlock bar", () => {
      // The regression this band arithmetic exists for. Ten seconds is what
      // counting up to a fact honestly costs; every answer here is CORRECT, and
      // a child who is reliably correct has to be able to move her token.
      // Before: 9000 ms read as "counting", which held strength still, so the
      // fact sat at 1 forever and no region, gem, or card could ever unlock.
      expect(classifySpeed(10000)).toBe("slow")
      const { strengths, record, now } = practise(Array(6).fill(10000))
      expect(strengths).toEqual([1, 2, 3, 3, 3, 3])
      expect(record.strength).toBeGreaterThanOrEqual(TRAIL.UNLOCK_MIN_STRENGTH)
      expect(decayedStrength(record, now)).toBeGreaterThanOrEqual(TRAIL.UNLOCK_MIN_STRENGTH)
      // Still not mastered: slow is progress, not fluency.
      expect(isMastered(record, now)).toBe(false)
      expect(masteryTier(record, now)).toBe("strengthening")
    })

    test("even a full-on counting player reaches the unlock bar", () => {
      // Past SLOW_MS, so the band is "counting" -- the slowest correct answer the
      // game records. It still promotes, one box at a time, up to SLOW_CAP.
      expect(classifySpeed(20000)).toBe("counting")
      const { strengths, record, now } = practise(Array(5).fill(20000))
      expect(strengths).toEqual([1, 2, 3, 3, 3])
      expect(decayedStrength(record, now)).toBe(TRAIL.UNLOCK_MIN_STRENGTH)
      expect(isMastered(record, now)).toBe(false)
    })
  })

  describe("masteryTier", () => {
    test("a never-asked fact is new even if strength was hand-set", () => {
      expect(masteryTier({ ...recordAt(5), totalSeen: 0, totalCorrect: 0 }, NOW)).toBe("new")
      expect(masteryTier(createRecord(), NOW)).toBe("new")
      expect(masteryTier(null, NOW)).toBe("new")
    })

    test("buckets strength into weak, strengthening, and mastered", () => {
      const expected = {
        0: "weak",
        1: "weak",
        2: "weak",
        3: "strengthening",
        4: "mastered",
        5: "mastered",
      }
      for (const strength of ALL_STRENGTHS) {
        expect(masteryTier(recordAt(strength), NOW)).toBe(expected[strength])
      }
    })

    test("follows decay", () => {
      expect(masteryTier(overdueRecord(5, 30, 3), NOW)).toBe("strengthening")
    })
  })

  describe("isMastered", () => {
    test("is true from MASTERED_MIN up", () => {
      for (const strength of ALL_STRENGTHS) {
        expect(isMastered(recordAt(strength), NOW)).toBe(strength >= STRENGTH.MASTERED_MIN)
      }
    })

    test("a strength-5 record 30 days overdue is not mastered", () => {
      expect(isMastered(overdueRecord(5, 30, 3), NOW)).toBe(false)
    })
  })

  describe("cardTier", () => {
    test("maps decayed strength to card art", () => {
      const expected = {
        0: "grey",
        1: "grey",
        2: "colored",
        3: "colored",
        4: "foiled",
        5: "foiled",
      }
      for (const strength of ALL_STRENGTHS) {
        expect(cardTier(recordAt(strength), NOW)).toBe(expected[strength])
      }
    })

    test("follows decay rather than the persisted strength", () => {
      expect(cardTier(overdueRecord(5, 30, 3), NOW)).toBe("colored")
      expect(cardTier(overdueRecord(5, 60, 3), NOW)).toBe("grey")
    })

    test("is foiled exactly when the fact is mastered", () => {
      for (const strength of ALL_STRENGTHS) {
        for (const overdueDays of [0, 13, 14, 29, 60, 200]) {
          for (const totalCorrect of [0, 3]) {
            const record = overdueRecord(strength, overdueDays, totalCorrect)
            expect(cardTier(record, NOW) === "foiled").toBe(isMastered(record, NOW))
          }
        }
      }
    })
  })

  describe("accuracy", () => {
    test("is 0 for a never-asked fact", () => {
      expect(accuracy(createRecord())).toBe(0)
      expect(accuracy(null)).toBe(0)
    })

    test("is totalCorrect over totalSeen", () => {
      expect(accuracy({ ...createRecord(), totalSeen: 4, totalCorrect: 3 })).toBe(0.75)
      expect(accuracy({ ...createRecord(), totalSeen: 2, totalCorrect: 2 })).toBe(1)
    })
  })

  describe("selectionWeight", () => {
    test("a fresh fact gets the maximum weight plus the due bonus", () => {
      expect(selectionWeight(createRecord(), NOW)).toBe(
        (STRENGTH.MAX + 1) * SELECTION.DUE_WEIGHT_BONUS,
      )
      expect(selectionWeight(createRecord(), NOW)).toBe(12)
    })

    test("weight falls with strength and doubles when due", () => {
      expect(selectionWeight(recordAt(5), NOW)).toBe(1)
      expect(selectionWeight(recordAt(5, { dueAt: NOW - 1 }), NOW)).toBe(2)
      expect(selectionWeight(recordAt(0), NOW)).toBe(6)
      expect(selectionWeight(recordAt(0, { dueAt: NOW - 1 }), NOW)).toBe(12)
    })

    test("is always at least 1 across the strength and due matrix", () => {
      for (const strength of ALL_STRENGTHS) {
        for (const dueAt of [null, NOW - DAY_MS, NOW, NOW + DAY_MS]) {
          expect(selectionWeight(recordAt(strength, { dueAt }), NOW)).toBeGreaterThanOrEqual(1)
        }
      }
    })
  })

  describe("countMastered", () => {
    test("returns 0 for empty or junk input", () => {
      expect(countMastered({}, NOW)).toBe(0)
      expect(countMastered(null, NOW)).toBe(0)
      expect(countMastered(undefined, NOW)).toBe(0)
      expect(countMastered([], NOW)).toBe(0)
      expect(countMastered("x", NOW)).toBe(0)
    })

    test("counts only the mastered records", () => {
      const records = {
        "2x2": recordAt(5),
        "2x3": recordAt(4),
        "3x3": recordAt(3),
        "3x4": recordAt(0),
        "4x4": overdueRecord(5, 30, 3),
      }
      expect(countMastered(records, NOW)).toBe(2)
    })

    test("counts a decayed-but-still-mastered record", () => {
      expect(countMastered({ "6x7": overdueRecord(5, 14, 3) }, NOW)).toBe(1)
    })
  })
})

describe("MasteryStore", () => {
  /** @returns {() => number} A clock frozen at NOW. */
  const fixedNow = () => NOW

  describe("constructor", () => {
    test("normalizes incoming values", () => {
      const store = new MasteryStore({ "6x7": { strength: 99, totalCorrect: 4 } }, fixedNow)
      expect(store.get("6x7")).toEqual({
        strength: STRENGTH.MAX,
        totalSeen: 0,
        totalCorrect: 0,
        lastSeen: null,
        lastMs: null,
        dueAt: null,
      })
    })

    test("defaults to an empty map and the system clock", () => {
      const store = new MasteryStore()
      expect(store.toJSON()).toEqual({})
      expect(store.strengthOf("6x7")).toBe(0)
    })

    test("substitutes a fresh map for unusable input without throwing", () => {
      for (const input of [null, undefined, [], "x", 42]) {
        const store = new MasteryStore(input, fixedNow)
        expect(store.toJSON()).toEqual({})
        expect(() => store.set("2x3", createRecord())).not.toThrow()
        expect(store.has("2x3")).toBe(true)
      }
    })

    test("falls back to Date.now when now is not a function", () => {
      const store = new MasteryStore({}, "nope")
      expect(() => store.masteredCount()).not.toThrow()
      expect(store.masteredCount()).toBe(0)
    })
  })

  describe("aliasing (D1)", () => {
    test("keeps the caller's map, normalizing it in place", () => {
      const facts = { "6x7": { strength: 99 } }
      const store = new MasteryStore(facts, fixedNow)

      // 1. Same object identity, not a copy.
      expect(store.records).toBe(facts)

      // 2. The constructor normalized in place, so the caller's map is clean.
      expect(facts["6x7"].strength).toBe(5)
      expect(Object.keys(facts["6x7"]).sort()).toEqual([...RECORD_KEYS].sort())

      // 3. apply() is visible through the ORIGINAL reference.
      store.apply("6x7", { correct: true, responseMs: 1200 })
      expect(facts["6x7"].totalSeen).toBe(1)
      expect(facts["6x7"].lastSeen).toBe(NOW)

      // 4. set() is visible through the original reference too.
      store.set("2x3", createRecord())
      expect(Object.keys(facts)).toContain("2x3")
    })

    test("does not alias an unusable map, because there is nothing to alias", () => {
      const notAMap = []
      const store = new MasteryStore(notAMap, fixedNow)
      expect(store.records).not.toBe(notAMap)
      expect(store.records).toEqual({})
    })
  })

  describe("get", () => {
    test("returns a default record for an unknown id without inserting it", () => {
      const facts = { "6x7": createRecord() }
      const store = new MasteryStore(facts, fixedNow)
      expect(store.get("9x9")).toEqual(createRecord())
      expect(Object.keys(store.records)).toEqual(["6x7"])
      expect(Object.keys(facts)).toEqual(["6x7"])
    })

    test("returns the stored record for a known id", () => {
      const stored = recordAt(3)
      const store = new MasteryStore({ "6x7": stored }, fixedNow)
      expect(store.get("6x7")).toEqual(stored)
    })
  })

  describe("has", () => {
    test("reports only own stored keys", () => {
      const store = new MasteryStore({ "6x7": createRecord() }, fixedNow)
      expect(store.has("6x7")).toBe(true)
      expect(store.has("9x9")).toBe(false)
      expect(store.has("toString")).toBe(false)
    })
  })

  describe("set", () => {
    test("replaces the record and normalizes it", () => {
      const store = new MasteryStore({}, fixedNow)
      store.set("6x7", { strength: 99, totalSeen: 2, totalCorrect: 9 })
      expect(store.get("6x7")).toMatchObject({ strength: 5, totalSeen: 2, totalCorrect: 2 })
    })
  })

  describe("apply", () => {
    test("uses the injected clock, stores the result, and returns it", () => {
      const store = new MasteryStore({}, fixedNow)
      const next = store.apply("6x7", { correct: true, responseMs: 1200 })
      expect(next.lastSeen).toBe(NOW)
      expect(next.strength).toBe(1)
      expect(store.get("6x7")).toBe(next)
    })

    test("builds on the previous answer", () => {
      const store = new MasteryStore({}, fixedNow)
      store.apply("6x7", { correct: true, responseMs: 1200 })
      const second = store.apply("6x7", { correct: true, responseMs: 1200 })
      expect(second).toMatchObject({ strength: 2, totalSeen: 2, totalCorrect: 2 })
    })

    test("treats a missing responseMs as unmeasured", () => {
      const store = new MasteryStore({}, fixedNow)
      const next = store.apply("6x7", { correct: true })
      expect(next.strength).toBe(1)
      expect(next.lastMs).toBeNull()
    })

    test("records a miss", () => {
      const store = new MasteryStore({ "6x7": recordAt(3) }, fixedNow)
      const next = store.apply("6x7", { correct: false, responseMs: 1200 })
      expect(next.strength).toBe(2)
      expect(next.totalCorrect).toBe(4)
    })
  })

  describe("strengthOf / tierOf / cardTierOf", () => {
    test("read the decayed strength through the injected clock", () => {
      const store = new MasteryStore({ "6x7": overdueRecord(5, 30, 3) }, fixedNow)
      expect(store.strengthOf("6x7")).toBe(3)
      expect(store.tierOf("6x7")).toBe("strengthening")
      expect(store.cardTierOf("6x7")).toBe("colored")
    })

    test("agree with the module functions on the same record", () => {
      const store = new MasteryStore({ "6x7": recordAt(4) }, fixedNow)
      expect(store.cardTierOf("6x7")).toBe(cardTier(store.get("6x7"), NOW))
      expect(store.tierOf("6x7")).toBe(masteryTier(store.get("6x7"), NOW))
      expect(store.strengthOf("6x7")).toBe(decayedStrength(store.get("6x7"), NOW))
    })

    test("treat an unknown id as fresh", () => {
      const store = new MasteryStore({}, fixedNow)
      expect(store.strengthOf("9x9")).toBe(0)
      expect(store.tierOf("9x9")).toBe("new")
      expect(store.cardTierOf("9x9")).toBe("grey")
    })
  })

  describe("toJSON", () => {
    test("is a copy: mutating it affects neither the store nor the source map", () => {
      const facts = { "6x7": createRecord() }
      const store = new MasteryStore(facts, fixedNow)
      const snapshot = store.toJSON()
      expect(snapshot).toEqual(facts)
      expect(snapshot).not.toBe(facts)
      expect(snapshot).not.toBe(store.records)

      snapshot["2x3"] = createRecord()
      delete snapshot["6x7"]
      expect(store.has("2x3")).toBe(false)
      expect(store.has("6x7")).toBe(true)
      expect(Object.keys(facts)).toEqual(["6x7"])
    })
  })

  describe("masteredCount", () => {
    test("is 0 on a fresh store", () => {
      expect(new MasteryStore({}, fixedNow).masteredCount()).toBe(0)
    })

    test("counts a fact pushed to MASTERED_MIN by fluent answers", () => {
      let clock = NOW
      const store = new MasteryStore({}, () => clock)
      for (let i = 0; i < 4; i += 1) {
        const next = store.apply("6x7", { correct: true, responseMs: 1200 })
        clock = next.dueAt + 1
      }
      expect(store.strengthOf("6x7")).toBe(STRENGTH.MASTERED_MIN)
      expect(store.masteredCount()).toBe(1)
    })
  })

  describe("dueIds", () => {
    test("returns only the due subset, preserving input order", () => {
      const store = new MasteryStore(
        {
          "2x2": recordAt(5, { dueAt: NOW + DAY_MS }),
          "2x3": recordAt(2, { dueAt: NOW }),
          "3x3": recordAt(4, { dueAt: NOW - 1 }),
        },
        fixedNow,
      )
      expect(store.dueIds(["3x3", "2x2", "2x3", "9x9"])).toEqual(["3x3", "2x3", "9x9"])
    })

    test("returns an empty array for non-array input", () => {
      const store = new MasteryStore({}, fixedNow)
      expect(store.dueIds(null)).toEqual([])
      expect(store.dueIds("6x7")).toEqual([])
    })
  })
})
