/**
 * Journey: one themed trail, and a token that moves one space per correct answer.
 *
 * What these tests are mostly for is the property the "simple trails" change was
 * made to get: nothing stops the token. A new player with no strong fact moves on
 * the first correct answer, and every trail can be walked to its last space.
 */

import { describe, test, expect } from "@jest/globals"
import { allTrailProgress, Journey, normalizeTrailId, trailIds } from "../js/Journey.js"
import { factIdsForTrail } from "../js/facts.js"
import { DAY_MS, DEFAULT_TRAIL_ID, STRENGTH, TRAIL, TRAILS } from "../js/constants.js"

/** A fixed instant, so nothing in these tests depends on the wall clock. */
const NOW = Date.UTC(2026, 5, 1)

/** The injected clock every Journey in this file uses. */
const fixedNow = () => NOW

/** Trail ids in hub order, for readable expectations. */
const TRAIL_IDS = TRAILS.map((trail) => trail.id)

/**
 * Records at a given strength that will not decay during the test.
 * @param {string[]} factIds - Facts to give a record
 * @param {number} strength - Their stored strength
 * @returns {Object} A records map
 */
function recordsAt(factIds, strength) {
  const records = {}
  for (const id of factIds) {
    records[id] = {
      strength,
      totalSeen: 4,
      totalCorrect: 4,
      lastSeen: NOW - DAY_MS,
      lastMs: 1200,
      dueAt: NOW + 365 * DAY_MS,
    }
  }
  return records
}

/**
 * Records stored at strength 5 but overdue by `days`, so decay has eaten into
 * them: one point per full 14-day period.
 * @param {string[]} factIds - Facts to decay
 * @param {number} days - How overdue they are
 * @returns {Object} A records map
 */
function decayedRecords(factIds, days) {
  const records = recordsAt(factIds, 5)
  for (const id of factIds) {
    records[id].lastSeen = NOW - (days + 1) * DAY_MS
    records[id].dueAt = NOW - days * DAY_MS
  }
  return records
}

/** A journey over one trail. */
function journeyFor(trailId) {
  return new Journey({ trailId, now: fixedNow })
}

describe("trailIds", () => {
  test("lists every trail in hub order", () => {
    expect(trailIds()).toEqual(TRAIL_IDS)
  })

  test("returns a new array each call", () => {
    expect(trailIds()).not.toBe(trailIds())
  })
})

describe("normalizeTrailId", () => {
  test("keeps a known id", () => {
    for (const id of TRAIL_IDS) expect(normalizeTrailId(id)).toBe(id)
  })

  test.each([
    ["an old region id", "dragon-peak"],
    ["an empty string", ""],
    ["a number", 3],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
  ])("falls back to the default for %s", (_label, input) => {
    expect(normalizeTrailId(input)).toBe(DEFAULT_TRAIL_ID)
  })
})

describe("construction", () => {
  test("defaults to the default trail", () => {
    expect(new Journey({ now: fixedNow }).trailId).toBe(DEFAULT_TRAIL_ID)
  })

  test.each([
    ["no options", undefined],
    ["a non-object", 7],
    ["null", null],
  ])("survives %s", (_label, options) => {
    expect(() => new Journey(options)).not.toThrow()
  })

  test("an unknown trail id falls back rather than throwing", () => {
    expect(new Journey({ trailId: "dragon-peak" }).trailId).toBe(DEFAULT_TRAIL_ID)
  })
})

describe("the trail's own facts", () => {
  test("`factIds` is all of the trail's facts, whatever else is going on", () => {
    for (const id of TRAIL_IDS) {
      expect(journeyFor(id).factIds).toEqual(factIdsForTrail(id))
    }
  })

  test("`factIds` hands back a copy", () => {
    const journey = journeyFor("nines")
    journey.factIds.push("nonsense")
    expect(journey.factIds).not.toContain("nonsense")
  })
})

describe("progress", () => {
  test("counts nothing before anything is practiced", () => {
    expect(journeyFor("doubles").progress({})).toEqual({
      trailId: "doubles",
      total: 8,
      strong: 0,
      totalSpaces: TRAIL.SPACES,
      space: 0,
      complete: false,
    })
  })

  test("`strong` counts facts at the strengthening bar or better", () => {
    const ids = factIdsForTrail("squares")
    const records = {
      ...recordsAt(ids.slice(0, 3), STRENGTH.STRENGTHENING),
      ...recordsAt(ids.slice(3, 5), STRENGTH.MASTERED_MIN),
      ...recordsAt(ids.slice(5), STRENGTH.WEAK_MAX),
    }
    expect(journeyFor("squares").progress(records).strong).toBe(5)
  })

  test("decay can take a fact back below the bar", () => {
    const ids = factIdsForTrail("doubles")
    const journey = journeyFor("doubles")
    expect(journey.progress(recordsAt(ids, 5)).strong).toBe(8)
    // 5 - floor(60/14) = 1, which is under the strengthening bar.
    expect(journey.progress(decayedRecords(ids, 60)).strong).toBe(0)
  })

  test("never throws for a junk records argument", () => {
    for (const records of [null, undefined, "records", 7, []]) {
      expect(() => journeyFor("doubles").progress(records)).not.toThrow()
    }
  })

  test("reports the token's space, and a junk position as the start", () => {
    const journey = journeyFor("fives")
    expect(journey.progress({}, { space: 6 }).space).toBe(6)
    for (const trail of [null, undefined, "far", 7, [], { space: NaN }]) {
      expect(journey.progress({}, trail).space).toBe(0)
    }
  })

  test("`complete` means the token is on the last space, whatever the strength", () => {
    const journey = journeyFor("fives")
    expect(journey.progress({}, { space: TRAIL.SPACES - 2 }).complete).toBe(false)
    expect(journey.progress({}, { space: TRAIL.SPACES - 1 }).complete).toBe(true)
  })
})

describe("createTrail and normalizeTrail", () => {
  test("a fresh trail starts at space 0 and is a new object", () => {
    expect(Journey.createTrail()).toEqual({ space: 0 })
    expect(Journey.createTrail()).not.toBe(Journey.createTrail())
  })

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a number", 7],
    ["a string", "space"],
    ["an array", []],
    ["a missing space", {}],
    ["a NaN space", { space: NaN }],
    ["an Infinite space", { space: Infinity }],
  ])("reads %s as the start of the trail", (_label, raw) => {
    expect(Journey.normalizeTrail(raw)).toEqual({ space: 0 })
  })

  test("floors, and clamps to the first and last space", () => {
    expect(Journey.normalizeTrail({ space: 3.9 })).toEqual({ space: 3 })
    expect(Journey.normalizeTrail({ space: -4 })).toEqual({ space: 0 })
    expect(Journey.normalizeTrail({ space: 1e9 })).toEqual({ space: TRAIL.SPACES - 1 })
  })

  test("drops extra keys rather than carrying them", () => {
    expect(Journey.normalizeTrail({ space: 4, lapsCompleted: 2 })).toEqual({ space: 4 })
  })
})

describe("advance", () => {
  test("moves the token exactly one space", () => {
    const result = journeyFor("doubles").advance({ space: 0 })
    expect(result).toEqual({ trail: { space: 1 }, finished: false })
  })

  test("returns a NEW trail and never touches the one it was given", () => {
    const input = { space: 1 }
    const result = journeyFor("doubles").advance(input)
    expect(result.trail).not.toBe(input)
    expect(input).toEqual({ space: 1 })
  })

  // The owner's complaint was a token that stopped after a few answers. With no
  // strong fact anywhere, every answer still moves it, all the way to the end.
  test("every step from the start to the last space moves the token, with no strong fact", () => {
    const journey = journeyFor("squares")
    let trail = Journey.createTrail()
    for (let step = 1; step < TRAIL.SPACES; step += 1) {
      const result = journey.advance(trail)
      expect(result.trail.space).toBe(step)
      expect(result.finished).toBe(step === TRAIL.SPACES - 1)
      trail = result.trail
    }
    expect(trail.space).toBe(TRAIL.SPACES - 1)
  })

  test("every trail can be walked to its last space", () => {
    for (const id of TRAIL_IDS) {
      let trail = Journey.createTrail()
      for (let step = 0; step < TRAIL.SPACES - 1; step += 1) {
        trail = journeyFor(id).advance(trail).trail
      }
      expect(trail.space).toBe(TRAIL.SPACES - 1)
    }
  })

  test("reports finishing exactly once, then stays on the last space", () => {
    const journey = journeyFor("doubles")
    const arriving = journey.advance({ space: TRAIL.SPACES - 2 })
    expect(arriving.finished).toBe(true)
    const again = journey.advance(arriving.trail)
    expect(again).toEqual({ trail: { space: TRAIL.SPACES - 1 }, finished: false })
  })

  test("a position past the end is brought back to the last space", () => {
    const result = journeyFor("doubles").advance({ space: 999 })
    expect(result).toEqual({ trail: { space: TRAIL.SPACES - 1 }, finished: false })
  })

  test("never throws for a junk trail argument", () => {
    for (const trail of [null, undefined, "far", 7, [], { space: NaN }]) {
      expect(() => journeyFor("doubles").advance(trail)).not.toThrow()
    }
  })
})

describe("allTrailProgress", () => {
  test("reports every trail, in hub order", () => {
    const statuses = allTrailProgress({ now: fixedNow })
    expect(statuses.map((status) => status.trailId)).toEqual(TRAIL_IDS)
  })

  test("agrees with a Journey built for the same trail", () => {
    const records = recordsAt(["2x2", "2x3", "5x5"], 5)
    const spaces = { squares: 7 }
    const statuses = allTrailProgress({ now: fixedNow, records, spaces })
    for (const status of statuses) {
      expect(status).toEqual(
        journeyFor(status.trailId).progress(records, { space: spaces[status.trailId] }),
      )
    }
  })

  test("each trail reads its own token position", () => {
    const statuses = allTrailProgress({
      now: fixedNow,
      spaces: { doubles: 3, tough: TRAIL.SPACES - 1 },
    })
    const byId = Object.fromEntries(statuses.map((status) => [status.trailId, status]))
    expect(byId.doubles.space).toBe(3)
    expect(byId.tough.complete).toBe(true)
    expect(byId.squares.space).toBe(0)
  })

  test("survives being called with nothing at all", () => {
    expect(() => allTrailProgress()).not.toThrow()
    expect(allTrailProgress()).toHaveLength(TRAILS.length)
  })
})
