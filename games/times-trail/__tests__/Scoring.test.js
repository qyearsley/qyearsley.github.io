import { describe, test, expect } from "@jest/globals"
import { Scoring } from "../js/Scoring.js"
import {
  DAILY_GOAL,
  FLAME_STAGES,
  GEM_MILESTONES,
  INPUT_MODE,
  SESSION,
  STARS,
} from "../js/constants.js"

/**
 * Timezone care: `dateKey` reads LOCAL date components, so every timestamp in
 * this file is built from local components (`new Date(2026, 0, 5)`) rather than
 * a UTC string literal or a bare epoch number. A UTC literal would land on a
 * different local calendar day west of Greenwich and the suite would fail on a
 * machine in another timezone. `daysBetween` takes date-key strings, so those
 * literals are safe as written -- it parses them as UTC midnight on purpose.
 *
 * No fake timers anywhere: the clock is injected.
 */

/** The reference day: 5 January 2026, local, mid-morning. */
const REFERENCE_YEAR = 2026
const REFERENCE_MONTH = 0
const REFERENCE_DAY = 5

/**
 * Local-time epoch ms, `offsetDays` from the reference day.
 * @param {number} offsetDays - Whole days, may be negative
 * @returns {number} Epoch ms
 */
function msOnDay(offsetDays) {
  return new Date(REFERENCE_YEAR, REFERENCE_MONTH, REFERENCE_DAY + offsetDays, 10, 30).getTime()
}

/**
 * The local date key of a day relative to the reference day.
 * @param {number} offsetDays - Whole days, may be negative
 * @returns {string} "YYYY-MM-DD"
 */
function keyOnDay(offsetDays) {
  return new Scoring().dateKey(msOnDay(offsetDays))
}

/**
 * A Scoring whose injected clock is fixed to a day relative to the reference.
 * @param {number} [offsetDays] - Whole days, may be negative
 * @returns {Scoring} Instance with a fixed clock
 */
function scoringOnDay(offsetDays = 0) {
  const fixed = msOnDay(offsetDays)
  return new Scoring({ now: () => fixed })
}

/**
 * Structural clone without `structuredClone` (banned by the spec's globals rule).
 * @param {Object} value - JSON-safe value
 * @returns {Object} Deep copy
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Feeds `count` answers through applyAnswer, threading each result forward.
 * @param {Scoring} scoring - Instance to use
 * @param {Object} daily - Starting daily record
 * @param {number} count - Number of answers
 * @returns {{daily: Object, flags: boolean[]}} Final record and the flag per answer
 */
function answerTimes(scoring, daily, count) {
  let current = daily
  const flags = []
  for (let i = 0; i < count; i += 1) {
    const result = scoring.applyAnswer(current)
    current = result.daily
    flags.push(result.goalJustMet)
  }
  return { daily: current, flags }
}

const DAILY_KEYS = [
  "todayDate",
  "factsToday",
  "goalMetToday",
  "lastGoalDate",
  "streakDays",
  "bestStreakDays",
  "flameDimmed",
]

/** The six MilestoneMetrics fields, written out so a deleted metric fails loudly. */
const METRIC_NAMES = [
  "sessionsCompleted",
  "factsCorrect",
  "starsTotal",
  "masteredCount",
  "unlockedRegionCount",
  "streakDays",
]

describe("Scoring", () => {
  describe("constructor", () => {
    test("defaults to a real clock when no now is injected", () => {
      const scoring = new Scoring()
      expect(scoring.dateKey(Date.now())).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test("accepts no options at all", () => {
      expect(() => new Scoring().streakMultiplier(0)).not.toThrow()
    })

    test("ignores a non-function now", () => {
      const scoring = new Scoring({ now: 12345 })
      expect(typeof scoring.rollDaily(Scoring.createDaily()).todayDate).toBe("string")
    })
  })

  describe("streakMultiplier", () => {
    test.each([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1.5],
      [4, 1.5],
      [5, 1.5],
      [6, 2],
      [7, 2],
      [9, 2],
      [10, 3],
      [11, 3],
      [100, 3],
    ])("streak %i multiplies by %f", (streak, expected) => {
      expect(scoringOnDay().streakMultiplier(streak)).toBe(expected)
    })

    test("a negative streak multiplies by 1", () => {
      expect(scoringOnDay().streakMultiplier(-1)).toBe(1)
      expect(scoringOnDay().streakMultiplier(-99)).toBe(1)
    })

    test("a non-finite streak multiplies by 1", () => {
      expect(scoringOnDay().streakMultiplier(NaN)).toBe(1)
      expect(scoringOnDay().streakMultiplier(undefined)).toBe(1)
    })

    test("never exceeds STARS.MAX_MULTIPLIER", () => {
      const scoring = scoringOnDay()
      for (let streak = 0; streak <= 60; streak += 1) {
        expect(scoring.streakMultiplier(streak)).toBeLessThanOrEqual(STARS.MAX_MULTIPLIER)
      }
    })

    test("is non-decreasing in the streak", () => {
      const scoring = scoringOnDay()
      let previous = 0
      for (let streak = 0; streak <= 30; streak += 1) {
        const current = scoring.streakMultiplier(streak)
        expect(current).toBeGreaterThanOrEqual(previous)
        previous = current
      }
    })

    test("each threshold in STARS.STREAK_MULTIPLIERS is exact at its boundary", () => {
      const scoring = scoringOnDay()
      for (const entry of STARS.STREAK_MULTIPLIERS) {
        expect(scoring.streakMultiplier(entry.minStreak)).toBe(entry.multiplier)
      }
    })
  })

  describe("tierForStrength", () => {
    test.each([
      [0, "weak"],
      [1, "weak"],
      [2, "weak"],
      [3, "strengthening"],
      [4, "mastered"],
      [5, "mastered"],
    ])("strength %i is %s", (strength, expected) => {
      expect(scoringOnDay().tierForStrength(strength)).toBe(expected)
    })

    test("clamps out-of-range strengths", () => {
      const scoring = scoringOnDay()
      expect(scoring.tierForStrength(9)).toBe("mastered")
      expect(scoring.tierForStrength(-2)).toBe("weak")
    })

    test("rounds a fractional strength before classifying", () => {
      const scoring = scoringOnDay()
      expect(scoring.tierForStrength(2.4)).toBe("weak")
      expect(scoring.tierForStrength(2.6)).toBe("strengthening")
      expect(scoring.tierForStrength(3.5)).toBe("mastered")
    })

    test("a non-finite strength is treated as 0", () => {
      const scoring = scoringOnDay()
      expect(scoring.tierForStrength(NaN)).toBe("weak")
      expect(scoring.tierForStrength(undefined)).toBe("weak")
    })
  })

  describe("starsForCorrect", () => {
    test("weak plus tiles at streak 1 pays 20", () => {
      expect(
        scoringOnDay().starsForCorrect({ strength: 0, streak: 1, inputMode: INPUT_MODE.TILES }),
      ).toBe(20)
    })

    test("strengthening plus tiles at streak 1 pays 15", () => {
      expect(
        scoringOnDay().starsForCorrect({ strength: 3, streak: 1, inputMode: INPUT_MODE.TILES }),
      ).toBe(15)
    })

    test("mastered plus tiles at streak 1 pays 10", () => {
      expect(
        scoringOnDay().starsForCorrect({ strength: 5, streak: 1, inputMode: INPUT_MODE.TILES }),
      ).toBe(10)
    })

    test("a mastered fact pays exactly half what a weak one pays at equal streak", () => {
      const scoring = scoringOnDay()
      const weak = scoring.starsForCorrect({
        strength: 0,
        streak: 1,
        inputMode: INPUT_MODE.TILES,
      })
      const mastered = scoring.starsForCorrect({
        strength: 5,
        streak: 1,
        inputMode: INPUT_MODE.TILES,
      })
      expect(weak).toBe(2 * mastered)
    })

    test("a mastered fact pays strictly less than a weak one at every streak and input mode", () => {
      const scoring = scoringOnDay()
      for (const streak of [0, 1, 2, 3, 5, 6, 9, 10, 20]) {
        for (const inputMode of [INPUT_MODE.TILES, INPUT_MODE.KEYPAD, "grid"]) {
          const weak = scoring.starsForCorrect({ strength: 0, streak, inputMode })
          const strengthening = scoring.starsForCorrect({ strength: 3, streak, inputMode })
          const mastered = scoring.starsForCorrect({ strength: 5, streak, inputMode })
          expect(mastered).toBeLessThan(strengthening)
          expect(strengthening).toBeLessThan(weak)
        }
      }
    })

    test("the keypad adds exactly 5 before the multiplier", () => {
      const scoring = scoringOnDay()
      expect(
        scoring.starsForCorrect({ strength: 0, streak: 1, inputMode: INPUT_MODE.KEYPAD }),
      ).toBe(25)
      expect(
        scoring.starsForCorrect({ strength: 0, streak: 6, inputMode: INPUT_MODE.KEYPAD }),
      ).toBe(50)
    })

    test("only the keypad earns the honesty bonus", () => {
      const scoring = scoringOnDay()
      const tiles = scoring.starsForCorrect({
        strength: 0,
        streak: 1,
        inputMode: INPUT_MODE.TILES,
      })
      const unknown = scoring.starsForCorrect({ strength: 0, streak: 1, inputMode: "grid" })
      expect(unknown).toBe(tiles)
    })

    test.each([
      [0, 1, INPUT_MODE.TILES, 20],
      [0, 2, INPUT_MODE.TILES, 20],
      [0, 3, INPUT_MODE.TILES, 30],
      [0, 5, INPUT_MODE.TILES, 30],
      [0, 6, INPUT_MODE.TILES, 40],
      [0, 9, INPUT_MODE.TILES, 40],
      [0, 10, INPUT_MODE.TILES, 60],
      [0, 25, INPUT_MODE.TILES, 60],
      [3, 1, INPUT_MODE.TILES, 15],
      [3, 3, INPUT_MODE.TILES, 23],
      [3, 6, INPUT_MODE.TILES, 30],
      [3, 10, INPUT_MODE.TILES, 45],
      [5, 1, INPUT_MODE.TILES, 10],
      [5, 3, INPUT_MODE.TILES, 15],
      [5, 6, INPUT_MODE.TILES, 20],
      [5, 12, INPUT_MODE.TILES, 30],
      [0, 1, INPUT_MODE.KEYPAD, 25],
      [0, 3, INPUT_MODE.KEYPAD, 38],
      [0, 6, INPUT_MODE.KEYPAD, 50],
      [0, 10, INPUT_MODE.KEYPAD, 75],
      [3, 3, INPUT_MODE.KEYPAD, 30],
      [3, 6, INPUT_MODE.KEYPAD, 40],
      [5, 3, INPUT_MODE.KEYPAD, 23],
      [5, 10, INPUT_MODE.KEYPAD, 45],
    ])("strength %i, streak %i, %s pays %i", (strength, streak, inputMode, expected) => {
      expect(scoringOnDay().starsForCorrect({ strength, streak, inputMode })).toBe(expected)
    })

    test("rounds rather than truncates", () => {
      // 15 * 1.5 is 22.5, which truncation would report as 22.
      expect(
        scoringOnDay().starsForCorrect({ strength: 3, streak: 3, inputMode: INPUT_MODE.TILES }),
      ).toBe(23)
    })

    test("is always a non-negative integer across the strength x streak x inputMode matrix", () => {
      const scoring = scoringOnDay()
      for (let strength = -1; strength <= 6; strength += 1) {
        for (let streak = -1; streak <= 15; streak += 1) {
          for (const inputMode of [INPUT_MODE.TILES, INPUT_MODE.KEYPAD, "grid"]) {
            const stars = scoring.starsForCorrect({ strength, streak, inputMode })
            expect(Number.isInteger(stars)).toBe(true)
            expect(stars).toBeGreaterThanOrEqual(0)
          }
        }
      }
    })

    test("never returns less than STARS.BASE for a correct answer", () => {
      const scoring = scoringOnDay()
      for (let strength = 0; strength <= 5; strength += 1) {
        const stars = scoring.starsForCorrect({
          strength,
          streak: 0,
          inputMode: INPUT_MODE.TILES,
        })
        expect(stars).toBeGreaterThanOrEqual(STARS.BASE)
      }
    })

    test("tolerates a missing input object", () => {
      const scoring = scoringOnDay()
      expect(scoring.starsForCorrect()).toBe(20)
      expect(scoring.starsForCorrect({})).toBe(20)
    })

    test("does not mutate its input", () => {
      const input = { strength: 0, streak: 3, inputMode: INPUT_MODE.KEYPAD }
      const before = clone(input)
      scoringOnDay().starsForCorrect(input)
      expect(input).toEqual(before)
    })
  })

  describe("starsForWrong", () => {
    test("returns 0", () => {
      expect(scoringOnDay().starsForWrong()).toBe(0)
    })

    test("a wrong answer never reduces a running total", () => {
      const scoring = scoringOnDay()
      let total = 120
      for (let i = 0; i < 5; i += 1) {
        const next = total + scoring.starsForWrong()
        expect(next).toBeGreaterThanOrEqual(total)
        total = next
      }
      expect(total).toBe(120)
    })

    test("is never negative", () => {
      expect(scoringOnDay().starsForWrong()).toBeGreaterThanOrEqual(0)
    })
  })

  describe("createDaily", () => {
    test("deep-equals the documented literal", () => {
      expect(Scoring.createDaily()).toEqual({
        todayDate: null,
        factsToday: 0,
        goalMetToday: false,
        lastGoalDate: null,
        streakDays: 0,
        bestStreakDays: 0,
        flameDimmed: false,
      })
    })

    test("has exactly the seven documented keys and no secondsToday", () => {
      const daily = Scoring.createDaily()
      expect(Object.keys(daily).sort()).toEqual([...DAILY_KEYS].sort())
      expect("secondsToday" in daily).toBe(false)
    })

    test("two calls return distinct objects", () => {
      const first = Scoring.createDaily()
      const second = Scoring.createDaily()
      expect(first).not.toBe(second)
      first.factsToday = 7
      expect(second.factsToday).toBe(0)
    })
  })

  describe("dateKey", () => {
    test("formats a January 5th date with zero padding", () => {
      expect(scoringOnDay().dateKey(new Date(2026, 0, 5, 8, 15).getTime())).toBe("2026-01-05")
    })

    test("matches the date-key pattern", () => {
      expect(scoringOnDay().dateKey(msOnDay(0))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test("two timestamps on the same local day give the same key", () => {
      const scoring = scoringOnDay()
      const early = new Date(2026, 5, 17, 0, 0, 1).getTime()
      const late = new Date(2026, 5, 17, 23, 59, 59).getTime()
      expect(scoring.dateKey(early)).toBe(scoring.dateKey(late))
      expect(scoring.dateKey(early)).toBe("2026-06-17")
    })

    test("consecutive local days give different keys", () => {
      const scoring = scoringOnDay()
      expect(scoring.dateKey(msOnDay(0))).not.toBe(scoring.dateKey(msOnDay(1)))
    })

    test("pads a single-digit month and day", () => {
      expect(scoringOnDay().dateKey(new Date(2026, 8, 9, 12, 0).getTime())).toBe("2026-09-09")
    })

    test("round-trips through daysBetween for adjacent days", () => {
      const scoring = scoringOnDay()
      expect(scoring.daysBetween(scoring.dateKey(msOnDay(0)), scoring.dateKey(msOnDay(1)))).toBe(1)
    })
  })

  describe("daysBetween", () => {
    test("the same key is 0 days apart", () => {
      expect(scoringOnDay().daysBetween("2026-01-05", "2026-01-05")).toBe(0)
    })

    test("consecutive days are 1 apart", () => {
      expect(scoringOnDay().daysBetween("2026-01-05", "2026-01-06")).toBe(1)
    })

    test("crosses a month boundary in a non-leap year", () => {
      expect(scoringOnDay().daysBetween("2026-02-28", "2026-03-01")).toBe(1)
    })

    test("crosses a year boundary", () => {
      expect(scoringOnDay().daysBetween("2025-12-31", "2026-01-01")).toBe(1)
    })

    test("counts a leap day", () => {
      expect(scoringOnDay().daysBetween("2028-02-28", "2028-03-01")).toBe(2)
    })

    test("is negative when the keys are reversed", () => {
      expect(scoringOnDay().daysBetween("2026-01-06", "2026-01-05")).toBe(-1)
    })

    test("spans a DST transition as exactly 2 days", () => {
      expect(scoringOnDay().daysBetween("2026-03-07", "2026-03-09")).toBe(2)
    })

    test("returns Infinity for a null key on either side", () => {
      const scoring = scoringOnDay()
      expect(scoring.daysBetween(null, "2026-01-05")).toBe(Number.POSITIVE_INFINITY)
      expect(scoring.daysBetween("2026-01-05", null)).toBe(Number.POSITIVE_INFINITY)
    })

    test("returns Infinity for a malformed key", () => {
      const scoring = scoringOnDay()
      expect(scoring.daysBetween("garbage", "2026-01-05")).toBe(Number.POSITIVE_INFINITY)
      expect(scoring.daysBetween("2026-1-5", "2026-01-05")).toBe(Number.POSITIVE_INFINITY)
      expect(scoring.daysBetween(20260105, "2026-01-05")).toBe(Number.POSITIVE_INFINITY)
      expect(scoring.daysBetween(undefined, undefined)).toBe(Number.POSITIVE_INFINITY)
    })
  })

  describe("rollDaily", () => {
    test("returns a fresh object on the same-day branch", () => {
      const scoring = scoringOnDay()
      const daily = { ...Scoring.createDaily(), todayDate: keyOnDay(0), factsToday: 4 }
      const rolled = scoring.rollDaily(daily)
      expect(rolled).not.toBe(daily)
      rolled.factsToday = 99
      expect(daily.factsToday).toBe(4)
    })

    test("returns a fresh object on the new-day branch", () => {
      const scoring = scoringOnDay()
      const daily = { ...Scoring.createDaily(), todayDate: keyOnDay(-1), factsToday: 4 }
      const rolled = scoring.rollDaily(daily)
      expect(rolled).not.toBe(daily)
    })

    test("preserves today's counters on a same-day repeat", () => {
      const scoring = scoringOnDay()
      const daily = {
        todayDate: keyOnDay(0),
        factsToday: 12,
        goalMetToday: false,
        lastGoalDate: keyOnDay(-1),
        streakDays: 4,
        bestStreakDays: 9,
        flameDimmed: false,
      }
      expect(scoring.rollDaily(daily)).toEqual(daily)
    })

    test("a new day with the goal met yesterday resets counters and keeps the streak", () => {
      const scoring = scoringOnDay()
      const rolled = scoring.rollDaily({
        todayDate: keyOnDay(-1),
        factsToday: 25,
        goalMetToday: true,
        lastGoalDate: keyOnDay(-1),
        streakDays: 4,
        bestStreakDays: 9,
        flameDimmed: false,
      })
      expect(rolled.todayDate).toBe(keyOnDay(0))
      expect(rolled.factsToday).toBe(0)
      expect(rolled.goalMetToday).toBe(false)
      expect(rolled.streakDays).toBe(4)
      expect(rolled.bestStreakDays).toBe(9)
      expect(rolled.flameDimmed).toBe(false)
    })

    test("a one-day gap is forgiven and dims the flame", () => {
      const rolled = scoringOnDay().rollDaily({
        ...Scoring.createDaily(),
        todayDate: keyOnDay(-2),
        lastGoalDate: keyOnDay(-2),
        streakDays: 6,
        bestStreakDays: 6,
      })
      expect(rolled.streakDays).toBe(6)
      expect(rolled.flameDimmed).toBe(true)
    })

    test("a two-day gap resets the streak", () => {
      const rolled = scoringOnDay().rollDaily({
        ...Scoring.createDaily(),
        todayDate: keyOnDay(-3),
        lastGoalDate: keyOnDay(-3),
        streakDays: 6,
        bestStreakDays: 6,
      })
      expect(rolled.streakDays).toBe(0)
      expect(rolled.flameDimmed).toBe(false)
      expect(rolled.bestStreakDays).toBe(6)
    })

    test("a ten-day gap resets the streak but keeps the best", () => {
      const rolled = scoringOnDay().rollDaily({
        ...Scoring.createDaily(),
        todayDate: keyOnDay(-10),
        lastGoalDate: keyOnDay(-10),
        streakDays: 12,
        bestStreakDays: 12,
      })
      expect(rolled.streakDays).toBe(0)
      expect(rolled.bestStreakDays).toBe(12)
    })

    test("the grace gap is exactly DAILY_GOAL.GRACE_GAP_DAYS", () => {
      const scoring = scoringOnDay()
      const build = (gap) => ({
        ...Scoring.createDaily(),
        todayDate: keyOnDay(-gap),
        lastGoalDate: keyOnDay(-gap),
        streakDays: 5,
        bestStreakDays: 5,
      })
      expect(scoring.rollDaily(build(DAILY_GOAL.GRACE_GAP_DAYS)).streakDays).toBe(5)
      expect(scoring.rollDaily(build(DAILY_GOAL.GRACE_GAP_DAYS + 1)).streakDays).toBe(0)
    })

    test("a null lastGoalDate resets the streak", () => {
      const rolled = scoringOnDay().rollDaily({
        ...Scoring.createDaily(),
        todayDate: keyOnDay(-1),
        lastGoalDate: null,
        streakDays: 3,
        bestStreakDays: 3,
      })
      expect(rolled.streakDays).toBe(0)
      expect(rolled.flameDimmed).toBe(false)
      expect(rolled.bestStreakDays).toBe(3)
    })

    test("bestStreakDays is never reduced", () => {
      const scoring = scoringOnDay()
      for (const gap of [0, 1, 2, 3, 30]) {
        const rolled = scoring.rollDaily({
          ...Scoring.createDaily(),
          todayDate: keyOnDay(-gap),
          lastGoalDate: keyOnDay(-gap),
          streakDays: 4,
          bestStreakDays: 11,
        })
        expect(rolled.bestStreakDays).toBe(11)
      }
    })

    test("never mutates the input", () => {
      const scoring = scoringOnDay()
      const daily = {
        todayDate: keyOnDay(-5),
        factsToday: 17,
        goalMetToday: true,
        lastGoalDate: keyOnDay(-5),
        streakDays: 3,
        bestStreakDays: 8,
        flameDimmed: true,
      }
      const before = clone(daily)
      const rolled = scoring.rollDaily(daily)
      expect(daily).toEqual(before)
      expect(rolled).not.toBe(daily)
    })

    test("drops a legacy secondsToday key", () => {
      const rolled = scoringOnDay().rollDaily({
        ...Scoring.createDaily(),
        todayDate: keyOnDay(0),
        secondsToday: 400,
      })
      expect("secondsToday" in rolled).toBe(false)
      expect(Object.keys(rolled).sort()).toEqual([...DAILY_KEYS].sort())
    })

    test("normalizes junk input into a valid record for today", () => {
      const scoring = scoringOnDay()
      for (const junk of [null, undefined, 42, "x", []]) {
        const rolled = scoring.rollDaily(junk)
        expect(rolled.todayDate).toBe(keyOnDay(0))
        expect(rolled.factsToday).toBe(0)
        expect(rolled.streakDays).toBe(0)
      }
    })

    test("rolling twice on the same day is idempotent in value", () => {
      const scoring = scoringOnDay()
      const once = scoring.rollDaily(Scoring.createDaily())
      const twice = scoring.rollDaily(once)
      expect(twice).toEqual(once)
      expect(twice).not.toBe(once)
    })
  })

  describe("applyAnswer", () => {
    test("answers 1 through 19 never report the goal", () => {
      const scoring = scoringOnDay()
      const { daily, flags } = answerTimes(scoring, Scoring.createDaily(), 19)
      expect(flags.some(Boolean)).toBe(false)
      expect(daily.factsToday).toBe(19)
      expect(daily.goalMetToday).toBe(false)
      expect(daily.lastGoalDate).toBeNull()
      expect(daily.streakDays).toBe(0)
    })

    test("factsToday tracks the answer count", () => {
      const scoring = scoringOnDay()
      let current = Scoring.createDaily()
      for (let i = 1; i <= 19; i += 1) {
        current = scoring.applyAnswer(current).daily
        expect(current.factsToday).toBe(i)
      }
    })

    test("the 20th answer is the one that meets the goal, not the 21st", () => {
      const scoring = scoringOnDay()
      const { flags } = answerTimes(scoring, Scoring.createDaily(), 25)
      const firedAt = flags.map((flag, index) => (flag ? index + 1 : 0)).filter(Boolean)
      expect(firedAt).toEqual([DAILY_GOAL.FACTS])
      expect(flags[DAILY_GOAL.FACTS - 1]).toBe(true)
      expect(flags[DAILY_GOAL.FACTS]).toBe(false)
    })

    test("the goal-meeting answer bumps the streak and records the date", () => {
      const scoring = scoringOnDay()
      const { daily } = answerTimes(scoring, Scoring.createDaily(), DAILY_GOAL.FACTS)
      expect(daily.factsToday).toBe(DAILY_GOAL.FACTS)
      expect(daily.goalMetToday).toBe(true)
      expect(daily.streakDays).toBe(1)
      expect(daily.bestStreakDays).toBe(1)
      expect(daily.lastGoalDate).toBe(keyOnDay(0))
      expect(daily.flameDimmed).toBe(false)
    })

    test("the 21st answer does not fire the goal again", () => {
      const scoring = scoringOnDay()
      const { daily } = answerTimes(scoring, Scoring.createDaily(), DAILY_GOAL.FACTS)
      const extra = scoring.applyAnswer(daily)
      expect(extra.goalJustMet).toBe(false)
      expect(extra.daily.streakDays).toBe(daily.streakDays)
      expect(extra.daily.factsToday).toBe(DAILY_GOAL.FACTS + 1)
    })

    // The goal is deliberately NOT derived from the session length now that the
    // length is a setting. If it tracked the setting, picking the 10-question
    // session would halve the goal and every day would still be "done" in one
    // session -- which is the opposite of what a goal is for. So: the default
    // session meets it exactly, the long one overshoots, and the short one takes
    // two. In every case it fires at most once.
    test("the default session meets the goal exactly", () => {
      expect(SESSION.DEFAULT_LENGTH).toBe(DAILY_GOAL.FACTS)
    })

    test("no session length fires the goal more than once", () => {
      for (const length of SESSION.LENGTH_OPTIONS) {
        const { flags } = answerTimes(scoringOnDay(), Scoring.createDaily(), length)
        expect(flags.filter(Boolean).length).toBeLessThanOrEqual(1)
      }
    })

    test("a session shorter than the goal does not meet it, and two of them do", () => {
      const short = Math.min(...SESSION.LENGTH_OPTIONS)
      expect(short).toBeLessThan(DAILY_GOAL.FACTS)

      const scoring = scoringOnDay()
      const first = answerTimes(scoring, Scoring.createDaily(), short)
      expect(first.flags.filter(Boolean)).toHaveLength(0)
      expect(first.daily.factsToday).toBe(short)

      const second = answerTimes(scoring, first.daily, short)
      expect(second.flags.filter(Boolean)).toHaveLength(1)
      expect(second.daily.streakDays).toBe(1)
    })

    test("a session longer than the goal fires it mid-session, not at the end", () => {
      const long = Math.max(...SESSION.LENGTH_OPTIONS)
      expect(long).toBeGreaterThan(DAILY_GOAL.FACTS)
      const { flags } = answerTimes(scoringOnDay(), Scoring.createDaily(), long)
      expect(flags.filter(Boolean)).toHaveLength(1)
      expect(flags.indexOf(true)).toBe(DAILY_GOAL.FACTS - 1)
    })

    test("takes no second argument; a stray object changes nothing", () => {
      const scoring = scoringOnDay()
      const daily = { ...Scoring.createDaily(), todayDate: keyOnDay(0), factsToday: 19 }
      const plain = scoring.applyAnswer(daily)
      const withStray = scoring.applyAnswer(daily, { elapsedSeconds: 99999 })
      expect(withStray.daily).toEqual(plain.daily)
      expect(withStray.goalJustMet).toBe(plain.goalJustMet)
      expect("secondsToday" in withStray.daily).toBe(false)
    })

    test("two consecutive goal days build a streak of 2", () => {
      const dayOne = answerTimes(scoringOnDay(0), Scoring.createDaily(), DAILY_GOAL.FACTS).daily
      expect(dayOne.streakDays).toBe(1)
      const dayTwo = answerTimes(scoringOnDay(1), dayOne, DAILY_GOAL.FACTS).daily
      expect(dayTwo.streakDays).toBe(2)
      expect(dayTwo.bestStreakDays).toBe(2)
      expect(dayTwo.lastGoalDate).toBe(keyOnDay(1))
    })

    test("a grace-day gap keeps the streak and then increments it to 3", () => {
      const dayOne = answerTimes(scoringOnDay(0), Scoring.createDaily(), DAILY_GOAL.FACTS).daily
      const dayTwo = answerTimes(scoringOnDay(1), dayOne, DAILY_GOAL.FACTS).daily
      expect(dayTwo.streakDays).toBe(2)

      // Day 3 is skipped entirely; day 4 is a two-day gap, which is forgiven.
      const dayFourScoring = scoringOnDay(3)
      const rolled = dayFourScoring.rollDaily(dayTwo)
      expect(rolled.streakDays).toBe(2)
      expect(rolled.flameDimmed).toBe(true)

      const dayFour = answerTimes(dayFourScoring, dayTwo, DAILY_GOAL.FACTS).daily
      expect(dayFour.streakDays).toBe(3)
      expect(dayFour.flameDimmed).toBe(false)
      expect(dayFour.bestStreakDays).toBe(3)
    })

    test("a three-day gap restarts the streak at 1", () => {
      const dayOne = answerTimes(scoringOnDay(0), Scoring.createDaily(), DAILY_GOAL.FACTS).daily
      const later = answerTimes(scoringOnDay(3), dayOne, DAILY_GOAL.FACTS).daily
      expect(later.streakDays).toBe(1)
      expect(later.bestStreakDays).toBe(1)
    })

    test("bestStreakDays never shrinks", () => {
      const start = {
        ...Scoring.createDaily(),
        todayDate: keyOnDay(-9),
        lastGoalDate: keyOnDay(-9),
        streakDays: 1,
        bestStreakDays: 14,
      }
      const { daily } = answerTimes(scoringOnDay(0), start, DAILY_GOAL.FACTS)
      expect(daily.streakDays).toBe(1)
      expect(daily.bestStreakDays).toBe(14)
    })

    test("a single call rolls a stale record and counts the answer", () => {
      const stale = {
        ...Scoring.createDaily(),
        todayDate: keyOnDay(-1),
        factsToday: 25,
        goalMetToday: true,
        lastGoalDate: keyOnDay(-1),
        streakDays: 3,
        bestStreakDays: 3,
      }
      const result = scoringOnDay(0).applyAnswer(stale)
      expect(result.daily.todayDate).toBe(keyOnDay(0))
      expect(result.daily.factsToday).toBe(1)
      expect(result.daily.goalMetToday).toBe(false)
      expect(result.goalJustMet).toBe(false)
      expect(result.daily.streakDays).toBe(3)
    })

    test("never mutates the input and returns a distinct object", () => {
      const daily = { ...Scoring.createDaily(), todayDate: keyOnDay(0), factsToday: 19 }
      const before = clone(daily)
      const result = scoringOnDay().applyAnswer(daily)
      expect(daily).toEqual(before)
      expect(result.daily).not.toBe(daily)
      result.daily.factsToday = 999
      expect(daily.factsToday).toBe(19)
    })

    test("returns exactly the seven daily keys", () => {
      const result = scoringOnDay().applyAnswer(Scoring.createDaily())
      expect(Object.keys(result.daily).sort()).toEqual([...DAILY_KEYS].sort())
    })
  })

  describe("isDailyGoalMet", () => {
    test("is false below the threshold and true at it", () => {
      const scoring = scoringOnDay()
      expect(scoring.isDailyGoalMet({ factsToday: DAILY_GOAL.FACTS - 1 })).toBe(false)
      expect(scoring.isDailyGoalMet({ factsToday: DAILY_GOAL.FACTS })).toBe(true)
      expect(scoring.isDailyGoalMet({ factsToday: DAILY_GOAL.FACTS + 5 })).toBe(true)
    })

    test("a stray legacy secondsToday key changes nothing", () => {
      const scoring = scoringOnDay()
      expect(scoring.isDailyGoalMet({ factsToday: DAILY_GOAL.FACTS, secondsToday: 0 })).toBe(true)
      expect(scoring.isDailyGoalMet({ factsToday: 0, secondsToday: 100000 })).toBe(false)
    })

    test("no record below the fact threshold can ever be met", () => {
      const scoring = scoringOnDay()
      for (let facts = 0; facts < DAILY_GOAL.FACTS; facts += 1) {
        expect(
          scoring.isDailyGoalMet({
            factsToday: facts,
            goalMetToday: true,
            streakDays: 99,
            flameDimmed: true,
            secondsToday: 99999,
          }),
        ).toBe(false)
      }
    })

    test("junk input is not met", () => {
      const scoring = scoringOnDay()
      for (const junk of [null, undefined, 42, "x", {}, { factsToday: "20" }]) {
        expect(scoring.isDailyGoalMet(junk)).toBe(false)
      }
    })
  })

  describe("flameStage", () => {
    test.each([
      [0, 0, "out"],
      [1, 1, "spark"],
      [2, 1, "spark"],
      [3, 2, "flame"],
      [6, 2, "flame"],
      [7, 3, "blaze"],
      [13, 3, "blaze"],
      [14, 4, "inferno"],
      [100, 4, "inferno"],
    ])("streak %i shows stage %i (%s)", (streakDays, index, id) => {
      const stage = scoringOnDay().flameStage({ ...Scoring.createDaily(), streakDays })
      expect(stage.index).toBe(index)
      expect(stage.id).toBe(id)
      expect(stage.dimmed).toBe(false)
    })

    test("every FLAME_STAGES threshold is exact at its boundary", () => {
      const scoring = scoringOnDay()
      for (const entry of FLAME_STAGES) {
        const stage = scoring.flameStage({
          ...Scoring.createDaily(),
          streakDays: entry.minStreak,
        })
        expect(stage.index).toBe(entry.index)
        expect(stage.id).toBe(entry.id)
      }
    })

    test("one below each threshold shows the previous stage", () => {
      const scoring = scoringOnDay()
      for (const entry of FLAME_STAGES.slice(1)) {
        const stage = scoring.flameStage({
          ...Scoring.createDaily(),
          streakDays: entry.minStreak - 1,
        })
        expect(stage.index).toBe(entry.index - 1)
      }
    })

    test("a dimmed flame drops one stage", () => {
      const stage = scoringOnDay().flameStage({
        ...Scoring.createDaily(),
        streakDays: 7,
        flameDimmed: true,
      })
      expect(stage.index).toBe(2)
      expect(stage.id).toBe("flame")
      expect(stage.dimmed).toBe(true)
    })

    test("a dimmed flame never falls below index 1 while the streak lives", () => {
      const scoring = scoringOnDay()
      for (const streakDays of [1, 2, 3, 4]) {
        const stage = scoring.flameStage({
          ...Scoring.createDaily(),
          streakDays,
          flameDimmed: true,
        })
        expect(stage.index).toBeGreaterThanOrEqual(1)
        expect(stage.dimmed).toBe(true)
      }
    })

    test("a dimmed flame with no streak is still out", () => {
      const stage = scoringOnDay().flameStage({
        ...Scoring.createDaily(),
        streakDays: 0,
        flameDimmed: true,
      })
      expect(stage.index).toBe(0)
      expect(stage.id).toBe("out")
      expect(stage.dimmed).toBe(true)
    })

    test("the returned emoji matches the reported stage", () => {
      const scoring = scoringOnDay()
      for (let streakDays = 0; streakDays <= 20; streakDays += 1) {
        for (const flameDimmed of [false, true]) {
          const stage = scoring.flameStage({
            ...Scoring.createDaily(),
            streakDays,
            flameDimmed,
          })
          expect(stage.emoji).toBe(FLAME_STAGES[stage.index].emoji)
          expect(stage.id).toBe(FLAME_STAGES[stage.index].id)
        }
      }
    })

    test("junk input reads as the lowest stage", () => {
      const scoring = scoringOnDay()
      for (const junk of [null, undefined, {}, 42]) {
        expect(scoring.flameStage(junk).index).toBe(0)
      }
    })

    test("does not mutate its input", () => {
      const daily = { ...Scoring.createDaily(), streakDays: 7, flameDimmed: true }
      const before = clone(daily)
      scoringOnDay().flameStage(daily)
      expect(daily).toEqual(before)
    })
  })

  describe("checkMilestones", () => {
    test("empty metrics award nothing", () => {
      expect(scoringOnDay().checkMilestones({}, [])).toEqual({ newlyAwarded: [], gems: 0 })
    })

    test("factsCorrect 12 awards only facts-10", () => {
      const result = scoringOnDay().checkMilestones({ factsCorrect: 12 }, [])
      expect(result.newlyAwarded.map((m) => m.id)).toEqual(["facts-10"])
      expect(result.gems).toBe(1)
    })

    test("factsCorrect 30 awards facts-10 and facts-25", () => {
      const result = scoringOnDay().checkMilestones({ factsCorrect: 30 }, [])
      expect(result.newlyAwarded.map((m) => m.id)).toEqual(["facts-10", "facts-25"])
      expect(result.gems).toBe(2)
    })

    test("factsCorrect 1000 awards all three facts milestones at once", () => {
      const result = scoringOnDay().checkMilestones({ factsCorrect: 1000 }, [])
      expect(result.newlyAwarded.map((m) => m.id)).toEqual(["facts-10", "facts-25", "facts-100"])
      expect(result.gems).toBe(4)
    })

    test("a full mastery map awards both mastered milestones plus regions-4", () => {
      const result = scoringOnDay().checkMilestones(
        { masteredCount: 36, unlockedRegionCount: 8 },
        [],
      )
      expect(result.newlyAwarded.map((m) => m.id)).toEqual([
        "mastered-5",
        "mastered-15",
        "regions-4",
      ])
      expect(result.gems).toBe(8)
    })

    test("a first session can earn a gem", () => {
      const result = scoringOnDay().checkMilestones({ factsCorrect: 10 }, [])
      expect(result.newlyAwarded).toHaveLength(1)
      expect(result.newlyAwarded[0].id).toBe("facts-10")
      expect(result.gems).toBe(1)
    })

    test("thresholds fire at the exact value, not one past it", () => {
      const scoring = scoringOnDay()
      for (const milestone of GEM_MILESTONES) {
        const below = scoring.checkMilestones({ [milestone.metric]: milestone.threshold - 1 }, [])
        expect(below.newlyAwarded.map((m) => m.id)).not.toContain(milestone.id)
        const at = scoring.checkMilestones({ [milestone.metric]: milestone.threshold }, [])
        expect(at.newlyAwarded.map((m) => m.id)).toContain(milestone.id)
      }
    })

    test("each milestone fires exactly once as its metric grows", () => {
      const scoring = scoringOnDay()
      const awarded = []
      const fireCounts = new Map(GEM_MILESTONES.map((m) => [m.id, 0]))
      for (let factsCorrect = 0; factsCorrect <= 120; factsCorrect += 1) {
        const result = scoring.checkMilestones({ factsCorrect }, awarded)
        for (const milestone of result.newlyAwarded) {
          fireCounts.set(milestone.id, fireCounts.get(milestone.id) + 1)
          awarded.push(milestone.id)
        }
      }
      expect(fireCounts.get("facts-10")).toBe(1)
      expect(fireCounts.get("facts-25")).toBe(1)
      expect(fireCounts.get("facts-100")).toBe(1)
      expect(awarded).toEqual(["facts-10", "facts-25", "facts-100"])
    })

    test("is idempotent when the previous ids are fed back in", () => {
      const scoring = scoringOnDay()
      const metrics = { factsCorrect: 120, masteredCount: 20, unlockedRegionCount: 8 }
      const first = scoring.checkMilestones(metrics, [])
      expect(first.newlyAwarded.length).toBeGreaterThan(0)
      const second = scoring.checkMilestones(
        metrics,
        first.newlyAwarded.map((m) => m.id),
      )
      expect(second).toEqual({ newlyAwarded: [], gems: 0 })
    })

    test("does not mutate the awardedIds array", () => {
      const awarded = ["facts-10"]
      scoringOnDay().checkMilestones({ factsCorrect: 500 }, awarded)
      expect(awarded).toEqual(["facts-10"])
    })

    test("result order matches GEM_MILESTONES order", () => {
      const result = scoringOnDay().checkMilestones(
        {
          factsCorrect: 1000,
          masteredCount: 36,
          unlockedRegionCount: 8,
          streakDays: 30,
          starsTotal: 5000,
          sessionsCompleted: 50,
        },
        [],
      )
      expect(result.newlyAwarded.map((m) => m.id)).toEqual(GEM_MILESTONES.map((m) => m.id))
      expect(result.gems).toBe(GEM_MILESTONES.reduce((sum, m) => sum + m.gems, 0))
    })

    test("a missing metric key counts as 0", () => {
      const result = scoringOnDay().checkMilestones({ sessionsCompleted: 99 }, [])
      expect(result.newlyAwarded).toEqual([])
      expect(result.gems).toBe(0)
    })

    test("gems are never negative, even for junk metrics", () => {
      const scoring = scoringOnDay()
      for (const junk of [null, undefined, 42, "x", { factsCorrect: -50 }, { factsCorrect: NaN }]) {
        const result = scoring.checkMilestones(junk, [])
        expect(result.gems).toBeGreaterThanOrEqual(0)
      }
    })

    test("tolerates a junk awardedIds argument", () => {
      const scoring = scoringOnDay()
      for (const junk of [null, undefined, "facts-10", 42]) {
        const result = scoring.checkMilestones({ factsCorrect: 12 }, junk)
        expect(result.newlyAwarded.map((m) => m.id)).toEqual(["facts-10"])
      }
    })

    test("every milestone metric is a MilestoneMetrics field", () => {
      for (const milestone of GEM_MILESTONES) {
        expect(METRIC_NAMES).toContain(milestone.metric)
      }
    })

    test("a streakDays metric feeds the streak-3 milestone", () => {
      const result = scoringOnDay().checkMilestones({ streakDays: 3 }, [])
      expect(result.newlyAwarded.map((m) => m.id)).toEqual(["streak-3"])
      expect(result.gems).toBe(1)
    })

    test("a starsTotal metric feeds the stars-1000 milestone", () => {
      const result = scoringOnDay().checkMilestones({ starsTotal: 1000 }, [])
      expect(result.newlyAwarded.map((m) => m.id)).toEqual(["stars-1000"])
      expect(result.gems).toBe(2)
    })
  })

  describe("normalizeDaily", () => {
    test("null deep-equals a fresh daily", () => {
      expect(Scoring.normalizeDaily(null)).toEqual(Scoring.createDaily())
    })

    test.each([[undefined], [42], ["x"], [[]], [true]])("junk input %p yields defaults", (junk) => {
      expect(Scoring.normalizeDaily(junk)).toEqual(Scoring.createDaily())
    })

    test("a negative counter becomes 0", () => {
      expect(Scoring.normalizeDaily({ streakDays: -4 }).streakDays).toBe(0)
      expect(Scoring.normalizeDaily({ factsToday: -1 }).factsToday).toBe(0)
    })

    test("a fractional counter is floored", () => {
      expect(Scoring.normalizeDaily({ factsToday: 3.9 }).factsToday).toBe(3)
    })

    test("a non-string date key becomes null", () => {
      expect(Scoring.normalizeDaily({ todayDate: 20260101 }).todayDate).toBeNull()
      expect(Scoring.normalizeDaily({ todayDate: "2026-1-1" }).todayDate).toBeNull()
      expect(Scoring.normalizeDaily({ lastGoalDate: "yesterday" }).lastGoalDate).toBeNull()
    })

    test("a well-formed date key survives", () => {
      const normalized = Scoring.normalizeDaily({
        todayDate: "2026-01-05",
        lastGoalDate: "2025-12-31",
      })
      expect(normalized.todayDate).toBe("2026-01-05")
      expect(normalized.lastGoalDate).toBe("2025-12-31")
    })

    test("a truthy non-boolean flag becomes false", () => {
      expect(Scoring.normalizeDaily({ goalMetToday: "yes" }).goalMetToday).toBe(false)
      expect(Scoring.normalizeDaily({ flameDimmed: 1 }).flameDimmed).toBe(false)
      expect(Scoring.normalizeDaily({ goalMetToday: true }).goalMetToday).toBe(true)
    })

    test("bestStreakDays is lifted to at least streakDays", () => {
      expect(Scoring.normalizeDaily({ streakDays: 9, bestStreakDays: 2 }).bestStreakDays).toBe(9)
      expect(Scoring.normalizeDaily({ streakDays: 2, bestStreakDays: 9 }).bestStreakDays).toBe(9)
    })

    test("a non-finite counter becomes 0", () => {
      expect(Scoring.normalizeDaily({ streakDays: NaN }).streakDays).toBe(0)
      expect(Scoring.normalizeDaily({ factsToday: Infinity }).factsToday).toBe(0)
      expect(Scoring.normalizeDaily({ factsToday: "12" }).factsToday).toBe(0)
    })

    test("drops a legacy secondsToday key and keeps the rest", () => {
      const normalized = Scoring.normalizeDaily({ secondsToday: 400, factsToday: 3 })
      expect(normalized.factsToday).toBe(3)
      expect("secondsToday" in normalized).toBe(false)
    })

    test("drops unknown keys", () => {
      const normalized = Scoring.normalizeDaily({ foo: 1, factsToday: 2 })
      expect("foo" in normalized).toBe(false)
    })

    test("returns exactly the seven documented keys for every input", () => {
      const inputs = [
        null,
        {},
        { secondsToday: 5 },
        { factsToday: 20, goalMetToday: true },
        Scoring.createDaily(),
      ]
      for (const input of inputs) {
        expect(Object.keys(Scoring.normalizeDaily(input)).sort()).toEqual([...DAILY_KEYS].sort())
      }
    })

    test("never mutates or returns its input", () => {
      const raw = { factsToday: 5, streakDays: 2, secondsToday: 90 }
      const before = clone(raw)
      const normalized = Scoring.normalizeDaily(raw)
      expect(raw).toEqual(before)
      expect(normalized).not.toBe(raw)
    })

    test("round-trips a valid record unchanged", () => {
      const daily = {
        todayDate: "2026-01-05",
        factsToday: 12,
        goalMetToday: false,
        lastGoalDate: "2026-01-04",
        streakDays: 3,
        bestStreakDays: 8,
        flameDimmed: true,
      }
      expect(Scoring.normalizeDaily(daily)).toEqual(daily)
    })
  })
})
